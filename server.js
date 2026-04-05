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
        
        // 自动平账：确保总量严格 1,000,000
        await client.query("UPDATE users SET balance = 0 WHERE name != 'Admin'");
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT (name) DO UPDATE SET balance = 1000000");
    } catch (err) { console.error("DB Error"); }
    app.listen(port);
}

const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 GLOBAL TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: #0d0d0d; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); border-bottom: 1px solid #222; display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply { font-family: 'Orbitron'; font-size: 20px; color: var(--gold); letter-spacing: 2px; }
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; }
        .globe-area { flex: 1; background: #000; position: relative; cursor: crosshair; }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid #222; padding: 30px; display: flex; flex-direction: column; }
        .terminal-info { background: #1a1a1a; padding: 15px; border-radius: 4px; border-left: 3px solid var(--gold); margin-bottom: 20px; font-size: 12px; color: #888; }
        .input-box { background: #111; padding: 20px; border-radius: 8px; border: 1px solid #222; }
        input { width: 100%; padding: 12px; margin-bottom: 12px; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 4px; box-sizing: border-box; outline: none; }
        .btn { width: 100%; padding: 15px; border-radius: 4px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.3s; margin-top: 10px; }
        .btn-check { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        .btn-send { background: var(--gold); color: #000; }
        .logs-title { font-family: 'Orbitron'; font-size: 12px; color: #444; margin-top: 30px; margin-bottom: 10px; text-transform: uppercase; }
        .log-list { flex: 1; overflow-y: auto; font-size: 11px; color: #666; }
        .log-item { padding: 5px 0; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; }
        .log-item span { color: var(--gold); }
    </style>
</head>
<body>
`;

app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 8');
        const total = stats.rows[0].b || 1000000;
        
        let logHtml = logs.rows.map(l => `
            <div class="log-item">
                <div><span>${l.sender}</span> → ${l.receiver}</div>
                <div style="color:#fff">${l.amount} WOW</div>
            </div>
        `).join('');

        res.send(`${htmlHead}
    <div class="header"><div class="supply">RESERVE: ${Number(total).toLocaleString()} WOW</div></div>
    <div class="container">
        <div class="globe-area">
            <canvas id="globeCanvas"></canvas>
            <div style="position:absolute; bottom:20px; left:20px; font-size:10px; color:#333;">ENCRYPTION: AES-256 GLOBAL NODE ACTIVE</div>
        </div>
        <div class="sidebar">
            <div class="terminal-info">SYSTEM STATUS: OPTIMIZED<br>LOCATION: MALAYSIA HUB</div>
            <button class="btn btn-check" onclick="check()">🔍 ACCESS MY VAULT</button>
            <div class="input-box" style="margin-top:20px;">
                <input type="text" id="f" placeholder="SENDER ID">
                <input type="text" id="t" placeholder="RECEIVER ID">
                <input type="number" id="a" placeholder="AMOUNT (WOW)">
                <button class="btn btn-send" onclick="send()">🚀 EXECUTE TRANSFER</button>
            </div>
            <div class="logs-title">Live Transaction Ledger</div>
            <div class="log-list">${logHtml || 'Waiting for network activity...'}</div>
        </div>
    </div>
    <script>
        const canvas = document.getElementById('globeCanvas'); const ctx = canvas.getContext('2d');
        let w, h, points = [];
        function init() {
            w = canvas.width = canvas.parentElement.offsetWidth; h = canvas.height = canvas.parentElement.offsetHeight;
            points = [];
            // 创建地球仪经纬度点网格
            for(let i=0; i<500; i++) {
                let t = Math.random()*Math.PI*2; 
                let p = Math.acos(Math.random()*2-1);
                points.push({x: Math.sin(p)*Math.cos(t), y: Math.sin(p)*Math.sin(t), z: Math.cos(p)});
            }
        }
        let rot = 0;
        function draw() {
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,w,h); 
            const R = Math.min(w,h) * 0.4; rot += 0.003;
            ctx.save(); ctx.translate(w/2, h/2);
            points.forEach(pt => {
                // 3D 旋转逻辑
                let x1 = pt.x*Math.cos(rot) - pt.z*Math.sin(rot);
                let z1 = pt.z*Math.cos(rot) + pt.x*Math.sin(rot);
                let opacity = (z1 + 1) / 2;
                ctx.fillStyle = "rgba(240, 185, 11, " + opacity + ")";
                // 只有正面的点显示得更亮
                let size = opacity * 2;
                ctx.beginPath(); ctx.arc(x1*R, pt.y*R, size, 0, Math.PI*2); ctx.fill();
            });
            ctx.restore(); requestAnimationFrame(draw);
        }
        window.onresize = init; init(); draw();
        function check(){ const n=prompt("Identify Name?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
        function send(){
            const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(f && t && a) location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
        }
    </script>
</body></html>`);
    } catch(e) { res.status(500).send("Node Error"); }
});

app.get('/api/balance', async (req, res) => {
    const user = req.query.u;
    let r = await client.query('SELECT balance FROM users WHERE name = $1', [user]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [user]);
        r = { rows: [{ balance: 0 }] };
    }
    res.send(`${htmlHead}
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
        <div class="sidebar" style="border:1px solid var(--gold); height:auto; border-radius:10px;">
            <h2 style="text-align:center;font-family:'Orbitron';color:var(--gold);">${user}</h2>
            <div style="font-size:4rem;text-align:center;margin:30px 0;font-family:'Orbitron';">${r.rows[0].balance}</div>
            <button class="btn btn-check" onclick="location.href='/'">BACK TO TERMINAL</button>
        </div>
    </div></body></html>`);
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("<script>alert('Denied: Insufficient Balance');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("Error"); }
});

startServer();
