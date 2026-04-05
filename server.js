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

// --- 基础安全与解析 ---
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- 数据库配置 (针对 Render 稳定性优化) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, 
  connectionTimeoutMillis: 20000,
  max: 10,
});

// --- 核心品牌与安全常量 ---
const JWT_SECRET = process.env.JWT_SECRET || 'mba-quantum-key-2026';
const CURRENCY_NAME = "MBA2509007 COIN";
const CURRENCY_UNIT = "COIN";
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const ADMIN_PIN = process.env.ADMIN_PIN || '888888';
const ADMIN_BALANCE = process.env.ADMIN_BALANCE || '1000000';

const schemas = {
  name: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9._-]+$/),
  pin: z.string().trim().regex(/^\d{6}$/),
  amount: z.string().trim().regex(/^\d+$/).refine(v => BigInt(v) > 0n),
};

// --- 工具函数 ---
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatAmount(v) { return String(v ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + " " + CURRENCY_UNIT; }

async function migrateAndSeed() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, pin_hash TEXT NOT NULL, balance NUMERIC(20,0) NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT NOT NULL, receiver TEXT NOT NULL, amount NUMERIC(20,0) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
    `);
    const adminPinHash = await bcrypt.hash(ADMIN_PIN, 12);
    await client.query(`
      INSERT INTO users (name, pin_hash, balance) VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, balance = GREATEST(users.balance, EXCLUDED.balance);
    `, [ADMIN_NAME, adminPinHash, ADMIN_BALANCE]);
    console.log('SYSTEM_READY_BRAND_COIN');
  } finally { client.release(); }
}

// --- 认证 ---
function authFromCookie(req, res, next) {
  const token = req.cookies.token;
  if (!token) { req.user = null; return next(); }
  try { req.user = jwt.verify(token, JWT_SECRET); } catch { req.user = null; }
  next();
}

// --- UI 渲染引擎 (包含量子地球) ---
function renderPage({ user, balance, logsHtml }) {
  const loggedIn = !!user;
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${CURRENCY_NAME} | LEDGER</title>
  <style>
    :root { --gold: #f0b90b; --bg: #030406; --panel: rgba(13, 16, 22, 0.82); --border: rgba(240,185,11,0.25); --text: #E0E2E5; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; margin: 0; overflow: hidden; height: 100vh; }
    #globe-canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; }
    .sidebar { 
      position: absolute; left: 40px; top: 50%; transform: translateY(-50%); 
      width: 400px; max-height: 90vh; overflow-y: auto;
      background: var(--panel); border: 1px solid var(--border); 
      padding: 35px; border-radius: 28px; backdrop-filter: blur(25px); 
      z-index: 10; box-shadow: 0 20px 60px rgba(0,0,0,0.6); scrollbar-width: none;
    }
    .header-info { position: fixed; top: 30px; left: 40px; z-index: 100; font-size: 11px; letter-spacing: 5px; color: var(--gold); font-weight: 800; text-transform: uppercase; }
    .card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; padding: 22px; margin-bottom: 20px; }
    h3 { font-size: 13px; color: var(--gold); margin: 0 0 18px; letter-spacing: 3px; text-transform: uppercase; }
    input { width: 100%; padding: 14px; background: rgba(0,0,0,0.4); border: 1px solid #2a2a2a; color: #fff; border-radius: 10px; margin-bottom: 12px; outline: none; transition: 0.3s; font-family: monospace; }
    input:focus { border-color: var(--gold); background: rgba(0,0,0,0.6); }
    .btn { width: 100%; padding: 16px; border-radius: 10px; border: none; cursor: pointer; font-weight: 800; text-transform: uppercase; transition: 0.3s; letter-spacing: 1px; }
    .btn-gold { background: var(--gold); color: #000; box-shadow: 0 4px 15px rgba(240,185,11,0.2); }
    .btn-gold:hover { background: #fff; transform: translateY(-2px); }
    .balance-display { font-size: 36px; font-weight: 900; color: #fff; margin: 12px 0; letter-spacing: -1px; }
    .log-item { font-size: 11px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); color: #999; display: flex; justify-content: space-between; align-items: center; }
    .log-item b { color: var(--gold); }
  </style>
</head>
<body>
  <div class="header-info">${CURRENCY_NAME} // NODE_ACTIVE</div>
  <canvas id="globe-canvas"></canvas>
  <div class="sidebar">
    <div class="card">
      <h3>Vault Status</h3>
      <div style="font-size: 10px; color: #555;">ID: ${loggedIn ? escapeHtml(user.name) : 'GUEST_MODE'}</div>
      <div class="balance-display">${loggedIn ? formatAmount(balance) : '---'}</div>
      ${loggedIn ? '<button class="btn" style="background:#1a1a1a; color:#888; font-size:10px; margin-top:10px;" onclick="logout()">TERMINATE SESSION</button>' : ''}
    </div>
    ${!loggedIn ? `
    <div class="card">
      <h3>Access Terminal</h3>
      <input id="loginName" placeholder="USER ID (Admin)">
      <input id="loginPin" type="password" placeholder="6-DIGIT PIN (888888)">
      <button class="btn btn-gold" onclick="login()">AUTHORIZE ACCESS</button>
    </div>` : `
    <div class="card">
      <h3>Transfer Assets</h3>
      <input id="toName" placeholder="RECEIVER ID">
      <input id="amount" placeholder="COIN AMOUNT" type="number">
      <input id="transferPin" type="password" placeholder="VERIFY PIN">
      <button class="btn btn-gold" onclick="transfer()">EXECUTE SHIPMENT</button>
    </div>`}
    <div class="card">
      <h3>Network Ledger</h3>
      <div id="logList" style="max-height:200px; overflow-y:auto;">${logsHtml || '<div style="color:#333">Awaiting blocks...</div>'}</div>
    </div>
  </div>

  <script>
    const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
    let w, h, pts=[], startTime=Date.now();
    function init(){
      w=c.width=window.innerWidth; h=c.height=window.innerHeight; pts=[];
      for(let i=0; i<450; i++){
        let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1);
        pts.push({ tx: Math.sin(a)*Math.cos(t), ty: Math.sin(a)*Math.sin(t), tz: Math.cos(a), sx: (Math.random()-0.5)*20, sy: (Math.random()-0.5)*20, sz: (Math.random()-0.5)*20 });
      }
    }
    let rot=0;
    function draw(){
      x.fillStyle='#030406'; x.fillRect(0,0,w,h);
      let pgr = Math.min((Date.now()-startTime)/2000, 1), ease = 1 - Math.pow(2, -10 * pgr); rot += 0.0025;
      x.save(); x.translate(w/2, h/2);
      let active = pts.map(p => {
        let cx=p.sx+(p.tx-p.sx)*ease, cy=p.sy+(p.ty-p.sy)*ease, cz=p.sz+(p.tz-p.sz)*ease;
        let x1=cx*Math.cos(rot)-cz*Math.sin(rot), z1=cz*Math.cos(rot)+cx*Math.sin(rot);
        let s = Math.min(w, h) * 0.4; return { x: x1*s, y: cy*s, z: z1 };
      });
      for(let i=0; i<active.length; i++){
        if(active[i].z < -0.2) continue;
        for(let j=i+1; j<active.length; j++){
          let d = Math.hypot(active[i].x-active[j].x, active[i].y-active[j].y);
          if(d < 70){
            x.strokeStyle = \`rgba(240,185,11,\${(1-d/70)*0.15*pgr})\`;
            x.beginPath(); x.moveTo(active[i].x, active[i].y); x.lineTo(active[j].x, active[j].y); x.stroke();
          }
        }
      }
      active.forEach(p => {
        x.fillStyle = \`rgba(240,185,11,\${(p.z+1)*0.4*pgr})\`;
        x.beginPath(); x.arc(p.x, p.y, 1.5*(p.z+1.2), 0, 7); x.fill();
      });
      x.restore(); requestAnimationFrame(draw);
    }
    window.onresize=init; init(); draw();

    async function login(){
      try {
        const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: document.getElementById('loginName').value, pin: document.getElementById('loginPin').value })});
        if(!res.ok) throw new Error('AUTH_FAILED');
        location.reload();
      } catch(e) { alert(e.message); }
    }
    async function transfer(){
      try {
        const res = await fetch('/api/transfer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ receiver: document.getElementById('toName').value, amount: document.getElementById('amount').value, pin: document.getElementById('transferPin').value })});
        if(!res.ok) { const d = await res.json(); throw new Error(d.error); }
        location.reload();
      } catch(e) { alert(e.message); }
    }
    async function logout(){ await fetch('/api/logout', { method: 'POST' }); location.reload(); }
  </script>
</body>
</html>`;
}

