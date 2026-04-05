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
        :root { --gold: #f0b90b; --bg: #000; --panel: rgba(15, 15, 15, 0.95); --border: #222; --green: #00ff88; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', sans-serif; margin: 0; height: 100vh; overflow: hidden; }
        
        .header { height: 60px; background: rgba(0,0,0,0.9); border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: center; z-index: 100; flex-shrink: 0; }
        .header-content { display: flex; align-items: center; font-family: 'Orbitron'; font-size: 11px; color: var(--gold); width: 92%; justify-content: space-between; }
        
        .container { display: flex; flex: 1; height: calc(100vh - 60px); }
        .visual { flex: 1; position: relative; background:#000; }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; overflow-y: auto; display: flex; flex-direction: column; }

        @media (max-width: 850px) {
            .container { flex-direction: column; overflow-y: auto; }
            .visual { height: 260px; flex: none; width: 100%; }
            .sidebar { width: 100%; border-left: none; padding: 20px; flex: none; }
            .header-content { font-size: 10px; }
        }

        .card { background: #0a0a0a; border: 1px solid var(--border); padding: 20px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        input { width: 100%; padding: 16px; margin-bottom: 12px; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 12px; font-family: 'Orbitron'; font-size: 15px; outline: none; transition: 0.3s; }
        input:focus { border-color: var(--gold); background: #050505; }
        
        .btn { width: 100%; padding: 18px; border-radius: 12px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 13px; text-transform: uppercase; transition: 0.2s; }
        .btn-gold { background: var(--gold); color: #000; box-shadow: 0 4px 15px rgba(240,185,11,0.2); }
        .btn-gold:active { transform: scale(0.97); }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 10px; }
        
        .tab-box { display: flex; background: #111; padding: 4px; border-radius: 12px; margin-bottom: 20px; }
        .tab-btn { flex: 1; background: transparent; color: #555; border: none; padding: 12px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; border-radius: 10px; transition: 0.3s; }
        .tab-btn.active { background: var(--gold); color: #000; font-weight: bold; }

        .lb-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #111; font-size: 11px; font-family: 'Orbitron'; }
    </style>
</head>
<body>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-content">
            <span id="live-clock">00:00:00</span>
            <span id="header-reserve" style="letter-spacing:1px;">RESERVE: ...</span>
        </div>
    </div>`}
    ${content}
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="margin:auto;color:var(--gold);font-family:Orbitron;">LOADING_SYSTEM...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const ranking = await client.query("SELECT name, balance FROM users WHERE name != 'Admin' ORDER BY balance DESC LIMIT 5");
        const total = stats.rows[0].b || 0;
        let rankHtml = ranking.rows.map((r, i) => `<div class="lb-item"><span>${i === 0 ? '🏆' : '#' + (i + 1)} ${r.name}</span><span>${r.balance.toLocaleString()}</span></div>`).join('');

        res.send(getLayout(`
            <div class="container">
                <div class="visual">
                    <canvas id="g" style="width:100%; height:100%;"></canvas>
                    <div style="padding:15px; background: linear-gradient(transparent, #000); position:absolute; bottom:0; width:100%;">
                        <div style="font-family:Orbitron; margin-bottom:8px; font-size:9px; color:#444;">LEADERBOARD</div>
                        ${rankHtml}
                    </div>
                </div>
                <div class="sidebar">
                    <div class="tab-box">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TERMINAL</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">REGISTRY</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="IDENTIFICATION ID">
                        <input type="password" id="p" placeholder="SECURITY PIN">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE</button>
                        <button class="btn btn-outline" onclick="check()">SCAN BALANCE</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="NEW UNIQUE ID">
                        <input type="password" id="rp" placeholder="6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">GENERATE VAULT</button>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('header-reserve').innerText = "RES: ${total.toLocaleString()} COIN";
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.offsetWidth; h=c.height=c.offsetHeight; pts=[]; for(let i=0;i<200;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.005; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.4,p.y*Math.min(w,h)*0.4,s*1.5,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const id = document.getElementById('f').value || prompt("ENTER ID:"); if(id) location.href='/api/bal?u='+encodeURIComponent(id); }
                setInterval(()=>{const now=new Date(); document.getElementById('live-clock').innerText=now.toLocaleTimeString('en-US',{hour12:false})},1000);
            </script>
        `));
    } catch (e) { res.send("ERR"); }
});

// 后面所有功能路由（Admin/Bal/Reg/Pay）保持不变，样式会自动应用上面的优化
app.get('/admin/cash', (req, res) => {
    const { u, a } = req.query; const usd = parseFloat(a || 0);
    res.send(getLayout(`
        <div style="display:flex; justify-content:center; padding:40px 20px;">
            <div class="card" style="width:100%; max-width:380px; background:#fff; color:#000; text-align:center;">
                <div style="font-size:40px;">💵</div>
                <div style="font-size:2.2rem; font-weight:800; margin:10px 0;">$ ${usd.toLocaleString()}</div>
                <div style="background:#f0f0f0; padding:15px; border-radius:12px; text-align:left; font-size:14px; margin:20px 0;">
                    <div style="display:flex; justify-content:space-between;"><span>Account:</span><b>${u}</b></div>
                    <div style="display:flex; justify-content:space-between; color:green; font-weight:bold; margin-top:5px;"><span>Credit:</span><span>${(usd/100).toFixed(2)} COIN</span></div>
                </div>
                <button class="btn btn-gold" onclick="location.href='/'">CONFIRM RECEIPT</button>
            </div>
        </div>
    `, true));
});

app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        const b = r.rows.length ? r.rows[0].balance : 0;
        res.send(getLayout(`
            <div style="display:flex; align-items:center; justify-content:center; height:90vh; padding:20px;">
                <div class="card" style="width:100%; max-width:350px; text-align:center; border-color:var(--gold);">
                    <div style="font-family:Orbitron; color:#555; font-size:10px;">VAULT_HOLDER</div>
                    <div style="font-family:Orbitron; font-size:18px; margin:10px 0;">${req.query.u}</div>
                    <div style="font-size:3.2rem; font-family:Orbitron; text-shadow:0 0 20px var(--gold); color:#fff;">${b.toLocaleString()}</div>
                    <div style="color:var(--gold); font-size:12px; letter-spacing:4px; font-weight:bold;">COIN</div>
                    <button class="btn btn-gold" style="margin-top:30px;" onclick="location.href='/'">BACK</button>
                </div>
            </div>
        `, true));
    } catch (e) { res.redirect('/'); }
});

app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('SUCCESS');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ERROR');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.floor(Math.abs(parseInt(a)));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(!auth.rows.length) return res.send("<script>alert('PIN ERROR');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(!dec.rowCount) return res.send("<script>alert('NO FUNDS');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
