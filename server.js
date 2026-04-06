require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs'); // 确保使用 bcryptjs 兼容性

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let client = null;
let isDbReady = false;

// 数据库连接与初始化 (Database Initialization)
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
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #000; --glass: rgba(12, 12, 12, 0.8); --border: rgba(255, 255, 255, 0.05); --green: #00ff88; }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
        body { background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; height: 100vh; overflow: hidden; position: relative; }
        
        /* 全屏背景画布 */
        #canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; filter: blur(0.5px); pointer-events: none; }

        /* 顶部导航：Orbitron 金色并排 */
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .header-inner { width: 92%; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--gold); letter-spacing: 1px; }
        .header-left { display: flex; align-items: center; gap: 10px; }
        .sep { margin: 0 10px; opacity: 0.3; }

        /* 主体内容层 */
        .main-layer { position: relative; z-index: 10; height: 100vh; padding-top: 60px; display: flex; flex-direction: column; justify-content: center; align-items: center; padding-bottom: 30px; }

        /* 玻璃面板：悬浮科技感 */
        .panel { 
            background: var(--glass); 
            backdrop-filter: blur(25px); 
            -webkit-backdrop-filter: blur(25px);
            border: 1px solid var(--border);
            border-radius: 24px; 
            padding: 30px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.6);
            width: 92%; max-width: 420px; 
            margin: auto;
        }
        
        /* 排行榜样式修正 */
        .list-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 11px; color: rgba(255,255,255,0.5); }
        .list-row span:first-child { color: rgba(255,255,255,0.8); font-weight: bold; }

        /* 输入组件优化 */
        .tabs { display: flex; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 10px; margin-bottom: 20px; }
        .tab { flex: 1; background: transparent; color: #555; border: none; padding: 12px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; border-radius: 8px; transition: 0.3s; }
        .tab.active { background: var(--gold); color: #000; font-weight: 900; }

        input { 
            width: 100%; padding: 18px; margin-bottom: 12px; 
            background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); 
            color: #fff; border-radius: 12px; font-family: 'Orbitron'; font-size: 15px; text-align: center; outline: none; transition: 0.3s;
        }
        input:focus { border-color: var(--gold); background: rgba(240,185,11,0.05); }

        .btn-pay { 
            width: 100%; padding: 20px; background: var(--gold); color: #000; 
            border: none; border-radius: 12px; font-family: 'Orbitron'; font-weight: 900; 
            font-size: 16px; margin-top: 10px; box-shadow: 0 10px 20px rgba(240,185,11,0.2);
        }
        .btn-pay:active { transform: translateY(1px); opacity: 0.9; }

        /* 移动端特殊适配 */
        @media (min-width: 850px) {
            .main-layer { flex-direction: row; justify-content: space-between; padding: 80px; align-items: center; }
            .panel { margin-right: 0; width: 400px; }
        }
    </style>
</head>
<body>
    <canvas id="canvas"></canvas>
    ${hideNav ? '' : `
    <div class="header">
        <div class="header-inner">
            <div class="header-left">
                <span id="clock">00:00:00</span>
                <span class="sep">|</span>
                <span id="res-val">RES: LOADING...</span>
            </div>
            <span style="color:var(--green)">1 COIN = 100 USD</span>
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
            <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; padding-top:40px; pointer-events:none;">
                <div style="width:92%; max-width:380px; margin:0 auto; padding-left:20px;">
                    <div style="font-size:10px; color:#444; font-family:Orbitron; margin-bottom:15px; letter-spacing:2px;">GLOBAL_RANKING</div>
                    ${rankHtml}
                </div>
            </div>
            <div class="panel">
                <div class="tabs">
                    <button class="tab active" id="btn-t" onclick="sw('t')">TERMINAL</button>
                    <button class="tab" id="btn-r" onclick="sw('r')">REGISTRY</button>
                </div>
                <div id="panel-t">
                    <input type="text" id="id_f" placeholder="IDENT ID">
                    <input type="password" id="id_p" placeholder="SECURITY PIN">
                    <input type="text" id="id_t" placeholder="RECIPIENT ID">
                    <input type="number" id="id_a" placeholder="AMOUNT">
                    <button class="btn-pay" onclick="doPay()">AUTHORIZE</button>
                    <button class="btn btn-gold" style="background:transparent; color:var(--gold); border:1px solid var(--gold); border-radius:8px; margin-top:15px; width:100%; padding:15px; font-family:Orbitron; font-size:12px;" onclick="doBal()">SCAN VAULT</button>
                </div>
                <div id="panel-r" style="display:none;">
                    <input type="text" id="reg_n" placeholder="NEW UNIQUE ID">
                    <input type="password" id="reg_p" placeholder="6-DIGIT PIN">
                    <button class="btn-pay" onclick="doReg()">GENERATE VAULT</button>
                </div>
            </div>
            <script>
                document.getElementById('res-val').innerText = "RES: ${total.toLocaleString()} COIN";
                const c=document.getElementById('canvas'), ctx=c.getContext('2d'); let w,h,p=[];
                function init(){ w=c.width=window.innerWidth; h=c.height=window.innerHeight; p=[]; for(let i=0;i<300;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); p.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let rot=0; function draw(){
                    ctx.fillStyle='#000'; ctx.fillRect(0,0,w,h); rot+=0.0035; ctx.save(); ctx.translate(w/2,h/2);
                    p.forEach(pt=>{
                        let x1=pt.x*Math.cos(rot)-pt.z*Math.sin(rot), z1=pt.z*Math.cos(rot)+pt.x*Math.sin(rot);
                        let s=(z1+1.2)/2.4; ctx.fillStyle="rgba(240,185,11,"+s+")";
                        ctx.beginPath(); ctx.arc(x1*Math.min(w,h)*0.4, pt.y*Math.min(w,h)*0.4, s*2, 0, 7); ctx.fill();
                    });
                    ctx.restore(); requestAnimationFrame(draw);
                }
                window.onresize=init; init(); draw();
                function sw(m){ document.getElementById('panel-t').style.display=m==='t'?'block':'none'; document.getElementById('panel-r').style.display=m==='r'?'block':'none'; document.getElementById('btn-t').className=m==='t'?'tab active':'tab'; document.getElementById('btn-r').className=m==='r'?'tab active':'tab'; }
                function doPay(){ const f=document.getElementById('id_f').value, p=document.getElementById('id_p').value, t=document.getElementById('id_t').value, a=document.getElementById('id_a').value; if(f&&p&&t&&a) location.href='/api/pay?f='+encodeURIComponent(f)+'&p='+p+'&t='+encodeURIComponent(t)+'&a='+a; }
                function doReg(){ const n=document.getElementById('reg_n').value, p=document.getElementById('reg_p').value; if(n&&p) location.href='/api/reg?u='+encodeURIComponent(n)+'&p='+p; }
                function doBal(){ const id=document.getElementById('id_f').value || prompt("ENTER ID:"); if(id) location.href='/api/bal?u='+encodeURIComponent(id); }
                setInterval(()=>{const now=new Date(); document.getElementById('clock').innerText=now.toLocaleTimeString('en-US',{hour12:false})},1000);
            </script>
        `));
    } catch (e) { res.send("DB_ERROR"); }
});

app.get('/api/bal', async (req, res) => {
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
    const b = r.rows.length ? r.rows[0].balance : 0;
    res.send(getLayout(`
        <div style="margin:auto; width:92%; max-width:400px; text-align:center; padding:30px; background:var(--glass); border-radius:24px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid var(--border);">
            <div style="font-size:10px; color:rgba(255,255,255,0.4); font-family:Orbitron; letter-spacing:3px;">VAULT_HOLDER: ${req.query.u}</div>
            <div style="font-size:3.5rem; font-weight:900; margin:20px 0; color:#fff; text-shadow:0 0 20px rgba(255,255,255,0.3);">${b.toLocaleString()}</div>
            <div style="color:var(--gold); font-size:12px; letter-spacing:4px;">COIN Credits</div>
            <button class="btn-pay" style="margin-top:40px; width:100%;" onclick="location.href='/'">RETURN TO TERMINAL</button>
        </div>
    `, true));
});

// 其余 API (reg/pay) 逻辑保持不变...
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

app.listen(port, async () => {
    await connectToDb();
    console.log(`Server connected & Running on port ${port}`);
});
