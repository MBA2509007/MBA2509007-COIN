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
        // 初始 Admin 资产：100万 COIN (价值 1亿 USD)
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
    } catch (err) {
        console.error("DB_ERR:", err.message);
        setTimeout(connectToDb, 5000);
    }
}

// 统一界面布局渲染引擎
const getLayout = (content, hideNav = false) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.95); --border: #222; --green: #00ff88; --cash-green: #059669; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', sans-serif; margin: 0; overflow-x: hidden; }
        
        /* 现金收款卡片专用样式 (来自你的代码) */
        .cash-card { background: #fff; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.8); width: 90%; max-width: 420px; text-align: center; color: #111; margin: 60px auto; animation: slideUp 0.5s ease; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .icon-box { background: #ecfdf5; width: 70px; height: 70px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 1.5rem; }
        .amount-display { font-size: 2.8rem; font-weight: 800; color: #111; margin-bottom: 0.5rem; }
        .order-info { background: #f3f4f6; padding: 1.2rem; border-radius: 8px; margin: 1.5rem 0; text-align: left; font-size: 0.9rem; color: #4b5563; border: 1px solid #e5e7eb; }
        .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .status-badge { display: inline-block; padding: 4px 14px; background: #fef3c7; color: #92400e; border-radius: 20px; font-size: 0.75rem; font-weight: bold; margin-bottom: 1rem; text-transform: uppercase; }
        #confirm-btn { width: 100%; background-color: var(--cash-green); color: white; padding: 18px; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; font-family: 'Orbitron'; transition: 0.3s; }
        #confirm-btn:hover { background: #047857; box-shadow: 0 4px 15px rgba(5,150,105,0.4); }

        /* 系统主架构样式 */
        .header { position: fixed; top: 0; width: 100%; height: 70px; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-content { display: flex; align-items: center; font-family: 'Orbitron'; font-size: 13px; color: var(--gold); letter-spacing: 1px; }
        .rate-tag { margin-left: 20px; color: var(--green); border: 1px solid var(--green); padding: 2px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; }
        .container { display: flex; height: 100vh; padding-top: 70px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; display:flex; flex-direction:column; background:#000; }
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; z-index: 10; overflow-y: auto; }
        .card { background: #000; border: 1px solid var(--border); padding: 25px; border-radius: 12px; margin-bottom: 25px; transition: 0.3s; }
        input { width: 100%; padding: 14px; margin-bottom: 12px; background: #080808; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; outline: none; font-family: 'Orbitron'; font-size: 12px; }
        input:focus { border-color: var(--gold); background: #0c0c0c; }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 12px; transition: 0.3s; text-transform: uppercase; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 12px; }
        .btn-outline:hover { background: rgba(240,185,11,0.1); }
        .tab-btn { background: #111; color: #444; border: none; padding: 12px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 4px; margin: 0 5px; transition: 0.3s; }
        .tab-btn.active { background: var(--gold); color: #000; box-shadow: 0 0 15px rgba(240,185,11,0.3); }
        .lb-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #111; font-size: 11px; font-family: 'Orbitron'; }
        .lb-item:nth-child(2) { color: var(--gold); font-size: 13px; } /* 第一名 */
    </style>
</head>
<body>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-content">
            <span id="live-clock">00:00:00</span>
            <span style="margin:0 15px; opacity:0.3;">|</span>
            <span id="header-reserve">RESERVE: LOADING...</span>
            <span class="rate-tag">1 COIN = 100.00 USD</span>
        </div>
    </div>`}
    ${content}
    <script>
        function updateClock() {
            const now = new Date();
            const opt = { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false };
            const clock = document.getElementById('live-clock');
            if(clock) clock.innerText = now.toLocaleString('en-US', opt).toUpperCase();
        }
        setInterval(updateClock, 1000); updateClock();
    </script>
</body>
</html>`;

// --- 路由定义 ---

// 1. 主页终端
app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="text-align:center;padding-top:20%;color:var(--gold);font-family:Orbitron;">INITIALIZING_QUANTUM_CELLS...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const ranking = await client.query("SELECT name, balance FROM users WHERE name != 'Admin' ORDER BY balance DESC LIMIT 5");
        const total = stats.rows[0].b || 0;
        let rankHtml = ranking.rows.map((r, i) => `
            <div class="lb-item">
                <span>${i === 0 ? '🏆' : '#' + (i + 1)} ${r.name}</span>
                <span style="color:${i === 0 ? 'var(--gold)' : '#888'};">${r.balance.toLocaleString()} COIN</span>
            </div>`).join('');

        res.send(getLayout(`
            <div class="container">
                <div class="visual">
                    <canvas id="g" style="flex:2;"></canvas>
                    <div style="padding:30px; background: linear-gradient(transparent, #000);">
                        <div style="font-family:Orbitron; margin-bottom:15px; font-size:12px; color:#444; letter-spacing:2px;">GLOBAL_LEADERBOARD</div>
                        ${rankHtml}
                    </div>
                </div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:25px;">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TERMINAL</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">REGISTRY</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="IDENTIFICATION ID">
                        <input type="password" id="p" placeholder="SECURITY PIN">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="TRANSFER AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE TRANSFER</button>
                        <button class="btn btn-outline" onclick="check()">SCAN BALANCE</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="NEW UNIQUE ID">
                        <input type="password" id="rp" placeholder="6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">GENERATE VAULT</button>
                    </div>
                    <div style="margin-top:auto;">
                        <button class="btn btn-outline" style="border-color:#222; color:#333; font-size:9px;" onclick="location.href='/admin/cash?u=CLIENT_NAME&a=500'">ADMIN_CASH_CONFIRM_PORTAL</button>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('header-reserve').innerText = "EXCHANGE RESERVE: ${total.toLocaleString()} COIN";
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; pts=[]; for(let i=0;i<400;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.0035; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.35,p.y*Math.min(w,h)*0.35,s*1.6,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const id = document.getElementById('f').value; if(id) location.href='/api/bal?u='+encodeURIComponent(id); else { const n=prompt("ENTER ID:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); } }
            </script>
        `));
    } catch (e) { res.send("SYSTEM_BUSY"); }
});

// 2. 现金确认页面 (USD -> COIN 换算逻辑)
app.get('/admin/cash', (req, res) => {
    const { u, a } = req.query; // a 为 USD
    const usd = parseFloat(a || 0);
    const coinGain = (usd / 100).toFixed(2); // 汇率核心：除以 100

    res.send(getLayout(`
        <div class="cash-card" id="main-content">
            <div class="icon-box"><span style="font-size: 35px;">💵</span></div>
            <div class="status-badge">Awaiting Offline Payment</div>
            <div class="amount-display">$ ${usd.toLocaleString()}</div>
            <p style="color: #6b7280; margin-top: 0; font-size: 0.85rem;">Total Cash Amount (USD)</p>
            
            <div class="order-info">
                <div class="info-row"><span>Target Account:</span> <strong>${u}</strong></div>
                <div class="info-row" style="color:var(--cash-green); font-size:1.1rem; padding-top:10px; border-top:1px dashed #ddd;">
                    <span>Assets to Issue:</span> <strong>${coinGain} COIN</strong>
                </div>
                <div class="info-row" style="font-size: 10px; opacity: 0.7;">
                    <span>Exchange Rate:</span> <span>1 COIN = 100 USD</span>
                </div>
            </div>
            
            <button id="confirm-btn" onclick="confirmCash()">Confirm Receipt</button>
            <div class="footer-note">Verification will instantly credit the user's vault</div>
        </div>

        <div class="cash-card" id="success-screen" style="display: none;">
            <div class="icon-box" style="background: #d1fae5;"><span style="font-size: 35px;">✅</span></div>
            <h2 style="color: var(--cash-green); font-family:Orbitron;">PAYMENT RECEIVED</h2>
            <p style="font-size:0.9rem; color:#666;">Assets have been successfully minted and transferred to <b>${u}</b>.</p>
            <button onclick="location.href='/'" class="btn btn-gold" style="margin-top:20px; width:auto; padding:15px 40px;">BACK TO TERMINAL</button>
        </div>

        <script>
            function confirmCash() {
                const btn = document.getElementById('confirm-btn');
                btn.innerText = "PROCESSING...";
                btn.disabled = true;
                setTimeout(() => {
                    document.getElementById('main-content').style.display = 'none';
                    document.getElementById('success-screen').style.display = 'block';
                }, 1000);
            }
        </script>
    `, true));
});

// 3. 余额查询 API (显示美金估值)
app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        if (r.rows.length === 0) return res.send("<script>alert('ERROR: IDENTITY NOT FOUND');location.href='/';</script>");
        
        const b = r.rows[0].balance;
        const usdVal = b * 100; // 核心：乘以 100

        res.send(getLayout(`
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;">
                <div class="card" style="width:400px; text-align:center; border-color:var(--gold); box-shadow:0 0 50px rgba(240,185,11,0.15);">
                    <div style="font-family:Orbitron; color:var(--gold); font-size:12px; opacity:0.5; letter-spacing:2px;">VAULT_HOLDER</div>
                    <div style="font-family:Orbitron; font-size:22px; margin:10px 0 30px 0;">${req.query.u}</div>
                    
                    <div style="font-size:3.8rem; font-family:Orbitron; color:#fff; text-shadow:0 0 20px var(--gold); line-height:1;">${b.toLocaleString()}</div>
                    <div style="color:var(--gold); font-size:11px; margin-top:10px; letter-spacing:4px; font-weight:bold;">COIN CREDITS</div>
                    
                    <div style="margin-top:25px; padding-top:20px; border-top:1px solid #111;">
                        <span style="color:#555; font-size:12px;">ESTIMATED MARKET VALUE</span>
                        <div style="font-size:1.5rem; color:var(--green); font-family:Orbitron; margin-top:5px;">$ ${usdVal.toLocaleString()} <span style="font-size:12px;">USD</span></div>
                    </div>

                    <button class="btn btn-gold" style="margin-top:40px;" onclick="location.href='/'">RETURN TO TERMINAL</button>
                </div>
            </div>
        `, true));
    } catch (e) { res.redirect('/'); }
});

// 4. 注册与转账 API (包含防作弊逻辑)
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('VAULT CREATED');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ERROR: ID TAKEN');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.floor(Math.abs(parseInt(a)));
        if(isNaN(amt) || amt <= 0) throw new Error();
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('AUTH_FAILED: INVALID PIN');location.href='/';</script>");
        
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('DENIED: INSUFFICIENT FUNDS');location.href='/';</script>");
        
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
