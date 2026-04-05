const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mba-2026-secret';

// --- 基础配置 ---
app.use(express.json());
app.use(cookieParser());

// --- 数据库连接（Render 专用加固） ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- 品牌常量 ---
const BRAND = "MBA2509007 COIN";

// --- 初始化数据库 ---
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, pin_hash TEXT, balance NUMERIC DEFAULT 0);
      CREATE TABLE IF NOT EXISTS logs (sender TEXT, receiver TEXT, amount NUMERIC, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
    `);
    const hash = await bcrypt.hash('888888', 10);
    await client.query("INSERT INTO users (name, pin_hash, balance) VALUES ('Admin', $1, 1000000) ON CONFLICT DO NOTHING", [hash]);
  } finally { client.release(); }
}

// --- 界面渲染 ---
function render(user, balance, logs) {
  const logRows = logs.map(l => `<div style="display:flex;justify-content:space-between;font-size:11px;border-bottom:1px solid #222;padding:5px 0;"><span>${l.sender} > ${l.receiver}</span><span style="color:#f0b90b;">+${l.amount} COIN</span></div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${BRAND}</title>
  <style>
    body { background:#000; color:#eee; font-family:sans-serif; margin:0; overflow:hidden; }
    #canvas { position:fixed; top:0; left:0; z-index:1; }
    .ui { position:absolute; left:30px; top:50px; width:340px; background:rgba(10,10,15,0.9); border:1px solid #333; padding:25px; border-radius:15px; backdrop-filter:blur(10px); z-index:10; }
    .gold { color:#f0b90b; }
    input { width:100%; padding:10px; margin:8px 0; background:#000; border:1px solid #444; color:#fff; border-radius:5px; box-sizing:border-box; }
    button { width:100%; padding:12px; background:#f0b90b; border:none; font-weight:bold; cursor:pointer; border-radius:5px; margin-top:10px; }
  </style></head><body>
  <canvas id="canvas"></canvas>
  <div class="ui">
    <h2 class="gold" style="margin:0;font-size:16px;letter-spacing:2px;">${BRAND} NODE</h2>
    <div style="margin:20px 0;">
      <div style="font-size:10px;color:#666;">ACCOUNT: ${user || 'GUEST'}</div>
      <div style="font-size:28px;font-weight:bold;">${balance} <span style="font-size:14px;">COIN</span></div>
    </div>
    ${!user ? `
      <input id="u" placeholder="Admin ID"><input id="p" type="password" placeholder="PIN (888888)">
      <button onclick="login()">AUTHORIZE ACCESS</button>
    ` : `
      <input id="to" placeholder="RECIPIENT ID"><input id="amt" placeholder="AMOUNT"><input id="pin" type="password" placeholder="YOUR PIN">
      <button onclick="send()">EXECUTE TRANSFER</button>
      <button style="background:#222;color:#888;margin-top:5px;" onclick="document.cookie='token=;max-age=0';location.reload()">LOGOUT</button>
    `}
    <div style="margin-top:20px;">
      <h4 class="gold" style="font-size:12px;margin-bottom:10px;">RECENT LEDGER</h4>
      ${logRows || '<div style="color:#444">No data...</div>'}
    </div>
  </div>
  <script>
    const c=document.getElementById('canvas'), x=c.getContext('2d');
    let w, h, pts=[];
    function init(){ w=c.width=window.innerWidth; h=c.height=window.innerHeight; pts=[]; for(let i=0;i<350;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
    function draw(){ 
      x.fillStyle='#000'; x.fillRect(0,0,w,h); 
      let rot=Date.now()*0.0005; x.save(); x.translate(w/2, h/2);
      pts.forEach(p=>{
        let x1=p.x*Math.cos(rot)-p.z*Math.sin(rot), z1=p.z*Math.cos(rot)+p.x*Math.sin(rot);
        let s=Math.min(w,h)*0.35;
        x.fillStyle=\`rgba(240,185,11,\${(z1+1)*0.5})\`;
        x.beginPath(); x.arc(x1*s, p.y*s, 1.5*(z1+1), 0, 7); x.fill();
      });
      x.restore(); requestAnimationFrame(draw);
    }
    init(); draw(); window.onresize=init;
    async function login(){ 
      const res = await fetch('/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({u:document.getElementById('u').value,p:document.getElementById('p').value})});
      if(res.ok) location.reload(); else alert('Auth Failed');
    }
    async function send(){
      const res = await fetch('/transfer', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:document.getElementById('to').value,amt:document.getElementById('amt').value,p:document.getElementById('pin').value})});
      if(res.ok) location.reload(); else alert('Transfer Failed');
    }
  </script></body></html>`;
}

// --- 路由处理 ---
app.get('/', async (req, res) => {
  try {
    const logs = await pool.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
    let user = null, balance = 0;
    if (req.cookies.token) {
      const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
      const me = await pool.query('SELECT * FROM users WHERE name = $1', [decoded.name]);
      if (me.rows[0]) { user = me.rows[0].name; balance = me.rows[0].balance; }
    }
    res.send(render(user, balance, logs.rows));
  } catch (e) { res.status(500).send("Node Error"); }
});

app.post('/login', async (req, res) => {
  const { u, p } = req.body;
  const r = await pool.query('SELECT * FROM users WHERE name = $1', [u]);
  if (r.rows[0] && await bcrypt.compare(p, r.rows[0].pin_hash)) {
    const token = jwt.sign({ name: r.rows[0].name }, JWT_SECRET);
    res.cookie('token', token).json({ ok: true });
  } else res.status(401).send();
});

app.post('/transfer', async (req, res) => {
  const { to, amt, p } = req.body;
  try {
    const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
    await pool.query('BEGIN');
    await pool.query('UPDATE users SET balance = balance - $1 WHERE name = $2', [amt, decoded.name]);
    await pool.query('INSERT INTO users (name, balance, pin_hash) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [to, amt, await bcrypt.hash('000000', 10)]);
    await pool.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [decoded.name, to, amt]);
    await pool.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await pool.query('ROLLBACK'); res.status(400).send(); }
});

initDB().then(() => app.listen(port, () => console.log('COIN_READY')));
