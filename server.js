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
        
        /* 左：原生 Canvas 高科技拓扑地球 */
        .left-zone { flex: 1; position: relative; background: #000; overflow: hidden; cursor: crosshair; }
        #nodeCanvas { pointer-events: none; }

        /* 右：卡片区 (保持不变) */
        .right-zone { width: 450px; background: var(--card); border-left: 1px solid var(--border); padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; z-index: 10; }
        .panel { background: #1a1a1a; padding: 25px; border-radius: 20px; border: 1px solid var(--border); }
        input { width: 100%; padding: 15px; margin-bottom: 15px; background: #000; border: 1px solid var(--border); color: var(--gold); border-radius: 8px; font-family: inherit; box-sizing: border-box; font-size: 16px; }
        .btn { width: 100%; padding: 18px; border-radius: 10px; border: none; cursor: pointer; font-weight: bold; font-family: 'Orbitron', sans-serif; transition: 0.3s; font-size: 16px; }
        .btn-check { background: #333; color: #fff; margin-bottom: 20px; }
        .btn-send { background: var(--gold); color: #000; }
        .btn:hover { opacity: 0.8; transform: scale(1.02); }
        .log-box { margin-top: auto; height: 150px; font-size: 11px; color: #666; overflow-y: auto; border-top: 1px solid var(--border); padding-top: 10px; }
        .node-tag { position: absolute; bottom: 20px; left: 20px; color: var(--gold); font-size: 12px; letter-spacing: 2px; text-shadow: 0 0 5px var(--gold); }
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
            <canvas id="nodeCanvas"></canvas>
            <div class="node-tag">MBA2509007 DATA TOPOLOGY: CONNECTED</div>
        </div>

        <div class="right-zone">
            <div style="text-align:center; margin-bottom:30px;">
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" style="width:80px;">
                <h2 style="font-family:'Orbitron'; margin-top:10px; color:var(--gold);">GLOBAL TERMINAL</h2>
                <p style="font-size:12px; color:#666;">Interconnected Ledger Access</p>
            </div>

            <button class="btn btn-check" onclick="check()">🔍 ACCESS MY VAULT</button>

            <div class="panel">
                <div style="font-size:14px; margin-bottom:15px; color:var(--gold);">EXECUTE TRANSFER PROTOCOL</div>
                <input type="text" id="f" placeholder="Identify Sender (Admin?)">
                <input type="text" id="t" placeholder="Identify Receiver">
                <input type="number" id="a" placeholder="Amount (WOW)">
                <button class="btn btn-send" onclick="send()">🚀 SEND TO MOON</button>
            </div>

            <div class="log-box">
                <b>NETWORK LOGS:</b><br>${logHtml}
            </div>
        </div>
    </div>

    <script>
        // 核心：原生 Canvas 3D 拓扑地球渲染引擎
        const canvas = document.getElementById('nodeCanvas');
        const ctx = canvas.getContext('2d');
        let width, height, nodes = [], links = [];
        const numNodes = ${Math.min(200, stats.rows[0].u * 10)}; // 节点数取决于用户数
        const radiusFactor = 0.38;

        function init() {
            width = canvas.width = canvas.parentElement.offsetWidth;
            height = canvas.height = canvas.parentElement.offsetHeight;
            nodes = []; links = [];
            // 创建地理数据节点
            for(let i=0; i<numNodes; i++) {
                let theta = Math.random() * Math.PI * 2;
                let phi = Math.acos((Math.random() * 2) - 1);
                nodes.push({
                    x: Math.sin(phi) * Math.cos(theta),
                    y: Math.sin(phi) * Math.sin(theta),
                    z: Math.cos(phi),
                    id: i,
                    connections: []
                });
            }
            // 创建数据连接线条
            for(let i=0; i<numNodes; i++) {
                // 每个节点随机连接 1-3 个邻近节点
                let potentialLinks = [...nodes].sort((a, b) => {
                    const d = (p, q) => Math.sqrt((p.x-q.x)**2 + (p.y-q.y)**2 + (p.z-q.z)**2);
                    return d(nodes[i], a) - d(nodes[i], b);
                }).slice(1, 4);
                
                potentialLinks.forEach(target => {
                    if(Math.random() > 0.5) {
                        links.push({ from: nodes[i], to: target });
                    }
                });
            }
        }

        let angleY = 0, angleX = 0;
        function draw() {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            const radius = Math.min(width, height) * radiusFactor;
            angleY += 0.003; // 自转
            // angleX = Math.sin(angleY) * 0.3; // 摇摆，增加立体感

            ctx.save();
            ctx.translate(width/2, height/2);
            
            // 绘制数据线条 (Links)
            ctx.lineWidth = 0.8;
            links.forEach(link => {
                let from_rotated = rotate(link.from, angleY, angleX);
                let to_rotated = rotate(link.to, angleY, angleX);

                // 只绘制面向观众的线条，增加通透感
                if(from_rotated.z > 0 || to_rotated.z > 0) {
                    let alpha = ((from_rotated.z + to_rotated.z) / 2 + 1) / 2.5;
                    ctx.strokeStyle = \`rgba(240, 185, 11, \${alpha * 0.4})\`; // 金色线条，半透明
                    ctx.beginPath();
                    ctx.moveTo(from_rotated.x * radius, from_rotated.y * radius);
                    ctx.lineTo(to_rotated.x * radius, to_rotated.y * radius);
                    ctx.stroke();
                }
            });

            // 绘制数据节点 (Nodes)
            nodes.forEach(p => {
                let rotated = rotate(p, angleY, angleX);
                let scale = (rotated.z + 1.5) / 2.5; // Z坐标影响大小
                let alpha = (rotated.z + 1) / 2; // Z坐标影响透明度
                
                ctx.fillStyle = \`rgba(240, 185, 11, \${alpha})\`; // 金色粒子
                ctx.beginPath();
                ctx.arc(rotated.x * radius, rotated.y * radius, scale * 3, 0, Math.PI*2);
                ctx.fill();
            });
            ctx.restore();
            requestAnimationFrame(draw);
        }

        // 旋转工具函数
        function rotate(p, ay, ax) {
            // 先绕Y轴转 (自转)
            let x1 = p.x * Math.cos(ay) - p.z * Math.sin(ay);
            let z1 = p.z * Math.cos(ay) + p.x * Math.sin(ay);
            // 再绕X轴转 (俯仰)
            let y2 = p.y * Math.cos(ax) - z1 * Math.sin(ax);
            let z2 = z1 * Math.cos(ax) + p.y * Math.sin(ax);
            return { x: x1, y: y2, z: z2 };
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

// balance 和 pay 逻辑保持不变
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="panel" style="width:350px; text-align:center;"><h3>\${name} VAULT</h3><div style="font-size:50px; font-family:'Orbitron'; margin:20px 0; color:var(--gold);">\${r.rows[0].balance}</div><button class="btn btn-check" onclick="location.href='/'">RETURN</button></div></div></body></html>`);
    }
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("Access Denied: Wallet Empty!");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("SystemFail"); }
});

startServer();
