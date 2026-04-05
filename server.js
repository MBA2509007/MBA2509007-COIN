require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mba2026_secure_quantum_key';

// --- 基础配置 ---
app.use(express.json());
app.use(cookieParser());

// --- 数据库连接：这是解决 Status 1 的唯一关键 ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // 这一行绝对不能删，删了就会报 Status 1
});

// --- 品牌常量 ---
const BRAND = "MBA2509007 COIN";

// --- 初始化数据库逻辑 ---
async function startServer() {
  const client = await pool.connect();
  try {
    // 自动建表，确保数据库是全新的
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, pin_hash TEXT, balance NUMERIC DEFAULT 0);
      CREATE TABLE IF NOT EXISTS logs (sender TEXT, receiver TEXT, amount NUMERIC, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
    // 创建默认 Admin 账号
    const hash = await bcrypt.hash('888888', 10);
    await client.query("INSERT INTO users (name, pin_hash, balance) VALUES ('Admin', $1, 1000000) ON CONFLICT DO NOTHING", [hash]);
    console.log('--- MBA COIN SYSTEM ONLINE ---');
  } finally { client.release(); }
}

// --- UI 渲染引擎 ---
function getUI(user, balance, logs) {
  const logRows = logs.map(l => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222;font-size:11px;"><span>${l.sender} → ${l.receiver}</span><span style="color:#f0b90b;">+${l.amount} COIN</span></div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${BRAND}</title>
  <style>
    body { background:#030405; color:#eee; font-family:sans-serif; margin:0; overflow:hidden; }
    #c { position:fixed; top:0; left:0; z-index:1; }
    .ui { position:absolute; left:40px; top:50%; transform:translateY(-50%); width:360px; background:rgba(8,10,12,0.92); border:1px solid rgba(240,185,11,0.25); padding:30px; border-radius:20px; backdrop-filter:blur(15px); z-index:10; }
    .gold { color:#f0b90b; }
    input { width:100%; padding:12px; margin:10px 0; background:#000; border:1px solid #333; color:#fff; border-radius:8px; box-sizing:border-box; outline:none; }
    button { width:100%; padding:15px; background:#f0b90b; border:none; font-weight:bold; cursor:pointer; border-radius:8px; margin-top:10px; transition:0.3s; }
    button:hover { background:#fff; }
  </style></head><body>
  <canvas id="c"></canvas>
  <div class="ui">
    <h2 class="gold" style="margin:0;font-size:14px;letter-spacing:3px;">${BRAND} // TERMINAL</h2>
    <div style="margin:25px 0;">
      <div style="font-size:10px;color:#666;">ACCOUNT STATUS: ${user ? 'ACTIVE' : 'GUEST'}</div>
      <div style="font-size:32px;font-weight:900;">${balance} <span style="font-size:14px;">COIN</span></div>
    </div>
    ${!user ? `
      <input id="u" placeholder="Admin ID"><input id="p" type="password" placeholder="PIN (888888)">
      <button onclick="login()">AUTHORIZE ACCESS</button>
    ` : `
      <input id="to" placeholder="RECIPIENT ID"><input id="amt" placeholder="TRANSFER AMOUNT"><input id="pin" type="password" placeholder="YOUR PIN">
      <button onclick="send()">EXECUTE TRANSACTION</button>
      <button style="background:#1a1a1a;color:#555;margin-top:8px;" onclick="document.cookie='token=;max-age=0';location.reload()">TERMINATE SESSION</button>
    `}
    <div style="margin-top:25px;">
      <h4 class="gold" style="font-size:11px;margin-bottom:12px;">SYSTEM_LEDGER_LIVE</h4>
      ${logRows || '<div style="color:#333;font-size:11px;">AWAITING NETWORK ACTIVITY...</div>'}
    </div>
  </div>
  <script>
    const c=document.getElementById('c'), x=c.getContext('2d');
    let w, h, pts=[];
    function init(){ w=c.width=window.innerWidth; h=c.height=window.innerHeight; pts=[]; for(let i=0;i<400;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
    function draw(){ x.fillStyle='#030405'; x.fillRect(0,0,w,h); let rot=Date.now()*0.0005; x.save(); x.translate(w/2, h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(rot)-p.z*Math.sin(rot), z1=p.z*Math.cos(rot)+p.x*Math.sin(rot); let s=Math.min(w,h)*0.4; x.fillStyle=\`rgba(240,185,11,\${(z1+1)*0.45})\`; x.beginPath(); x.arc(x1*s, p.y*s, 1.2*(z1+1.2), 0, 7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
    init(); draw(); window.onresize=init;
    async function login(){ const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u:document.getElementById('u').value,p:document.getElementById('p').value})}); if(r.ok) location.reload(); else alert('Invalid Credentials'); }
    async function send(){ const r=await fetch('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:document.getElementById('to').value,amt:document.getElementById('amt').value,p:document.getElementById('pin').value})}); if(r.ok) location.reload(); else alert('Transaction Failed'); }
  </script></body></html>`;
}

// --- API 路由 ---
app.get('/', async (req, res) => {
  try {
    const logs = await pool.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
    let user = null, balance = 0;
    if (req.cookies.token) {
      const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
      const me = await pool.query('SELECT * FROM users WHERE name = $1', [decoded.name]);
      if (me.rows[0]) { user = me.rows[0].name; balance = me.rows[0].balance; }
    }
    res.send(getUI(user, balance, logs.rows));
  } catch (e) { res.status(500).send("Node Service Offline"); }
});

app.post('/api/login', async (req, res) => {
  const { u, p } = req.body;
  try {
    const r = await pool.query('SELECT * FROM users WHERE name = $1', [u]);
    if (r.rows[0] && await bcrypt.compare(p, r.rows[0].pin_hash)) {
      const token = jwt.sign({ name: r.rows[0].name }, JWT_SECRET);
      res.cookie('token', token, { httpOnly: true, secure: true }).json({ ok: true });
    } else res.status(401).send();
  } catch (e) { res.status(500).send(); }
});

app.post('/api/transfer', async (req, res) => {
  const { to, amt, p } = req.body;
  const client = await pool.connect();
  try {
    const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
    await client.query('BEGIN');
    const sender = (await client.query('SELECT * FROM users WHERE name = $1 FOR UPDATE', [decoded.name])).rows[0];
    if (await bcrypt.compare(p, sender.pin_hash)) {
      await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2', [amt, decoded.name]);
      await client.query('INSERT INTO users (name, balance, pin_hash) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [to, amt, await bcrypt.hash('000000', 10)]);
      await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [decoded.name, to, amt]);
      await client.query('COMMIT');
      res.json({ ok: true });
    } else throw new Error();
  } catch (e) { await client.query('ROLLBACK'); res.status(400).send(); } finally { client.release(); }
});

startServer().then(() => app.listen(port));