// --- 路由 ---
app.use(authFromCookie);
app.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const logs = await client.query('SELECT sender, receiver, amount FROM logs ORDER BY created_at DESC LIMIT 10');
    const logsHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b>+${formatAmount(l.amount)}</b></div>`).join('');
    let user = null, balance = '0';
    if (req.user) {
      const me = await client.query('SELECT name, balance FROM users WHERE name = $1', [req.user.name]);
      if (me.rowCount) { user = { name: me.rows[0].name }; balance = me.rows[0].balance; }
    }
    res.send(renderPage({ user, balance, logsHtml }));
  } finally { client.release(); }
});

app.post('/api/login', async (req, res) => {
  const { name, pin } = req.body;
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM users WHERE name = $1', [name]);
    if (!r.rowCount || !(await bcrypt.compare(pin, r.rows[0].pin_hash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    const token = jwt.sign({ name }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'lax' }).json({ ok: true });
  } finally { client.release(); }
});

app.post('/api/transfer', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const { receiver, amount, pin } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sender = (await client.query('SELECT * FROM users WHERE name = $1 FOR UPDATE', [req.user.name])).rows[0];
    if (!(await bcrypt.compare(pin, sender.pin_hash))) throw new Error('PIN_VERIFICATION_FAILED');
    if (BigInt(sender.balance) < BigInt(amount)) throw new Error('INSUFFICIENT_COIN');
    await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2', [amount, req.user.name]);
    await client.query('INSERT INTO users (name, balance, pin_hash) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET balance = users.balance + EXCLUDED.balance', [receiver, amount, await bcrypt.hash('000000', 10)]);
    await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [req.user.name, receiver, amount]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/logout', (req, res) => res.clearCookie('token').json({ ok: true }));

async function start() { 
  try { await migrateAndSeed(); app.listen(port, () => console.log(`NODE_ONLINE_${port}`)); } 
  catch(e) { console.error(e); process.exit(1); }
}
start();
