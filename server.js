const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;
let dbError = "Connecting to Mainframe...";

// 1. 数据库安全初始化
async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });
    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance BIGINT, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount BIGINT, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 自动初始化 Admin 账户
        const check = await client.query('SELECT * FROM users WHERE name = $1', ['Admin']);
        if (check.rows.length === 0) {
            await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 1000000, $2)', ['Admin', '888888']);
        } else {
            await client.query('UPDATE users SET pin = $1, balance = CASE WHEN balance < 1000000 THEN 1000000 ELSE balance END WHERE name = $2', ['888888', 'Admin']);
        }
        isDbReady = true;
    } catch (err) {
        dbError = err.message;
        setTimeout(connectToDb, 5000);
    }
}

// 2. 增强型 3D 布局 (V13.6)
const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | NEURAL LEDGER</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(10, 12, 16, 0.95); --border: #1A1C22; --text: #E0E2E5; }
        body { background: var(--bg); color: var(--text); font-family: 'Exo 2', sans-serif; margin: 0; overflow: hidden; height: 100vh; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.8); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply-tag { font-weight: 700; color: var(--gold); letter-spacing: 4px; text-transform: uppercase; font-size: 13px; text-shadow: 0 0 10px rgba(240,185,11,0.3); }
        .container { display: flex; height: 100vh; width: 100vw; padding-top: 60px; flex-direction: row-reverse; }
        .visual-frame { flex: 1; position: relative; background: #000; overflow: hidden; }
        .sidebar { width: 420px; background: var(--panel); border-right: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; z-index: 10; box-shadow: 20px 0 60px rgba(0,0,0,1); }
        .card { background: rgba(20, 20, 25, 0.7); border: 1px solid var(--border); padding: 22px; border-radius: 12px; margin-bottom: 25px; transition: 0.3s; }
        input { width: 100%; padding: 14px; background: #000; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; margin-bottom: 12px; font-family: 'JetBrains Mono'; outline: none; }
        input:focus { border-color: var(--gold); box-shadow: 0 0 10px rgba(240,185,11,0.2); }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Exo 2'; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; transition: 0.3s; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); box-shadow: 0 0 15px rgba(240,185,11,0.3); }
        .log-item { font-family: 'JetBrains Mono'; font-size: 11px; padding: 10px 0; border-bottom: 1px solid #111; display: flex; justify-content: space-between; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { opacity:0; transform: translateX(10px); } to { opacity:1; transform: translateX(0); } }
        canvas { display: block; width: 100%; height: 100%; }
        #bal-view { display: none; text-align: center; margin-top: 10px; animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body>
    ${isDbReady ? content : '<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#f0b90b;background:#000;font-weight:700;letter-spacing:5px;">MBA MAIN_FRAME BOOTING...</div>'}
    <script>
        // 【震撼 3D 寰宇光网引擎 V13.6】
        const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
        let w, h, pts=[];
        function init(){
            if(!c) return;
            w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight;
            pts=[];
            for(let i=0; i<450; i++){
                // 模拟大陆板块密集效果（非均匀分布）
                let t=Math.random()*Math.PI*2;
                let a = Math.acos(Math.random()*1.5 - 0.75); // 偏向赤道（模拟大陆密集）
                pts.push({ x: Math.sin(a)*Math.cos(t), y: Math.sin(a)*Math.sin(t), z: Math.cos(a) });
            }
        }
        let rot=0;
        function draw(){
            if(!x) return;
            x.fillStyle='#000'; x.fillRect(0,0,w,h);
            rot+=0.003; x.save(); x.translate(w/2, h/2);
            let active = pts.map(p => {
                let x1=p.x*Math.cos(rot)-p.z*Math.sin(rot), z1=p.z*Math.cos(rot)+p.x*Math.sin(rot);
                return { x: x1*Math.min(w,h)*0.38, y: p.y*Math.min(w,h)*0.38, z: z1 };
            });

            // 3D 智能连线 ( Neural Network Links )
            x.lineWidth=0.6;
            for(let i=0; i<active.length; i++){
                if(active[i].z < -0.2) continue; // 不连背面的线，增强 3D 景深感
                for(let j=i+1; j<active.length; j++){
                    let dx=active[i].x-active[j].x, dy=active[i].y-active[j].y, dz=active[i].z-active[j].z;
                    let dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
                    if(dist < 70){
                        // 连线透明度同时受距离和 Z 轴深度影响
                        let alpha = (1 - dist/70) * (active[i].z+0.5) * (active[j].z+0.5) * 0.25;
                        x.strokeStyle=\`rgba(240,185,11,\${alpha})\`;
                        x.beginPath(); x.moveTo(active[i].x, active[i].y); x.lineTo(active[j].x, active[j].y); x.stroke();
                    }
                }
            }

            // 绘制极简粒子
            active.forEach(p => {
                let s=(p.z+1.2)/2.4; // 景深缩放
                if(s<0.2) return; // 移除过深的点
                // 只有一种粒子，移除“首都”
                x.fillStyle=\`rgba(240,185,11,\${0.7 * s})\`;
                x.beginPath(); x.arc(p.x, p.y, 1.4 * s, 0, Math.PI*2); x.fill();
            });
            x.restore(); requestAnimationFrame(draw);
        }
        window.onresize=init; init(); draw();

        // UI 交互
        function sendTx(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href=\`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`; }
        function checkBal(){ const u=document.getElementById('f').value; if(!u) return alert("ENTER YOUR YOUR ID"); fetch(\`/api/bal_raw?u=\${encodeURIComponent(u)}\`).then(r=>r.json()).then(d=>{ document.getElementById('v-u').innerText=u; document.getElementById('v-n').innerText=Number(d.b).toLocaleString(); document.getElementById('bal-view').style.display='block'; }); }
        function regAcc(){ const u=document.getElementById('rn').value, p=document.getElementById('rp').value; if(u&&p) location.href=\`/api/reg?u=\${encodeURIComponent(u)}&p=\${p}\`; }
    </script>
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout(''));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
        const total = stats.rows[0].b || 1000000;
        let logHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b style="color:#f0b90b">+${Number(l.amount).toLocaleString()}</b></div>`).join('');

        res.send(getLayout(`
            <div class="header"><div class="supply-tag">NETWORK RESERVE: ${Number(total).toLocaleString()} WOW</div></div>
            <div class="container">
                <div class="visual-frame"><canvas id="globe-canvas"></canvas></div>
                <div class="sidebar">
                    <div id="b-tx" class="card">
                        <div style="font-size:10px; color:#333; margin-bottom:15px; letter-spacing:2px;">TERMINAL_AUTHORIZATION</div>
                        <input type="text" id="f" placeholder="YOUR ID (Admin)">
                        <input type="password" id="p" placeholder="6-DIGIT PIN (888888)">
                        <input type="text" id="t" placeholder="RECIPIENT ID">
                        <input type="number" id="a" placeholder="WOW AMOUNT">
                        <button class="btn btn-gold" onclick="sendTx()">AUTHORIZE TRANSACTION</button>
                        <button class="btn" style="color:#f0b90b;background:none;border:1px solid #1A1C22;font-size:10px;margin-top:10px;" onclick="checkBal()">VIEW BALANCE</button>
                    </div>
                    <div id="bal-view" class="card" style="border-color:#f0b90b; background: rgba(240,185,11,0.05); ">
                        <div style="font-size:10px;color:#555">VAULT: <span id="v-u" style="color:#fff"></span></div>
                        <div id="v-n" style="font-size:2.8rem;font-weight:700;color:#fff">0</div>
                        <div style="font-size:10px;color:#f0b90b;letter-spacing:3px;font-weight:700;">WOW CREDITS</div>
                    </div>
                    <div style="font-size:10px;color:#333;margin-bottom:10px;letter-spacing:1px;font-weight:700;">SYSTEM_LEDGER_LIVE</div>
                    <div class="log-list" style="overflow-y:auto;flex:1;">${logHtml || '<div style="color:#222;font-size:10px;text-align:center;padding:10px;">AWAITING NETWORK ACTIVITY...</div>'}</div>
                </div>
            </div>
        `));
    } catch(e) { res.send("Terminal sync error. Retrying..."); }
});

// API 部分保持原样
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Account Created');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID Taken');location.href='/';</script>"); }
});
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = BigInt(Math.abs(parseInt(a)));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('Auth Fail');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('Insufficient Balance');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "123456") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});
app.get('/api/bal_raw', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        res.json({b: r.rows.length ? r.rows[0].balance.toString() : "0"});
    } catch (e) { res.json({b:"0"}); }
});

app.listen(port, () => {
    console.log(`MBA_CORE_ONLINE_PORT_${port}`);
    connectToDb();
});
