const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// 1. 数据库连接配置 (带有错误捕获，防止启动崩溃)
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function startServer() {
    try {
        await client.connect();
        console.log("✅ WOW! Doge connected to Database!");
        // 创建表结构
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        // 初始化管理员
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT DO NOTHING");
    } catch (err) {
        console.error("❌ DB Connection Error:", err.message);
    }

    app.listen(port, () => {
        console.log(`🚀 MBA2509007 Mission Control active on port ${port}`);
    });
}

// 2. UI 设计部分 (Doge 官网风格)
const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 - MUCH WOW!</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&display=swap');
        :root { --dg: #e1b303; --db: #fcf1d1; --txt: #5d4037; }
        body { 
            background: var(--db); 
            background-image: url('https://www.dogecoin.com/assets/images/doge.png');
            background-repeat: no-repeat; background-position: right bottom; background-attachment: fixed;
            color: var(--txt); font-family: 'Comic Neue', cursive; margin: 0; padding-top: 60px;
        }
        .ticker { background: var(--dg); color: white; padding: 12px; position: fixed; top: 0; width: 100%; text-align: center; z-index: 100; font-size: 14px; font-weight: bold; }
        .container { max-width: 550px; margin: 0 auto; padding: 20px; text-align: center; }
        .main-card { 
            background: rgba(255, 255, 255, 0.92); padding: 35px; border-radius: 40px; 
            border: 5px solid var(--dg); box-shadow: 15px 15px 0px var(--dg);
        }
        .doge-logo { width: 120px; border: 5px solid white; border-radius: 50%; box-shadow: 0 5px 15px rgba(0,0,0,0.1); margin-bottom: 15px; }
        .status-box { background: #f4d35e; padding: 15px; border-radius: 20px; margin: 20px 0; border: 2px dashed var(--dg); }
        .btn-moon { 
            background: #ba9f33; color: white; border: none; padding: 18px 40px; 
            font-size: 22px; border-radius: 50px; cursor: pointer; transition: 0.2s; 
            font-family: inherit; box-shadow: 0 6px 0 #8d7926; margin: 10px 0;
        }
        .btn-moon:active { transform: translateY(4px); box-shadow: 0 2px 0 #8d7926; }
        .input-field { 
            width: 85%; padding: 15px; margin: 8px 0; border: 3px solid #eee; 
            border-radius: 15px; font-family: inherit; font-size: 18px;
        }
        .logs { margin-top: 30px; text-align: left; background: white; padding: 15px; border-radius: 15px; font-size: 13px; }
    </style>
</head>
<body>
    <div class="ticker" id="tk">WOW! FETCHING DOGE DATA...</div>
`;

// 3. 路由逻辑
app.get('/', async (req, res) => {
    try {
        const users = await client.query('SELECT COUNT(*) FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
        let logHtml = logs.rows.map(l => `<div style="border-bottom:1px solid #eee;padding:5px 0;">🐕 <b>${l.sender}</b> → ${l.amount} → <b>${l.receiver}</b></div>`).join('');

        res.send(`
            ${htmlHead}
            <div class="container">
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" class="doge-logo">
                <h1 style="margin:0; font-size:40px;">MBA2509007 COIN</h1>
                <p>Very Currency! Much Professional!</p>
                
                <div class="main-card">
                    <div class="status-box"><b>${users.rows[0].count}</b> Shibes in Network</div>
                    <button class="btn-moon" onclick="go('/api/balance?u='+prompt('Name?'))">🔍 CHECK MY WOWS</button>
                    <hr style="border:1px solid #eee; margin:30px 0;">
                    <input type="text" id="f" class="input-field" placeholder="From (Your Name)">
                    <input type="text" id="t" class="input-field" placeholder="To (Friend Name)">
                    <input type="number" id="a" class="input-field" placeholder="Amount">
                    <button class="btn-moon" style="background:#28a745; box-shadow:0 6px 0 #1e7e34;" onclick="send()">🚀 SEND TO MOON</button>
                    
                    <div class="logs">
                        <b style="color:var(--dg)">Recent Activity:</b><br>${logHtml || 'Waiting for first wow...'}
                    </div>
                </div>
            </div>
            <script>
                async function update(){
                    try {
                        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&include_24hr_change=true');
                        const d = await r.json();
                        document.getElementById('tk').innerHTML = "DOGE: $" + d.dogecoin.usd + " (" + d.dogecoin.usd_24h_change.toFixed(2) + "%) | MBA2509007: $1.00";
                    } catch(e){}
                }
                setInterval(update, 15000); update();
                function go(url){ location.href = url; }
                function send(){
                    const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
                    if(f&&t&&a) go('/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a);
                }
            </script>
        </body></html>`);
    } catch(e) { res.send("Doge is waking up... Refresh!"); }
});

app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
        if (r.rows.length === 0) {
            await client.query('INSERT INTO users (name, balance) VALUES ($1, 10)', [name]);
            return res.redirect('/api/balance?u=' + encodeURIComponent(name));
        }
        res.send(`${htmlHead}<div class="container"><div class="main-card"><h2>${name}'s WALLET</h2><div style="font-size:60px;margin:20px 0;">🐕</div><div class="status-box" style="font-size:32px;">${r.rows[0].balance} WOWS</div><button class="btn-moon" onclick="go('/')">BACK TO EARTH</button></div></div></body></html>`);
    } catch(e) { res.send("Error"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = parseInt(a);
        const sender = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (sender.rowCount === 0) return res.send("Not enough Wows!");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("Fail"); }
});

startServer();
