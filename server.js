const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;

// 1. 增强型数据库连接与自动修复逻辑
async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });
    try {
        await client.connect();
        
        // 创建基础表
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance BIGINT, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount BIGINT, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 关键修复：动态补齐缺失列，防止 "pin does not exist" 报错
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='pin') THEN
                    ALTER TABLE users ADD COLUMN pin TEXT DEFAULT '000000';
                END IF;
            END $$;
        `);

        // 初始化 Admin 账户权限
        await client.query(`
            INSERT INTO users (name, balance, pin) 
            VALUES ('Admin', 1000000, '888888') 
            ON CONFLICT (name) DO UPDATE SET pin = '888888', balance = EXCLUDED.balance;
        `);
        
        isDbReady = true;
        console.log("MBA_SYSTEM_SECURED: V17.0 Online");
    } catch (err) {
        console.error("DB_SYNC_ERROR:", err.message);
        setTimeout(connectToDb, 5000);
    }
}

const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 | GLOBAL DIGITAL ASSET EXCHANGE</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(10, 12, 16, 0.98); --border: #1A1C22; --text: #E0E2E5; }
        body { background: var(--bg); color: var(--text); font-family: 'Exo 2', sans-serif; margin: 0; overflow: hidden; height: 100vh; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply-tag { font-weight: 700; color: var(--gold); letter-spacing: 4px; text-transform: uppercase; font-size: 15px; text-shadow: 0 0 15px rgba(240,185,11,0.4); }
        .container { display: flex; height: 100vh; width: 100vw; padding-top: 60px; }
        .visual-frame { flex: 1; position: relative; background: #000; overflow: hidden; }
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; z-index: 10; box-shadow: -20px 0 60px #000; }
        .card { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); padding: 18px; border-radius: 12px; margin-bottom: 15px; }
        input { width: 100%; padding: 12px; background: #000; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; margin-bottom: 10px; font-family: 'JetBrains Mono'; outline: none; border: 1px solid #1A1C22; }
        input:focus { border-color: var(--gold); }
        .btn { width: 100%; padding: 14px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Exo 2'; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; transition: 0.3s; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-gold:hover { background: #fff; box-shadow: 0 0 20px var(--gold); }
        .log-list { overflow-y: auto; flex: 1; margin-top: 10px; scroll-behavior: smooth; }
        .log-list::-webkit-scrollbar { width: 3px; }
        .log-list::-webkit-scrollbar-thumb { background: #222; }
        .log-item { font-family: 'JetBrains Mono'; font-size: 10px; padding: 8px 0; border-bottom: 1px solid #111; display: flex; justify-content: space-between; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { opacity:0; transform: translateX(15px); } to { opacity:1; transform: translateX(0); } }
        canvas { display: block; width: 100%; height: 100%; }
        #bal-view { display: none; border: 1px solid var(--gold); background: rgba(240,185,11,0.1); text-align: center; }
    </style>
</head>
<body>
    ${isDbReady ? content : '<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#f0b90b;letter-spacing:5px;font-weight:700;">INITIALIZING GLOBAL ASSET EXCHANGE...</div>'}
    <script>
        // --- 量子凝聚引擎 ---
        const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
        let w, h, pts=[], startTime=Date.now();
        function init(){
            if(!c) return;
            w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight;
            pts=[];
            for(let i=0; i<450; i++){
                let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1);
                pts.push({ tx: Math.sin(a)*Math.cos(t), ty: Math.sin(a)*Math.sin(t), tz: Math.cos(a), sx: (Math.random()-0.5)*6, sy: (Math.random()-0.5)*6, sz: (Math.random()-0.5)*6, isCap: Math.random()>0.92 });
            }
        }
        let rot=0;
        function draw(){
            if(!x) return;
            x.fillStyle='#000'; x.fillRect(0,0,w,h);
            let pgr = Math.min((Date.now()-startTime)/2500, 1);
            let ease = 1-Math.pow(2, -10*pgr); rot+=0.0025;
            x.save(); x.translate(w/2, h/2);
            let active = pts.map(p => {
                let cx=p.sx+(p.tx-p.sx)*ease, cy=p.sy+(p.ty-p.sy)*ease, cz=p.sz+(p.tz-p.sz)*ease;
                let x1=cx*Math.cos(rot)-cz*Math.sin(rot), z1=cz*Math.cos(rot)+cx*Math.sin(rot);
                return { x: x1*Math.min(w,h)*0.38, y: cy*Math.min(w,h)*0.38, z: z1, cap: p.isCap };
            });
            active.forEach(p=>{
                let s=(p.z+1.2)/2.4; if(s<0.2) return;
                x.fillStyle=p.cap?\`rgba(255,255,255,\${s*pgr})\`:\`rgba(240,185,11,\${0.6*s*pgr})\`;
                x.beginPath(); x.arc(p.x,p.y,p.cap?3.5*s:1.3*s,0,Math.PI*2); x.fill();
            });
            x.restore(); requestAnimationFrame(draw);
        }
        window.onresize=init; init(); draw();

        // --- 实时流水账滚动优化 ---
        const observer = new MutationObserver(() => {
            const list = document.getElementById('log-list');
            if(list) list.scrollTop = list.scrollHeight;
        });
        window.onload = () => {
            const logList = document.getElementById('log-list');
            if(logList) {
                observer.observe(logList, { childList: true });
                logList.scrollTop = logList.scrollHeight;
            }
        };

        function checkBal(){
            const u=document.getElementById('f').value;
            fetch(\`/api/bal_raw?u=\${encodeURIComponent(u)}\`).then(r=>r.json()).then(d=>{
                document.getElementById('v-u').innerText=u;
                document.getElementById('v-n').innerText=Number(d.b).toLocaleString();
                document.getElementById('bal-view').style.display='block';
            });
        }
        function sendTx(){
            const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value;
            if(!f||!p||!t||!a) return alert("COMPLETE ALL FIELDS");
            location.href=\`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`;
        }
    </script>
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout(''));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time ASC LIMIT 100');
        const total = stats.rows[0].b || 0;
        let logHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b style="color:#f0b90b">+${Number(l.amount).toLocaleString()}</b></div>`).join('');

        res.send(getLayout(`
            <div class="header"><div class="supply-tag">MBA2509007 GLOBAL DIGITAL ASSET EXCHANGE</div></div>
            <div class="container">
                <div class="visual-frame"><canvas id="globe-canvas"></canvas></div>
                <div class="sidebar">
                    <div class="card">
                        <div style="font-size:10px; color:#444; margin-bottom:12px; letter-spacing:2px;">TERMINAL_AUTH</div>
                        <input type="text" id="f" placeholder="ID (Admin)">
                        <input type="password" id="p" placeholder="PIN (888888)">
                        <input type="text" id="t" placeholder="TARGET ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="sendTx()">EXECUTE TRANSACTION</button>
                        <button class="btn" style="background:none; color:#f0b90b; border:1px solid #1A1C22; font-size:10px; margin-top:10px;" onclick="checkBal()">VAULT STATUS</button>
                    </div>
                    <div id="bal-view" class="card">
                        <div style="font-size:9px; color:#666;">VAULT: <span id="v-u" style="color:#fff"></span></div>
                        <div id="v-n" style="font-size:2.2rem; font-weight:700; color:#fff;">0</div>
                        <div style="font-size:9px; color:var(--gold); letter-spacing:2px;">COIN BALANCE</div>
                    </div>
                    <div style="font-size:10px; color:#222; font-weight:700; margin-top:5px;">REALTIME_LEDGER</div>
                    <div class="log-list" id="log-list">${logHtml}</div>
                </div>
            </div>
        `));
    } catch(e) { res.send("Terminal Syncing..."); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = BigInt(a);
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('AUTH FAIL');location.href='/';</script>");
        
        await client.query('BEGIN');
        await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2', [amt, f]);
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        await client.query('COMMIT');
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.get('/api/bal_raw', async (req, res) => {
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
    res.json({b: r.rows.length ? r.rows[0].balance.toString() : "0"});
});

app.listen(port, () => {
    connectToDb();
});
