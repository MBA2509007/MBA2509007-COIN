// server.js
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { z } = require('zod');

const app = express();
const port = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false, // 这里为了让内联页面脚本正常工作
}));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' || isProd
    ? { rejectUnauthorized: false }
    : undefined,
  connectionTimeoutMillis: 15000,
  max: 10,
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const ADMIN_PIN = process.env.ADMIN_PIN || '888888';
const ADMIN_BALANCE = process.env.ADMIN_BALANCE || '1000000';

const schemas = {
  name: z.string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .max(32, 'Name too long')
    .regex(/^[A-Za-z0-9._-]+$/, 'Only letters, numbers, dot, underscore, dash allowed'),
  pin: z.string()
    .trim()
    .regex(/^\d{6}$/, 'PIN must be exactly 6 digits'),
  amount: z.string()
    .trim()
    .regex(/^\d+$/, 'Amount must be a positive integer')
    .refine(v => BigInt(v) > 0n, 'Amount must be greater than 0')
    .refine(v => BigInt(v) <= 10_000_000_000_000_000n, 'Amount too large'),
};

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatAmount(v) {
  const s = String(v ?? '0');
  const neg = s.startsWith('-');
  const raw = neg ? s.slice(1) : s;
  const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return neg ? `-${formatted}` : formatted;
}

async function migrateAndSeed() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        name TEXT PRIMARY KEY,
        pin_hash TEXT NOT NULL,
        balance NUMERIC(20,0) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        amount NUMERIC(20,0) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const adminPinHash = await bcrypt.hash(ADMIN_PIN, 12);
    const exists = await client.query('SELECT name FROM users WHERE name = $1', [ADMIN_NAME]);

    if (exists.rowCount === 0) {
      await client.query(
        'INSERT INTO users (name, pin_hash, balance) VALUES ($1, $2, $3)',
        [ADMIN_NAME, adminPinHash, ADMIN_BALANCE]
      );
    } else {
      await client.query(
        'UPDATE users SET balance = GREATEST(balance, $1) WHERE name = $2',
        [ADMIN_BALANCE, ADMIN_NAME]
      );
    }

    console.log('Database ready.');
  } finally {
    client.release();
  }
}

function signToken(name) {
  return jwt.sign({ name }, JWT_SECRET, { expiresIn: '7d' });
}

