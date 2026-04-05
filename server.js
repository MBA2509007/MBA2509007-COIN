const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// 增加错误捕获，防止因数据库连不上而直接 Status 1
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function startServer() {
    try {
        await client.connect();
        console.log("✅ WOW! Doge is connected!");
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    } catch (err) {
        console.error("❌ DB connection failed, but keeping server alive:", err.message);
    }

    app.listen(port, () => {
        console.log(`🚀 Moon mission started on port ${port}`);
    });
}

const htmlHead = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>MBA2509007 - DOGE</title><style>@import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&display=swap');body { background: #fcf1d1; background-image: url('https://www.dogecoin.com/assets/images/doge.png'); background-repeat: no-repeat; background-position: right bottom; background-attachment: fixed; color: #5d4037; font-family: 'Comic Neue', cursive; margin: 0; padding-top: 60px; }.ticker { background: #e1b303; color: white; padding: 12px; position: fixed; top: 0; width: 100%; text-align: center; z-index: 100; }.container { max-width: 500px; margin: 0 auto; padding: 20px; text-align: center; }.main-card { background: rgba(255, 255, 255, 0.9); padding: 30px; border-radius: 30px; border: 4px solid #e1b303; box-shadow: 10px 10px 0px #e1b303; }.btn { background: #ba9f33; color: white; border: none; padding: 15px 30px; font-size: 20px; border-radius: 50px; cursor: pointer; box-shadow: 0 5px 0 #8d7926; margin: 10px 0; }.input { width: 90%; padding: 12px; margin: 8px 0; border: 2px solid #eee; border-radius: 12px; font-family: inherit; }</style></head><body><div class="ticker">MUCH WOW! MBA2509007 TO THE MOON! 🚀</div>`;

app.get('/', async (req, res) => {
    try {
        const users = await client.query('SELECT COUNT(*) FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
        let logHtml = logs.rows.map(l => `<div>🐕 ${l.sender} -> ${l.receiver} (${l.amount})</div>`).join('');
        res.send(`${htmlHead}<div class="container"><div class="main-card"><h1>MBA2509007 COIN</h1><div style="background:#f4d35e;padding:15px;border-radius:15px;margin:15px 0;"><b>${users.rows[0].count}</b> Shibes Registered</div><button class="btn" onclick="check()">🔍 MY WALLET</button><hr><input type="text" id="f" class="input" placeholder="From"><input type="text" id="t" class="input" placeholder="To"><input type="number" id="a" class="input" placeholder="Amount"><button class="btn" style="background:#28a745;" onclick="send()">🚀 SEND WOW</button><div style="margin-top:20px; text-align:left;">${logHtml}</div></div></div><script>function check(){const n=prompt("Name?");if(n)location.href='/api/balance?u='+encodeURIComponent(n)}function send(){const f=document.getElementById('f').value,t=document.getElementById('t').value,a=document.getElementById('a').value;if(f&&t&&a)location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a}</script></body></html>`);
    } catch(e) { res.send("System is warming up... Refresh in 5s."); }
});

app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 10)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}<div class="container"><div class="main-card"><h2>${name}'s WOWS</h2><div style="font-size:48px;margin:20px 0;">${r.rows[0].balance}</div><button class="btn" onclick="location.href='/'">BACK</button></div></div></body></html>`);
    }
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [parseInt(a), f]);
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, parseInt(a)]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, parseInt(a)]);
        res.redirect('/');
    } catch (e) { res.send("Transaction failed!"); }
});

startServer();
