const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;
let dbError = "Connecting to MBA Mainframe...";

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
        
        // 核心：初始化 Admin 账户
        const adminCheck = await client.query('SELECT * FROM users WHERE name = $1', ['Admin']);
        if (adminCheck.rows.length === 0) {
            await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 1000000, $2)', ['Admin', '888888']);
        } else {
            await client.query('UPDATE users SET pin = $1 WHERE name = $2', ['888888', 'Admin']);
        }
        isDbReady = true;
    } catch (err) {
        dbError = err.message;
        setTimeout(connectToDb, 5000);
    }
}

const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MBA2509007 | QUANTUM TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(10, 12, 16, 0.95); --border: #1A1C22; --text: #E0E2E5; }
        body { background: var(--bg); color: var(--text); font-family: 'Exo 2', sans-serif; margin: 0; overflow: hidden; height: 100vh; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply-tag { font-weight: 700; color: var(--gold); letter-spacing: 4px; text-transform: uppercase; font-size: 13px; text-shadow: 0 0 10px rgba(240,185,11,0.3); }
        .container { display: flex; height: 100vh; width: 100vw; padding-top: 60px; }
        .visual-frame { flex: 1; position: relative; background: #000; overflow: hidden; }
        .sidebar { width: 420px; background: var(--panel); border-left: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; z-index: 10; box-shadow: -20px 0 60px rgba(0,0,0,1); }
        .card { background: rgba(20, 20, 25, 0.8); border: 1px solid var(--border); padding: 20px; border-radius: 12px; margin-bottom: 20px; }
        input { width: 100%; padding: 14px; background: #000; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; margin-bottom: 12px; font-family: 'JetBrains Mono'; outline: none; transition: 0.3s; }
        input:focus { border-color: var(--gold); box-shadow: 0 0 10px rgba(240,185,11,0.2); }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Exo 2'; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; transition: 0.3s; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); }
        .tab-btn { flex: 1; padding: 12px; background: #111; color: #555; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700; }
        .tab-btn.active { background: var(--gold); color: #000; }
        .log-item { font-family: 'JetBrains Mono'; font-size: 11px; padding: 10px 0; border-bottom: 1px solid #111; display: flex; justify-content: space-between; }
        canvas { display: block; width: 100%; height: 100%; }
        #bal-view { display: none; text-align: center; animation: fadeIn 0.8s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    </style>
</head>
<body>
    ${isDbReady ? content : '<div style="height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#f0b90b;font-weight:700;letter-spacing:5px;">MBA CORE SYNCING...</div>'}
    <script>
        // 【量子凝聚引擎 V14.0】
        const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
        let w, h, pts=[], startTime=Date.now();
        const DURATION = 2500; // 凝聚动画持续时间 (毫秒)

        function init(){
            w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight;
            pts=[];
            for(let i=0; i<450; i++){
                let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1);
                pts.push({
                    // 目标球体坐标 (Normalized)
                    tx: Math.sin(a)*Math.cos(t), ty: Math.sin(a)*Math.sin(t), tz: Math.cos(a),
                    // 初始云状随机坐标 (散布在整个屏幕)
                    sx: (Math.random()-0.5)*4, sy: (Math.random()-0.5)*4, sz: (Math.random()-0.5)*4,
                    isCap: Math.random() > 0.92
                });
            }
        }

        let rot=0;
        function draw(){
            x.fillStyle='#000'; x.fillRect(0,0,w,h);
            let elapsed = Date.now() - startTime;
            let progress = Math.min(elapsed / DURATION, 1);
            // 缓动函数 (Ease Out Expo)
            let ease = 1 - Math.pow(2, -10 * progress);
            
            rot += 0.0025;
            x.save(); x.translate(w/2, h/2);
            let scale = Math.min(w,h)*0.38;

            let active = pts.map(p => {
                // 插值计算：从初始随机点云移动到球体点位
                let curX = p.sx + (p.tx - p.sx) * ease;
                let curY = p.sy + (p.ty - p.sy) * ease;
                let curZ = p.sz + (p.tz - p.sz) * ease;

                // 旋转变换
                let x1 = curX*Math.cos(rot) - curZ*Math.sin(rot);
                let z1 = curZ*Math.cos(rot) + curX*Math.sin(rot);
                return { x: x1 * scale, y: curY * scale, z: z1, cap: p.isCap };
            });

            // 只有当凝聚度超过 80% 时才开始连线
            if(progress > 0.8) {
                x.lineWidth = 0.6 * (progress - 0.8) * 5;
                for(let i=0; i<active.length; i++){
                    if(active[i].z < -0.2) continue;
                    for(let j=i+1; j<active.length; j++){
                        let dist = Math.hypot(active[i].x-active[j].x, active[i].y-active[j].y);
                        if(dist < 65){
                            let alpha = (1 - dist/65) * (active[i].z+0.5) * 0.25;
                            x.strokeStyle = \`rgba(240,185,11,\${alpha})\`;
                            x.beginPath(); x.moveTo(active[i].x, active[i].y); x.lineTo(active[j].x, active[j].y); x.stroke();
                        }
                    }
                }
            }

            // 绘制粒子
            active.forEach(p => {
                let s = (p.z+1.2)/2.4;
                let size = p.cap ? 3.8 * s : 1.4 * s;
                // 凝聚过程中增加闪烁感
                let op = progress < 1 ? (0.4 + Math.random()*0.6) : 1;
                x.fillStyle = p.cap ? \`rgba(255,255,255,\${s * op})\` : \`rgba(240,185,11,\${0.7 * s * op})\`;
                if(p.cap && progress > 0.9) { x.shadowBlur=15*s; x.shadowColor="#fff"; }
                x.beginPath(); x.arc(p.x, p.y, size, 0, Math.PI*2); x.fill();
                x.shadowBlur=0;
            });

            x.restore(); requestAnimationFrame(draw);
        }
        window.onresize=init; init(); draw();

        function sw(m){ document.getElementById('b-tx').style.display=m==='tx'?'block':'none'; document.getElementById('b-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
        function checkBal(){ 
            const u=document.getElementById('f').value; 
            if(!u) return alert("INPUT SENDER ID");
            fetch(\`/api/bal_raw?u=\${encodeURIComponent(u)}\`).then(r=>r.json()).then(d=>{
                document.getElementById('v-u').innerText=u;
                document.getElementById('v-n').innerText=Number(d.b).toLocaleString();
                document.getElementById('bal-view').style.display='block';
            });
        }
        function sendTx(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href=\`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`; }
        function regAcc(){ const u=document.getElementById('rn').value, p=document.getElementById('rp').value; if(u&&p) location.href=\`/api/reg?u=\${encodeURIComponent(u)}&p=\${p}\`; }
    </script>
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout(''));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 12');
        const total = stats.rows[0].b || 1000000;
        let logHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b style="color:#f0b90b">+${Number(l.amount).toLocaleString()}</b></div>`).join('');
        res.send(getLayout(`
            <div class="header"><div class="supply-tag">GLOBAL LIQUIDITY: ${Number(total).toLocaleString()} COIN</div></div>
            <div class="container">
                <div class="visual-frame"><canvas id="globe-canvas"></canvas></div>
                <div class="sidebar">
                    <div class="tabs"><button class="tab-btn active" id="t1" onclick="sw('tx')">SHIPMENT</button><button class="tab-btn" id="t2" onclick="sw('rg')">NEW VAULT</button></div>
                    <div id="b-tx" class="card">
                        <input type="text" id="f" placeholder="ID (Admin)">
                        <input type="password" id="p" placeholder="6-DIGIT PIN (888888)">
                        <input type="text" id="t" placeholder="RECIPIENT">
                        <input type="number" id="a" placeholder="COIN AMOUNT">
                        <button class="btn btn-gold" onclick="sendTx()">EXECUTE TRANSACTION</button>
                        <button class="btn" style="color:#f0b90b;background:none;border:1px solid #222;margin-top:12px;font-size:11px;" onclick="checkBal()">VIEW VAULT STATUS</button>
                    </div>
                    <div id="b-rg" class="card" style="display:none;"><input type="text" id="rn" placeholder="NEW ID"><input type="password" id="rp" placeholder="PIN"><button class="btn btn-gold" onclick="regAcc()">INITIALIZE</button></div>
                    <div id="bal-view" class="card" style="border-color:#f0b90b; background: rgba(240,185,11,0.05);"><div style="font-size:10px;color:#666;">VAULT: <span id="v-u" style="color:#fff"></span></div><div id="v-n" style="font-size:2.8rem;font-weight:700;color:#fff;">0</div><div style="font-size:10px;color:#f0b90b;letter-spacing:3px;font-weight:700;">COIN ASSETS</div></div>
                    <div style="font-size:10px;color:#333;margin-bottom:10px;letter-spacing:1px;font-weight:700;">SYSTEM_LEDGER_LIVE</div>
                    <div class="log-list" style="overflow-y:auto;flex:1;">${logHtml}</div>
                </div>
            </div>
        `));
    } catch(e) { res.send("Syncing..."); }
});

// API 保持稳定
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Registered');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID Exists');location.href='/';</script>"); }
});
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = BigInt(Math.abs(parseInt(a)));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('Auth Fail');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('Low Balance');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});
app.get('/api/bal_raw', async (req, res) => {
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
    res.json({b: r.rows.length ? r.rows[0].balance.toString() : "0"});
});

app.listen(port, () => {
    console.log(`MBA_CORE_ONLINE_PORT_${port}`);
    connectToDb();
});
