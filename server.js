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

// 2. UI 设计 (高科技 3D Earth 布局版)
const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 GLOBAL RESERVE</title>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Play&display=swap');
    <style>
        :root { --gold: #f0b90b; --bg: #0b0e11; --text: #eaecef; --card: #1e2329; --border: #2b3139; }
        body { 
            background: var(--bg); color: var(--text); font-family: 'Play', sans-serif; margin: 0; overflow-x: hidden;
            background-image: radial-gradient(circle at 50% 50%, #1e2329 0%, #0b0e11 100%);
        }

        /* 顶部总供应量 (醒目显示) */
        .header-stats { 
            background: #181a20; padding: 20px; border-bottom: 1px solid var(--border); 
            text-align: center; position: fixed; top: 0; width: 100%; z-index: 100;
        }
        .header-stats .total-label { font-size: 12px; color: #848e9c; text-transform: uppercase; letter-spacing: 2px; }
        .header-stats .total-amount { font-size: 48px; color: var(--gold); font-weight: bold; font-family: 'Orbitron', sans-serif; text-shadow: 0 0 15px rgba(240, 185, 11, 0.4); }

        /* 主体布局 (左地球，右卡片) */
        .main-layout { 
            display: grid; grid-template-columns: 1fr 400px; gap: 40px; 
            margin-top: 140px; padding: 40px; max-width: 1600px; margin-left: auto; margin-right: auto;
        }

        /* 左侧：3D 地球区 */
        .earth-container { position: relative; height: 700px; border-radius: 20px; }
        #earth_canvas { width: 100%; height: 100%; border-radius: 20px; }
        .node-status { 
            position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.6); 
            padding: 10px 20px; border-radius: 10px; font-size: 14px; color: var(--gold); border: 1px solid var(--border);
        }

        /* 右侧：功能卡片 (优化版) */
        .panel { 
            background: var(--card); border-radius: 16px; padding: 30px; border: 1px solid var(--border); 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3); height: 600px; overflow-y: auto;
        }
        .status-badge { 
            background: #2b3139; padding: 12px; border-radius: 10px; margin-bottom: 25px; 
            border: 1px dashed var(--gold); text-align: center; font-size: 18px; color: var(--gold);
        }
        .btn-gold { 
            background: var(--gold); color: black; border: none; padding: 18px; 
            font-size: 20px; border-radius: 10px; cursor: pointer; transition: 0.2s; width: 100%; font-family: inherit; font-weight: bold;
        }
        .btn-gold:hover { background: #e0ac0a; transform: translateY(-2px); }
        .btn-gold:active { transform: translateY(1px); }
        .input-group input { 
            width: 85%; padding: 15px; margin: 10px 0; border: 1px solid #474d57; background: #2b3139;
            color: white; border-radius: 8px; font-size: 16px; font-family: inherit;
        }
        .logs-box { margin-top: 30px; text-align: left; font-size: 13px; color: #848e9c; }
        .log-item { border-bottom: 1px solid #2b3139; padding: 8px 0; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/webglearth@1.1.0/lib/webglearth.js"></script>
</head>
<body>
    <div class="header-stats">
        <div id="loading" style="color:var(--gold);">[LOADING RESERVE DATA...]</div>
    </div>
`;

app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT COUNT(*) as u_count, SUM(balance) as b_total FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 8');
        const count = stats.rows[0].u_count;
        const total = stats.rows[0].b_total || 0;
        let logHtml = logs.rows.map(l => `<div class="log-item">🐕 <b>${l.sender}</b> to <b>${l.receiver}</b>: +${l.amount}</div>`).join('');

        res.send(`${htmlHead}
        <div class="main-layout">
            <div class="earth-container">
                <div id="earth_canvas"></div>
                <div class="node-status">GLOBAL NETWORK: <b id="shibe-count">0</b> SHIBES ACTIVE</div>
            </div>

            <div class="panel">
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" style="width:100px; display:block; margin:0 auto 15px auto;">
                <h1 style="font-size:32px;margin:0 0 10px 0;text-align:center;">MBA2509007 TERMINAL</h1>
                <p style="color:#848e9c; text-align:center; margin-bottom:25px;">Much Wow! Very Capital!</p>

                <button class="btn-gold" onclick="check()">🔍 ACCESS MY金库</button>
                <hr style="border:0.5px solid #2b3139; margin:30px 0;">
                
                <h3 style="color:#fff;">SEND WOWS</h3>
                <div class="input-group">
                    <input type="text" id="f" placeholder="支付人姓名 (Admin?)">
                    <input type="text" id="t" placeholder="收款人姓名 (Shibe Friend)">
                    <input type="number" id="a" placeholder="Amount (WOW)">
                </div>
                <button class="btn-gold" style="background:#02c076;" onclick="send()">🚀 SEND TO MOON</button>
                
                <div class="logs-box"><b>Recent Network Activity:</b><br>${logHtml || 'Waiting for first wow...'}</div>
            </div>
        </div>
        <script>
            // 初始化地球
            function initialize() {
                var earth = new WE.map('earth_canvas', {
                    center: [30, 0], zoom: 2, sky: true, atmosphere: true, dragging: true, tilting: true
                });
                WE.tileLayer('https://tileserver.maptiler.com/maps/satellite/{z}/{x}/{y}.jpg', {
                    opacity: 0.8
                }).addTo(earth);
                
                // 实时自转
                var speed = 0.5; // 转动速度
                setInterval(function() {
                    var c = earth.getPosition();
                    earth.panTo([c[0], c[1] + speed]);
                }, 50);

                // 更新顶部数据
                document.getElementById('header-stats').innerHTML = \`<div class="total-label">全网 COINS SUPPLY LOCKIN</div><div class="total-amount">${Number(total).toLocaleString()} WOWs</div>\`;
                document.getElementById('shibe-count').innerText = "${count}";
            }
            window.onload = initialize;

            function check(){const n=prompt("Access Key? (Name)");if(n)location.href='/api/balance?u='+encodeURIComponent(n)}
            function send(){const f=document.getElementById('f').value,t=document.getElementById('t').value,a=document.getElementById('a').value;if(f&&t&&a)location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a}
        </script></body></html>`);
    } catch(e) { res.send("Systemwarming..."); }
});

// balance and pay 逻辑保持不变
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="panel" style="width:400px;text-align:center;"><h2>${name}'s VAULT</h2><div style="font-size:60px;margin:20px 0; color:var(--gold); font-family:'Orbitron';">${r.rows[0].balance}</div><button class="btn-gold" onclick="location.href='/'">BACK</button></div></div></body></html>`);
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
    } catch (e) { res.send("TransFail"); }
});

startServer();
