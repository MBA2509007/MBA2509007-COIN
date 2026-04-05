require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

let client = null;
let isDbReady = false;

async function connectToDb() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT DO NOTHING");
        isDbReady = true;
    } catch (err) {
        setTimeout(connectToDb, 5000);
    }
}

const getLayout = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>MBA2509007</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #000; --card: #0c0c0c; }
        body { background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; margin: 0; overflow: hidden; height: 100vh; }
        
        /* 顶部状态栏：大字清晰 */
        .header { height: 70px; border-bottom: 1px solid #222; display: flex; flex-direction: column; justify-content: center; align-items: center; background: rgba(0,0,0,0.8); }
        #res { color: var(--gold); font-size: 14px; letter-spacing: 1px; }
        .rate { color: #00ff88; font-size: 10px; margin-top: 4px; }

        .main { height: calc(100vh - 70px); display: flex; flex-direction: column; }
        .visual { flex: 1.2; position: relative; } /* 3D球体区域 */
        
        /* 操作区：手机端大卡片 */
        .controls { flex: 2; background: var(--card); border-top: 2px solid var(--gold); padding: 30px 20px; border-radius: 25px 25px 0 0; box-shadow: 0 -20px 40px rgba(0,0,0,0.5); overflow-y: auto; }
        
        input { 
            width: 100%; padding: 20px; margin-bottom: 15px; 
            background: #000; border: 1px solid #333; color: var(--gold); 
            border-radius: 12px; box-sizing: border-box; font-family: 'Orbitron';
            font-size: 18px; /* 字体加大 */
            text-align: center;
        }
        input:focus { border-color: var(--gold); outline: none; }

        .btn { 
            width: 100%; padding: 22px; border-radius: 12px; border: none; 
            font-family: 'Orbitron'; font-weight: bold; font-size: 16px; 
            text-transform: uppercase; margin-bottom: 12px; cursor: pointer;
        }
        .btn-gold { background: var(--gold); color: #000; box-shadow: 0 5px 15px rgba(240,185,11,0.3); }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab { flex: 1; padding: 12px; background: #222; color: #666; border-radius: 8px; text-align: center; font-size: 12px; }
        .tab.active { background: var(--gold); color: #000; }

        @media (min-width: 850px) {
            .main { flex-direction: row; }
            .visual { flex: 2; }
            .controls { flex: 1; border-top: none; border-left: 2px solid var(--gold); border-radius: 0; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div id="res">RESERVE: LOADING...</div>
        <div class="rate">EST. 1 COIN = 100.00 USD</div>
    </div>
    ${content}
</body>
</html>`;

app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout('<div style="padding:50px;text-align:center;color:var(--gold);">CONNECTING_NODE...</div>'));
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const total = stats.rows[0].b || 0;

        res.send(getLayout(`
            <div class="main">
                <div class="visual"><canvas id="g"></canvas></div>
                <div class="controls">
                    <div class="tabs">
                        <div class="tab active" id="t1" onclick="sw('tx')">TERMINAL</div>
                        <div class="tab" id="t2" onclick="sw('rg')">REGISTRY</div>
                    </div>
                    
                    <div id="box-tx">
                        <input type="text" id="f" placeholder="YOUR ID">
                        <input type="password" id="p" placeholder="PIN CODE">
                        <input type="text" id="t" placeholder="RECIPIENT">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">AUTHORIZE</button>
                        <button class="btn btn-outline" onclick="check()">CHECK BALANCE</button>
                    </div>

                    <div id="box-rg" style="display:none;">
                        <input type="text" id="rn" placeholder="CREATE ID">
                        <input type="password" id="rp" placeholder="6-DIGIT PIN">
                        <button class="btn btn-gold" onclick="reg()">MINT VAULT</button>
                    </div>
                </div>
            </div>
            <script>
                document.getElementById('res').innerText = "RESERVE: ${total.toLocaleString()} COIN";
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,pts=[];
                function res(){ w=c.width=c.offsetWidth; h=c.height=c.offsetHeight; pts=[]; for(let i=0;i<250;i++){ let t=Math.random()*6.28, a=Math.acos(Math.random()*2-1); pts.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.003; x.save(); x.translate(w/2,h/2); pts.forEach(p=>{ let x1=p.x*Math.cos(r)-p.z*Math.sin(r), z1=p.z*Math.cos(r)+p.x*Math.sin(r); let s=(z1+1.2)/2.4; x.fillStyle="rgba(240,185,11,"+s+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.4,p.y*Math.min(w,h)*0.4,s*2,0,7); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=res; res(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab':'tab'; document.getElementById('t1').classList.toggle('active',m==='tx'); document.getElementById('t2').className=m==='rg'?'tab':'tab'; document.getElementById('t2').classList.toggle('active',m==='rg');}
                function reg(){ location.href='/api/reg?u='+encodeURIComponent(document.getElementById('rn').value)+'&p='+document.getElementById('rp').value; }
                function send(){ location.href='/api/pay?f='+encodeURIComponent(document.getElementById('f').value)+'&p='+document.getElementById('p').value+'&t='+encodeURIComponent(document.getElementById('t').value)+'&a='+document.getElementById('a').value; }
                function check(){ const id = document.getElementById('f').value; if(id) location.href='/api/bal?u='+encodeURIComponent(id); }
            </script>
        `));
    } catch (e) { res.send("ERR"); }
});

// 余额查询页面：大字强化
app.get('/api/bal', async (req, res) => {
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
    if (r.rows.length === 0) return res.send("<script>alert('NOT FOUND');location.href='/';</script>");
    const b = r.rows[0].balance;
    res.send(getLayout(`
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:80vh; padding:20px;">
            <div style="font-size:12px; color:var(--gold); margin-bottom:10px;">VAULT HOLDER: ${req.query.u}</div>
            <div style="font-size:60px; color:#fff; text-shadow:0 0 30px var(--gold);">${b.toLocaleString()}</div>
            <div style="font-size:20px; color:#00ff88; margin:15px 0;">$ ${(b*100).toLocaleString()} USD</div>
            <button class="btn btn-gold" style="width:200px;" onclick="location.href='/'">RETURN</button>
        </div>
    `));
});

// 基础 API
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('SUCCESS');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('ID TAKEN');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.floor(Math.abs(parseInt(a)));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('PIN ERROR');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('NO FUNDS');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "000000") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.listen(port, () => { connectToDb(); });
