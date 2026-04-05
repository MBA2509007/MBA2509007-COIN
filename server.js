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
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 自动校准总量为 1,000,000
        await client.query("UPDATE users SET balance = 0 WHERE name != 'Admin'");
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT (name) DO UPDATE SET balance = 1000000");
    } catch (err) { console.error("DB Error:", err.message); }
    app.listen(port);
}

// 静态文件服务，确保能读取根目录下的图片
app.use(express.static('.'));

const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 GLOBAL TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Play:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root { --bronze: #c99c54; --gold: #f0b90b; --bg: #050505; --panel: #121212; }
        body { background: var(--bg); color: #fff; font-family: 'Play', sans-serif; margin: 0; overflow: hidden; }
        .top-bar { position: fixed; top: 0; width: 100%; height: 80px; background: rgba(0,0,0,0.9); border-bottom: 1px solid #333; display: flex; justify-content: center; align-items: center; z-index: 100; }
        .total-display { font-family: 'Orbitron', sans-serif; font-size: 26px; color: var(--bronze); text-shadow: 0 0 15px rgba(201,156,84,0.4); }
        .wrapper { display: flex; height: 100vh; padding-top: 80px; box-sizing: border-box; }
        .left-zone { flex: 1; background: #000; position: relative; }
        .right-zone { width: 450px; background: var(--panel); border-left: 1px solid #333; padding: 40px; display: flex; flex-direction: column; z-index: 10; }
        .coin-img { width: 150px; height: 150px; border-radius: 50%; border: 3px solid var(--bronze); box-shadow: 0 0 30px rgba(201,156,84,0.5); margin-bottom: 15px; object-fit: cover; }
        .btn { width: 100%; padding: 18px; border-radius: 8px; border: none; cursor: pointer; font-weight: bold; font-family: 'Orbitron', sans-serif; transition: 0.3s; }
        .btn-check { background: #1a1a1a; color: #fff; border: 1px solid var(--bronze); margin-bottom: 20px; }
        .btn-send { background: var(--gold); color: #000; }
        .panel { background: #1e1e1e; padding: 20px; border-radius: 12px; border: 1px solid #333; }
        input { width: 100%; padding: 15px; margin-bottom: 15px; background: #000; border: 1px solid #444; color: var(--gold); border-radius: 6px; box-sizing: border-box; }
    </style>
</head>
<body>
`;

// 主页渲染
app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const total = stats.rows[0].b || 1000000;
        res.send(`${htmlHead}
    <div class="top-bar"><div class="total-display">TOTAL SUPPLY: ${Number(total).toLocaleString()} / 1,000,000 WOW</div></div>
    <div class="wrapper">
        <div class="left-zone"><canvas id="nodeCanvas"></canvas></div>
        <div class="right-zone">
            <div style="text-align:center;">
                <img src="/coin.jpg" class="coin-img" onerror="this.src='https://i.imgur.com/8K9M4sK.png'">
                <h2 style="font-family:'Orbitron'; color:var(--bronze);">GLOBAL TERMINAL</h2>
            </div>
            <button class="btn btn-check" onclick="check()">🔍 ACCESS VAULT</button>
            <div class="panel">
                <input type="text" id="f" placeholder="Sender"><input type="text" id="t" placeholder="Receiver"><input type="number" id="a" placeholder="Amount">
                <button class="btn btn-send" onclick="send()">🚀 EXECUTE TRANSFER</button>
            </div>
        </div>
    </div>
    <script>
        const canvas = document.getElementById('nodeCanvas'); const ctx = canvas.getContext('2d');
        let width, height, nodes = [];
        function init() {
            width = canvas.width = canvas.parentElement.offsetWidth; height = canvas.height = canvas.parentElement.offsetHeight;
            for(let i=0; i<100; i++) nodes.push({x: Math.random()-0.5, y: Math.random()-0.5, z: Math.random()-0.5});
        }
        let ay = 0;
        function draw() {
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height); const r = Math.min(width,height)*0.4; ay+=0.005;
            ctx.save(); ctx.translate(width/2, height/2);
            nodes.forEach(p => {
                let x = p.x*Math.cos(ay)-p.z*Math.sin(ay); let z = p.z*Math.cos(ay)+p.x*Math.sin(ay);
                ctx.fillStyle = "rgba(201,156,84,"+(z+1)+")"; ctx.beginPath(); ctx.arc(x*r, p.y*r, 2, 0, Math.PI*2); ctx.fill();
            });
            ctx.restore(); requestAnimationFrame(draw);
        }
        init(); draw();
        function check(){ const n=prompt("Name?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
        function send(){
            const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(f&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
        }
    </script>
</body></html>`);
    } catch(e) { res.send("Error"); }
});

// 余额查询页面 - 已修复死循环
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    let r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    
    // 如果没有用户，直接插入并手动设置变量，不再使用 redirect
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        r = { rows: [{ balance: 0 }] };
    }

    res.send(`${htmlHead}
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
        <div class="panel" style="width:350px; text-align:center; border: 2px solid var(--bronze);">
            <img src="/coin.jpg" style="width:100px; border-radius:50%; margin-bottom:15px;">
            <h3 style="color:var(--bronze); font-family:'Orbitron';">${name} VAULT</h3>
            <div style="font-size:50px; font-family:'Orbitron'; color:var(--gold); margin-bottom:20px;">${r.rows[0].balance}</div>
            <button class="btn btn-check" onclick="location.href='/'">RETURN</button>
        </div>
    </div></body></html>`);
});

// 转账逻辑
app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("Insufficient funds.");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("Transfer failed."); }
});

startServer();
