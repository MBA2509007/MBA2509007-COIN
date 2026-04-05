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
        
        /* 顶部：全网总数 */
        .top-bar { 
            position: fixed; top: 0; width: 100%; height: 80px; 
            background: rgba(0,0,0,0.8); border-bottom: 1px solid var(--border);
            display: flex; justify-content: center; align-items: center; z-index: 100;
        }
        .total-display { font-family: 'Orbitron', sans-serif; font-size: 32px; color: var(--gold); text-shadow: 0 0 10px rgba(240,185,11,0.5); }

        /* 主体分栏布局 */
        .wrapper { display: flex; height: 100vh; padding-top: 80px; box-sizing: border-box; }
        
        /* 左：地球区 */
        .left-zone { flex: 1; position: relative; display: flex; justify-content: center; align-items: center; }
        #earth-iframe { width: 100%; height: 100%; border: none; pointer-events: none; }

        /* 右：卡片区 */
        .right-zone { width: 450px; background: var(--card); border-left: 1px solid var(--border); padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; }
        
        .panel { background: #1a1a1a; padding: 25px; border-radius: 20px; border: 1px solid var(--border); }
        .input-group { margin-top: 20px; }
        input { 
            width: 100%; padding: 15px; margin-bottom: 15px; background: #000; border: 1px solid var(--border); 
            color: var(--gold); border-radius: 8px; font-family: inherit; box-sizing: border-box;
        }
        .btn { 
            width: 100%; padding: 18px; border-radius: 10px; border: none; cursor: pointer; 
            font-weight: bold; font-family: 'Orbitron', sans-serif; transition: 0.3s;
        }
        .btn-check { background: #333; color: #fff; margin-bottom: 20px; }
        .btn-send { background: var(--gold); color: #000; }
        .btn:hover { opacity: 0.8; transform: scale(1.02); }

        .log-box { margin-top: auto; height: 150px; font-size: 11px; color: #666; overflow-y: auto; border-top: 1px solid var(--border); padding-top: 10px; }
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
            <iframe id="earth-iframe" src="https://www.chromeexperiments.com/globe"></iframe>
            <div style="position:absolute; bottom:20px; left:20px; color:var(--gold); font-size:12px;">GLOBAL NODE STATUS: ONLINE</div>
        </div>

        <div class="right-zone">
            <div style="text-align:center; margin-bottom:30px;">
                <img src="https://cryptologos.cc/logos/dogecoin-doge-logo.png" style="width:80px;">
                <h2 style="font-family:'Orbitron'; margin-top:10px;">MBA2509007</h2>
                <p style="font-size:12px; color:#666;">High Fidelity Asset Terminal</p>
            </div>

            <button class="btn btn-check" onclick="check()">🔍 ACCESS MY VAULT</button>

            <div class="panel">
                <div style="font-size:14px; margin-bottom:15px; color:var(--gold);">NEW TRANSACTION</div>
                <div class="input-group">
                    <input type="text" id="f" placeholder="Sender Name (Admin?)">
                    <input type="text" id="t" placeholder="Receiver Name">
                    <input type="number" id="a" placeholder="Amount (WOW)">
                </div>
                <button class="btn btn-send" onclick="send()">🚀 EXECUTE TRANSFER</button>
            </div>

            <div class="log-box">
                <b>NETWORK LOGS:</b><br>${logHtml}
            </div>
        </div>
    </div>

    <script>
        function check(){ const n=prompt("Identify?"); if(n) location.href='/api/balance?u='+encodeURIComponent(n); }
        function send(){
            const f=document.getElementById('f').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(f&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
        }
    </script>
</body></html>`);
    } catch(e) { res.send("Terminal error. Refreshing..."); }
});

// 余额页
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}
        <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
            <div class="panel" style="width:350px; text-align:center;">
                <h3 style="color:var(--gold);">${name}'s ASSETS</h3>
                <div style="font-size:50px; font-family:'Orbitron'; margin:20px 0;">${r.rows[0].balance}</div>
                <button class="btn btn-check" onclick="location.href='/'">RETURN</button>
            </div>
        </div></body></html>`);
    }
});

// 转账页
app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("Transaction Rejected: Insufficient Funds.");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.send("System Error"); }
});

startServer();
