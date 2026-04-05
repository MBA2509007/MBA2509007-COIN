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

        // 确保 Admin 账户数据完整
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
        setTimeout(connectToDb, 5000);
    }
}

// 2. 尊享版 UI 布局
const getLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.9); --border: #222; --glow: rgba(240, 185, 11, 0.3); }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        
        /* 顶部导航 */
        .header { position: fixed; top: 0; width: 100%; height: 65px; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply-tag { font-family: 'Orbitron'; font-size: 14px; color: var(--gold); letter-spacing: 3px; text-shadow: 0 0 10px var(--glow); }

        /* 主容器 */
        .container { display: flex; height: 100vh; padding-top: 65px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; background: radial-gradient(circle at center, #111 0%, #000 100%); }
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; box-shadow: -10px 0 30px rgba(0,0,0,0.5); z-index: 10; }

        /* 元素样式 */
        .card { background: #111; border: 1px solid var(--border); padding: 20px; border-radius: 12px; margin-bottom: 25px; transition: 0.3s; }
        .card:hover { border-color: #444; box-shadow: 0 0 15px rgba(240,185,11,0.05); }
        input { width: 100%; padding: 14px; margin-bottom: 12px; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 6px; box-sizing: border-box; font-family: inherit; transition: 0.3s; }
        input:focus { border-color: var(--gold); outline: none; box-shadow: 0 0 8px var(--glow); }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 12px; transition: 0.3s; margin-top: 5px; text-transform: uppercase; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        
        /* 日志列表 */
        .log-container { flex: 1; overflow-y: auto; font-size: 11px; border-top: 1px solid #222; padding-top: 15px; }
        .log-item { padding: 10px 0; border-bottom: 1px solid #151515; display: flex; justify-content: space-between; align-items: center; opacity: 0.8; }
        .log-item b { color: var(--gold); }

        /* 初始化界面 */
        .init-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
        .loader { border: 2px solid #111; border-top: 2px solid var(--gold); border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 25px; box-shadow: 0 0 15px var(--glow); }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        .tab-btn { background: #222; color: #555; border: none; padding: 10px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 4px; margin: 0 5px; transition: 0.3s; }
        .tab-btn.active { background: var(--gold); color: #000; box-shadow: 0 0 10px var(--glow); }
    </style>
    ${!isDbReady ? '<script>setTimeout(() => location.reload(), 4000);</script>' : ''}
</head>
<body>
    ${isDbReady ? content : `
        <div class="init-screen">
            <div class="loader"></div>
            <div style="font-family:'Orbitron'; color:var(--gold); letter-spacing:4px; font-size:18px;">MBA QUANTUM NODE</div>
            <div style="color:#555; margin-top:15px; font-size:12px;">SYNCHRONIZING LEDGER...</div>
            <div style="color:#333; font-size:9px; margin-top:40px; max-width:70%;">SYSTEM_REPORT: ${dbError}</div>
        </div>
    `}
</body>
</html>`;

// 3. 路由与逻辑
app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout(''));

    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 12');
        const total = stats.rows[0].b || 1000000;
        let logHtml = logs.rows.map(l => `
            <div class="log-item">
                <span>${l.sender} <span style="color:#444">→</span> ${l.receiver}</span>
                <b>+${l.amount.toLocaleString()} WOW</b>
            </div>
        `).join('');

        res.send(getLayout(`
            <div class="header">
                <div class="supply-tag">GLOBAL RESERVE: ${total.toLocaleString()} WOW</div>
            </div>
            <div class="container">
                <div class="visual"><canvas id="g"></canvas></div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:20px;">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TRANSFER</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">NEW VAULT</button>
                    </div>
                    
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="SENDER ID">
                        <input type="password" id="p" placeholder="PIN CODE">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">EXECUTE TRANSACTION</button>
                        <button class="btn btn-outline" style="margin-top:10px;" onclick="check()">VIEW BALANCE</button>
                    </div>

                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="CHOOSE ID">
                        <input type="password" id="rp" placeholder="6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">CREATE ACCOUNT</button>
                    </div>

                    <div style="font-family:'Orbitron'; font-size:10px; color:#444; margin-bottom:12px; letter-spacing:1px;">LIVE_TRANSACTION_LOG</div>
                    <div class="log-container">${logHtml || '<div style="color:#333;text-align:center;margin-top:20px;">AWAITING NETWORK ACTIVITY...</div>'}</div>
                </div>
            </div>
            <script>
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,p=[];
                function resize(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; p=[]; for(let i=0;i<450;i++){ let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1); p.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#050505'; x.fillRect(0,0,w,h); r+=0.003; x.save(); x.translate(w/2,h/2); p.forEach(i=>{ let x1=i.x*Math.cos(r)-i.z*Math.sin(r),z1=i.z*Math.cos(r)+i.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.shadowBlur=s*8; x.shadowColor= "rgba(240,185,11,0.5)"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.38,i.y*Math.min(w,h)*0.38,s*1.8,0,Math.PI*2); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=resize; resize(); draw();
                
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const n=prompt("ENTER ACCOUNT NAME:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); }
            </script>
        `));
    } catch (e) { res.send("System sync error. Refreshing..."); }
});

// API 实现
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Account Generated.');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID Already Registered.');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('Access Denied: Invalid Credentials');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('Transaction Failed: Insufficient Funds');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "123456") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
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
                <div class="card" style="width:350px;text-align:center;border:1px solid var(--gold);box-shadow: 0 0 30px var(--glow);">
                    <div style="font-family:'Orbitron';color:var(--gold);margin-bottom:10px;font-size:12px;">ACCOUNT: ${req.query.u}</div>
                    <div style="font-size:4rem;margin:20px 0;font-family:'Orbitron';color:#fff;text-shadow:0 0 20px var(--gold);">${b.toLocaleString()}</div>
                    <div style="color:var(--gold);font-size:10px;margin-bottom:30px;letter-spacing:2px;">WOW CREDITS</div>
                    <button class="btn btn-gold" onclick="location.href='/'">RETURN TO TERMINAL</button>
                </div>
            </div>
        `));
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => {
    console.log(`MBA_SYSTEM_LIVE_ON_${port}`);
    connectToDb();
});
