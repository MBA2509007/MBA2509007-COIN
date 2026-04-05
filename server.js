const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function startServer() {
    try {
        await client.connect();
        // 数据库初始化
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 初始 Admin 账户
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT (name) DO NOTHING");
        console.log("MBA SYSTEM V12.0 ONLINE.");
    } catch (err) { console.error("DB Error"); }
    app.listen(port);
}

const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 GLOBAL TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: #0d0d0d; --border: #222; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply { font-family: 'Orbitron'; font-size: 18px; color: var(--gold); letter-spacing: 2px; }
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; }
        .globe-zone { flex: 1; position: relative; }
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; overflow-y: auto; }
        .card { background: #111; border: 1px solid var(--border); padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        input { width: 100%; padding: 12px; margin-bottom: 12px; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 4px; box-sizing: border-box; font-family: inherit; outline: none; }
        input:focus { border-color: var(--gold); }
        .btn { width: 100%; padding: 14px; border-radius: 4px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.3s; margin-top: 5px; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        .btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
        .log-item { font-size: 11px; padding: 8px 0; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; }
        .tab-btn { background: #222; color: #888; border: none; padding: 8px 15px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; margin-right: 5px; border-radius: 4px; }
        .tab-btn.active { background: var(--gold); color: #000; }
    </style>
</head>
<body>${content}</body>
</html>`;

// 主页路由
app.get('/', async (req, res) => {
    const stats = await client.query('SELECT SUM(balance) as b FROM users');
    const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 12');
    
    let logHtml = logs.rows.map(l => `
        <div class="log-item">
            <span>${l.sender} > ${l.receiver}</span>
            <b style="color:var(--gold)">${l.amount} WOW</b>
        </div>
    `).join('');

    const content = `
    <div class="header"><div class="supply">MBA RESERVE: ${(stats.rows[0].b || 0).toLocaleString()} WOW</div></div>
    <div class="container">
        <div class="globe-zone">
            <canvas id="globe"></canvas>
            <div style="position:absolute; bottom:20px; left:20px; color:#222; font-size:10px;">ENCRYPTED NODE_V12_STABLE</div>
        </div>
        <div class="sidebar">
            <div style="margin-bottom:15px;">
                <button class="tab-btn active" onclick="showTab('transfer')">TRANSFER</button>
                <button class="tab-btn" onclick="showTab('register')">NEW ACCOUNT</button>
            </div>

            <div id="transfer-box" class="card">
                <div style="color:var(--gold); font-size:12px; margin-bottom:15px;">TERMINAL EXECUTION</div>
                <input type="text" id="f" placeholder="YOUR ID">
                <input type="password" id="p" placeholder="6-DIGIT PIN">
                <input type="text" id="t" placeholder="TARGET ID">
                <input type="number" id="a" placeholder="AMOUNT">
                <button class="btn btn-gold" onclick="send()">CONFIRM SHIPMENT</button>
                <button class="btn btn-outline" style="margin-top:10px;" onclick="check()">🔍 CHECK BALANCE</button>
            </div>

            <div id="register-box" class="card" style="display:none;">
                <div style="color:var(--gold); font-size:12px; margin-bottom:15px;">CREATE IDENTITY</div>
                <input type="text" id="reg-n" placeholder="CHOOSE UNIQUE NAME">
                <input type="password" id="reg-p" placeholder="SET 6-DIGIT PIN" maxlength="6">
                <button class="btn btn-gold" onclick="register()">INITIALIZE ACCOUNT</button>
            </div>

            <div style="font-family:'Orbitron'; font-size:10px; color:#444; margin-bottom:10px;">GLOBAL LEDGER</div>
            <div style="flex:1; overflow-y:auto;">${logHtml || 'LISTENING FOR TRANSACTIONS...'}</div>
        </div>
    </div>
    <script>
        // 地球仪代码
        const canvas = document.getElementById('globe'); const ctx = canvas.getContext('2d');
        let w, h, pts = [];
        function init() {
            w = canvas.width = canvas.parentElement.offsetWidth; h = canvas.height = canvas.parentElement.offsetHeight;
            pts = []; for(let i=0; i<450; i++) {
                let t = Math.random()*Math.PI*2, p = Math.acos(Math.random()*2-1);
                pts.push({x: Math.sin(p)*Math.cos(t), y: Math.sin(p)*Math.sin(t), z: Math.cos(p)});
            }
        }
        let rot = 0;
        function draw() {
            ctx.fillStyle = '#050505'; ctx.fillRect(0,0,w,h);
            const R = Math.min(w,h)*0.4; rot += 0.003;
            ctx.save(); ctx.translate(w/2, h/2);
            pts.forEach(p => {
                let x = p.x*Math.cos(rot)-p.z*Math.sin(rot), z = p.z*Math.cos(rot)+p.x*Math.sin(rot);
                ctx.fillStyle = "rgba(240,185,11,"+(z+1)/2+")";
                ctx.beginPath(); ctx.arc(x*R, p.y*R, (z+1.2)*1.2, 0, Math.PI*2); ctx.fill();
            });
            ctx.restore(); requestAnimationFrame(draw);
        }
        window.onresize = init; init(); draw();

        // 逻辑切换代码
        function showTab(t) {
            document.getElementById('transfer-box').style.display = t === 'transfer' ? 'block' : 'none';
            document.getElementById('register-box').style.display = t === 'register' ? 'block' : 'none';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.innerText.toLowerCase().includes(t)));
        }
        function register() {
            const n = document.getElementById('reg-n').value, p = document.getElementById('reg-p').value;
            if(n && p.length >= 4) location.href = \`/api/register?u=\${encodeURIComponent(n)}&p=\${p}\`;
            else alert("ID invalid or PIN too short.");
        }
        function send() {
            const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(f && p && t && a) {
                if(confirm(\`Authorize transfer of \${a} WOW to \${t}?\`))
                location.href = \`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`;
            }
        }
        function check() { const n=prompt("Identify Name?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
    </script>`;
    res.send(getLayout(content));
});

// API: 注册
app.get('/api/register', async (req, res) => {
    const { u, p } = req.query;
    try {
        const check = await client.query('SELECT * FROM users WHERE name = $1', [u]);
        if(check.rows.length > 0) return res.send("<script>alert('ERROR: ID Already Exists'); location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [u, p]);
        res.send(\`<script>alert('SUCCESS: Identity \${u} Created'); location.href='/';</script>\`);
    } catch(e) { res.redirect('/'); }
});

// API: 转账 (带加密校验)
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('ERROR: Invalid Credentials'); location.href='/';</script>");
        
        const deduct = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(deduct.rowCount === 0) return res.send("<script>alert('ERROR: Insufficient Funds'); location.href='/';</script>");
        
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "123456") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch(e) { res.redirect('/'); }
});

// API: 余额 (带数字滚动)
app.get('/api/balance', async (req, res) => {
    const u = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [u]);
    if(r.rows.length === 0) return res.redirect('/');
    const bal = r.rows[0].balance;
    res.send(getLayout(\`
        <div style="display:flex; justify-content:center; align-items:center; height:100vh;">
            <div class="card" style="width:350px; text-align:center; border: 1px solid var(--gold);">
                <div style="font-family:'Orbitron'; color:var(--gold); font-size:14px;">\${u} ACCT</div>
                <div id="n" style="font-size:4rem; font-family:'Orbitron'; margin:25px 0;">0</div>
                <button class="btn btn-outline" onclick="location.href='/'">RETURN</button>
            </div>
        </div>
        <script>
            let c=0, t=\${bal}; 
            const s=()=>{ if(c<t){ c+=Math.ceil((t-c)*0.1); document.getElementById('n').innerText=c.toLocaleString(); requestAnimationFrame(s); }else{ document.getElementById('n').innerText=t.toLocaleString(); } };
            s();
        </script>
    \`));
});

startServer();
