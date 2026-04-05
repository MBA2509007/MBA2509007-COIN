const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 核心初始化逻辑
async function startServer() {
    try {
        await client.connect();
        // 1. 初始化表结构
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 2. 强制总量平衡：Admin 拥有 1,000,000，其余人清零
        await client.query("UPDATE users SET balance = 0 WHERE name != 'Admin'");
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT (name) DO UPDATE SET balance = 1000000");
        
        console.log("🚀 System Optimized: Supply Locked at 1,000,000.");
    } catch (err) {
        console.error("Critical DB Error:", err.message);
    }
    app.listen(port);
}

// 静态资源托管（确保图片能被读取）
app.use(express.static('.'));

const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #c99c54; --bright: #f0b90b; --bg: #050505; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .top-bar { position: fixed; top: 0; width: 100%; height: 70px; background: rgba(0,0,0,0.95); border-bottom: 1px solid #222; display: flex; justify-content: center; align-items: center; z-index: 100; }
        .total { font-family: 'Orbitron', sans-serif; font-size: 24px; color: var(--gold); }
        .wrapper { display: flex; height: 100vh; padding-top: 70px; box-sizing: border-box; }
        .left { flex: 1; background: #000; }
        .right { width: 420px; background: #0a0a0a; border-left: 1px solid #222; padding: 30px; display: flex; flex-direction: column; }
        .coin-box { text-align: center; margin-bottom: 30px; }
        .coin-img { width: 140px; height: 140px; border-radius: 50%; border: 2px solid var(--gold); box-shadow: 0 0 20px rgba(201,156,84,0.3); }
        .panel { background: #111; padding: 20px; border-radius: 10px; border: 1px solid #333; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; background: #000; border: 1px solid #444; color: var(--bright); border-radius: 4px; box-sizing: border-box; }
        .btn { width: 100%; padding: 15px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.2s; }
        .btn-check { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-bottom: 20px; }
        .btn-send { background: var(--bright); color: #000; }
        .btn:hover { opacity: 0.8; transform: translateY(-1px); }
    </style>
</head>
<body>`;

// 主页接口
app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const total = stats.rows[0].b || 1000000;
        res.send(`${htmlHead}
    <div class="top-bar"><div class="total">SUPPLY: ${Number(total).toLocaleString()} / 1,000,000 WOW</div></div>
    <div class="wrapper">
        <div class="left"><canvas id="canvas"></canvas></div>
        <div class="right">
            <div class="coin-box">
                <img src="/古代中国金币设计.jpg" class="coin-img" onerror="this.src='https://i.imgur.com/8K9M4sK.png'">
                <h2 style="font-family:'Orbitron'; color:var(--gold); margin-top:15px;">GLOBAL RESERVE</h2>
            </div>
            <button class="btn btn-check" onclick="check()">🔍 ACCESS VAULT</button>
            <div class="panel">
                <input type="text" id="f" placeholder="Sender Name">
                <input type="text" id="t" placeholder="Receiver Name">
                <input type="number" id="a" placeholder="Amount">
                <button class="btn btn-send" onclick="send()">🚀 EXECUTE TRANSFER</button>
            </div>
        </div>
    </div>
    <script>
        const cvs = document.getElementById('canvas'); const ctx = cvs.getContext('2d');
        let w, h, pts = [];
        function init() {
            w = cvs.width = cvs.parentElement.offsetWidth; h = cvs.height = cvs.parentElement.offsetHeight;
            pts = []; for(let i=0; i<80; i++) pts.push({x: Math.random()-0.5, y: Math.random()-0.5, z: Math.random()-0.5});
        }
        let rot = 0;
        function draw() {
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); const R = Math.min(w,h)*0.35; rot += 0.005;
            ctx.save(); ctx.translate(w/2, h/2);
            pts.forEach(p => {
                let x = p.x*Math.cos(rot)-p.z*Math.sin(rot); let z = p.z*Math.cos(rot)+p.x*Math.sin(rot);
                ctx.fillStyle = "rgba(201,156,84,"+(z+1)+")"; ctx.beginPath(); ctx.arc(x*R, p.y*R, 3, 0, Math.PI*2); ctx.fill();
            });
            ctx.restore(); requestAnimationFrame(draw);
        }
        init(); draw();
        function check(){ const n=prompt("Identify Name?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
        function send(){
            const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(f&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
        }
    </script>
</body></html>`);
    } catch(e) { res.status(500).send("Node Error"); }
});

// 余额接口（优化版：杜绝 Redirect 循环）
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    if(!name) return res.redirect('/');
    
    let r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    let balance = 0;

    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        balance = 0;
    } else {
        balance = r.rows[0].balance;
    }

    res.send(`${htmlHead}
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
        <div class="panel" style="width:360px; text-align:center; border: 1px solid var(--gold);">
            <img src="/古代中国金币设计.jpg" style="width:100px; border-radius:50%; margin-bottom:15px;" onerror="this.src='https://i.imgur.com/8K9M4sK.png'">
            <h3 style="color:var(--gold); font-family:'Orbitron';">${name}</h3>
            <div style="font-size:48px; font-family:'Orbitron'; color:var(--bright); margin:20px 0;">${balance}</div>
            <button class="btn btn-check" onclick="location.href='/'">BACK TO TERMINAL</button>
        </div>
    </div></body></html>`);
});

// 转账接口
app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("<script>alert('Insufficient Balance');history.back();</script>");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("Transaction Failed"); }
});

startServer();
