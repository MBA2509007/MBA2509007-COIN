require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;

// 数据库连接与初始化
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

// 统一界面布局渲染引擎 - 重点优化了 Media Queries 比例
const getLayout = (content, hideNav = false) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>MBA2509007 | TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.95); --border: #222; --green: #00ff88; --cash-green: #059669; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', sans-serif; margin: 0; overflow-x: hidden; }
        
        /* 响应式容器 */
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-content { display: flex; align-items: center; font-family: 'Orbitron'; font-size: 11px; color: var(--gold); padding: 0 10px; width: 100%; justify-content: center; flex-wrap: wrap; }
        
        .container { display: flex; flex-direction: row; min-height: 100vh; padding-top: 60px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; display:flex; flex-direction:column; background:#000; min-height: 300px; }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; z-index: 10; }

        /* 手机端适配：改为上下结构 */
        @media (max-width: 850px) {
            .container { flex-direction: column; height: auto; }
            .sidebar { width: 100%; border-left: none; border-top: 1px solid var(--border); padding: 20px; }
            .visual { min-height: 250px; flex: none; }
            .header-content { font-size: 9px; }
            .res-amt-text { font-size: 10px !important; }
        }

        /* 现金收款卡片适配 */
        .cash-card { background: #fff; padding: 2rem; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); width: 92%; max-width: 400px; text-align: center; color: #111; margin: 40px auto; animation: slideUp 0.5s ease; }
        .amount-display { font-size: 2.2rem; font-weight: 800; color: #111; margin-bottom: 0.5rem; }
        
        /* 输入组件优化 */
        .card { background: #000; border: 1px solid var(--border); padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        input { width: 100%; padding: 16px; margin-bottom: 12px; background: #080808; border: 1px solid #222; color: var(--gold); border-radius: 8px; box-sizing: border-box; font-family: 'Orbitron'; font-size: 14px; }
        .btn { width: 100%; padding: 18px; border-radius: 8px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 13px; text-transform: uppercase; }
        .btn-gold { background: var(--gold); color: #000; }
        .tab-btn { background: #111; color: #444; border: none; padding: 14px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 6px; margin: 0 4px; }
        .tab-btn.active { background: var(--gold); color: #000; }

        .lb-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #111; font-size: 10px; font-family: 'Orbitron'; }
    </style>
</head>
<body>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-content">
            <span id="live-clock">00:00:00</span>
            <span style="margin:0 10px; opacity:0.3;">|</span>
            <span id="header-reserve" class="res-amt-text">RESERVE: LOADING...</span>
            <span class="rate-tag" style="margin-left:10px; color:var(--green); border:1px solid var(--green); padding:2px 6px; border-radius:4px; font-size:9px;">1 COIN = 100 USD</span>
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

// --- 路由定义 (保持你的逻辑不变) ---

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="text-align:center;padding-top:40%;color:var(--gold);font-family:Orbitron;">INITIALIZING...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const ranking = await client.query("SELECT name, balance FROM users WHERE name != 'Admin' ORDER BY balance DESC LIMIT 5");
        const total = stats.rows[0].b || 0;
        let rankHtml = ranking.rows.map((r, i) => `
            <div class="lb-item">
                <span>${i === 0 ? '🏆' : '#' + (i + 1)} ${r.name}</span>
                <span style="color:${i === 0 ? 'var(--gold)' : '#888'};">${r.balance.toLocaleString()}</span>
            </div>`).join('');

        res.send(getLayout(`
            <div class="container">
                <div class="visual">
                    <canvas id="g" style="width:100%; height:100%; flex:1;"></canvas>
                    <div style="padding:20px; background: linear-gradient(transparent, #000);">
                        <div style="font-family:Orbitron; margin-bottom:10px; font-size:10px; color:#444; letter-spacing:1px;">LEADERBOARD</div>
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
                        <button class="btn btn-outline" style="margin-top:10px; background:transparent; color:var(--gold); border:1px solid var(--gold);" onclick="check()">SCAN BALANCE</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="NEW UNIQUE ID">
                        <input type="password" id="rp" placeholder="6-PIN">
                        <button class="btn btn-gold" onclick="reg()">GENERATE VAULT</button>
                    </div>
                    <div style="margin-top:20px; opacity:0.3">
                        <button class="btn" style="font-size:8px; border:1px solid #333; color:#555;" onclick="location.href='/admin/cash?u=USER&a=100'">ADMIN_CASH_PORTAL</button>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('header-reserve').innerText = "RES: ${total.toLocaleString()} COIN";
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ 
                    const rect = c.parentElement.getBoundingClientRect();
                    w=c.width=rect.width; h=c.height=rect.height; 
                    pts=[]; for(let i=0;i<250;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } 
                }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.004; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.4,p.y*Math.min(w,h)*0.4,s*1.5,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.addEventListener('resize', res); res(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const id = document.getElementById('f').value || prompt("ENTER ID:"); if(id) location.href='/api/bal?u='+encodeURIComponent(id); }
            </script>
        `));
    } catch (e) { res.send("SYSTEM_BUSY"); }
});

app.get('/admin/cash', (req, res) => {
    const { u, a } = req.query;
    const usd = parseFloat(a || 0);
    const coinGain = (usd / 100).toFixed(2);
    res.send(getLayout(`
        <div class="cash-card" id="main-content">
            <div style="font-size: 30px; margin-bottom:10px;">💵</div>
            <div style="padding: 4px 12px; background: #fef3c7; color: #92400e; border-radius: 20px; font-size: 0.7rem; font-weight: bold; display:inline-block; margin-bottom:1rem;">Awaiting Offline Payment</div>
            <div class="amount-display">$ ${usd.toLocaleString()}</div>
            <p style="color: #6b7280; font-size: 0.8rem;">Total Cash Amount (USD)</p>
            <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px; margin: 1.5rem 0; text-align: left; font-size: 0.85rem; border: 1px solid #e5e7eb;">
                <div style="display:flex; justify-content:space-between; margin:5px 0;"><span>Account:</span> <b>${u}</b></div>
                <div style="display:flex; justify-content:space-between; margin:5px 0; color:#059669; font-weight:bold;"><span>Minting:</span> <span>${coinGain} COIN</span></div>
            </div>
            <button class="btn btn-gold" id="confirm-btn" onclick="confirmCash()">Confirm Receipt</button>
        </div>
        <div class="cash-card" id="success-screen" style="display: none;">
            <div style="font-size: 40px; margin-bottom:15px;">✅</div>
            <h3 style="font-family:Orbitron; margin:0;">RECEIVED</h3>
            <p style="font-size:0.8rem; color:#666;">Assets transferred to ${u}.</p>
            <button onclick="location.href='/'" class="btn btn-gold" style="margin-top:15px;">BACK</button>
        </div>
        <script>
            function confirmCash() {
                const btn = document.getElementById('confirm-btn');
                btn.innerText = "MINTING...";
                btn.disabled = true;
                setTimeout(() => {
                    document.getElementById('main-content').style.display = 'none';
                    document.getElementById('success-screen').style.display = 'block';
                }, 800);
            }
        </script>
    `, true));
});

app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        if (r.rows.length === 0) return res.send("<script>alert('ID NOT FOUND');location.href='/';</script>");
        const b = r.rows[0].balance;
        res.send(getLayout(`
            <div style="display:flex;justify-content:center;align-items:center;min-height:90vh;padding:20px;">
                <div class="card" style="width:100%; max-width:350px; text-align:center; border-color:var(--gold);">
                    <div style="font-family:Orbitron; color:var(--gold); font-size:10px; opacity:0.5;">VAULT_HOLDER</div>
                    <div style="font-family:Orbitron; font-size:18px; margin:10px 0 20px 0;">${req.query.u}</div>
                    <div style="font-size:3rem; font-family:Orbitron; text-shadow:0 0 15px var(--gold);">${b.toLocaleString()}</div>
                    <div style="color:var(--gold); font-size:10px; margin-top:5px; font-weight:bold;">COIN</div>
                    <div style="margin-top:20px; padding-top:15px; border-top:1px solid #111;">
                        <div style="font-size:1.2rem; color:var(--green); font-family:Orbitron;">$ ${(b*100).toLocaleString()} <span style="font-size:10px;">USD</span></div>
                    </div>
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
        if(auth.rows.length === 0) return res.send("<script>alert('PIN ERROR');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('LOW FUNDS');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
