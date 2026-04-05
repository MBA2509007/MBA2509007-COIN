require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;

// 数据库连接
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
        // Admin 初始资产 100万 COIN (1亿 USD)
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
    } catch (err) {
        console.error("DB_ERR:", err.message);
        setTimeout(connectToDb, 5000);
    }
}

// 统一布局渲染
const getLayout = (content, hideNav = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Roboto+Mono:wght@300;500&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(13, 13, 13, 0.98); --border: #222; --green: #00ff88; --cash-green: #059669; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', sans-serif; margin: 0; overflow-x: hidden; height: 100vh; }
        
        /* 顶部导航 */
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-content { display: flex; align-items: center; font-family: 'Orbitron'; font-size: 12px; color: var(--gold); width: 100%; max-width: 1400px; padding: 0 20px; justify-content: space-between; box-sizing: border-box; }
        .rate-tag { color: var(--green); border: 1px solid var(--green); padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; }

        /* 核心响应式布局 */
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; flex-direction: row; }
        
        /* 3D 视觉区域 - 电脑端占据剩余空间 */
        .visual { flex: 1; position: relative; display: flex; flex-direction: column; background: #000; overflow: hidden; }
        
        /* 侧边栏区域 - 电脑端固定宽度 400px */
        .sidebar { width: 400px; min-width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; z-index: 10; overflow-y: auto; box-sizing: border-box; }

        /* 📱 移动端适配断点 */
        @media (max-width: 850px) {
            .container { flex-direction: column; height: auto; overflow-y: auto; }
            .visual { height: 350px; flex: none; width: 100%; }
            .sidebar { width: 100%; min-width: 100%; border-left: none; border-top: 1px solid var(--border); padding: 20px; }
            .header-content { font-size: 10px; padding: 0 10px; }
            .header-content .sep { display: none; }
        }

        /* 常用组件样式 */
        .card { background: #000; border: 1px solid var(--border); padding: 22px; border-radius: 12px; margin-bottom: 20px; }
        input { width: 100%; padding: 14px; margin-bottom: 12px; background: #080808; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; outline: none; font-family: 'Orbitron'; font-size: 12px; }
        input:focus { border-color: var(--gold); }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; font-size: 11px; transition: 0.3s; text-transform: uppercase; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 12px; }
        .tab-btn { background: #111; color: #444; border: none; padding: 12px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; flex: 1; border-radius: 4px; margin: 0 5px; }
        .tab-btn.active { background: var(--gold); color: #000; }
        .lb-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #111; font-size: 11px; font-family: 'Orbitron'; align-items: center; }

        /* 现金收款卡片样式 */
        .cash-card { background: #fff; padding: 2.5rem; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); width: 92%; max-width: 420px; text-align: center; color: #111; margin: 40px auto; box-sizing: border-box; }
        .icon-box { background: #ecfdf5; width: 60px; height: 60px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 1.2rem; }
        .amount-display { font-size: 2.5rem; font-weight: 800; color: #111; margin-bottom: 0.5rem; }
        .order-info { background: #f3f4f6; padding: 1rem; border-radius: 8px; margin: 1.5rem 0; text-align: left; font-size: 0.9rem; color: #4b5563; }
        #confirm-btn { width: 100%; background-color: var(--cash-green); color: white; padding: 16px; border: none; border-radius: 8px; font-size: 1.1rem; font-weight: bold; cursor: pointer; font-family: 'Orbitron'; }
    </style>
</head>
<body>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-content">
            <span id="live-clock">00:00:00</span>
            <span class="sep" style="opacity:0.2;">|</span>
            <span id="header-reserve">RESERVE: LOADING...</span>
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

// --- 核心路由 ---

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="text-align:center;padding-top:20%;color:var(--gold);font-family:Orbitron;">BOOTING_SYSTEM...</div>'));
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
                    <canvas id="g" style="width:100%; height:100%;"></canvas>
                    <div style="padding:20px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); position:absolute; bottom:0; width:100%; box-sizing:border-box;">
                        <div style="font-family:Orbitron; margin-bottom:10px; font-size:10px; color:#444; letter-spacing:1px;">TOP_HOLDERS_RANKING</div>
                        ${rankHtml}
                    </div>
                </div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:20px;">
                        <button class="tab-btn active" id="t1" onclick="sw('tx')">TERMINAL</button>
                        <button class="tab-btn" id="t2" onclick="sw('rg')">REGISTRY</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="IDENT ID">
                        <input type="password" id="p" placeholder="SECURITY PIN">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE</button>
                        <button class="btn btn-outline" onclick="check()">SCAN BALANCE</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="NEW UNIQUE ID">
                        <input type="password" id="rp" placeholder="6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">CREATE VAULT</button>
                    </div>
                    <div style="margin-top:auto;">
                        <button class="btn btn-outline" style="border-color:#222; color:#333; font-size:9px;" onclick="location.href='/admin/cash?u=User&a=100'">ADMIN_CASH_PORTAL</button>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('header-reserve').innerText = "RES: ${total.toLocaleString()} COIN";
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.offsetWidth; h=c.height=c.offsetHeight; pts=[]; for(let i=0;i<300;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.003; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.38,p.y*Math.min(w,h)*0.38,s*1.5,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function check(){ const id = document.getElementById('f').value; if(id) location.href='/api/bal?u='+encodeURIComponent(id); else { const n=prompt("ID:"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); } }
            </script>
        `));
    } catch (e) { res.send("ERR"); }
});

// 现金收款界面
app.get('/admin/cash', (req, res) => {
    const { u, a } = req.query;
    const usd = parseFloat(a || 0);
    const coin = (usd / 100).toFixed(2);
    res.send(getLayout(`
        <div class="cash-card" id="main-content">
            <div class="icon-box"><span style="font-size:30px;">💵</span></div>
            <div class="status-badge">Awaiting Cash</div>
            <div class="amount-display">$ ${usd.toLocaleString()}</div>
            <p style="color:#6b7280; margin-top:0; font-size:12px;">Total USD Required</p>
            <div class="order-info">
                <div class="info-row"><span>Account:</span> <strong>${u}</strong></div>
                <div class="info-row" style="color:var(--cash-green); margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <span>Assets:</span> <strong>+ ${coin} COIN</strong>
                </div>
            </div>
            <button id="confirm-btn" onclick="confirmCash()">Confirm Receipt</button>
        </div>
        <div class="cash-card" id="success-screen" style="display:none;">
            <div class="icon-box" style="background:#d1fae5;"><span style="font-size:30px;">✅</span></div>
            <h2 style="color:var(--cash-green); font-family:Orbitron;">SUCCESS</h2>
            <p style="font-size:13px; color:#666;">Assets have been minted to ${u}</p>
            <button onclick="location.href='/'" class="btn btn-gold" style="margin-top:20px;">BACK</button>
        </div>
        <script>
            function confirmCash() {
                document.getElementById('confirm-btn').innerText = "SINCING...";
                setTimeout(() => {
                    document.getElementById('main-content').style.display = 'none';
                    document.getElementById('success-screen').style.display = 'block';
                }, 800);
            }
        </script>
    `, true));
});

// 余额查询
app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        if (r.rows.length === 0) return res.send("<script>alert('ID NOT FOUND');location.href='/';</script>");
        const b = r.rows[0].balance;
        res.send(getLayout(`
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;padding:20px;box-sizing:border-box;">
                <div class="card" style="width:100%;max-width:400px;text-align:center;border-color:var(--gold);">
                    <div style="font-family:Orbitron;color:var(--gold);font-size:10px;opacity:0.5;letter-spacing:2px;">VAULT_HOLDER</div>
                    <div style="font-family:Orbitron;font-size:20px;margin:10px 0 25px 0;">${req.query.u}</div>
                    <div style="font-size:3.5rem;font-family:Orbitron;color:#fff;text-shadow:0 0 20px var(--gold);">${b.toLocaleString()}</div>
                    <div style="color:var(--gold);font-size:10px;margin-top:10px;letter-spacing:4px;">COIN CREDITS</div>
                    <div style="margin-top:25px;padding-top:20px;border-top:1px solid #111;">
                        <div style="font-size:1.5rem;color:var(--green);font-family:Orbitron;">$ ${(b*100).toLocaleString()} <span style="font-size:10px;">USD</span></div>
                    </div>
                    <button class="btn btn-gold" style="margin-top:35px;" onclick="location.href='/'">BACK</button>
                </div>
            </div>
        `, true));
    } catch (e) { res.redirect('/'); }
});

app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('CREATED');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('EXISTS');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.floor(Math.abs(parseInt(a)));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('PIN ERROR');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('LOW BALANCE');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
