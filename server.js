require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;

// 数据库连接逻辑：增加了超时保护，防止在 Render 启动时崩溃
async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 20000, 
    });
    try {
        await client.connect();
        // 初始化数据库表
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        // 确保 Admin 账户存在
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
        console.log("Database Connected & Ready.");
    } catch (err) {
        console.error("DB Error:", err.message);
        setTimeout(connectToDb, 5000); 
    }
}

// 页面布局模板
const getLayout = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.95); --border: #222; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        
        /* 顶部导航栏：包含 EXCHANGE RESERVE 和 实时时间 */
        .header { position: fixed; top: 0; width: 100%; height: 80px; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply-tag { font-family: 'Orbitron'; font-size: 14px; color: var(--gold); letter-spacing: 2px; text-transform: uppercase; }
        #live-clock { font-size: 11px; color: #555; margin-top: 5px; letter-spacing: 1px; font-weight: 300; }

        .container { display: flex; height: 100vh; padding-top: 80px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; background: radial-gradient(circle at center, #111 0%, #050505 100%); }
        
        /* 侧边操作面板 */
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; z-index: 10; overflow-y: auto; box-shadow: -10px 0 30px rgba(0,0,0,0.5); }
        .card { background: #000; border: 1px solid var(--border); padding: 25px; border-radius: 12px; margin-bottom: 25px; }
        
        input { width: 100%; padding: 15px; margin-bottom: 12px; background: #080808; border: 1px solid #1a1a1a; color: var(--gold); border-radius: 8px; box-sizing: border-box; font-family: inherit; outline: none; transition: 0.3s; }
        input:focus { border-color: var(--gold); background: #0c0c0c; }
        
        .btn { width: 100%; padding: 18px; border-radius: 8px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 12px; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; }
        .btn-gold { background: var(--gold); color: #000; margin-top: 5px; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 15px; }
        .btn-outline:hover { background: rgba(240,185,11,0.1); }

        .log-item { padding: 12px 0; border-bottom: 1px solid #111; display: flex; justify-content: space-between; font-size: 11px; color: #888; }
        .tab-btn { background: #111; color: #444; border: none; padding: 14px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 6px; margin: 0 5px; transition: 0.3s; }
        .tab-btn.active { background: var(--gold); color: #000; }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;

// 主路由
app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#f0b90b;font-family:Orbitron;letter-spacing:5px;">NODE_INITIALIZING...</div>'));
    
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
        const total = stats.rows[0].b || 0;
        let logHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b style="color:var(--gold);">+${l.amount.toLocaleString()} COIN</b></div>`).join('');

        res.send(getLayout(`
            <div class="header">
                <div style="text-align:center;">
                    <div class="supply-tag">EXCHANGE RESERVE: ${total.toLocaleString()} COIN</div>
                    <div id="live-clock">LOADING...</div>
                </div>
            </div>
            <div class="container">
                <div class="visual"><canvas id="g"></canvas></div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:25px;">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TRANSFER</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">NEW VAULT</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="YOUR ID">
                        <input type="password" id="p" placeholder="PIN CODE">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE TRANSACTION</button>
                        <button class="btn btn-outline" onclick="check()">SCAN BALANCE</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="CREATE NEW ID">
                        <input type="password" id="rp" placeholder="SET 6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">GENERATE VAULT</button>
                    </div>
                    <div style="font-family:Orbitron; font-size:10px; color:#444; margin: 10px 0;">SYSTEM_LEDGER_LIVE</div>
                    <div class="log-container">${logHtml || '<div style="color:#222;font-size:10px;">NO DATA RECORDED</div>'}</div>
                </div>
            </div>
            <script>
                // 3D 粒子球逻辑
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; pts=[]; for(let i=0;i<450;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#050505'; x.fillRect(0,0,w,h); r+=0.0035; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.38,p.y*Math.min(w,h)*0.38,s*1.6,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                
                // 实时时钟更新函数
                function updateClock() {
                    const now = new Date();
                    const options = { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false };
                    document.getElementById('live-clock').innerText = now.toLocaleString('en-US', options).toUpperCase();
                }
                setInterval(updateClock, 1000); updateClock();

                // 交互逻辑
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const n=prompt("ENTER ID TO SCAN:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); }
            </script>
        `));
    } catch (e) { res.send(getLayout('<div style="color:red; text-align:center; padding-top:100px;">SYSTEM_DATABASE_REBOOTING...</div>')); }
});

// API：用户注册
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Vault Created Successfully.');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('Error: ID already exists or invalid data.');location.href='/';</script>"); }
});

// API：转账支付
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('Authorization Failed: Invalid ID or PIN.');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('Error: Insufficient COIN in your vault.');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

// API：余额查询界面
app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        const b = r.rows.length ? r.rows[0].balance : 0;
        res.send(getLayout(`<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="card" style="width:380px;text-align:center;border-color:var(--gold);box-shadow:0 0 30px rgba(240,185,11,0.2);"><div style="font-family:Orbitron;color:var(--gold);font-size:12px;margin-bottom:10px;opacity:0.6;">VAULT_HOLDER</div><div style="font-family:Orbitron;font-size:18px;margin-bottom:25px;">${req.query.u}</div><div style="font-size:3.5rem;margin:15px 0;font-family:Orbitron;text-shadow:0 0 25px var(--gold);color:#fff;">${b.toLocaleString()}</div><div style="color:var(--gold);font-size:10px;margin-bottom:35px;letter-spacing:4px;font-weight:bold;">COIN CREDITS</div><button class="btn btn-gold" onclick="location.href='/'">RETURN TO TERMINAL</button></div></div>`));
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
