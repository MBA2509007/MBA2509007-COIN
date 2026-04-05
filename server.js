require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const jwt = require('jsonwebtoken'); // 核心：安全令牌
const app = express();
const port = process.env.PORT || 3000;
const SECRET = "MBA2509007_SECRET_KEY"; // JWT 密钥

let client = null;
let isDbReady = false;

async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000,
    });
    try {
        await client.connect();
        // 数据库表结构升级
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
    } catch (err) {
        console.error("DB_ERR:", err.message);
        setTimeout(connectToDb, 5000);
    }
}

const getLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.95); --border: #222; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .header { position: fixed; top: 0; width: 100%; height: 70px; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-content { display: flex; align-items: center; font-family: 'Orbitron'; font-size: 14px; color: var(--gold); letter-spacing: 2px; }
        .separator { margin: 0 15px; opacity: 0.6; }
        .container { display: flex; height: 100vh; padding-top: 70px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; display:flex; flex-direction:column; }
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; z-index: 10; overflow-y: auto; }
        .card { background: #000; border: 1px solid var(--border); padding: 22px; border-radius: 12px; margin-bottom: 25px; }
        input { width: 100%; padding: 14px; margin-bottom: 12px; background: #080808; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; outline: none; font-family: 'Orbitron'; font-size: 12px; }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 12px; transition: 0.3s; text-transform: uppercase; }
        .btn-gold { background: var(--gold); color: #000; margin-top: 5px; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 12px; }
        .tab-btn { background: #111; color: #444; border: none; padding: 12px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 4px; margin: 0 5px; }
        .tab-btn.active { background: var(--gold); color: #000; }
        .leaderboard { padding: 20px; color: #555; font-size: 11px; flex-grow:1; }
        .lb-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #111; }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="text-align:center;width:100%;padding-top:20%;color:var(--gold);font-family:Orbitron;">QUANTUM_SYNCING...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const ranking = await client.query('SELECT name, balance FROM users ORDER BY balance DESC LIMIT 5');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 5');
        const total = stats.rows[0].b || 0;
        
        let rankHtml = ranking.rows.map((r, i) => `<div class="lb-item"><span>#${i+1} ${r.name}</span><span style="color:#888;">${r.balance.toLocaleString()}</span></div>`).join('');
        let logHtml = logs.rows.map(l => `<div style="font-size:10px; color:#444; margin-bottom:5px;">${l.sender} > ${l.receiver} [${l.amount}]</div>`).join('');

        res.send(getLayout(`
            <div class="header">
                <div class="header-content">
                    <span id="live-clock">00:00:00</span>
                    <span class="separator">/</span>
                    <span>EXCHANGE RESERVE: ${total.toLocaleString()} COIN</span>
                </div>
            </div>
            <div class="container">
                <div class="visual">
                    <canvas id="g" style="flex:2;"></canvas>
                    <div class="leaderboard">
                        <div style="font-family:Orbitron; margin-bottom:15px; letter-spacing:2px; color:#333;">TOP_HOLDERS_RANKING</div>
                        ${rankHtml}
                    </div>
                </div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:20px;">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TERMINAL</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">REGISTRY</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="IDENTIFICATION ID">
                        <input type="password" id="p" placeholder="SECURITY PIN">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="TRANSFER AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE</button>
                        <button class="btn btn-outline" onclick="check()">SCAN BALANCE</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="NEW UNIQUE ID">
                        <input type="password" id="rp" placeholder="6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">GENERATE VAULT</button>
                    </div>
                    <div style="font-family:Orbitron; font-size:10px; color:#222; margin-bottom:10px;">RECENT_SIGNALS</div>
                    <div>${logHtml}</div>
                </div>
            </div>
            <script>
                // 3D Visuals
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; pts=[]; for(let i=0;i<400;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#050505'; x.fillRect(0,0,w,h); r+=0.003; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.35,p.y*Math.min(w,h)*0.35,s*1.5,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();

                function updateClock() {
                    const now = new Date();
                    const opt = { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false };
                    document.getElementById('live-clock').innerText = now.toLocaleString('en-US', opt).toUpperCase();
                }
                setInterval(updateClock, 1000); updateClock();

                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const id = document.getElementById('f').value; if(id) location.href='/api/bal?u='+encodeURIComponent(id); else { const n=prompt("ID:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); } }
            </script>
        `));
    } catch (e) { res.send("SYSTEM_BUSY"); }
});

// API：真正钱包逻辑与防作弊
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.floor(Math.abs(parseInt(a))); // 防绕过：强制正整数
        if(isNaN(amt) || amt <= 0) throw new Error("Invalid Amount");

        // 1. 验证身份 (简易版登录逻辑)
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('SEC_AUTH_FAILED: PIN ERROR');location.href='/';</script>");

        // 2. 原子化扣款 (防超支作弊)
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('ERR_INSUFFICIENT_FUNDS');location.href='/';</script>");

        // 3. 增加收款方金额
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        
        // 4. 写入不可逆账本
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('SUCCESS: VAULT INITIALIZED');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ERR: ID EXISTS');location.href='/';</script>"); }
});

app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        const b = r.rows.length ? r.rows[0].balance : 0;
        res.send(getLayout(`<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="card" style="width:380px;text-align:center;border-color:var(--gold);box-shadow:0 0 30px rgba(240,185,11,0.2);"><div style="font-family:Orbitron;color:var(--gold);font-size:12px;opacity:0.5;">HOLDER_ID</div><div style="font-family:Orbitron;font-size:18px;margin-bottom:20px;">${req.query.u}</div><div style="font-size:3.5rem;font-family:Orbitron;color:#fff;text-shadow:0 0 20px var(--gold);">${b.toLocaleString()}</div><div style="color:var(--gold);font-size:10px;margin-top:10px;letter-spacing:4px;">COIN CREDITS</div><button class="btn btn-gold" style="margin-top:40px;" onclick="location.href='/'">BACK TO TERMINAL</button></div></div>`));
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
