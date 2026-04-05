const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// 数据库连接配置
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function startServer() {
    try {
        await client.connect();
        // 初始化数据库表
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 自动对账：确保总量严格为 1,000,000
        await client.query("UPDATE users SET balance = 0 WHERE name != 'Admin'");
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT (name) DO UPDATE SET balance = 1000000");
        
        console.log("DATABASE READY: SUPPLY LOCKED AT 1,000,000");
    } catch (err) {
        console.error("DB CONNECTION ERROR:", err.message);
    }
    app.listen(port, () => console.log(`Server running on port ${port}`));
}

// 核心 HTML 模板
const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: #111; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .top-bar { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); border-bottom: 1px solid #333; display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply { font-family: 'Orbitron'; color: var(--gold); font-size: 1.2rem; letter-spacing: 2px; }
        .main { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; }
        .canvas-container { flex: 1; background: #000; position: relative; }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid #222; padding: 30px; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.5); }
        .core-icon { width: 120px; height: 120px; margin: 0 auto 20px; border: 2px solid var(--gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Orbitron'; color: var(--gold); box-shadow: 0 0 20px rgba(240,185,11,0.3); }
        .input-group { margin-top: 20px; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; background: #000; border: 1px solid #444; color: var(--gold); border-radius: 4px; box-sizing: border-box; }
        .btn { width: 100%; padding: 15px; border-radius: 4px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.3s; }
        .btn-check { background: transparent; color: #aaa; border: 1px solid #444; margin-bottom: 20px; }
        .btn-check:hover { color: var(--gold); border-color: var(--gold); }
        .btn-send { background: var(--gold); color: #000; }
        .btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .footer-tag { position: absolute; bottom: 20px; left: 20px; font-size: 10px; color: #444; }
    </style>
</head>
<body>${content}</body>
</html>`;

// 主页路由
app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const total = stats.rows[0].b || 1000000;
        
        const content = `
        <div class="top-bar"><div class="supply">RESERVE: ${Number(total).toLocaleString()} WOW</div></div>
        <div class="main">
            <div class="canvas-container">
                <canvas id="bgCanvas"></canvas>
                <div class="footer-tag">MBA2509007 ENCRYPTION ACTIVE</div>
            </div>
            <div class="sidebar">
                <div class="core-icon">MBA</div>
                <h2 style="text-align:center; font-family:'Orbitron'; color:var(--gold);">TERMINAL v9.0</h2>
                <button class="btn btn-check" onclick="check()">ACCESS VAULT</button>
                <div class="input-group">
                    <input type="text" id="f" placeholder="SENDER ID">
                    <input type="text" id="t" placeholder="RECEIVER ID">
                    <input type="number" id="a" placeholder="AMOUNT">
                    <button class="btn btn-send" onclick="send()">EXECUTE TRANSFER</button>
                </div>
            </div>
        </div>
        <script>
            const canvas = document.getElementById('bgCanvas'); const ctx = canvas.getContext('2d');
            let w, h, dots = [];
            function init() {
                w = canvas.width = canvas.parentElement.offsetWidth; h = canvas.height = canvas.parentElement.offsetHeight;
                dots = []; for(let i=0; i<100; i++) dots.push({x: Math.random(), y: Math.random(), z: Math.random()});
            }
            let r = 0;
            function animate() {
                ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); r += 0.005;
                ctx.save(); ctx.translate(w/2, h/2);
                dots.forEach(d => {
                    let x = (d.x-0.5)*Math.cos(r) - (d.z-0.5)*Math.sin(r);
                    let z = (d.z-0.5)*Math.cos(r) + (d.x-0.5)*Math.sin(r);
                    let scale = Math.min(w,h) * 0.4;
                    ctx.fillStyle = "rgba(240,185,11," + (z+0.5) + ")";
                    ctx.beginPath(); ctx.arc(x*scale, (d.y-0.5)*scale, 2, 0, Math.PI*2); ctx.fill();
                });
                ctx.restore(); requestAnimationFrame(animate);
            }
            window.onresize = init; init(); animate();
            function check() { const n = prompt("Identity?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
            function send() {
                const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
                if(f && t && a) location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
            }
        </script>`;
        res.send(getLayout(content));
    } catch (e) { res.status(500).send("Node Error"); }
});

// 余额路由
app.get('/api/balance', async (req, res) => {
    const user = req.query.u;
    if(!user) return res.redirect('/');
    let r = await client.query('SELECT balance FROM users WHERE name = $1', [user]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [user]);
        r = { rows: [{ balance: 0 }] };
    }
    const content = `
    <div style="display:flex; justify-content:center; align-items:center; height:100vh;">
        <div class="sidebar" style="border:1px solid var(--gold); border-radius:12px; height:auto;">
            <div class="core-icon">ID</div>
            <h3 style="text-align:center; color:var(--gold); font-family:'Orbitron';">${user}</h3>
            <div style="font-size:3rem; text-align:center; color:#fff; margin:20px 0; font-family:'Orbitron';">${r.rows[0].balance}</div>
            <button class="btn btn-check" onclick="location.href='/'">RETURN</button>
        </div>
    </div>`;
    res.send(getLayout(content));
});

// 转账路由
app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const result = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (result.rowCount === 0) return res.send("<script>alert('Transaction Denied'); location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        res.redirect('/');
    } catch (e) { res.send("System Fault"); }
});

startServer();
