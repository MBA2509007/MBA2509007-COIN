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

// 基础中间件
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 数据库配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' || isProd ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
  max: 10,
});

const JWT_SECRET = process.env.JWT_SECRET || 'mba-quantum-secure-key-2026';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
const ADMIN_PIN = process.env.ADMIN_PIN || '888888';
const ADMIN_BALANCE = process.env.ADMIN_BALANCE || '1000000';

const schemas = {
  name: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9._-]+$/),
  pin: z.string().trim().regex(/^\d{6}$/),
  amount: z.string().trim().regex(/^\d+$/).refine(v => BigInt(v) > 0n),
};

// 辅助函数
function escapeHtml(str) { return String(str).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function formatAmount(v) { return String(v ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

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
    console.log('DATABASE_AND_ADMIN_READY');
  } finally { client.release(); }
}

// 认证中间件
function authFromCookie(req, res, next) {
  const token = req.cookies.token;
  if (!token) { req.user = null; return next(); }
  try { req.user = jwt.verify(token, JWT_SECRET); } catch { req.user = null; }
  next();
}

function renderPage({ user, balance, logsHtml }) {
  const loggedIn = !!user;
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MBA2509007 | NEURAL LEDGER V21</title>
  <style>
    :root { --gold: #f0b90b; --bg: #000; --panel: rgba(10, 12, 16, 0.75); --border: rgba(240,185,11,0.2); --text: #E0E2E5; }
    body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; overflow: hidden; height: 100vh; }
    
    /* 量子地球 Canvas：全屏置底 */
    #globe-canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; }
    
    /* 侧边栏布局：左侧悬浮 */
    .sidebar { 
      position: absolute; left: 40px; top: 50%; transform: translateY(-50%); 
      width: 380px; max-height: 90vh; overflow-y: auto;
      background: var(--panel); border: 1px solid var(--border); 
      padding: 30px; border-radius: 24px; backdrop-filter: blur(20px); 
      z-index: 10; box-shadow: 0 0 50px rgba(0,0,0,0.8); scrollbar-width: none;
    }
    
    .header-info { position: fixed; top: 30px; left: 40px; z-index: 100; font-size: 12px; letter-spacing: 4px; color: var(--gold); font-weight: 700; text-transform: uppercase; }
    
    .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 20px; margin-bottom: 20px; }
    h3 { font-size: 14px; color: var(--gold); margin: 0 0 15px; letter-spacing: 2px; text-transform: uppercase; }
    
    input { width: 100%; padding: 12px; background: rgba(0,0,0,0.5); border: 1px solid #333; color: #fff; border-radius: 8px; margin-bottom: 10px; font-family: monospace; outline: none; transition: 0.3s; }
    input:focus { border-color: var(--gold); }
    
    .btn { width: 100%; padding: 14px; border-radius: 8px; border: none; cursor: pointer; font-weight: 700; text-transform: uppercase; transition: 0.3s; }
    .btn-gold { background: var(--gold); color: #000; }
    .btn-gold:hover { background: #fff; transform: scale(1.02); }
    
    .balance-display { font-size: 32px; font-weight: 900; color: #fff; margin: 10px 0; }
    .log-item { font-size: 11px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #888; display: flex; justify-content: space-between; }
    .log-item b { color: var(--gold); }
  </style>
</head>
<body>
  <div class="header-info">MBA2509007 // NEURAL NODE</div>
  <canvas id="globe-canvas"></canvas>
  
  <div class="sidebar">
    <div class="card">
      <h3>Account Status</h3>
      <div style="font-size: 10px; color: #666;">VAULT: ${loggedIn ? escapeHtml(user.name) : 'GUEST'}</div>
      <div class="balance-display">${loggedIn ? formatAmount(balance) : '---'}</div>
      ${loggedIn ? '<button class="btn" style="background:#222; color:#fff; font-size:10px;" onclick="logout()">TERMINATE SESSION</button>' : ''}
    </div>

    ${!loggedIn ? `
    <div class="card">
      <h3>Terminal Access</h3>
      <input id="loginName" placeholder="ACCOUNT ID">
      <input id="loginPin" type="password" placeholder="SECURITY PIN">
      <button class="btn btn-gold" onclick="login()">AUTHORIZE</button>
    </div>` : `
    <div class="card">
      <h3>Asset Transfer</h3>
      <input id="toName" placeholder="TARGET RECIPIENT">
      <input id="amount" placeholder="WOW AMOUNT" type="number">
      <input id="transferPin" type="password" placeholder="CONFIRM PIN">
      <button class="btn btn-gold" onclick="transfer()">EXECUTE SHIPMENT</button>
    </div>`}

    <div class="card">
      <h3>Live Ledger</h3>
      <div id="logList">${logsHtml || '<div style="color:#444">No active logs...</div>'}</div>
    </div>
  </div>

  <script>
    // --- 量子凝聚动画引擎 ---
    const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
    let w, h, pts=[], startTime=Date.now();

    function init(){
      w=c.width=window.innerWidth; h=c.height=window.innerHeight;
      pts=[];
      for(let i=0; i<450; i++){
        let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1);
        pts.push({ 
          tx: Math.sin(a)*Math.cos(t), ty: Math.sin(a)*Math.sin(t), tz: Math.cos(a), 
          sx: (Math.random()-0.5)*15, sy: (Math.random()-0.5)*15, sz: (Math.random()-0.5)*15 
        });
      }
    }

    let rot=0;
    function draw(){
      x.fillStyle='#000'; x.fillRect(0,0,w,h);
      let pgr = Math.min((Date.now()-startTime)/2500, 1);
      let ease = 1 - Math.pow(2, -10 * pgr); 
      rot += 0.003;
      
      x.save(); x.translate(w/2, h/2);
      let active = pts.map(p => {
        let cx=p.sx+(p.tx-p.sx)*ease, cy=p.sy+(p.ty-p.sy)*ease, cz=p.sz+(p.tz-p.sz)*ease;
        let x1=cx*Math.cos(rot)-cz*Math.sin(rot), z1=cz*Math.cos(rot)+cx*Math.sin(rot);
        let scale = Math.min(w, h) * 0.38;
        return { x: x1 * scale, y: cy * scale, z: z1 };
      });

      x.lineWidth = 0.5;
      for(let i=0; i<active.length; i++){
        if(active[i].z < -0.1) continue;
        for(let j=i+1; j<active.length; j++){
          let dist = Math.hypot(active[i].x-active[j].x, active[i].y-active[j].y);
          if(dist < 65){
            let alpha = (1 - dist/65) * (active[i].z + 0.6) * 0.2 * pgr;
            x.strokeStyle = \`rgba(240, 185, 11, \${alpha})\`;
            x.beginPath(); x.moveTo(active[i].x, active[i].y); x.lineTo(active[j].x, active[j].y); x.stroke();
          }
        }
      }
      active.forEach(p => {
        let s = (p.z + 1.2) / 2.4;
        if(s < 0.2) return;
        x.fillStyle = \`rgba(240, 185, 11, \${0.8 * s * pgr})\`;
        x.beginPath(); x.arc(p.x, p.y, 1.2 * s, 0, Math.PI*2); x.fill();
      });
      x.restore(); requestAnimationFrame(draw);
    }
    window.onresize=init; init(); draw();

    // --- 后端交互逻辑 ---
    async function request(path, body){
      const res = await fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error);
      return data;
    }

    async function login(){
      try {
        await request('/api/login', { name: document.getElementById('loginName').value, pin: document.getElementById('loginPin').value });
        location.reload();
      } catch(e) { alert(e.message); }
    }

    async function transfer(){
      try {
        await request('/api/transfer', { 
          receiver: document.getElementById('toName').value, 
          amount: document.getElementById('amount').value,
          pin: document.getElementById('transferPin').value
        });
        location.reload();
      } catch(e) { alert(e.message); }
    }

    async function logout(){
      await fetch('/api/logout', { method: 'POST' });
      location.reload();
    }
  </script>
</body>
</html>`;
}

// 路由处理
app.use(authFromCookie);
app.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const logs = await client.query('SELECT sender, receiver, amount FROM logs ORDER BY created_at DESC LIMIT 8');
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
    if (!r.rowCount || !(await bcrypt.compare(pin, r.rows[0].pin_hash))) return res.status(401).json({ error: 'AUTH_FAILED' });
    const token = jwt.sign({ name }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, secure: isProd }).json({ ok: true });
  } finally { client.release(); }
});

app.post('/api/transfer', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const { receiver, amount, pin } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sender = (await client.query('SELECT * FROM users WHERE name = $1 FOR UPDATE', [req.user.name])).rows[0];
    if (!(await bcrypt.compare(pin, sender.pin_hash))) throw new Error('WRONG_PIN');
    if (BigInt(sender.balance) < BigInt(amount)) throw new Error('LOW_BALANCE');
    await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2', [amount, req.user.name]);
    await client.query('INSERT INTO users (name, balance, pin_hash) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET balance = users.balance + EXCLUDED.balance', [receiver, amount, '000000']);
    await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [req.user.name, receiver, amount]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/logout', (req, res) => res.clearCookie('token').json({ ok: true }));

async function start() { await migrateAndSeed(); app.listen(port, () => console.log(`PORT_${port}`)); }
start();
