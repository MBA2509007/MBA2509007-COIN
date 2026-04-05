const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// 数据库连接
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT DO NOTHING");
    } catch (err) { console.error("DB Error:", err); }
}
initDatabase();

const htmlHead = `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MBA2509007 - DOGE</title><style>@import url('https://fonts.googleapis.com/css2?family=Comic+Neue:wght@700&display=swap');:root { --dg: #e1b303; --db: #fcf1d1; }body { background: var(--db); background-image: url('https://www.dogecoin.com/assets/images/doge.png'); background-repeat: no-repeat; background-position: right bottom; background-attachment: fixed; color: #5d4037; font-family: 'Comic Neue', cursive; margin: 0; padding-top: 60px; }.ticker { background: var(--dg); color: white; padding: 12px; position: fixed; top: 0; width: 100%; text-align: center; z-index: 100; font-size: 14px; }.container { max-width: 500px; margin: 0 auto; padding: 20px; text-align: center; }.main-card { background: rgba(255, 255, 255, 0.9); padding: 30px; border-radius: 30px; border: 4px solid var(--dg); box-shadow: 10px 10px 0px var(--dg); }.btn-moon { background: #ba9f33; color: white; border: none; padding: 15px 30px; font-size: 20px; border-radius: 50px; cursor: pointer; transition: 0.2s; box-shadow: 0 5px 0 #8d7926; margin: 10px 0; }.input-field { width: 90%; padding: 12px; margin: 8px 0; border: 2px solid #eee; border-radius: 12px; font-family: inherit; }</style></head><body><div class="ticker">WOW! TO THE MOON! 🚀</div>`;

app.get('/', async (req, res) => {
    try {
        const users = await client.query('SELECT COUNT(*) FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
        let logHtml = logs.rows.map(l => `<div>🐕 ${l.sender} -> ${l.receiver} (${l.amount})</div>`).join('');
        res.send(`${htmlHead}<div class="container"><div class="main-card"><h1>MBA2509007 COIN</h1><p>Much Wow! Very Exchange!</p><div style="background:#f4d35e;padding:15px;border-radius:15px;margin:15px 0;"><b>${users.rows[0].count}</b> Shibes Registered</div><button class="btn-moon" onclick="check()">🔍 WALLET</button><hr><input type="text" id="f" class="input-field" placeholder="From"><input type="text" id="t" class="input-field" placeholder="To"><input type="number" id="a" class="input-field" placeholder="Amount"><button class="btn-moon" style="background:#28a745;" onclick="send()">🚀 SEND</button><div>${logHtml}</div></div></div><script>function check(){const n=prompt("Name?");if(n)location.href='/api/balance?u='+encodeURIComponent(n)}function send(){const f=document.getElementById('f').value,t=document.getElementById('t').value,a=document.getElementById('a').value;if(f&&t&&a)location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a}</script></body></html>`);
    } catch(e) { res.send("Error"); }
});

app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 10)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}<div class="container"><div class="main-card"><h2>${name}</h2><div style="font-size:40px;">${r.rows[0].balance} COINS</div><button class="btn-moon" onclick="location.href='/'">BACK</button></div></div></body></html>`);
    }
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const sender = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [parseInt(a), f]);
        if (sender.rowCount === 0) return res.send("No money!");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, parseInt(a)]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, parseInt(a)]);
        res.redirect('/');
    } catch (e) { res.send("Fail"); }
});

app.listen(port);
