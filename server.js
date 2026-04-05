require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// --- 基础配置 ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());

// --- 数据库连接 (针对 Render 报错进行加固) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // 必须设置为 false 才能连接 Render 托管的数据库
  },
  connectionTimeoutMillis: 10000,
});

// --- 品牌常量 ---
const CURRENCY_NAME = "MBA2509007 COIN";
const CURRENCY_UNIT = "COIN";
const JWT_SECRET = process.env.JWT_SECRET || 'mba-quantum-key-2026';

// --- 工具函数 ---
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function formatAmount(v) { return String(v ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',') + " " + CURRENCY_UNIT; }

// --- 数据库初始化 ---
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, pin_hash TEXT NOT NULL, balance NUMERIC(20,0) DEFAULT 0);
      CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount NUMERIC(20,0), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
    const hash = await bcrypt.hash('888888', 10);
    await client.query("INSERT INTO users (name, pin_hash, balance) VALUES ('Admin', $1, 1000000) ON CONFLICT DO NOTHING", [hash]);
    console.log('DB_ACTIVE_COIN_READY');
  } catch (err) {
    console.error('DB_INIT_ERROR:', err);
  } finally { client.release(); }
}

// --- 页面渲染 ---
function renderUI(user, balance, logs) {
  const loggedIn = !!user;
  const logsHtml = logs.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b>+${formatAmount(l.amount)}</b></div>`).join('');

  return `<!DOCTYPE html><html><head>
  <meta charset="UTF-8"><title>${CURRENCY_NAME}</title>
  <style>
    :root { --gold: #f0b90b; --bg: #050608; }
    body { background: var(--bg); color: #E0E2E5; font-family: sans-serif; margin: 0; overflow: hidden; height: 100vh; }
    #globe-canvas { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 1; }
    .sidebar { position: absolute; left: 40px; top: 50%; transform: translateY(-50%); width: 380px; background: rgba(10,12,18,0.85); border: 1px solid rgba(240,185,11,0.2); padding: 30px; border-radius: 20px; backdrop-filter: blur(20px); z-index: 10; }
    .header-info { position: fixed; top: 30px; left: 40px; z-index: 100; font-size: 12px; letter-spacing: 4px; color: var(--gold); }
    .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    input { width: 100%; padding: 12px; background: #000; border: 1px solid #333; color: #fff; border-radius: 6px; margin-bottom: 10px; box-sizing: border-box; }
    .btn { width: 100%; padding: 14px; background: var(--gold); border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .balance-display { font-size: 32px; font-weight: 900; margin: 10px 0; }
    .log-item { font-size: 11px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; }
  </style>
  </head><body>
  <div class="header-info">${CURRENCY_NAME} // NODE</div>
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
      <button class="btn" onclick="login()">AUTHORIZE</button>
    </div>` : `
    <div class="card">
      <input id="to" placeholder="RECIPIENT ID"><input id="amt" placeholder="COIN AMOUNT"><input id="pin" type="password" placeholder="PIN">
      <button class="btn" onclick="send()">EXECUTE TRANSFER</button>
    </div>`}
    <div class="card">
      <h3>Live Ledger</h3>
      <div id="logs">${logsHtml || 'Scanning...'}</div>
    </div>
  </div>
  <script>
    const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
    let w, h, pts=[], st=Date.now();
    function init(){ w=c.width=window.innerWidth; h=c.height=window.innerHeight; pts=[]; for(let i=0; i<400; i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({tx:Math.sin(a)*Math.cos(t), ty:Math.sin(a)*Math.sin(t), tz:Math.cos(a), sx:(Math.random()-0.5)*15, sy:(Math.random()-0.5)*15, sz:(Math.random()-0.5)*15}); } }
    function draw(){ x.fillStyle='#050608'; x.fillRect(0,0,w,h); let pg=Math.min((Date.now()-st)/2000, 1), rot=Date.now()*0.0005; x.save(); x.translate(w/2, h/2); let active=pts.map(p=>{ let cx=p.sx+(p.tx-p.sx)*pg, cy=p.sy+(p.ty-p.sy)*pg, cz=p.sz+(p.tz-p.sz)*pg; let x1=cx*Math.cos(rot)-cz*Math.sin(rot), z1=cz*Math.cos(rot)+cx*Math.sin(rot); return {x:x1*Math.min(w,h)*0.4, y:cy*Math.min(w,h)*0.4, z:z1}; }); active.forEach(p=>{ x.fillStyle=\`rgba(240,185,11,\${(p.z+1)*0.5*pg})\`; x.beginPath(); x.arc(p.x, p.y, 1.2*(p.z+1), 0, 7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
    window.onresize=init; init(); draw();
    async function login(){ const r=await fetch('/l',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u:document.getElementById('u').value,p:document.getElementById('p').value})}); if(r.ok) location.reload(); else alert('Error'); }
    async function send(){ const r=await fetch('/t',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:document.getElementById('to').value,amt:document.getElementById('amt').value,p:document.getElementById('pin').value})}); if(r.ok) location.reload(); else alert('Failed'); }
  </script>
  </body></html>`;
}

// --- 路由 ---
app.get('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const logs = await client.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 5');
    let user = null, balance = 0;
    if (req.cookies.token) {
      const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
      const me = await client.query('SELECT * FROM users WHERE name = $1', [decoded.name]);
      if (me.rows[0]) { user = me.rows[0].name; balance = me.rows[0].balance; }
    }
    res.send(renderUI(user, balance, logs.rows));
  } catch (e) { res.status(500).send("Database Error"); } finally { client.release(); }
});

app.post('/l', async (req, res) => {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM users WHERE name = $1', [req.body.u]);
    if (r.rows[0] && await bcrypt.compare(req.body.p, r.rows[0].pin_hash)) {
      const token = jwt.sign({ name: r.rows[0].name }, JWT_SECRET);
      res.cookie('token', token).json({ ok: true });
    } else res.status(401).json({ ok: false });
  } finally { client.release(); }
});

app.post('/t', async (req, res) => {
  const client = await pool.connect();
  try {
    const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
    await client.query('BEGIN');
    await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2', [req.body.amt, decoded.name]);
    await client.query('INSERT INTO users (name, balance, pin_hash) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [req.body.to, req.body.amt, await bcrypt.hash('000000', 10)]);
    await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [decoded.name, req.body.to, req.body.amt]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(400).json({ ok: false }); } finally { client.release(); }
});

initDB().then(() => app.listen(port, () => console.log('COIN_SERVER_RUNNING')));