function authFromCookie(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { name: payload.name };
  } catch {
    req.user = null;
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

async function getUserByName(client, name) {
  const r = await client.query(
    'SELECT name, pin_hash, balance FROM users WHERE name = $1',
    [name]
  );
  return r.rowCount ? r.rows[0] : null;
}

function renderPage({ user, balance, logsHtml }) {
  const loggedIn = !!user;
  const safeName = loggedIn ? escapeHtml(user.name) : '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEURAL LEDGER</title>
  <style>
    :root{
      --bg:#050608;
      --panel:rgba(12,14,18,.88);
      --panel2:rgba(18,20,26,.92);
      --line:#1c2028;
      --gold:#f0b90b;
      --text:#e7e9ee;
      --muted:#8b93a7;
      --danger:#ff6b6b;
      --ok:#33d69f;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      min-height:100vh;
      background:
        radial-gradient(circle at top, rgba(240,185,11,.12), transparent 30%),
        radial-gradient(circle at 20% 20%, rgba(51,214,159,.07), transparent 25%),
        linear-gradient(180deg, #040507 0%, #08090c 100%);
      color:var(--text);
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .topbar{
      position:sticky; top:0; z-index:20;
      display:flex; align-items:center; justify-content:space-between;
      padding:18px 22px;
      background:rgba(3,4,6,.72);
      backdrop-filter: blur(16px);
      border-bottom:1px solid rgba(255,255,255,.05);
    }
    .brand{
      display:flex; align-items:center; gap:12px;
      font-weight:800; letter-spacing:.18em; text-transform:uppercase;
      color:#fff;
    }
    .brand-badge{
      width:38px; height:38px; border-radius:12px;
      background:linear-gradient(135deg, rgba(240,185,11,1), rgba(255,223,112,1));
      box-shadow:0 10px 30px rgba(240,185,11,.25);
    }
    .top-right{
      display:flex; align-items:center; gap:10px; flex-wrap:wrap;
    }
    .pill{
      padding:10px 14px; border:1px solid rgba(255,255,255,.06);
      background:rgba(255,255,255,.03); border-radius:999px;
      color:var(--muted); font-size:13px;
    }
    .pill strong{ color:var(--gold); }
    .btn{
      border:0; border-radius:12px; padding:12px 16px;
      font-weight:700; cursor:pointer; transition:.18s ease;
    }
    .btn:hover{ transform: translateY(-1px); }
    .btn-gold{
      background:linear-gradient(135deg, #f0b90b, #ffd95e);
      color:#101114;
    }
    .btn-dark{
      background:#161922;
      color:var(--text);
      border:1px solid var(--line);
    }
    .wrap{
      max-width:1280px;
      margin:0 auto;
      padding:24px;
      display:grid;
      grid-template-columns: 1.3fr .9fr;
      gap:18px;
    }
    .hero,.panel,.logs{
      border:1px solid rgba(255,255,255,.06);
      background:linear-gradient(180deg, var(--panel), rgba(8,10,13,.94));
      box-shadow:0 24px 80px rgba(0,0,0,.35);
      border-radius:24px;
      overflow:hidden;
    }
    .hero{
      min-height:620px;
      position:relative;
      padding:28px;
    }
    .hero:before{
      content:"";
      position:absolute; inset:-2px;
      background:
        radial-gradient(circle at 20% 20%, rgba(240,185,11,.16), transparent 18%),
        radial-gradient(circle at 80% 30%, rgba(240,185,11,.07), transparent 20%),
        radial-gradient(circle at 50% 70%, rgba(255,255,255,.04), transparent 22%);
      pointer-events:none;
    }
    .hero-inner{ position:relative; z-index:1; }
    .eyebrow{
      display:inline-flex; align-items:center; gap:8px;
      color:var(--gold); font-size:12px; letter-spacing:.25em; text-transform:uppercase;
      margin-bottom:16px;
    }
    .title{
      font-size: clamp(30px, 6vw, 58px);
      line-height:1.02;
      margin:0 0 14px;
      letter-spacing:-.04em;
    }
    .subtitle{
      max-width:680px;
      color:var(--muted);
      font-size:16px;
      line-height:1.7;
      margin:0 0 26px;
    }
    .stats{
      display:grid;
      grid-template-columns: repeat(3, minmax(0,1fr));
      gap:12px;
      margin-bottom:18px;
    }
    .stat{
      background:rgba(255,255,255,.03);
      border:1px solid rgba(255,255,255,.05);
      border-radius:18px;
      padding:18px;
    }
    .stat .label{
      color:var(--muted);
      font-size:12px;
      letter-spacing:.15em;
      text-transform:uppercase;
      margin-bottom:8px;
    }
    .stat .value{
      font-size:22px;
      font-weight:800;
      color:#fff;
    }
    .grid2{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:18px;
      margin-top:18px;
    }
    .card{
      background:var(--panel2);
      border:1px solid rgba(255,255,255,.06);
      border-radius:22px;
      padding:20px;
    }
    .card h3{
      margin:0 0 14px;
      font-size:16px;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .field{
      margin-bottom:12px;
    }
    .field label{
      display:block;
      font-size:12px;
      color:var(--muted);
      margin-bottom:8px;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    .field input{
      width:100%;
      padding:13px 14px;
      background:#090b0f;
      border:1px solid var(--line);
      border-radius:14px;
      color:var(--text);
      outline:none;
    }
    .field input:focus{
      border-color:rgba(240,185,11,.6);
      box-shadow:0 0 0 4px rgba(240,185,11,.08);
    }
    .row{
      display:flex; gap:10px; flex-wrap:wrap;
    }
    .row .btn{ flex:1; min-width:120px; }
    .msg{
      margin-top:12px;
      font-size:13px;
      color:var(--muted);
      min-height:18px;
    }
    .msg.error{ color:var(--danger); }
    .msg.ok{ color:var(--ok); }
    .logs{
      padding:22px;
    }
    .logs h3{
      margin:0 0 14px;
      font-size:16px;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .log-list{
      display:flex;
      flex-direction:column;
      gap:10px;
      max-height: 520px;
      overflow:auto;
      padding-right:4px;
    }
    .log-item{
      padding:14px 15px;
      border:1px solid rgba(255,255,255,.05);
      border-radius:16px;
      background:rgba(255,255,255,.03);
      display:flex;
      justify-content:space-between;
      gap:10px;
      align-items:center;
      font-size:13px;
    }
    .muted{ color:var(--muted); }
    .amount{ color:var(--gold); font-weight:800; }
    .big-balance{
      font-size: 52px;
      font-weight: 900;
      letter-spacing: -0.05em;
      margin: 8px 0 6px;
      color:#fff;
    }
    .small-note{
      color:var(--muted);
      font-size:13px;
      line-height:1.7;
    }
    @media (max-width: 1024px){
      .wrap{ grid-template-columns:1fr; }
      .hero{ min-height:auto; }
    }
    @media (max-width: 640px){
      .stats{ grid-template-columns:1fr; }
      .grid2{ grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <div class="brand-badge"></div>
      <div>NEURAL LEDGER</div>
    </div>
    <div class="top-right">
      <div class="pill">Status: <strong id="authState">${loggedIn ? 'ONLINE' : 'GUEST'}</strong></div>
      ${loggedIn ? `<div class="pill">User: <strong>${safeName}</strong></div>` : ''}
      <button class="btn btn-dark" onclick="refreshMe()">Refresh</button>
      ${loggedIn ? `<button class="btn btn-dark" onclick="logout()">Logout</button>` : ''}
    </div>
  </div>

  <div class="wrap">
    <section class="hero">
      <div class="hero-inner">
        <div class="eyebrow">SECURE WALLET • LEDGER • TRANSFER</div>
        <h1 class="title">A cleaner, safer version of your crypto-style ledger.</h1>
        <p class="subtitle">
          This version uses hashed PINs, authenticated sessions, validation, rate limiting, and database transactions.
          It is much closer to something you can deploy without obvious security holes.
        </p>

        <div class="stats">
          <div class="stat">
            <div class="label">Your balance</div>
            <div class="value" id="balanceValue">${loggedIn ? formatAmount(balance) : '—'}</div>
          </div>
          <div class="stat">
            <div class="label">Account</div>
            <div class="value">${loggedIn ? safeName : 'Not logged in'}</div>
          </div>
          <div class="stat">
            <div class="label">System</div>
            <div class="value">Online</div>
          </div>
        </div>

        <div class="grid2">
          <div class="card">
            <h3>Login</h3>
            <div class="field">
              <label>Username</label>
              <input id="loginName" placeholder="Admin" value="${loggedIn ? safeName : ''}" />
            </div>
            <div class="field">
              <label>6-digit PIN</label>
              <input id="loginPin" type="password" placeholder="888888" />
            </div>
            <div class="row">
              <button class="btn btn-gold" onclick="login()">Login</button>
            </div>
            <div id="loginMsg" class="msg"></div>
          </div>

          <div class="card">
            <h3>Register</h3>
            <div class="field">
              <label>New username</label>
              <input id="regName" placeholder="alice_01" />
            </div>
            <div class="field">
              <label>6-digit PIN</label>
              <input id="regPin" type="password" placeholder="123456" />
            </div>
            <div class="row">
              <button class="btn btn-dark" onclick="registerAccount()">Create account</button>
            </div>
            <div id="regMsg" class="msg"></div>
          </div>
        </div>

        <div class="card" style="margin-top:18px;">
          <h3>Transfer</h3>
          <div class="grid2" style="margin-top:0;">
            <div class="field">
              <label>Receiver</label>
              <input id="toName" placeholder="receiver_name" />
            </div>
            <div class="field">
              <label>Amount</label>
              <input id="amount" placeholder="1000" inputmode="numeric" />
            </div>
          </div>
          <div class="field">
            <label>Confirm PIN</label>
            <input id="transferPin" type="password" placeholder="6-digit PIN" />
          </div>
          <div class="row">
            <button class="btn btn-gold" onclick="transfer()">Send</button>
            <button class="btn btn-dark" onclick="loadMe()">Load my balance</button>
          </div>
          <div id="txMsg" class="msg"></div>
          <div class="small-note" style="margin-top:10px;">
            转账现在是 <b>POST + 事务 + PIN 哈希校验</b>，不会再像原版那样直接在 URL 里暴露信息。
          </div>
        </div>
      </div>
    </section>

    <aside class="logs">
      <h3>Recent activity</h3>
      <div class="log-list" id="logList">
        ${logsHtml || '<div class="muted">No activity yet.</div>'}
      </div>
    </aside>
  </div>

  <script>
    const byId = (id) => document.getElementById(id);

    function showMsg(id, text, type = '') {
      const el = byId(id);
      if (!el) return;
      el.className = 'msg ' + (type || '');
      el.textContent = text || '';
    }

    async function request(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body || {}),
      });

      let data = {};
      try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    async function login() {
      showMsg('loginMsg', 'Logging in...');
      try {
        await request('/api/login', {
          name: byId('loginName').value,
          pin: byId('loginPin').value
        });
        showMsg('loginMsg', 'Login success.', 'ok');
        setTimeout(() => location.reload(), 400);
      } catch (e) {
        showMsg('loginMsg', e.message, 'error');
      }
    }

    async function registerAccount() {
      showMsg('regMsg', 'Creating account...');
      try {
        await request('/api/register', {
          name: byId('regName').value,
          pin: byId('regPin').value
        });
        showMsg('regMsg', 'Account created. You can login now.', 'ok');
      } catch (e) {
        showMsg('regMsg', e.message, 'error');
      }
    }

    async function transfer() {
      showMsg('txMsg', 'Processing transfer...');
      try {
        const data = await request('/api/transfer', {
          receiver: byId('toName').value,
          amount: byId('amount').value,
          pin: byId('transferPin').value
        });
        showMsg('txMsg', 'Transfer completed.', 'ok');
        if (data.balance !== undefined) {
          byId('balanceValue').textContent = data.balance;
        }
        await refreshLogs();
      } catch (e) {
        showMsg('txMsg', e.message, 'error');
      }
    }

    async function logout() {
      try {
        await request('/api/logout', {});
      } catch {}
      location.reload();
    }

    async function loadMe() {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        if (data.user) {
          byId('authState').textContent = 'ONLINE';
          byId('balanceValue').textContent = data.user.balance;
          byId('loginName').value = data.user.name;
        }
      } catch (e) {
        showMsg('txMsg', e.message, 'error');
      }
    }

    async function refreshMe() {
      await loadMe();
      await refreshLogs();
    }

    async function refreshLogs() {
      const res = await fetch('/api/logs', { credentials: 'include' });
      const data = await res.json();
      const list = byId('logList');
      if (!list) return;
      if (!res.ok) {
        list.innerHTML = '<div class="muted">Failed to load logs.</div>';
        return;
      }
      if (!data.logs || data.logs.length === 0) {
        list.innerHTML = '<div class="muted">No activity yet.</div>';
        return;
      }
      list.innerHTML = data.logs.map(item => (
        '<div class="log-item">' +
          '<div><b>' + item.sender + '</b> → <b>' + item.receiver + '</b><div class="muted" style="margin-top:4px;">' + item.created_at + '</div></div>' +
          '<div class="amount">+' + item.amount + '</div>' +
        '</div>'
      )).join('');
    }
  </script>
</body>
</html>`;
}

app.use(authFromCookie);

app.get('/health', async (req, res) => {
  res.json({ ok: true, user: req.user?.name || null });
});

app.get('/', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const logs = await client.query(
        'SELECT sender, receiver, amount, created_at FROM logs ORDER BY created_at DESC, id DESC LIMIT 12'
      );

      const logsHtml = logs.rows.length
        ? logs.rows.map(l => `
          <div class="log-item">
            <div>
              <b>${escapeHtml(l.sender)}</b> → <b>${escapeHtml(l.receiver)}</b>
              <div class="muted" style="margin-top:4px;">${escapeHtml(new Date(l.created_at).toLocaleString())}</div>
            </div>
            <div class="amount">${formatAmount(l.amount)}</div>
          </div>
        `).join('')
        : '';

      let user = null;
      let balance = '0';

      if (req.user) {
        const me = await getUserByName(client, req.user.name);
        if (me) {
          user = { name: me.name };
          balance = String(me.balance);
        } else {
          res.clearCookie('token');
        }
      }

      res.type('html').send(renderPage({ user, balance, logsHtml }));
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(500).send('Server error');
  }
});

app.post('/api/register', authLimiter, writeLimiter, async (req, res) => {
  try {
    const name = schemas.name.parse(req.body.name);
    const pin = schemas.pin.parse(req.body.pin);
    const pinHash = await bcrypt.hash(pin, 12);

    const client = await pool.connect();
    try {
      await client.query(
        'INSERT INTO users (name, pin_hash, balance) VALUES ($1, $2, $3)',
        [name, pinHash, '0']
      );
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (e) {
    if (String(e.message || '').includes('duplicate key') || String(e.code) === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return res.status(400).json({ error: e.message || 'Registration failed' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const name = schemas.name.parse(req.body.name);
    const pin = schemas.pin.parse(req.body.pin);

    const client = await pool.connect();
    try {
      const user = await getUserByName(client, name);
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or PIN' });
      }

      const ok = await bcrypt.compare(pin, user.pin_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid username or PIN' });
      }

      const token = signToken(user.name);
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({ ok: true });
    } finally {
      client.release();
    }
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Login failed' });
  }
});

app.post('/api/logout', async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  });
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const client = await pool.connect();
    try {
      const user = await getUserByName(client, req.user.name);
      if (!user) {
        res.clearCookie('token');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.json({
        user: {
          name: user.name,
          balance: String(user.balance),
        },
      });
    } finally {
      client.release();
    }
  } catch {
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const logs = await client.query(
        'SELECT sender, receiver, amount, created_at FROM logs ORDER BY created_at DESC, id DESC LIMIT 12'
      );

      return res.json({
        logs: logs.rows.map(l => ({
          sender: l.sender,
          receiver: l.receiver,
          amount: formatAmount(l.amount),
          created_at: new Date(l.created_at).toLocaleString(),
        })),
      });
    } finally {
      client.release();
    }
  } catch {
    return res.status(500).json({ error: 'Failed to load logs' });
  }
});

app.post('/api/transfer', authLimiter, writeLimiter, requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const receiver = schemas.name.parse(req.body.receiver);
    const amountStr = schemas.amount.parse(req.body.amount);
    const pin = schemas.pin.parse(req.body.pin);
    const amount = BigInt(amountStr);

    await client.query('BEGIN');

    const senderRow = await client.query(
      'SELECT name, pin_hash, balance FROM users WHERE name = $1 FOR UPDATE',
      [req.user.name]
    );
    if (senderRow.rowCount === 0) {
      throw new Error('Sender not found');
    }

    const sender = senderRow.rows[0];
    const pinOk = await bcrypt.compare(pin, sender.pin_hash);
    if (!pinOk) {
      throw new Error('PIN verification failed');
    }

    if (sender.name === receiver) {
      throw new Error('Cannot transfer to yourself');
    }

    const receiverRow = await client.query(
      'SELECT name, balance FROM users WHERE name = $1 FOR UPDATE',
      [receiver]
    );
    if (receiverRow.rowCount === 0) {
      throw new Error('Receiver not found');
    }

    const senderBalance = BigInt(sender.balance);
    if (senderBalance < amount) {
      throw new Error('Insufficient balance');
    }

    await client.query(
      'UPDATE users SET balance = balance - $1 WHERE name = $2',
      [amountStr, sender.name]
    );

    await client.query(
      'UPDATE users SET balance = balance + $1 WHERE name = $2',
      [amountStr, receiver]
    );

    await client.query(
      'INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)',
      [sender.name, receiver, amountStr]
    );

    await client.query('COMMIT');

    const fresh = await client.query(
      'SELECT balance FROM users WHERE name = $1',
      [sender.name]
    );

    return res.json({
      ok: true,
      balance: formatAmount(fresh.rows[0].balance),
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(400).json({ error: e.message || 'Transfer failed' });
  } finally {
    client.release();
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function start() {
  try {
    await migrateAndSeed();
    app.listen(port, () => {
      console.log(`NEURAL_LEDGER_ONLINE_PORT_${port}`);
    });
  } catch (e) {
    console.error('Startup failed:', e);
    process.exit(1);
  }
}

start();
