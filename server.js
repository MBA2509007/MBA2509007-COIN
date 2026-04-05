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
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT DO NOTHING");
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
        
        .top-bar { 
            position: fixed; top: 0; width: 100%; height: 80px; 
            background: rgba(0,0,0,0.9); border-bottom: 1px solid var(--border);
            display: flex; justify-content: center; align-items: center; z-index: 100;
        }
        .total-display { font-family: 'Orbitron', sans-serif; font-size: 28px; color: var(--gold); text-shadow: 0 0 10px rgba(240,185,11,0.5); }

        .wrapper { display: flex; height: 100vh; padding-top: 80px; box-sizing: border-box; }
        
        /* 左：原生 Canvas 地球 */
        .left-zone { flex: 1; position: relative; background: #000; display: flex; justify-content: center; align-items: center; overflow: hidden; }
        #earthCanvas { cursor: move; }

        /* 右：卡片区 */
        .right-zone { width: 450px; background: var(--card); border-left: 1px solid var(--border); padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; z-index: 10; }
        
        .panel { background: #1a1a1a; padding: 25px; border-radius: 20px; border: 1px solid var(--border); }
        input { 
            width: 100%; padding: 15px; margin-bottom: 15px; background: #000; border: 1px solid var(--border); 
            color: var(--gold); border-radius: 8px; font-family: inherit; box-sizing: border-box; font-size: 16px;
        }
        .btn { 
            width: 100%; padding: 18px; border-radius: 10px; border: none; cursor: pointer; 
            font-weight: bold; font-family: 'Orbitron', sans-serif; transition: 0.3s; font-size: 16px;
        }
        .btn-check { background: #333; color: #fff; margin-bottom: 20px; }
        .btn-send { background: var(--gold); color: #000; }
        .btn:hover { opacity: 0.8; transform: scale(1.02); }

        .log-box { margin-top: auto; height: 150px; font-size: 11px; color: #666; overflow-y: auto; border-top: 1px solid var(--border); padding-top: 10px; }
        .node-tag { position: absolute; bottom: 20px; left: 20px; color: var(--gold); font-size: 12px; letter-spacing: 2px; }
    </style>
</head>
<body>
`;

app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT COUNT(*) as u, SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
        const total = stats.rows[0].b || 0;
        let logHtml = logs.rows.map(l => `<div>[${l.time.toLocaleTimeString()}] ${l.sender} -> ${l.amount} -> ${l.receiver}</div>`).join('');

        res.send(`${htmlHead}
    <div class="top-bar">
        <div class="total-display">TOTAL SUPPLY: ${Number(total).toLocaleString()} / 1,000,000 WOW</div>
    </div>

    <div class="wrapper">
        <div class="left-zone">
            <canvas id="earthCanvas"></canvas>
            <div class="node-tag">GLOBAL RESERVE NODE: ACTIVE</div>
        </div>

        <div class="right-zone">
            <div style="text-align:center; margin-bottom:30px;">
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" style="width:80px;">
                <h2 style="font-family:'Orbitron'; margin-top:10px; color:var(--gold);">MBA2509007</h2>
                <p style="font-size:12px; color:#666;">Secure Asset Management Terminal</p>
            </div>

            <button class="btn btn-check" onclick="check()">🔍 ACCESS MY VAULT</button>

            <div class="panel">
                <div style="font-size:14px; margin-bottom:15px; color:var(--gold);">TRANSFER PROTOCOL</div>
                <input type="text" id="f" placeholder="Sender Name (Admin?)">
                <input type="text" id="t" placeholder="Receiver Name">
                <input type="number" id="a" placeholder="Amount (WOW)">
                <button class="btn btn-send" onclick="send()">🚀 EXECUTE TRANSFER</button>
            </div>

            <div class="log-box">
                <b>NETWORK LOGS:</b><br>${logHtml}
            </div>
        </div>
    </div>

    <script>
        // 核心：纯 Canvas 3D 球体渲染引擎
        const canvas = document.getElementById('earthCanvas');
        const ctx = canvas.getContext('2d');
        let width, height, points = [];
        const numPoints = 400;

        function init() {
            width = canvas.width = canvas.parentElement.offsetWidth;
            height = canvas.height = canvas.parentElement.offsetHeight;
            points = [];
            for(let i=0; i<numPoints; i++) {
                let theta = Math.random() * Math.PI * 2;
                let phi = Math.acos((Math.random() * 2) - 1);
                points.push({
                    x: Math.sin(phi) * Math.cos(theta),
                    y: Math.sin(phi) * Math.sin(theta),
                    z: Math.cos(phi)
                });
            }
        }

        let angle = 0;
        function draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            const radius = Math.min(width, height) * 0.35;
            angle += 0.005;

            ctx.save();
            ctx.translate(width/2, height/2);
            
            points.forEach(p => {
                // 旋转逻辑
                let x1 = p.x * Math.cos(angle) - p.z * Math.sin(angle);
                let z1 = p.z * Math.cos(angle) + p.x * Math.sin(angle);
                
                let y2 = p.y * Math.cos(angle*0.5) - z1 * Math.sin(angle*0.5);
                let z2 = z1 * Math.cos(angle*0.5) + p.y * Math.sin(angle*0.5);

                let scale = (z2 + 2) / 3;
                let alpha = (z2 + 1) / 2;
                
                ctx.fillStyle = \`rgba(240, 185, 11, \${alpha})\`;
                ctx.beginPath();
                ctx.arc(x1 * radius, y2 * radius, scale * 2, 0, Math.PI*2);
                ctx.fill();
            });
            ctx.restore();
            requestAnimationFrame(draw);
        }

        window.addEventListener('resize', init);
        init();
        draw();

        function check(){ const n=prompt("Identify Name?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
        function send(){
            const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(f&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
        }
    </script>
</body></html>`);
    } catch(e) { res.send("Terminal error. Refreshing..."); }
});

// 余额逻辑
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="panel" style="width:350px; text-align:center;"><h3>\${name} ASSETS</h3><div style="font-size:50px; font-family:'Orbitron'; margin:20px 0; color:var(--gold);">\${r.rows[0].balance}</div><button class="btn btn-check" onclick="location.href='/'">RETURN</button></div></div></body></html>`);
    }
});

// 转账逻辑
app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("Access Denied: Insufficient Funds.");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("TransFail"); }
});

startServer();
