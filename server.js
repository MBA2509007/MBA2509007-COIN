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
        // 核心表结构：增加 pin 码字段
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT DEFAULT "123456")');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 自动校准：Admin 拥有 1,000,000，其余清零
        await client.query("UPDATE users SET balance = 0 WHERE name != 'Admin'");
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT (name) DO UPDATE SET balance = 1000000");
    } catch (err) { console.error("DB Initial Error"); }
    app.listen(port);
}

app.use(express.static('.'));

// 页面基础模板
const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 GLOBAL RESERVE</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: #0d0d0d; --border: #222; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply { font-family: 'Orbitron'; font-size: 1.1rem; color: var(--gold); letter-spacing: 2px; }
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; }
        .globe-zone { flex: 1; position: relative; background: radial-gradient(circle at center, #111 0%, #000 100%); }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; overflow-y: auto; }
        .card { background: #151515; border: 1px solid var(--border); padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        input { width: 100%; padding: 12px; margin-bottom: 10px; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 4px; box-sizing: border-box; font-family: inherit; }
        .btn { width: 100%; padding: 14px; border-radius: 4px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.3s; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        .btn:hover { filter: brightness(1.2); transform: translateY(-1px); }
        .ledger-title { font-family: 'Orbitron'; font-size: 10px; color: #555; margin-bottom: 10px; }
        .log-item { font-size: 11px; padding: 6px 0; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: var(--gold); color: #000; padding: 15px 25px; border-radius: 4px; font-weight: bold; display: none; z-index: 1000; animation: slideIn 0.3s forwards; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    </style>
</head>
<body>${content}</body>
</html>`;

// 主页
app.get('/', async (req, res) => {
    const stats = await client.query('SELECT SUM(balance) as b FROM users');
    const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
    const total = stats.rows[0].b || 1000000;
    
    let logItems = logs.rows.map(l => `
        <div class="log-item">
            <span>${l.sender} > ${l.receiver}</span>
            <b style="color:var(--gold)">${l.amount}</b>
        </div>
    `).join('');

    const content = `
    <div class="header"><div class="supply">GLOBAL RESERVE: ${total.toLocaleString()} WOW</div></div>
    <div class="container">
        <div class="globe-zone">
            <canvas id="globe"></canvas>
            <div style="position:absolute; bottom:20px; left:20px; color:#333; font-size:10px;">MBA_SYSTEM_v11.0_ONLINE</div>
        </div>
        <div class="sidebar">
            <button class="btn btn-outline" onclick="access()">🔍 ACCESS VAULT</button>
            <div class="card" style="margin-top:20px;">
                <div style="color:var(--gold); font-size:12px; margin-bottom:10px;">EXECUTE TRANSFER</div>
                <input type="text" id="f" placeholder="SENDER ID">
                <input type="password" id="p" placeholder="6-DIGIT PIN" maxlength="6">
                <input type="text" id="t" placeholder="RECEIVER ID">
                <input type="number" id="a" placeholder="AMOUNT">
                <button class="btn btn-gold" onclick="send()">CONFIRM TRANSACTION</button>
            </div>
            <div class="ledger-title">LIVE TRANSACTION LEDGER</div>
            <div style="flex:1;">${logItems || 'NO RECENT LOGS'}</div>
        </div>
    </div>
    <div id="toast" class="toast"></div>
    <script>
        const canvas = document.getElementById('globe'); const ctx = canvas.getContext('2d');
        let w, h, pts = [];
        function init() {
            w = canvas.width = canvas.parentElement.offsetWidth; h = canvas.height = canvas.parentElement.offsetHeight;
            pts = []; for(let i=0; i<400; i++) {
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
                ctx.beginPath(); ctx.arc(x*R, p.y*R, (z+1)*1.2, 0, Math.PI*2); ctx.fill();
            });
            ctx.restore(); requestAnimationFrame(draw);
        }
        window.onresize = init; init(); draw();

        function showToast(m) { const t=document.getElementById('toast'); t.innerText=m; t.style.display='block'; setTimeout(()=>t.style.display='none', 3000); }
        function access() { const n=prompt("Identify Name?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
        function send() {
            const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(!f || !p || !t || !a) return showToast("INCOMPLETE DATA");
            if(confirm(\`Confirm transfer \${a} WOW to \${t}?\`)) {
                location.href=\`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`;
            }
        }
    </script>
    `;
    res.send(getLayout(content));
});

// 余额查询（带数字滚动动画）
app.get('/api/balance', async (req, res) => {
    const user = req.query.u;
    let r = await client.query('SELECT balance FROM users WHERE name = $1', [user]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [user]);
        r = { rows: [{ balance: 0 }] };
    }
    const bal = r.rows[0].balance;
    const content = `
    <div style="display:flex; justify-content:center; align-items:center; height:100vh;">
        <div class="card" style="width:360px; text-align:center; border: 1px solid var(--gold);">
            <div style="font-family:'Orbitron'; color:var(--gold);">${user} VAULT</div>
            <div id="num" style="font-size:4rem; font-family:'Orbitron'; margin:30px 0;">0</div>
            <button class="btn btn-outline" onclick="location.href='/'">TERMINAL EXIT</button>
        </div>
    </div>
    <script>
        let curr = 0; const target = ${bal};
        const step = () => {
            if(curr < target) {
                curr += Math.ceil((target - curr) * 0.1);
                document.getElementById('num').innerText = curr.toLocaleString();
                requestAnimationFrame(step);
            } else { document.getElementById('num').innerText = target.toLocaleString(); }
        };
        step();
    </script>
    `;
    res.send(getLayout(content));
});

// 转账逻辑（增加 PIN 校验和输入过滤）
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        if(isNaN(amt)) throw new Error("Invalid Amount");

        // 校验名字和 PIN
        const userCheck = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(userCheck.rows.length === 0) return res.send("<script>alert('ERROR: Invalid ID or PIN'); location.href='/';</script>");
        
        // 执行转账
        const updateSender = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (updateSender.rowCount === 0) return res.send("<script>alert('ERROR: Insufficient Balance'); location.href='/';</script>");
        
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        
        res.redirect('/?msg=SUCCESS');
    } catch (e) { res.send("<script>alert('SYSTEM FAULT'); location.href='/';</script>"); }
});

startServer();
