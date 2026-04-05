const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;
let dbError = "Initiating MBA Apex Terminal | Core Synchronizing...";

// 1. 核心连接与自动修复逻辑 (保持原版稳健)
async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });

    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 自动迁移逻辑
        try {
            await client.query('ALTER TABLE users ADD COLUMN pin TEXT');
            console.log("MBA_SYSTEM: Migration successful (Added 'pin' column).");
        } catch (e) { /* Column already exists */ }

        await client.query(`
            INSERT INTO users (name, balance, pin) 
            VALUES ('Admin', 1000000, '888888') 
            ON CONFLICT (name) DO UPDATE SET pin = '888888' WHERE users.pin IS NULL
        `);
        
        isDbReady = true;
        console.log("MBA_SYSTEM: Apex Network Established & Secured.");
    } catch (err) {
        dbError = err.message;
        console.error("DB_FAIL:", err.message);
        setTimeout(connectToDb, 5000); // Retry
    }
}

// 2. 尊享版 UI 布局模块 (黑金玻璃拟态)
const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | APEX QUANTUM VAULT</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #0A0B0E; --panel: rgba(18, 20, 26, 0.85); --border: #22262E; --text: #E0E2E5; --glow: rgba(240, 185, 11, 0.4); --font-main: 'Exo 2', sans-serif; --font-mono: 'JetBrains Mono', monospace; }
        
        body { background: var(--bg); color: var(--text); font-family: var(--font-main); margin: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; animation: fadeInBody 1s ease; }
        @keyframes fadeInBody { from { opacity: 0; } to { opacity: 1; } }

        /* 初始化界面 */
        .init-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
        .spinner { border: 3px solid #111; border-top: 3px solid var(--gold); border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 25px; box-shadow: 0 0 15px var(--glow); }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .msg { font-weight: 700; color: var(--gold); letter-spacing: 4px; font-size: 18px; text-shadow: 0 0 10px var(--glow); }
        .log-diag { color: #555; font-size: 10px; margin-top: 40px; font-family: var(--font-mono); max-width: 80%; word-break: break-all; }

        /* 顶部导航 */
        .header { position: fixed; top: 0; width: 100%; height: 65px; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; box-shadow: 0 5px 15px rgba(0,0,0,0.5); }
        .supply-tag { font-family: var(--font-main); font-weight: 700; font-size: 14px; color: var(--gold); letter-spacing: 3px; text-shadow: 0 0 15px var(--glow); text-transform: uppercase; }

        /* 主容器 */
        .container { display: flex; height: 100vh; width: 100vw; padding-top: 65px; box-sizing: border-box; overflow: hidden; }
        .visual-frame { flex: 1; position: relative; background: radial-gradient(circle at center, #111 0%, #000 100%); }
        .sidebar { width: 440px; background: var(--panel); border-left: 1px solid var(--border); padding: 35px; display: flex; flex-direction: column; box-shadow: -15px 0 30px rgba(0,0,0,0.6); z-index: 10; overflow-y: auto; }

        /* 元素卡片样式 (玻璃拟态) */
        .card { background: rgba(10, 10, 10, 0.4); border: 1px solid var(--border); padding: 25px; border-radius: 12px; margin-bottom: 25px; transition: all 0.3s ease; backdrop-filter: blur(5px); }
        .card:hover { border-color: #444; box-shadow: 0 0 20px rgba(240,185,11,0.1); transform: translateY(-2px); }
        .input-group { position: relative; margin-bottom: 15px; }
        .input-group::after { content: attr(data-icon); font-family: var(--font-mono); position: absolute; left: 15px; top: 15px; color: #444; font-size: 12px; }
        
        input { width: 100%; padding: 16px 16px 16px 50px; background: rgba(0,0,0,0.6); border: 1px solid #333; color: var(--gold); border-radius: 8px; box-sizing: border-box; font-family: var(--font-mono); font-size: 13px; transition: 0.3s ease; outline: none; }
        input:focus { border-color: var(--gold); box-shadow: 0 0 10px var(--glow); }
        
        .btn { width: 100%; padding: 18px; border-radius: 8px; border: none; cursor: pointer; font-family: var(--font-main); font-weight: 700; font-size: 12px; transition: all 0.3s ease; margin-top: 8px; text-transform: uppercase; letter-spacing: 2px; }
        .btn-gold { background: var(--gold); color: #000; position: relative; overflow: hidden; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255,255,255,0.2); }
        .btn-gold:active { transform: translateY(0px); }
        .btn-gold::after { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%); transform: rotate(30deg); transition: 0.5s; opacity: 0; }
        .btn-gold:hover::after { opacity: 1; left: 0; top: 0; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        .btn-outline:hover { color: #fff; border-color: #fff; backdrop-filter: blur(5px); }
        
        /* 余额展示框 */
        #bal-view { display: none; margin-bottom: 10px; opacity: 0; transition: opacity 0.3s ease; }
        .card-bal { border-color: var(--gold); box-shadow: 0 0 20px rgba(240,185,11,0.2); text-align: center; }

        /* 标签页与日志 */
        .tabs { display: flex; gap: 10px; margin-bottom: 25px; }
        .tab-btn { background: rgba(25, 25, 25, 0.6); color: #666; border: none; padding: 12px; cursor: pointer; font-family: var(--font-main); font-weight: 700; font-size: 10px; flex: 1; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s ease; }
        .tab-btn.active { background: var(--gold); color: #000; box-shadow: 0 0 15px var(--glow); }
        .log-list { flex: 1; overflow-y: auto; font-family: var(--font-mono); font-size: 11px; color: #777; border-top: 1px solid #1a1a1a; padding-top: 15px; }
        .log-item { padding: 10px 0; border-bottom: 1px solid #151515; display: flex; justify-content: space-between; align-items: center; }
        .log-item b { color: #aaa; }
        
        canvas { display: block; width: 100%; height: 100%; }
    </style>
    ${!isDbReady ? '<script>setTimeout(() => location.reload(), 3000);</script>' : ''}
</head>
<body>
    ${isDbReady ? content : `
        <div class="init-screen">
            <div class="spinner"></div>
            <div class="msg">INITIATING MBA APEX TERMINAL</div>
            <div style="color:#555; margin-top:15px; font-size:12px; letter-spacing:2px;">SYNCHRONIZING GLOBAL LEDGER...</div>
            <div class="log-diag">SYSTEM_REPORT: ${dbError}</div>
        </div>
    `}
</body>
</html>`;

// 3. 终极终端页面逻辑
app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout(''));

    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 15');
        const total = stats.rows[0].b || 1000000;
        let logHtml = logs.rows.map(l => `
            <div class="log-item">
                <span><b style="color:#fff">${l.sender}</b> > ${l.receiver}</span>
                <span style="color:var(--gold)">+${Number(l.amount).toLocaleString()} WOW</span>
            </div>
        `).join('');

        res.send(getLayout(`
            <div class="header">
                <div class="supply-tag">GLOBAL RESERVE: ${total.toLocaleString()} WOW CREDITS</div>
            </div>
            <div class="container">
                <div class="visual-frame"><canvas id="apex-globe"></canvas></div>
                <div class="sidebar">
                    <div class="tabs">
                        <button class="tab-btn active" id="t1" onclick="swTx('tx')">VAULT SHIPMENT</button>
                        <button class="tab-btn" id="t2" onclick="swTx('rg')">NEW APEX VAULT</button>
                    </div>
                    
                    <div id="box-tx" class="card">
                        <div class="supply-tag" style="font-size:11px; margin-bottom:15px;">TERMINAL EXECUTION</div>
                        <div class="input-group" data-icon="[ID]">
                            <input type="text" id="f" placeholder="YOUR ID">
                        </div>
                        <div class="input-group" data-icon="[PIN]">
                            <input type="password" id="p" placeholder="6-DIGIT PIN" maxlength="6">
                        </div>
                        <div class="input-group" data-icon="[TO]">
                            <input type="text" id="t" placeholder="TARGET ID">
                        </div>
                        <div class="input-group" data-icon="[AM]">
                            <input type="number" id="a" placeholder="SHIPMENT AMOUNT">
                        </div>
                        <button class="btn btn-gold" onclick="sendTx()">AUTHORIZE TRANSACTION</button>
                        <button class="btn btn-outline" style="margin-top:10px;" onclick="checkVault()">ACCESS VAULT VIEW</button>
                    </div>

                    <div id="box-rg" class="card" style="display:none; transition: all 0.3s ease;">
                        <div class="supply-tag" style="font-size:11px; margin-bottom:15px;">GENERATE IDENTITY</div>
                        <input type="text" id="rn" placeholder="CREATE UNIQUE ID">
                        <input type="password" id="rp" placeholder="SET 6-DIGIT PIN" maxlength="6">
                        <button class="btn btn-gold" onclick="regAcc()">INITIALIZE ACCOUNT</button>
                    </div>

                    <div id="bal-view">
                        <div class="card card-bal">
                            <div style="font-family:'Exo 2'; font-weight:700; color:var(--gold); font-size:12px; text-transform:uppercase;">VAULT IDENTITY</div>
                            <div id="bal-user" style="font-size:1.5rem; font-weight:700; color:#fff; margin:10px 0;">--</div>
                            <div id="bal-num" style="font-size:4rem; font-family:'Exo 2'; color:#fff; text-shadow: 0 0 20px var(--gold);">0</div>
                            <div style="font-size:10px; color:var(--gold); text-transform:uppercase; letter-spacing:2px; margin-bottom:20px;">WOW CREDITS</div>
                            <button class="btn btn-gold" style="padding:12px; font-size:10px;" onclick="hideVault()">CLOSE ACCESS</button>
                        </div>
                    </div>

                    <div style="font-family:var(--font-mono); font-size:10px; color:#444; margin-bottom:10px; letter-spacing:1px; text-transform:uppercase;">LIVE_APEX_LEDGER</div>
                    <div class="log-list">${logHtml || '<div style="color:#333;text-align:center;font-size:12px;">LISTENING FOR NETWORK ACTIVITY...</div>'}</div>
                </div>
            </div>
            <script>
                // APEX 地球渲染引擎升级
                const c=document.getElementById('apex-globe'), x=c.getContext('2d'); let w,h,p=[];
                function resize(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; p=[]; for(let i=0;i<480;i++){ let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1); p.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#050505'; x.fillRect(0,0,w,h); r+=0.0035; x.save(); x.translate(w/2,h/2); p.forEach(i=>{ let x1=i.x*Math.cos(r)-i.z*Math.sin(r),z1=i.z*Math.cos(r)+i.x*Math.sin(r); let s=(z1+1.2)/2.4; // 增加发光粒子效果 x.fillStyle="rgba(240,185,11,"+s+")"; x.shadowBlur=s*8; x.shadowColor="rgba(240,185,11,0.5)"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.38,i.y*Math.min(w,h)*0.38,s*1.8,0,Math.PI*2); x.fill(); x.shadowBlur=0; // Reset blur }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=resize; resize(); draw();
                
                // UX 逻辑与动画
                function swTx(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; hideVault(); }
                function regAcc(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function sendTx(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function hideVault(){ const v=document.getElementById('bal-view'); v.style.opacity=0; setTimeout(()=>v.style.display='none',300); }
                
                // 丝滑余额查询 (取代 Prompt)
                function checkVault(){ 
                    const n=document.getElementById('f').value;
                    if(!n) { alert('ENTER YOUR ID'); return; }
                    document.getElementById('apex-globe').scrollIntoView({behavior: "smooth", block: "end"}); 
                    fetch(\`/api/bal_raw?u=\${encodeURIComponent(n)}\`).then(r=>r.json()).then(d=>{
                        document.getElementById('bal-user').innerText = n;
                        // 动态数字滚动
                        let c=0, t=d.b; const anim=()=>{ if(c < t){ c += Math.ceil((t-c)*0.1); document.getElementById('bal-num').innerText = c.toLocaleString(); requestAnimationFrame(anim); } else { document.getElementById('bal-num').innerText = t.toLocaleString(); } }; anim();
                        const v=document.getElementById('bal-view'); v.style.display='block'; setTimeout(()=>v.style.opacity=1,50);
                    });
                }
            </script>
        `));
    } catch (e) { res.send("Apex Terminal sync fault. Refreshing..."); }
});

// API 实现与 V12.7 保持一致 (保持原版稳健)
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Quantum Identity Secured.');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('Identity Unavailable.');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('Denied: Invalid Credentials');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('Denied: Insufficient Funds');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "123456") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

// 新增数据 API (用于丝滑查询)
app.get('/api/bal_raw', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        res.json({b: r.rows.length ? r.rows[0].balance : 0});
    } catch (e) { res.json({b:0}); }
});

app.listen(port, () => {
    console.log(`MBA_APEX_SYSTEM_LIVE_ON_${port}`);
    connectToDb();
});
