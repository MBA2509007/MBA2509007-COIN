require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// --- 基础安全与解析 ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());

// --- 数据库连接：加入 Render 必须的安全配置 ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, 
  connectionTimeoutMillis: 20000,
});

// --- 品牌常量：彻底告别 WOW ---
const CURRENCY_NAME = "MBA2509007 COIN";
const CURRENCY_UNIT = "COIN";
const JWT_SECRET = process.env.JWT_SECRET || 'mba-2026-key';

// --- 工具函数 ---
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatAmount(v) { return String(v ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + " " + CURRENCY_UNIT; }

// --- 初始化数据库 ---
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, pin_hash TEXT NOT NULL, balance NUMERIC(20,0) DEFAULT 0);
      CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount NUMERIC(20,0), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
    const adminPinHash = await bcrypt.hash('888888', 12);
    await client.query(`
      INSERT INTO users (name, pin_hash, balance) VALUES ('Admin', $1, 1000000)
      ON CONFLICT (name) DO UPDATE SET balance = GREATEST(users.balance, EXCLUDED.balance);
    `, [adminPinHash]);
    console.log('SYSTEM_READY_BRAND_COIN');
  } finally { client.release(); }
}

// --- UI 渲染 (包含你喜欢的量子地球视觉) ---
function renderUI({ user, balance, logsHtml }) {
  const loggedIn = !!user;
  return `<!DOCTYPE html><html lang="zh"><head>
  <meta charset="UTF-8"><title>${CURRENCY_NAME}</title>
  <style>
    :root { --gold: #f0b90b; --bg: #030406; }
    body { background: var(--bg); color: #E0E2E5; font-family: sans-serif; margin: 0; overflow: hidden; height: 100vh; }
    #globe-canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; }
    .sidebar { position: absolute; left: 40px; top: 50%; transform: translateY(-50%); width: 380px; background: rgba(10,12,18,0.85); border: 1px solid rgba(240,185,11,0.2); padding: 30px; border-radius: 20px; backdrop-filter: blur(20px); z-index: 10; }
    .header-info { position: fixed; top: 30px; left: 40px; z-index: 100; font-size: 11px; letter-spacing: 4px; color: var(--gold); }
    .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    input { width: 100%; padding: 12px; background: #000; border: 1px solid #333; color: #fff; border-radius: 6px; margin-bottom: 10px; box-sizing: border-box; outline: none; }
    .btn { width: 100%; padding: 14px; background: var(--gold); border: none; border-radius: 6px; cursor: pointer; font-weight: bold; text-transform: uppercase; }
    .balance-display { font-size: 32px; font-weight: 900; color: #fff; margin: 10px 0; }
    .log-item { font-size: 11px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); color: #888; display: flex; justify-content: space-between; }
    .log-item b { color: var(--gold); }
  </style>
</head><body>
  <div class="header-info">${CURRENCY_NAME} // NODE_ACTIVE</div>
  <canvas id="globe-canvas"></canvas>
  <div class="sidebar">
    <div class="card">
      <h3>Vault Status</h3>
      <div style="font-size: 10px; color: #666;">ID: ${loggedIn ? escapeHtml(user) : 'GUEST'}</div>
      <div class="balance-display">${loggedIn ? formatAmount(balance) : '---'}</div>
    </div>
    ${!loggedIn ? `
    <div class="card">
      <input id="u" placeholder="Admin"><input id="p" type="password" placeholder="888888">
      <button class="btn" onclick="login()">AUTHORIZE ACCESS</button>
    </div>` : `
    <div class="card">
      <input id="to" placeholder="RECIPIENT ID"><input id="amt" placeholder="COIN AMOUNT"><input id="pin" type="password" placeholder="PIN">
      <button class="btn" onclick="send()">EXECUTE TRANSFER</button>
      <button style="background:#1a1a1a; color:#888; margin-top:10px;" class="btn" onclick="logout()">LOGOUT</button>
    </div>`}
    <div class="card">
      <h3>Network Ledger</h3>
      <div id="logs">${logsHtml || 'Scanning blockchain...'}</div>
    </div>
  </div>
  <script>
    const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
    let w, h, pts=[], st=Date.now();
    function init(){ w=c.width=window.innerWidth; h=c.height=window.innerHeight; pts=[]; for(let i=0; i<400; i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({tx:Math.sin(a)*Math.cos(t), ty:Math.sin(a)*Math.sin(t), tz:Math.cos(a), sx:(Math.random()-0.5)*15, sy:(Math.random()-0.5)*15, sz:(Math.random()-0.5)*15}); } }
    function draw(){ x.fillStyle='#030406'; x.fillRect(0,0,w,h); let pg=Math.min((Date.now()-st)/2000, 1), rot=Date.now()*0.0005; x.save(); x.translate(w/2, h/2); let active=pts.map(p=>{ let cx=p.sx+(p.tx-p.sx)*pg, cy=p.sy+(p.ty-p.sy)*pg, cz=p.sz+(p.tz-p.sz)*pg; let x1=cx*Math.cos(rot)-cz*Math.sin(rot), z1=cz*Math.cos(rot)+cx*Math.sin(rot); return {x:x1*Math.min(w,h)*0.4, y:cy*Math.min(w,h)*0.4, z:z1}; }); active.forEach(p=>{ x.fillStyle=\`rgba(240,185,11,\${(p.z+1)*0.5*pg})\`; x.beginPath(); x.arc(p.x, p.y, 1.2*(p.z+1), 0, 7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
    window.onresize=init; init(); draw();
    async function login(){ const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u:document.getElementById('u').value,p:document.getElementById('p').value})}); if(r.ok) location.reload(); else alert('Auth Failed'); }
    async function send(){ const r=await fetch('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:document.getElementById('to').value,amt:document.getElementById('amt').value,p:document.getElementById('pin').value})}); if(r.ok) location.reload(); else alert('Failed'); }
    async function logout(){ await fetch('/api/logout', {method:'POST'}); location.reload(); }
  </script>
</body></html>`;
}

// --- 路由 ---
app.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const logs = await client.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 5');
    const logsHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b>+${formatAmount(l.amount)}</b></div>`).join('');
    let user = null, balance = 0;
    if (req.cookies.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
        const me = await client.query('SELECT * FROM users WHERE name = $1', [decoded.name]);
        if (me.rows[0]) { user = me.rows[0].name; balance = me.rows[0].balance; }
      } catch(e) { res.clearCookie('token'); }
    }
    res.send(renderUI({ user, balance, logsHtml }));
  } catch (e) { res.status(500).send("Node Error"); } finally { client.release(); }
});

app.post('/api/login', async (req, res) => {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM users WHERE name = $1', [req.body.u]);
    if (r.rows[0] && await bcrypt.compare(req.body.p, r.rows[0].pin_hash)) {
      const token = jwt.sign({ name: r.rows[0].name }, JWT_SECRET);
      res.cookie('token', token, { httpOnly: true, secure: true }).json({ ok: true });
    } else res.status(401).json({ ok: false });
  } finally { client.release(); }
});

app.post('/api/transfer', async (req, res) => {
  const client = await pool.connect();
  try {
    const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
    await client.query('BEGIN');
    await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2', [req.body.amt, decoded.name]);
    await client.query('INSERT INTO users (name, balance, pin_hash) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET balance = users.balance + EXCLUDED.balance', [req.body.to, req.body.amt, await bcrypt.hash('000000', 10)]);
    await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [decoded.name, req.body.to, req.body.amt]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/logout', (req, res) => res.clearCookie('token').json({ ok: true }));

initDB().then(() => app.listen(port, () => console.log('COIN_SERVER_RUNNING')));
