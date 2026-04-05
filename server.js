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
        
        // 核心：只在这里产生 1,000,000 个币，给 Admin
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT DO NOTHING");
        console.log("✅ 1,000,000 WOWS LOCKED IN.");
    } catch (err) { console.error("DB Error:", err.message); }
    app.listen(port);
}

const htmlHead = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>MBA2509007 - DOGE</title><style>@import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&display=swap');body { background: #fcf1d1; background-image: url('https://www.dogecoin.com/assets/images/doge.png'); background-repeat: no-repeat; background-position: right bottom; background-attachment: fixed; color: #5d4037; font-family: 'Comic Neue', cursive; margin: 0; padding-top: 60px; }.ticker { background: #e1b303; color: white; padding: 12px; position: fixed; top: 0; width: 100%; text-align: center; z-index: 100; font-size: 14px; }.container { max-width: 550px; margin: 0 auto; padding: 20px; text-align: center; }.main-card { background: rgba(255, 255, 255, 0.9); padding: 35px; border-radius: 40px; border: 5px solid #e1b303; box-shadow: 15px 15px 0px #e1b303; }.status-box { background: #f4d35e; padding: 15px; border-radius: 20px; margin: 20px 0; border: 2px dashed #e1b303; }.btn { background: #ba9f33; color: white; border: none; padding: 15px 35px; font-size: 22px; border-radius: 50px; cursor: pointer; box-shadow: 0 6px 0 #8d7926; margin: 10px 0; }.input { width: 85%; padding: 15px; margin: 8px 0; border: 3px solid #eee; border-radius: 15px; font-family: inherit; font-size: 18px; }</style></head><body><div class="ticker" id="tk">WOW! MBA2509007 ECONOMY</div>`;

app.get('/', async (req, res) => {
    try {
        const stats = await client.query('SELECT COUNT(*) as u_count, SUM(balance) as b_total FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
        const count = stats.rows[0].u_count;
        const total = stats.rows[0].b_total || 0;
        let logHtml = logs.rows.map(l => `<div style="border-bottom:1px solid #eee;padding:5px 0;">🐕 <b>${l.sender}</b> → ${l.amount} → <b>${l.receiver}</b></div>`).join('');

        res.send(`${htmlHead}<div class="container">
            <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" style="width:120px;">
            <h1 style="font-size:40px;margin:10px 0;">MBA2509007 COIN</h1>
            <div class="main-card">
                <div class="status-box">
                    <span style="font-size:12px;color:#8d7926;">LIMITED TOTAL SUPPLY</span><br>
                    <b>${count}</b> Shibes | <b style="color:#d81b60;">${Number(total).toLocaleString()}</b> / 1,000,000 WOWs
                </div>
                <button class="btn" onclick="check()">🔍 MY WALLET</button>
                <hr style="border:1px solid #eee;margin:30px 0;">
                <input type="text" id="f" class="input" placeholder="From (Your Name)">
                <input type="text" id="t" class="input" placeholder="To (Friend Name)">
                <input type="number" id="a" class="input" placeholder="Amount">
                <button class="btn" style="background:#28a745;box-shadow:0 6px 0 #1e7e34;" onclick="send()">🚀 SEND WOW</button>
                <div style="text-align:left;margin-top:20px;font-size:13px;"><b>Recent Activity:</b><br>${logHtml}</div>
            </div>
        </div><script>
            async function up(){try{const r=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=dogecoin&include_24hr_change=true');const d=await r.json();document.getElementById('tk').innerHTML="DOGE: $"+d.dogecoin.usd+" ("+d.dogecoin.usd_24h_change.toFixed(2)+"%) | MBA2509007: $1.00"}catch(e){}}
            setInterval(up,15000);up();
            function check(){const n=prompt("Name?");if(n)location.href='/api/balance?u='+encodeURIComponent(n)}
            function send(){const f=document.getElementById('f').value,t=document.getElementById('t').value,a=document.getElementById('a').value;if(f&&t&&a)location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a}
        </script></body></html>`);
    } catch(e) { res.send("Doge is loading..."); }
});

app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        // 修改：新用户注册初始余额为 0
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}<div class="container"><div class="main-card"><h2>${name}</h2><div style="font-size:48px;margin:20px 0;">${r.rows[0].balance}</div><button class="btn" onclick="location.href='/'">BACK</button></div></div></body></html>`);
    }
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a)); // 防止负数转账
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("Not enough wows in your wallet!");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("Transaction Error"); }
});

startServer();
