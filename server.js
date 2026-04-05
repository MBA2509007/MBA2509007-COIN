const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;
let dbError = "Connecting to global nodes...";

// 1. 强化版连接逻辑
async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });

    try {
        await client.connect();
        // 初始化表结构
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        // 确保 Admin 存在
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT (name) DO NOTHING");
        
        isDbReady = true;
        console.log("MBA_SYSTEM: DATABASE LINK ESTABLISHED.");
    } catch (err) {
        dbError = err.message;
        console.error("MBA_DB_RETRY:", err.message);
        setTimeout(connectToDb, 5000); // 失败后 5 秒自动重试
    }
}

// 2. 增强型布局：含自动刷新检测
const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: #0d0d0d; --border: #222; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        /* 这里的 CSS 保留 V12.3 的全部样式，为了节省篇幅略过，请直接在你的代码里复用 */
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply { font-family: 'Orbitron'; font-size: 16px; color: var(--gold); letter-spacing: 2px; }
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; background: #000; }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; overflow-y: auto; }
        .card { background: #111; border: 1px solid var(--border); padding: 18px; border-radius: 8px; margin-bottom: 20px; }
        input { width: 100%; padding: 12px; margin-bottom: 10px; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 4px; box-sizing: border-box; font-family: inherit; outline: none; }
        .btn { width: 100%; padding: 14px; border-radius: 4px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.3s; margin-top: 5px; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        .log-item { font-size: 11px; padding: 8px 0; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; }
        .tab { background: #222; color: #666; border: none; padding: 8px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; border-radius: 4px; flex: 1; margin: 0 5px; }
        .tab.active { background: var(--gold); color: #000; }
    </style>
    ${!isDbReady ? '<script>setTimeout(() => location.reload(), 4000);</script>' : ''}
</head>
<body>${content}</body>
</html>`;

app.get('/', async (req, res) => {
    // 自动重连提示界面
    if (!isDbReady) {
        return res.send(getLayout(`
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh;">
                <div style="width: 40px; height: 40px; border: 3px solid #111; border-top: 3px solid var(--gold); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
                <div style="font-family:'Orbitron'; color:var(--gold); letter-spacing:2px;">MBA NODE INITIALIZING...</div>
                <div style="color:#444; font-size:10px; margin-top:20px; max-width:80%; word-break:break-all;">LOG: ${dbError}</div>
                <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
            </div>
        `));
    }

    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
        const total = stats.rows[0].b || 1000000;
        let logHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} > ${l.receiver}</span><b>${l.amount}</b></div>`).join('');

        res.send(getLayout(`
            <div class="header"><div class="supply">MBA2509007 SUPPLY: ${total.toLocaleString()} WOW</div></div>
            <div class="container">
                <div class="visual"><canvas id="g"></canvas></div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:15px;">
                        <button class="tab active" id="t1" onclick="sw('tx')">TRANSFER</button>
                        <button class="tab" id="t2" onclick="sw('rg')">REGISTER</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="YOUR ID (Case Sensitive)">
                        <input type="password" id="p" placeholder="6-DIGIT PIN">
                        <input type="text" id="t" placeholder="TARGET ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">EXECUTE TRANSACTION</button>
                        <button class="btn btn-outline" style="margin-top:10px;" onclick="check()">CHECK VAULT</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="CREATE UNIQUE ID">
                        <input type="password" id="rp" placeholder="SET 6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">INITIALIZE ACCOUNT</button>
                    </div>
                    <div style="font-family:'Orbitron'; font-size:10px; color:#444; margin-bottom:10px;">LIVE_LEDGER_FEED</div>
                    <div style="flex:1; overflow-y:auto;">${logHtml || 'LISTENING FOR TRADES...'}</div>
                </div>
            </div>
            <script>
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,p=[];
                function resize(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; p=[]; for(let i=0;i<400;i++){ let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1); p.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#050505'; x.fillRect(0,0,w,h); r+=0.0035; x.save(); x.translate(w/2,h/2); p.forEach(i=>{ let x1=i.x*Math.cos(r)-i.z*Math.sin(r),z1=i.z*Math.cos(r)+i.x*Math.sin(r); x.fillStyle="rgba(240,185,11,"+(z1+1.2)/2.4+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.4,i.y*Math.min(w,h)*0.4,(z1+1.2)*1.5,0,Math.PI*2); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=resize; resize(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab active':'tab'; document.getElementById('t2').className=m==='rg'?'tab active':'tab'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href=\`/api/reg?u=\${encodeURIComponent(n)}&p=\${p}\`; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href=\`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`; }
                function check(){ const n=prompt("Identify Account Name?"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); }
            </script>
        `));
    } catch (e) { res.send("DB Error: Reloading..."); }
});

// API 实现 (完全保留之前的逻辑)
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Account Created');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID Unavailable');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('Auth Error: Wrong ID or PIN');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('Insufficient WOW Balance');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "123456") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        const b = r.rows.length ? r.rows[0].balance : 0;
        res.send(getLayout(`<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="card" style="width:320px;text-align:center;border:1px solid var(--gold);"><div style="font-family:'Orbitron';color:var(--gold);">${req.query.u} VAULT</div><div style="font-size:3.5rem;margin:25px 0;font-family:'Orbitron';">${b.toLocaleString()}</div><button class="btn btn-outline" onclick="location.href='/'">CLOSE VAULT</button></div></div>`));
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => {
    console.log(`WEB_LIVE_ON_${port}`);
    connectToDb();
});
