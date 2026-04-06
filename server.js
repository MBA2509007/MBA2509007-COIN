require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

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
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER CHECK (balance >= 0), pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER CHECK (amount > 0), time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
    } catch (err) { setTimeout(connectToDb, 5000); }
}

// 统一界面布局渲染引擎 - 重点优化了 Media Queries 比例
const getLayout = (content, hideNav = false) => `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&family=Roboto+Mono:wght@700&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #000; --panel: rgba(13, 13, 13, 0.9); --border: rgba(255, 255, 255, 0.05); --green: #00ff88; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
        body { background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; height: 100vh; overflow: hidden; position: relative; }
        
        /* 全屏背景画布 */
        #canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; filter: blur(0.5px); pointer-events: none; }

        /* 顶部导航：Orbitron 金色并排 */
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-inner { width: 92%; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--gold); letter-spacing: 1px; }
        .clock-box { font-size: 10px; color: #fff; letter-spacing: 2px; text-align: right; }

        /* 主体内容层 */
        .main-layer { position: relative; z-index: 10; height: 100vh; padding-top: 60px; display: flex; flex-direction: column; }

        /* 左侧视觉区 (排行榜) */
        .visual { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; padding: 40px; pointer-events: none; position: relative; }
        #canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; }
        .list-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 11px; color: rgba(255,255,255,0.5); font-family: 'Orbitron'; }
        .list-row span:first-child { color: rgba(255,255,255,0.8); font-weight: bold; }

        /* 右侧操作面板与玻璃质感 */
        .sidebar { width: 420px; background: var(--panel); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; justify-content: center; z-index: 10; position: absolute; right: 0; top: 60px; bottom: 0; }
        
        /* 玻璃面板（核心重塑）：卡片结构更加稳固 */
        .panel { 
            background: rgba(12, 12, 12, 0.95); 
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px; 
            padding: 30px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.6);
            width: 100%; position: relative;
        }

        /* 修正重叠问题后的绿色卡片 */
        .rate-card { 
            position: absolute; top: -30px; right: 20px; 
            background: rgba(0, 255, 136, 0.1); 
            border: 1px solid var(--green);
            padding: 10px 25px;
            border-radius: 12px;
            color: var(--green);
            /* 重点修正：采用更稳固的 Roboto Mono 字体，加大字体，解决重叠 */
            font-family: 'Roboto Mono', monospace;
            font-size: 26px;
            font-weight: 700;
            line-height: 1; /* 精准控制行高 */
            letter-spacing: 0.5px; /* 控制字距 */
            text-align: center;
            text-shadow: 0 0 10px rgba(0,255,136,0.6);
            box-shadow: inset 0 0 15px rgba(0,255,136,0.1), 0 0 20px rgba(0,255,136,0.2);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 0.9; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.02); }
            100% { opacity: 0.9; transform: scale(1); }
        }

        /* 输入组件与按钮重塑 */
        input { 
            width: 100%; padding: 18px; margin-bottom: 12px; 
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); 
            color: #fff; border-radius: 12px; font-family: 'Orbitron'; font-size: 15px; text-align: center; outline: none; transition: 0.3s;
        }
        input:focus { border-color: var(--gold); background: rgba(240,185,11,0.05); }
        
        /* 统一大个子金色按钮 (LOGIN/REGISTER样式均一致) */
        .btn-main { width: 100%; padding: 20px; background: var(--gold); color: #000; border: none; border-radius: 12px; font-family: 'Orbitron'; font-weight: 900; font-size: 16px; margin-top: 10px; cursor: pointer; transition: 0.3s; text-transform: uppercase; box-shadow: 0 10px 20px rgba(240,185,11,0.2); }
        .btn-main:active { transform: translateY(1px); opacity: 0.9; }

        @media (max-width: 850px) {
            .sidebar { width: 100%; height: calc(100% - 60px); top: 60px; right: 0; left: 0; justify-content: center; }
            .visual { height: 30vh; }
        }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-inner">
            <span id="header-reserve">RESERVE: LOADING...</span>
            <div class="clock-box">
                <span id="live-date">--:--:--</span><br>
                <span id="live-time" style="color:#f0b90b; font-size:13px; font-weight:900;">--:--:--</span>
            </div>
        </div>
    </div>`}
    <div class="main-layer">
        ${content}
    </div>
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="margin:auto;font-family:Orbitron;color:var(--gold)">CONNECTING_CELLS...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const ranking = await client.query("SELECT name, balance FROM users WHERE name != 'Admin' ORDER BY balance DESC LIMIT 5");
        const total = stats.rows[0].b || 0;
        let rankHtml = ranking.rows.map((r, i) => `<div class="list-row"><span>${i === 0 ? '🏆' : '#' + (i + 1)} ${r.name}</span><span>${r.balance.toLocaleString()} COIN</span></div>`).join('');

        res.send(getLayout(`
            <div class="visual">
                <div style="width:100%; max-width:380px;">
                    <div style="font-family:Orbitron; margin-bottom:15px; font-size:12px; color:#444; letter-spacing:2px;">GLOBAL_LEADERBOARD</div>
                    ${rankHtml}
                </div>
            </div>
            <div class="sidebar">
                <div class="panel">
                    <div class="rate-card">1 COIN = 100 USD</div>
                    
                    <h2 style="margin-top:20px; text-align:center;">ACCESS TERMINAL</h2>
                    <input type="text" id="id_f" placeholder="IDENT ID">
                    <input type="password" id="id_p" placeholder="SECURITY PIN">
                    <button class="btn-main" onclick="doLog()">LOGIN</button>
                    
                    <div style="margin:25px 0; height:1px; background:linear-gradient(to right, transparent, rgba(255,255,255,0.08), transparent);"></div>
                    
                    <input type="text" id="reg_n" placeholder="NEW UNIQUE ID">
                    <input type="password" id="reg_p" placeholder="SET 6-DIGIT PIN">
                    <button class="btn-main" onclick="doReg()">REGISTER</button>
                </div>
            </div>
            <script>
                document.getElementById('header-reserve').innerText = "EXCHANGE RESERVE: ${total.toLocaleString()} COIN";
                const c=document.getElementById('canvas'),ctx=c.getContext('2d');let w,h,p=[];
                function init(){ w=c.width=window.innerWidth;h=c.height=window.innerHeight;p=[];for(let i=0;i<300;i++){let t=Math.random()*6.28,a=Math.acos(Math.random()*2-1);p.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)});}}
                let r=0;function draw(){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);r+=0.0035;ctx.save();ctx.translate(w/2,h/2);p.forEach(pt=>{let x1=pt.x*Math.cos(r)-pt.z*Math.sin(r),z1=pt.z*Math.cos(r)+pt.x*Math.sin(r);let s=(z1+1.2)/2.4;ctx.fillStyle="rgba(240,185,11,"+s+")";ctx.beginPath();ctx.arc(x1*Math.min(w,h)*0.4,pt.y*Math.min(w,h)*0.4,s*2.5,0,7);ctx.fill();});ctx.restore();requestAnimationFrame(draw);}
                window.onresize=init;init();draw();
                
                function doLog(){ const f=document.getElementById('id_f').value, p=document.getElementById('id_p').value; if(f&&p) location.href='/wallet?u='+encodeURIComponent(f); }
                function doReg(){ const n=document.getElementById('reg_n').value, p=document.getElementById('reg_p').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function updateClock(){const now=new Date();document.getElementById('live-date').innerText=now.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'}).toUpperCase();document.getElementById('live-time').innerText=now.toLocaleTimeString('en-US',{hour12:false});}
                setInterval(updateClock, 1000);updateClock();
            </script>
        `));
    } catch (e) { res.send("DB_ERROR"); }
});

