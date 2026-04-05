const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    try {
        await client.connect();
        // 增加交易记录表，让每笔钱都有据可查
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT DO NOTHING");
    } catch (err) { console.error("Database Error:", err); }
}
initDatabase();

const htmlHead = `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 Terminal</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root { --gold: #f0b90b; --bg: #0b0e11; --card: #1e2329; --green: #02c076; --red: #cf304a; }
        body { background: var(--bg); color: white; font-family: 'Roboto', sans-serif; margin: 0; overflow-x: hidden; }
        
        /* 顶部行情条 */
        .ticker { background: #181a20; padding: 10px; border-bottom: 1px solid #333; display: flex; gap: 30px; font-size: 12px; white-space: nowrap; overflow: hidden; }
        .ticker span { color: var(--gold); font-weight: bold; }

        .main-layout { display: grid; grid-template-columns: 1fr 350px; gap: 20px; padding: 20px; max-width: 1400px; margin: auto; }
        
        /* 左侧操作区 */
        .panel { background: var(--card); border-radius: 12px; padding: 25px; border: 1px solid #2b3139; }
        .balance-card { background: linear-gradient(135deg, #2b3139 0%, #1e2329 100%); padding: 30px; border-radius: 15px; border-left: 5px solid var(--gold); margin-bottom: 20px; }
        
        /* 右侧侧边栏 */
        .sidebar { display: flex; flex-direction: column; gap: 20px; }
        .order-book { background: #181a20; border-radius: 8px; padding: 15px; font-size: 13px; height: 400px; overflow-y: auto; }
        .order-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2b3139; }
        
        .input-group { margin-bottom: 15px; text-align: left; }
        input { width: 100%; padding: 12px; background: #2b3139; border: 1px solid #474d57; color: white; border-radius: 5px; box-sizing: border-box; }
        .btn { width: 100%; padding: 15px; border-radius: 5px; border: none; font-weight: bold; cursor: pointer; transition: 0.2s; margin-top: 10px; }
        .btn-buy { background: var(--green); color: white; }
        .btn-sell { background: var(--red); color: white; }
        
        h2 { font-size: 18px; margin-top: 0; color: #eaecef; }
        .price-up { color: var(--green); }
    </style>
</head>
<body>
    <div class="ticker">
        <div>BTC/USDT <span class="price-up">$68,432.12 +2.4%</span></div>
        <div>ETH/USDT <span class="price-up">$3,841.05 +1.8%</span></div>
        <div>MBA2509007/USDT <span>$1.00 (STABLE)</span></div>
        <div>MARKET STATUS: <span style="color: var(--green)">STABLE</span></div>
    </div>
`;

app.get('/', async (req, res) => {
    const users = await client.query('SELECT COUNT(*) FROM users');
    const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
    
    let logHtml = logs.rows.map(l => `
        <div class="order-item">
            <span style="color:#848e9c">${l.sender} ➔ ${l.receiver}</span>
            <span class="price-up">${l.amount}</span>
        </div>
    `).join('');

    res.send(`
        ${htmlHead}
        <div class="main-layout">
            <div class="panel">
                <div class="balance-card">
                    <p style="color:#848e9c; margin:0;">Total Market Participants</p>
                    <h1 style="font-size: 48px; margin: 10px 0;">${users.rows[0].count} <span style="font-size:18px; color:var(--gold)">NODES</span></h1>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-buy" onclick="openWallet()">DASHBOARD / 资产看板</button>
                    </div>
                </div>
                
                <h2>快速交易执行 (Trade Execution)</h2>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                    <div class="input-group">
                        <label>FROM ACCOUNT</label>
                        <input type="text" id="from" placeholder="您的姓名">
                    </div>
                    <div class="input-group">
                        <label>TO ACCOUNT</label>
                        <input type="text" id="to" placeholder="接收方姓名">
                    </div>
                </div>
                <div class="input-group">
                    <label>TRANSFER AMOUNT (COIN)</label>
                    <input type="number" id="amt" placeholder="0.00">
                </div>
                <button class="btn btn-sell" onclick="executeTrade()">确认加密转账 (SECURE TRANSFER)</button>
            </div>

            <div class="sidebar">
                <div class="panel" style="padding:15px;">
                    <h2>最新成交 (Recent Trades)</h2>
                    <div class="order-book">${logHtml || '<p style="color:#474d57">等待交易信号...</p>'}</div>
                </div>
            </div>
        </div>

        <script>
            function openWallet() {
                const n = prompt("ENTER ACCOUNT NAME:");
                if(n) window.location.href = '/api/balance?u=' + encodeURIComponent(n);
            }
            function executeTrade() {
                const f = document.getElementById('from').value;
                const t = document.getElementById('to').value;
                const a = document.getElementById('amt').value;
                if(f && t && a) window.location.href = '/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
                else alert("请完善交易信息");
            }
        </script>
    </body></html>
    `);
});

// 余额查询页也进行了专业化适配
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 10)', [name]);
        res.redirect('/api/balance?u=' + encodeURIComponent(name));
    } else {
        res.send(`${htmlHead}<div style="display:flex; justify-content:center; align-items:center; height:100vh;">
            <div class="panel" style="width:400px; text-align:center;">
                <h2 style="color:var(--gold)">ACCOUNT: ${name}</h2>
                <div style="font-size:64px; font-weight:bold; margin:20px 0;">${r.rows[0].balance}</div>
                <p style="color:#848e9c">AVAILABLE MBA2509007 COIN</p>
                <button class="btn btn-buy" onclick="location.href='/'">RETURN TO TERMINAL</button>
            </div>
        </div></body>`);
    }
});

app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    const amount = parseInt(a);
    try {
        const sender = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amount, f]);
        if (sender.rowCount === 0) return res.send("Insufficient Balance");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amount]);
        // 记录交易日志
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amount]);
        res.redirect('/');
    } catch (e) { res.send("Transaction Failed"); }
});

app.listen(port);
