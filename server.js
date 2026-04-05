const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// 1. 数据库连接配置
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    try {
        await client.connect();
        console.log("✅ WOW! Connected to Database!");
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT DO NOTHING");
    } catch (err) { console.error("❌ Database Error:", err); }
}
initDatabase();

// 2. 页面设计 (纯正 Doge 风格)
const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 - MUCH WOW!</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&display=swap');
        
        :root { --doge-gold: #e1b303; --doge-bg: #fcf1d1; --text: #5d4037; }
        
        body { 
            background: var(--doge-bg); 
            background-image: url('https://www.dogecoin.com/assets/images/doge.png');
            background-repeat: no-repeat; background-position: right bottom; background-attachment: fixed;
            color: var(--text); font-family: 'Comic Neue', 'Comic Sans MS', cursive; margin: 0; padding-top: 60px;
        }

        /* 顶部行情 */
        .ticker { background: var(--doge-gold); color: white; padding: 12px; position: fixed; top: 0; width: 100%; text-align: center; z-index: 100; font-size: 14px; font-weight: bold; }

        .container { max-width: 600px; margin: 0 auto; padding: 20px; text-align: center; }
        
        .doge-header img { width: 150px; border: 6px solid white; border-radius: 50%; box-shadow: 0 10px 20px rgba(0,0,0,0.1); margin-bottom: 20px; }
        
        .main-card { 
            background: rgba(255, 255, 255, 0.95); padding: 40px; border-radius: 40px; 
            border: 5px solid var(--doge-gold); box-shadow: 15px 15px 0px var(--doge-gold);
        }

        .balance-display { background: #f4d35e; padding: 20px; border-radius: 20px; margin: 20px 0; border: 3px dashed var(--doge-gold); }

        .input-group input { 
            width: 85%; padding: 15px; margin: 10px 0; border: 3px solid #eee; 
            border-radius: 15px; font-family: inherit; font-size: 18px; transition: 0.3s;
        }
        .input-group input:focus { border-color: var(--doge-gold); outline: none; }

        .btn-moon { 
            background: #ba9f33; color: white; border: none; padding: 18px 45px; 
            font-size: 24px; border-radius: 50px; cursor: pointer; transition: 0.2s; 
            font-family: inherit; box-shadow: 0 6px 0 #8d7926; margin-top: 15px;
        }
        .btn-moon:active { transform: translateY(4px); box-shadow: 0 2px 0 #8d7926; }

        .log-section { margin-top: 40px; text-align: left; background: white; padding: 20px; border-radius: 20px; }
        .log-item { border-bottom: 1px solid #eee; padding: 10px 0; font-size: 14px; }
    </style>
</head>
<body>
    <div class="ticker" id="ticker">WOW! FETCHING REAL DATA...</div>
`;

app.get('/', async (req, res) => {
    const users = await client.query('SELECT COUNT(*) FROM users');
    const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
    let logHtml = logs.rows.map(l => `<div class="log-item">🐕 <b>${l.sender}</b> sent ${l.amount} to <b>${l.receiver}</b></div>`).join('');

    res.send(`
        ${htmlHead}
        <div class="container">
            <div class="doge-header">
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" alt="Doge">
                <h1 style="font-size: 45px; margin: 0;">MBA2509007 COIN</h1>
                <p style="font-size: 20px;">Such Currency! Very Transfer! To the Moon! 🚀</p>
            </div>

            <div class="main-card">
                <div class="balance-display">
                    <span style="font-size: 14px; color: #8d7926;">NETWORK STATUS: ACTIVE</span><br>
                    <b>${users.rows[0].count}</b> Shibes Registered
                </div>

                <button class="btn-moon" onclick="checkBalance()">🔍 MY WALLET</button>
                
                <hr style="border: 1px solid #eee; margin: 40px 0;">
                
                <h2 style="color: var(--doge-gold)">SEND WOWS</h2>
                <div class="input-group">
                    <input type="text" id="f" placeholder="Your Name">
                    <input type="text" id="t" placeholder="Receiver Name">
                    <input type="number" id="a" placeholder="How many coins?">
                </div>
                <button class="btn-moon" style="background:#28a745; box-shadow: 0 6px 0 #1e7e34;" onclick="send()">🚀 SEND TO MOON</button>

                <div class="log-section">
                    <p style="font-weight:bold; color: var(--doge-gold)">Recent Activity:</p>
                    ${logHtml || 'No wows yet...'}
                </div>
            </div>
        </div>

        <script>
            // 实时 DogeCoin API
            async function getDoge() {
                try {
                    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&include_24hr_change=true');
                    const d = await r.json();
                    const p = d.dogecoin.usd;
                    const c = d.dogecoin.usd_24h_change.toFixed(2);
                    document.getElementById('ticker').innerHTML = "DOGE: $" + p + " (" + (c>0?"+":"") + c + "%) | MBA2509007: $1.00 | VERY PROFIT! 🚀";
                } catch(e) {}
            }
            setInterval(getDoge, 15000); getDoge();

            function checkBalance() {
                const n = prompt("What is your name, Shibe?");
                if(n) window.location.href = '/api/balance?u=' + encodeURIComponent(n);
            }
            function send() {
                const f = document.getElementById('f').value, t = document.getElementById('t').value, a = document.getElementById('a').value;
                if(f && t && a) window.location.href = '/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
            }
        </script>
    </body></html>
    `);
});

// 余额查询页
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 10)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}
            <div class="container"><div class="main-card">
                <h1 style="color:var(--doge-gold)">${name}'s WOWS</h1>
                <div style="font-size:80px; margin:20px 0;">🐕</div>
                <div class="balance-display" style="font-size:40px; font-weight:bold;">${r.rows[0].balance} COINS</div>
                <button class="btn-moon" onclick="location.href='/'">BACK TO EARTH</button>
            </div></div>
        </body>`);
    }
});

// 转账逻辑
app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = parseInt(a);
        const sender = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (sender.rowCount === 0) return res.send("Not enough coins for this wow! Check your name.");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("Transaction failed!"); }
});

app.listen(port);