// 其余 API (wallet/pay) 保持不变...
app.get('/wallet', async (req, res) => {
    const r = await client.query("SELECT * FROM users WHERE name=$1",[req.query.u]);
    if(!r.rows.length) return res.redirect('/');
    const stats = await client.query('SELECT SUM(balance) as b FROM users');
    res.send(getLayout(`
        <div class="visual">
            <div style="text-align:center; padding:50px; background:var(--glass); border-radius:24px; border:1px solid var(--border);">
                <div style="font-size:10px; color:rgba(255,255,255,0.4); font-family:Orbitron; letter-spacing:2px;">QUANTUM_VAULT_HOLDER: ${req.query.u}</div>
                <div style="font-size:4.5rem; font-weight:900; margin:20px 0; color:#fff; font-family:Orbitron; text-shadow:0 0 20px rgba(255,255,255,0.3); line-height:1;">${r.rows[0].balance.toLocaleString()}</div>
                <div style="color:var(--gold); font-size:12px; font-family:Orbitron; letter-spacing:4px;">COIN Credits</div>
            </div>
        </div>
        <div class="sidebar">
            <div class="panel" style="padding:40px;">
                <h2 style="font-size:16px;">SECURE_FUND_TRANSFER</h2>
                <input type="text" id="id_t" placeholder="RECIPIENT UNIQUE ID">
                <input type="number" id="id_a" placeholder="TRANSFER AMOUNT">
                <input type="password" id="id_p" placeholder="6-DIGIT SECURITY PIN">
                <button class="btn-main" onclick="doPay()">AUTHORIZE</button>
                <button onclick="location.href='/'" style="background:#222; color:#fff; margin-top:10px; font-size:12px;">LOGOUTTERMINAL</button>
            </div>
        </div>
        <script>
            document.getElementById('header-reserve').innerText = "EXCHANGE RESERVE: ${stats.rows[0].b.toLocaleString()} COIN";
            function doPay(){ const t=document.getElementById('id_t').value, a=document.getElementById('id_a').value, p=document.getElementById('id_p').value; if(t&&a&&p) location.href='/api/pay?f=${req.query.u}&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
        </script>
    `));
});

app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('REGISTER_SUCCESS');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ERROR: ID TAKEN');location.href='/';</script>"); }
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

app.listen(port, async () => {
    await connectToDb();
    console.log(`Server connected & Running on port ${port}`);
});
