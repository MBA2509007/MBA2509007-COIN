require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;
let dbError = "Initializing MBA Quantum Node...";

// 1. 核心连接与自动修复逻辑
async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });

    try {
        await client.connect();
        
        // 自动创建基础表
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 【智能修复】如果旧表没有 pin 列，自动添加
        try {
            await client.query('ALTER TABLE users ADD COLUMN pin TEXT');
            console.log("DATABASE_PATCH: Added 'pin' column to legacy table.");
        } catch (e) { /* 已存在则忽略 */ }

        // 确保 Admin 账户数据完整 (初始 1,000,000 WOW)
        await client.query(`
            INSERT INTO users (name, balance, pin) 
            VALUES ('Admin', 1000000, '888888') 
            ON CONFLICT (name) DO UPDATE SET pin = '888888' WHERE users.pin IS NULL
        `);
        
        isDbReady = true;
        console.log("MBA_SYSTEM: CONNECTED & SECURED.");
    } catch (err) {
        dbError = err.message;
        console.error("BOOT_RETRY:", err.message);
        setTimeout(connectToDb, 5000); // 失败则 5 秒后重连
    }
}

// 2. 尊享版 UI 布局模板
const getLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.92); --border: #222; --glow: rgba(240, 185, 11, 0.3); }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        
        .header { position: fixed; top: 0; width: 100%; height: 65px; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply-tag { font-family: 'Orbitron'; font-size: 14px; color: var(--gold); letter-spacing: 3px; text-shadow: 0 0 10px var(--glow); }

        .container { display: flex; height: 100vh; padding-top: 65px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; background: radial-gradient(circle at center, #0a0a0a 0%, #000 100%); }
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.5); z-index: 10; overflow-y: auto; }

        .card { background: #0a0a0a; border: 1px solid var(--border); padding: 22px; border-radius: 12px; margin-bottom: 25px; transition: 0.3s; }
        input { width: 100%; padding: 14px; margin-bottom: 12px; background: #000; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; font-family: inherit; }
        input:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 10px var(--glow); }
        
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 12px; transition: 0.3s; text-transform: uppercase; }
        .btn-gold { background: var(--gold); color: #000; margin-top: 5px; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); box-shadow: 0 5px 15px var(--glow); }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 12px; }
        
        .log-container { flex: 1; font-size: 11px; border-top: 1px solid #222; padding-top: 15px; margin-top: 10px; }
        .log-item { padding: 10px 0; border-bottom: 1px solid #111; display: flex; justify-content: space-between; align-items: center; }
        .log-item b { color: var(--gold); }

        .init-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
        .loader { border: 2px solid #111; border-top: 2px solid var(--gold); border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 25px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .tab-btn { background: #1a1a1a; color: #444; border: none; padding: 12px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 4px; margin: 0 5px; transition: 0.3s; }
        .tab-btn.active { background: var(--gold); color: #000; }
    </style>
    ${!isDbReady ? '<script>setTimeout(() => location.reload(), 4000);</script>' : ''}
</head>
<body>
    ${isDbReady ? content : `
        <div class="init-screen">
            <div class="loader"></div>
            <div style="font-family:'Orbitron'; color:var(--gold); letter-spacing:4px; font-size:18px;">MBA QUANTUM NODE</div>
            <div style="color:#555; margin-top:15px; font-size:12px;">SYNCHRONIZING LEDGER...</div>
            <div style="color:#222; font-size:9px; margin-top:40px; max-width:80%;">STATUS: ${dbError}</div>
        </div>
    `}
</body>
</html>`;

// 3. 页面路由
app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout(''));

    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
        const total = stats.rows[0].b || 0;
        let logHtml = logs.rows.map(l => `
            <div class="log-item">
                <span>${l.sender} <span style="color:#333">→</span> ${l.receiver}</span>
                <b>+${l.amount.toLocaleString()} WOW</b>
            </div>
        `).join('');

        res.send(getLayout(`
            <div class="header">
                <div class="supply-tag">NETWORK RESERVE: ${total.toLocaleString()} WOW</div>
            </div>
            <div class="container">
                <div class="visual"><canvas id="g"></canvas></div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:20px;">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TRANSFER</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">NEW VAULT</button>
                    </div>
                    
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="YOUR ID (Admin)">
                        <input type="password" id="p" placeholder="6-DIGIT PIN (888888)">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="WOW AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE TRANSACTION</button>
                        <button class="btn btn-outline" onclick="check()">VIEW BALANCE</button>
                    </div>

                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="REGISTER NEW ID">
                        <input type="password" id="rp" placeholder="SET 6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">GENERATE ACCOUNT</button>
                    </div>

                    <div style="font-family:'Orbitron'; font-size:10px; color:#333; margin-bottom:12px; letter-spacing:1px;">SYSTEM_LEDGER_LIVE</div>
                    <div class="log-container">${logHtml || '<div style="color:#222;text-align:center;">AWAITING NETWORK...</div>'}</div>
                </div>
            </div>
            <script>
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; pts=[]; for(let i=0;i<450;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#050505'; x.fillRect(0,0,w,h); r+=0.0035; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.38,p.y*Math.min(w,h)*0.38,s*1.6,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const n=prompt("ENTER ID TO SCAN:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); }
            </script>
        `));
    } catch (e) { res.send("Sync error. Please wait."); }
});

// API 实现
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Account Generated.');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID Conflict.');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('Auth Failed.');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('Insufficient Balance.');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        const b = r.rows.length ? r.rows[0].balance : 0;
        res.send(getLayout(`
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
                <div class="card" style="width:350px;text-align:center;border-color:var(--gold);">
                    <div style="font-family:'Orbitron';color:var(--gold);font-size:12px;">VAULT: ${req.query.u}</div>
                    <div style="font-size:3.5rem;margin:25px 0;font-family:'Orbitron';text-shadow:0 0 20px var(--gold);">${b.toLocaleString()}</div>
                    <div style="color:var(--gold);font-size:10px;margin-bottom:30px;letter-spacing:3px;">WOW CREDITS</div>
                    <button class="btn btn-gold" onclick="location.href='/'">BACK TO TERMINAL</button>
                </div>
            </div>
        `));
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => {
    console.log(`MBA_SYSTEM_ONLINE_PORT_${port}`);
    connectToDb();
});
