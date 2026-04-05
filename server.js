const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;
let dbError = "Initiating MBA Global Apex Terminal...";

async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });
    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        
        // 自动确保 Admin 账户
        await client.query(`
            INSERT INTO users (name, balance, pin) 
            VALUES ('Admin', 1000000, '888888') 
            ON CONFLICT (name) DO UPDATE SET pin = '888888' WHERE users.pin IS NULL
        `);
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
    <title>MBA2509007 | GLOBAL APEX</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: rgba(10, 12, 16, 0.85); --border: #1A1C22; --text: #E0E2E5; --glow: rgba(240, 185, 11, 0.4); }
        body { background: var(--bg); color: var(--text); font-family: 'Exo 2', sans-serif; margin: 0; overflow: hidden; height: 100vh; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.8); backdrop-filter: blur(15px); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply-tag { font-weight: 700; color: var(--gold); letter-spacing: 3px; text-transform: uppercase; font-size: 13px; }
        .container { display: flex; height: 100vh; width: 100vw; padding-top: 60px; flex-direction: row-reverse; }
        .visual-frame { flex: 1; position: relative; background: #000; overflow: hidden; }
        .sidebar { width: 420px; background: var(--panel); border-right: 1px solid var(--border); padding: 30px; display: flex; flex-direction: column; z-index: 10; box-shadow: 20px 0 50px rgba(0,0,0,0.9); backdrop-filter: blur(10px); }
        .card { background: rgba(20, 20, 25, 0.5); border: 1px solid var(--border); padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        input { width: 100%; padding: 14px; background: #000; border: 1px solid #222; color: var(--gold); border-radius: 6px; box-sizing: border-box; margin-bottom: 12px; font-family: 'JetBrains Mono'; outline: none; }
        input:focus { border-color: var(--gold); box-shadow: 0 0 10px var(--glow); }
        .btn { width: 100%; padding: 16px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Exo 2'; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; transition: 0.3s; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-gold:hover { background: #fff; transform: translateY(-2px); }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 10px; background: #111; color: #555; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 700; }
        .tab-btn.active { background: var(--gold); color: #000; }
        .log-item { font-family: 'JetBrains Mono'; font-size: 11px; padding: 8px 0; border-bottom: 1px solid #111; display: flex; justify-content: space-between; }
        canvas { display: block; width: 100%; height: 100%; }
        #bal-view { display: none; text-align: center; margin-top: 10px; }
    </style>
</head>
<body>
    ${isDbReady ? content : '<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#f0b90b;letter-spacing:5px;">CONNECTING TO GLOBAL NODE...</div>'}
    <script>
        // 寰宇光网引擎 (V13.5)
        const c=document.getElementById('globe-canvas'), x=c.getContext('2d');
        let w, h, pts=[];
        function init(){
            w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight;
            pts=[];
            for(let i=0; i<350; i++){
                let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1);
                pts.push({
                    x: Math.sin(a)*Math.cos(t), y: Math.sin(a)*Math.sin(t), z: Math.cos(a),
                    isCapital: Math.random() > 0.9 // 10% 概率为首都
                });
            }
        }
        let rot=0;
        function draw(){
            x.fillStyle='#000'; x.fillRect(0,0,w,h);
            rot+=0.002; x.save(); x.translate(w/2, h/2);
            let activePts = pts.map(p => {
                let x1=p.x*Math.cos(rot)-p.z*Math.sin(rot), z1=p.z*Math.cos(rot)+p.x*Math.sin(rot);
                return { x: x1*Math.min(w,h)*0.38, y: p.y*Math.min(w,h)*0.38, z: z1, cap: p.isCapital };
            });
            // 连线逻辑 (Neural Links)
            x.lineWidth=0.5;
            for(let i=0; i<activePts.length; i++){
                for(let j=i+1; j<activePts.length; j++){
                    let dx=activePts[i].x-activePts[j].x, dy=activePts[i].y-activePts[j].y, dz=activePts[i].z-activePts[j].z;
                    let dist=Math.sqrt(dx*dx+dy*dy+dz*dz);
                    if(dist < 70 && activePts[i].z > -0.5 && activePts[j].z > -0.5){
                        let alpha = (1 - dist/70) * (activePts[i].z+1.2)/2.4 * 0.3;
                        x.strokeStyle=\`rgba(240,185,11,\${alpha})\`;
                        x.beginPath(); x.moveTo(activePts[i].x, activePts[i].y); x.lineTo(activePts[j].x, activePts[j].y); x.stroke();
                    }
                }
            }
            // 绘制点 (Hierarchy Lights)
            activePts.forEach(p => {
                let s=(p.z+1.2)/2.4;
                if(s<0.1) return;
                let size = p.cap ? 3.5 * s : 1.5 * s; // 首都更大
                let op = p.cap ? 1 : 0.6; // 首都更亮
                x.fillStyle=\`rgba(240,185,11,\${op * s})\`;
                if(p.cap) {
                    x.shadowBlur=15*s; x.shadowColor="rgba(240,185,11,0.8)";
                }
                x.beginPath(); x.arc(p.x, p.y, size, 0, Math.PI*2); x.fill();
                x.shadowBlur=0;
            });
            x.restore(); requestAnimationFrame(draw);
        }
        window.onresize=init; init(); draw();

        function sw(m){ document.getElementById('b-tx').style.display=m==='tx'?'block':'none'; document.getElementById('b-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab-btn active':'tab-btn'; document.getElementById('t2').className=m==='rg'?'tab-btn active':'tab-btn'; }
        function sendTx(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href=\`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`; }
        function regAcc(){ const u=document.getElementById('rn').value, p=document.getElementById('rp').value; if(u&&p) location.href=\`/api/reg?u=\${encodeURIComponent(u)}&p=\${p}\`; }
        function checkBal(){ 
            const u=document.getElementById('f').value; 
            if(!u) return alert("ENTER YOUR ID");
            fetch(\`/api/bal_raw?u=\${encodeURIComponent(u)}\`).then(r=>r.json()).then(d=>{
                document.getElementById('v-u').innerText=u;
                document.getElementById('v-n').innerText=d.b.toLocaleString();
                document.getElementById('bal-view').style.display='block';
            });
        }
    </script>
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout(''));
    const stats = await client.query('SELECT SUM(balance) as b FROM users');
    const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
    const total = stats.rows[0].b || 1000000;
    let logHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} → ${l.receiver}</span><b style="color:#f0b90b">+${l.amount}</b></div>`).join('');

    res.send(getLayout(`
        <div class="header"><div class="supply-tag">GLOBAL LIQUIDITY: ${total.toLocaleString()} WOW</div></div>
        <div class="container">
            <div class="visual-frame"><canvas id="globe-canvas"></canvas></div>
            <div class="sidebar">
                <div class="tabs">
                    <button class="tab-btn active" id="t1" onclick="sw('tx')">TRANSACTION</button>
                    <button class="tab-btn" id="t2" onclick="sw('rg')">NEW VAULT</button>
                </div>
                <div id="b-tx" class="card">
                    <input type="text" id="f" placeholder="YOUR ID">
                    <input type="password" id="p" placeholder="6-DIGIT PIN">
                    <input type="text" id="t" placeholder="RECIPIENT ID">
                    <input type="number" id="a" placeholder="AMOUNT">
                    <button class="btn btn-gold" onclick="sendTx()">EXECUTE SHIPMENT</button>
                    <button class="btn" style="color:#f0b90b;background:none;border:1px solid #f0b90b;margin-top:10px;" onclick="checkBal()">VIEW BALANCE</button>
                </div>
                <div id="b-rg" class="card" style="display:none;">
                    <input type="text" id="rn" placeholder="NEW IDENTITY ID">
                    <input type="password" id="rp" placeholder="6-DIGIT PIN">
                    <button class="btn btn-gold" onclick="regAcc()">CREATE ACCOUNT</button>
                </div>
                <div id="bal-view" class="card" style="border-color:#f0b90b">
                    <div style="font-size:10px;color:#555">VAULT: <span id="v-u" style="color:#fff"></span></div>
                    <div id="v-n" style="font-size:2.5rem;font-weight:700;color:#fff">0</div>
                    <div style="font-size:9px;color:#f0b90b;letter-spacing:2px">WOW CREDITS</div>
                </div>
                <div style="font-size:10px;color:#333;margin-bottom:10px;letter-spacing:1px">NETWORK_LEDGER_LIVE</div>
                <div class="log-list" style="overflow-y:auto;flex:1;">${logHtml}</div>
            </div>
        </div>
    `));
});

// API 部分保持原样
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Account Created');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID Taken');location.href='/';</script>"); }
});
app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    const amt = Math.abs(parseInt(a));
    const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
    if(auth.rows.length === 0) return res.send("<script>alert('Invalid PIN');location.href='/';</script>");
    const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
    if(dec.rowCount === 0) return res.send("<script>alert('No Balance');location.href='/';</script>");
    await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "123456") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
    await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
    res.redirect('/');
});
app.get('/api/bal_raw', async (req, res) => {
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
    res.json({b: r.rows.length ? r.rows[0].balance : 0});
});

app.listen(port, () => {
    console.log(`MBA_CORE_ONLINE_PORT_${port}`);
    connectToDb();
});
