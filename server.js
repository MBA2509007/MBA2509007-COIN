require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;

// 数据库初始化
async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
    });
    try {
        await client.connect();
        // 数据库表升级：增加安全约束
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER CHECK (balance >= 0), pin TEXT, is_frozen BOOLEAN DEFAULT FALSE)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER CHECK (amount > 0), time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
    } catch (err) {
        console.error("DB_ERR:", err.message);
        setTimeout(connectToDb, 5000);
    }
}

const getLayout = (content, hideNav = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #000; --panel: rgba(10, 10, 10, 0.98); --border: #111; --green: #00ff88; --red: #ff4444; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', sans-serif; margin: 0; overflow: hidden; height: 100vh; }
        
        /* 顶部导航 - 金黄色 Orbitron */
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-content { display: flex; align-items: center; font-family: 'Orbitron'; font-size: 13px; color: var(--gold); letter-spacing: 1.5px; padding: 0 20px; box-sizing: border-box; width: 100%; max-width: 1400px; justify-content: center; }
        .sep { margin: 0 15px; opacity: 0.4; }
        .rate-tag { margin-left: 20px; color: var(--green); border: 1px solid var(--green); padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; }

        /* 布局控制 */
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; flex-direction: row; }
        .visual { flex: 1; position: relative; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .sidebar { width: 400px; min-width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 40px 30px; display: flex; flex-direction: column; z-index: 10; box-sizing: border-box; overflow-y: auto; }

        @media (max-width: 850px) {
            .container { flex-direction: column; height: auto; overflow-y: auto; }
            .visual { height: 35vh; flex: none; width: 100%; }
            .sidebar { width: 100%; min-width: 100%; border-left: none; border-top: 1px solid var(--border); padding: 30px 20px; }
        }

        /* 组件样式 */
        .card { background: #000; border: 1px solid var(--border); padding: 25px; border-radius: 12px; margin-bottom: 20px; }
        input { width: 100%; padding: 16px; margin-bottom: 15px; background: #080808; border: 1px solid #151515; color: var(--gold); border-radius: 6px; box-sizing: border-box; outline: none; font-family: 'Orbitron'; font-size: 12px; transition: 0.3s; }
        input:focus { border-color: var(--gold); background: #0c0c0c; }
        .btn { width: 100%; padding: 18px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 11px; text-transform: uppercase; transition: 0.3s; letter-spacing: 1px; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 15px; }
        
        /* 账单样式 */
        .log-item { border-bottom: 1px solid #111; padding: 12px 0; font-size: 10px; font-family: 'Orbitron'; }
        .log-in { color: var(--green); }
        .log-out { color: var(--red); }

        /* 加载动画 */
        #loader { display:none; position:fixed; top:0; left:0; width:100%; height:3px; background: var(--gold); z-index:999; animation: loading 2s infinite; }
        @keyframes loading { 0% { left:-100%; width:30%; } 100% { left:100%; width:100%; } }
    </style>
</head>
<body>
    <div id="loader"></div>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-content">
            <span id="live-clock">00:00:00</span>
            <span class="sep">/</span>
            <span id="header-reserve">RES: LOADING...</span>
            <span class="rate-tag">1 COIN = 100 USD</span>
        </div>
    </div>`}
    ${content}
    <script>
        const audioSuccess = new Audio('https://assets.mixkit.co/active_storage/sfx/2017/2017-preview.mp3');
        function updateClock() {
            const now = new Date();
            document.getElementById('live-clock').innerText = now.toLocaleTimeString('en-US', { hour12:false });
        }
        setInterval(updateClock, 1000); updateClock();
        function showLoad() { document.getElementById('loader').style.display = 'block'; }
    </script>
</body>
</html>`;

// --- 路由 ---

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="color:var(--gold);text-align:center;padding-top:20%;">CONNECTING_DATABASE...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const total = stats.rows[0].b || 0;
        res.send(getLayout(`
            <div class="container">
                <div class="visual"><canvas id="g"></canvas></div>
                <div class="sidebar">
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="IDENT ID">
                        <input type="password" id="p" placeholder="SECURITY PIN">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE</button>
                        <button class="btn btn-outline" onclick="check()">BALANCE</button>
                        <button class="btn btn-outline" style="border-color:#222;color:#444;" onclick="viewLogs()">TRANSACTION LOGS</button>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('header-reserve').innerText = "RES: ${total.toLocaleString()} COIN";
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.offsetWidth; h=c.height=c.offsetHeight; pts=[]; for(let i=0;i<400;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.0025; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.4,p.y*Math.min(w,h)*0.4,s*1.8,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                function send(){ showLoad(); const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ showLoad(); const id = document.getElementById('f').value; location.href='/api/bal?u='+encodeURIComponent(id || 'Admin'); }
                function viewLogs(){ showLoad(); const id = document.getElementById('f').value; location.href='/api/logs?u='+encodeURIComponent(id || 'Admin'); }
            </script>
        `));
    } catch (e) { res.send("ERR"); }
});

// 账单查询路由
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await client.query('SELECT * FROM logs WHERE sender = $1 OR receiver = $1 ORDER BY time DESC LIMIT 20', [req.query.u]);
        let logHtml = logs.rows.map(l => `
            <div class="log-item">
                <div style="display:flex;justify-content:space-between">
                    <span>${new Date(l.time).toLocaleDateString()}</span>
                    <span class="${l.sender === req.query.u ? 'log-out' : 'log-in'}">${l.sender === req.query.u ? '-' : '+'}${l.amount} COIN</span>
                </div>
                <div style="font-size:8px;opacity:0.5;margin-top:4px;">${l.sender === req.query.u ? 'TO: '+l.receiver : 'FROM: '+l.sender}</div>
            </div>
        `).join('');
        res.send(getLayout(`
            <div style="padding:100px 20px; max-width:600px; margin:0 auto;">
                <h2 style="font-family:Orbitron;color:var(--gold);">TRANSACTION HISTORY</h2>
                <p style="font-size:10px;opacity:0.5;">HOLDER: ${req.query.u}</p>
                <div class="card">${logHtml || 'NO RECORDS'}</div>
                <button class="btn btn-gold" onclick="location.href='/'">BACK</button>
            </div>
        `, true));
    } catch (e) { res.redirect('/'); }
});

// 支付 API（增强安全版）
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.floor(Math.abs(parseInt(a)));
        if(isNaN(amt) || amt <= 0) return res.send("<script>alert('INVALID AMOUNT');location.href='/';</script>");
        
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('AUTH FAILED');location.href='/';</script>");
        if(auth.rows[0].is_frozen) return res.send("<script>alert('ACCOUNT FROZEN');location.href='/';</script>");

        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('LOW BALANCE');location.href='/';</script>");
        
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        
        res.send("<script>alert('SUCCESSFUL AUTHORIZATION');location.href='/';</script>");
    } catch (e) { res.redirect('/'); }
});

// 其余 API (bal, reg) 保持逻辑一致...
app.listen(port, () => { connectToDb(); });
