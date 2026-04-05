require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

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
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
    } catch (err) {
        console.error("DB_ERR:", err.message);
        setTimeout(connectToDb, 5000);
    }
}

const getLayout = (content, hideNav = false) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.95); --border: #222; --green: #00ff88; --cash-green: #059669; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', sans-serif; margin: 0; overflow-x: hidden; }
        
        /* 头部响应式 */
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.95); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-content { display: flex; align-items: center; font-family: 'Orbitron'; font-size: 11px; color: var(--gold); padding: 0 15px; width: 100%; justify-content: space-between; max-width: 1200px; }
        .rate-tag { color: var(--green); border: 1px solid var(--green); padding: 2px 6px; border-radius: 4px; font-size: 9px; white-space: nowrap; }

        /* 核心布局响应式：核心改动 */
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; flex-direction: row; }
        .visual { flex: 1; position: relative; display:flex; flex-direction:column; background:#000; min-height: 300px; }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; z-index: 10; overflow-y: auto; }

        /* 手机端适配 (屏幕宽度小于 850px) */
        @media (max-width: 850px) {
            .container { flex-direction: column; height: auto; overflow-y: auto; }
            .sidebar { width: 100%; border-left: none; border-top: 1px solid var(--border); padding: 20px; box-sizing: border-box; }
            .visual { height: 350px; flex: none; }
            .header-content { font-size: 10px; }
            .header-content span:nth-child(2) { display: none; } /* 隐藏手机上的分隔符 */
        }

        .card { background: #000; border: 1px solid var(--border); padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        input { width: 100%; padding: 14px; margin-bottom: 12px; background: #080808; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; outline: none; font-family: 'Orbitron'; font-size: 12px; }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 12px; text-transform: uppercase; transition: 0.3s; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 10px; }
        .tab-btn { background: #111; color: #444; border: none; padding: 12px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 4px; margin: 0 5px; }
        .tab-btn.active { background: var(--gold); color: #000; }
        .lb-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #111; font-size: 11px; font-family: 'Orbitron'; }

        /* 现金卡片适配手机 */
        .cash-card { background: #fff; padding: 2rem; border-radius: 16px; width: 92%; max-width: 400px; text-align: center; color: #111; margin: 30px auto; box-sizing: border-box; }
    </style>
</head>
<body>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-content">
            <span id="live-clock">00:00:00</span>
            <span style="opacity:0.3;">|</span>
            <span id="header-reserve">RESERVE: ...</span>
            <span class="rate-tag">1 COIN = 100 USD</span>
        </div>
    </div>`}
    ${content}
    <script>
        function updateClock() {
            const now = new Date();
            const opt = { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false };
            const clock = document.getElementById('live-clock');
            if(clock) clock.innerText = now.toLocaleTimeString('en-US', opt);
        }
        setInterval(updateClock, 1000); updateClock();
    </script>
</body>
</html>`;

// 主页路由
app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="text-align:center;padding-top:20%;color:var(--gold);font-family:Orbitron;">INITIALIZING...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const ranking = await client.query("SELECT name, balance FROM users WHERE name != 'Admin' ORDER BY balance DESC LIMIT 5");
        const total = stats.rows[0].b || 0;
        let rankHtml = ranking.rows.map((r, i) => `<div class="lb-item"><span>${i === 0 ? '🏆' : '#' + (i+1)} ${r.name}</span><span>${r.balance.toLocaleString()}</span></div>`).join('');

        res.send(getLayout(`
            <div class="container">
                <div class="visual">
                    <canvas id="g" style="width:100%; height:100%;"></canvas>
                    <div style="padding:20px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); position:absolute; bottom:0; width:100%; box-sizing:border-box;">
                        <div style="font-family:Orbitron; margin-bottom:10px; font-size:10px; color:#555;">TOP_HOLDERS</div>
                        ${rankHtml}
                    </div>
                </div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:20px;">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TERMINAL</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">REGISTRY</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="YOUR ID">
                        <input type="password" id="p" placeholder="PIN">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE</button>
                        <button class="btn btn-outline" onclick="check()">BALANCE</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="NEW ID">
                        <input type="password" id="rp" placeholder="6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">CREATE VAULT</button>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('header-reserve').innerText = "RES: ${total.toLocaleString()}";
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ 
                    w=c.width=c.offsetWidth; 
                    h=c.height=c.offsetHeight; 
                    pts=[]; for(let i=0;i<300;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } 
                }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.004; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.38,p.y*Math.min(w,h)*0.38,s*1.5,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const id = document.getElementById('f').value; if(id) location.href='/api/bal?u='+encodeURIComponent(id); else { const n=prompt("ID:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); } }
            </script>
        `));
    } catch (e) { res.send("ERR"); }
});

// 现金、余额、转账 API 保持不变 (参考之前版本)...
app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        if (r.rows.length === 0) return res.send("<script>alert('NOT FOUND');location.href='/';</script>");
        const b = r.rows[0].balance;
        res.send(getLayout(`<div style="display:flex;justify-content:center;align-items:center;height:100vh;padding:20px;box-sizing:border-box;"><div class="card" style="width:100%;max-width:400px;text-align:center;border-color:var(--gold);"><div style="font-family:Orbitron;color:var(--gold);font-size:10px;opacity:0.5;">VAULT_HOLDER</div><div style="font-family:Orbitron;font-size:18px;margin:10px 0 20px 0;">${req.query.u}</div><div style="font-size:3rem;font-family:Orbitron;color:#fff;text-shadow:0 0 20px var(--gold);">${b.toLocaleString()}</div><div style="color:var(--gold);font-size:10px;margin-top:10px;letter-spacing:4px;">COIN</div><div style="margin-top:20px;color:var(--green);font-size:1.2rem;font-family:Orbitron;">$ ${(b*100).toLocaleString()}</div><button class="btn btn-gold" style="margin-top:30px;" onclick="location.href='/'">RETURN</button></div></div>`, true));
    } catch (e) { res.redirect('/'); }
});

app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('SUCCESS');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID EXISTS');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.floor(Math.abs(parseInt(a)));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('AUTH FAILED');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('LOW BALANCE');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
