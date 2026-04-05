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
        
        // 【核心修正】强制清理非 Admin 用户的余额并归还给 Admin
        const stats = await client.query('SELECT SUM(balance) as b FROM users WHERE name != $1', ['Admin']);
        const extraCoins = parseInt(stats.rows[0].b || 0);
        if (extraCoins > 0) {
            await client.query('UPDATE users SET balance = 0 WHERE name != $1', ['Admin']);
            await client.query('UPDATE users SET balance = balance + $1 WHERE name = $2', [extraCoins, 'Admin']);
        }
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT (name) DO UPDATE SET balance = 1000000");
        
        console.log("✅ SYSTEM RESET: SUPPLY SECURED AT 1,000,000 WOW.");
    } catch (err) { console.error("DB Error:", err.message); }
    app.listen(port);
}

const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 GLOBAL RESERVE</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --card: #121212; --border: #333; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .top-bar { position: fixed; top: 0; width: 100%; height: 80px; background: rgba(0,0,0,0.9); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .total-display { font-family: 'Orbitron', sans-serif; font-size: 28px; color: var(--gold); text-shadow: 0 0 10px rgba(240,185,11,0.5); }
        .wrapper { display: flex; height: 100vh; padding-top: 80px; box-sizing: border-box; }
        .left-zone { flex: 1; position: relative; background: #000; overflow: hidden; }
        .right-zone { width: 450px; background: var(--card); border-left: 1px solid var(--border); padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; z-index: 10; }
        .panel { background: #1a1a1a; padding: 25px; border-radius: 20px; border: 1px solid var(--border); }
        input { width: 100%; padding: 15px; margin-bottom: 15px; background: #000; border: 1px solid var(--border); color: var(--gold); border-radius: 8px; font-family: inherit; box-sizing: border-box; font-size: 16px; }
        .btn { width: 100%; padding: 18px; border-radius: 10px; border: none; cursor: pointer; font-weight: bold; font-family: 'Orbitron', sans-serif; transition: 0.3s; font-size: 16px; }
        .btn-check { background: #333; color: #fff; margin-bottom: 20px; }
        .btn-send { background: var(--gold); color: #000; }
    </style>
</head>
<body>
`;

app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT COUNT(*) as u, SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
        const total = stats.rows[0].b || 0;
        let logHtml = logs.rows.map(l => `<div style="font-size:11px;color:#666;border-bottom:1px solid #333;padding:5px 0;">[${l.time.toLocaleTimeString()}] ${l.sender} -> ${l.amount} -> ${l.receiver}</div>`).join('');

        res.send(`${htmlHead}
    <div class="top-bar"><div class="total-display">TOTAL SUPPLY: ${Number(total).toLocaleString()} / 1,000,000 WOW</div></div>
    <div class="wrapper">
        <div class="left-zone"><canvas id="nodeCanvas"></canvas></div>
        <div class="right-zone">
            <div style="text-align:center; margin-bottom:30px;">
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" style="width:80px;">
                <h2 style="font-family:'Orbitron'; margin-top:10px; color:var(--gold);">GLOBAL TERMINAL</h2>
            </div>
            <button class="btn btn-check" onclick="check()">🔍 ACCESS MY VAULT</button>
            <div class="panel">
                <input type="text" id="f" placeholder="Sender Name">
                <input type="text" id="t" placeholder="Receiver Name">
                <input type="number" id="a" placeholder="Amount (WOW)">
                <button class="btn btn-send" onclick="send()">🚀 SEND TO MOON</button>
            </div>
            <div style="margin-top:20px; flex:1; overflow-y:auto;"><b>NETWORK LOGS:</b><br>${logHtml}</div>
        </div>
    </div>
    <script>
        const canvas = document.getElementById('nodeCanvas'); const ctx = canvas.getContext('2d');
        let width, height, nodes = [], links = [];
        function init() {
            width = canvas.width = canvas.parentElement.offsetWidth; height = canvas.height = canvas.parentElement.offsetHeight;
            nodes = []; links = [];
            for(let i=0; i<150; i++) {
                let theta = Math.random() * Math.PI * 2; let phi = Math.acos((Math.random() * 2) - 1);
                nodes.push({x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: Math.cos(phi)});
            }
            for(let i=0; i<150; i++) {
                let target = nodes[Math.floor(Math.random()*nodes.length)];
                if(target !== nodes[i]) links.push({ from: nodes[i], to: target });
            }
        }
        let angleY = 0;
        function draw() {
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); const radius = Math.min(width, height) * 0.38; angleY += 0.003;
            ctx.save(); ctx.translate(width/2, height/2);
            links.forEach(l => {
                let f = rot(l.from, angleY); let t = rot(l.to, angleY);
                if(f.z > 0 || t.z > 0) {
                    ctx.strokeStyle = "rgba(240,185,11,0.15)"; ctx.beginPath();
                    ctx.moveTo(f.x*radius, f.y*radius); ctx.lineTo(t.x*radius, t.y*radius); ctx.stroke();
                }
            });
            nodes.forEach(p => {
                let r = rot(p, angleY); let s = (r.z + 1.5)/2.5;
                ctx.fillStyle = "rgba(240,185,11," + (r.z+1)/2 + ")"; ctx.beginPath();
                ctx.arc(r.x*radius, r.y*radius, s*3, 0, Math.PI*2); ctx.fill();
            });
            ctx.restore(); requestAnimationFrame(draw);
        }
        function rot(p, ay) {
            let x1 = p.x * Math.cos(ay) - p.z * Math.sin(ay);
            let z1 = p.z * Math.cos(ay) + p.x * Math.sin(ay);
            return { x: x1, y: p.y, z: z1 };
        }
        window.onload = () => { init(); draw(); };
        function check(){ const n=prompt("Identify Name?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
        function send(){
            const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(f&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
        }
    </script>
</body></html>`);
    } catch(e) { res.send("Error"); }
});

app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        res.redirect(`/api/balance?u=${encodeURIComponent(name)}`);
    } else {
        // 【修正】这里必须使用反引号 (`) 来正确渲染变量
        res.send(`${htmlHead}
        <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
            <div class="panel" style="width:350px; text-align:center;">
                <h3 style="color:var(--gold);">${name} VAULT</h3>
                <div style="font-size:50px; font-family:'Orbitron'; margin:20px 0; color:var(--gold);">${r.rows[0].balance}</div>
                <button class="btn btn-check" onclick="location.href='/'">RETURN</button>
            </div>
        </div></body></html>`);
    }
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("Insufficient Funds.");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("SystemFail"); }
});

startServer();
