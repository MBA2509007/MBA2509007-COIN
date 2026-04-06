require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let client;

// 1. 增强型数据库连接 (带自动重试)
async function connectDB() {
    const dbConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    };

    client = new Client(dbConfig);

    try {
        await client.connect();
        console.log("DB_CONNECTED");

        // 初始化表
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                name TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                pin_hash TEXT
            )
        `);

        // 强制初始化 Admin (1,000,000 余额)
        const hash = await bcrypt.hash("888888", 10);
        await client.query(`
            INSERT INTO users (name, balance, pin_hash) 
            VALUES ('Admin', 1000000, $1) 
            ON CONFLICT (name) DO UPDATE SET balance = 1000000
        `, [hash]);

    } catch (err) {
        console.error("DB_CONNECTION_FAILED:", err.message);
        setTimeout(connectDB, 5000); // 失败后 5 秒重连
    }
}

// 2. 彻底解决重叠的布局
function layout(content, totalReserve = "1,000,000") {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quantum Terminal</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&display=swap" rel="stylesheet">
        <style>
            :root { --gold: #f0b90b; --neon-green: #00ff88; --bg: #050505; }
            body { margin: 0; background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; height: 100vh; overflow: hidden; }
            
            /* 顶部状态栏 - 提高 Z-INDEX 且固定高度 */
            .header { 
                position: fixed; top: 0; left: 0; width: 100%; height: 100px;
                display: flex; justify-content: space-between; align-items: center;
                padding: 0 40px; box-sizing: border-box; z-index: 9999;
                background: linear-gradient(to bottom, #000 60%, transparent);
            }

            .reserve-info { color: var(--gold); font-size: 1.2rem; font-weight: 900; }
            .rate-card { 
                border: 1px solid var(--neon-green); padding: 10px 20px; border-radius: 8px;
                color: var(--neon-green); box-shadow: 0 0 15px rgba(0,255,136,0.2); font-weight: 900;
            }

            .main-frame { display: flex; height: 100vh; padding-top: 100px; box-sizing: border-box; }
            
            /* 左侧动画区 */
            .visual-zone { flex: 1.2; position: relative; display: flex; align-items: center; justify-content: center; }
            #canvas { width: 100%; height: 100%; }

            /* 右侧操作区 - 增加垂直边距防止重叠 */
            .action-zone { 
                flex: 0.8; background: rgba(255,255,255,0.02); backdrop-filter: blur(20px);
                border-left: 1px solid rgba(255,255,255,0.1);
                display: flex; flex-direction: column; align-items: center;
                padding: 60px 20px; box-sizing: border-box; overflow-y: auto;
            }

            .terminal-card { width: 100%; max-width: 380px; }
            h2 { color: var(--gold); text-transform: uppercase; letter-spacing: 4px; margin-bottom: 30px; font-size: 1.4rem; }
            
            input { width: 100%; padding: 15px; margin: 10px 0; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 5px; font-family: 'Orbitron'; box-sizing: border-box; }
            button { width: 100%; padding: 18px; margin-top: 15px; background: var(--gold); color: #000; border: none; font-family: 'Orbitron'; font-weight: 900; cursor: pointer; border-radius: 5px; transition: 0.3s; }
            button:hover { opacity: 0.8; box-shadow: 0 0 20px var(--gold); }

            @media (max-width: 768px) {
                .main-frame { flex-direction: column; overflow-y: auto; }
                .header { padding: 0 15px; height: 80px; }
                .reserve-info { font-size: 0.8rem; }
                .rate-card { font-size: 0.8rem; }
                .action-zone { border-left: none; padding-top: 40px; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="reserve-info">RESERVE: ${totalReserve} COIN</div>
            <div class="rate-card">1 COIN = 100 USD</div>
        </div>

        <div class="main-frame">
            <div class="visual-zone">
                <canvas id="canvas"></canvas>
            </div>
            <div class="action-zone">
                <div class="terminal-card">${content}</div>
            </div>
        </div>

        <script>
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            let w, h, pts = [];

            function init() {
                w = canvas.width = canvas.offsetWidth;
                h = canvas.height = canvas.offsetHeight;
                pts = [];
                for(let i=0; i<200; i++) pts.push({
                    x: Math.random() * 2 - 1,
                    y: Math.random() * 2 - 1,
                    z: Math.random() * 2 - 1
                });
            }

            let rot = 0;
            function draw() {
                ctx.clearRect(0,0,w,h);
                rot += 0.01;
                const r = Math.min(w, h) * 0.4;
                pts.forEach(p => {
                    let x = p.x * Math.cos(rot) - p.z * Math.sin(rot);
                    let z = p.z * Math.cos(rot) + p.x * Math.sin(rot);
                    let s = (z + 1) / 2;
                    ctx.fillStyle = \`rgba(240,185,11,\${s})\`;
                    ctx.beginPath();
                    ctx.arc(x * r + w/2, p.y * r + h/2, s * 3, 0, 7);
                    ctx.fill();
                });
                requestAnimationFrame(draw);
            }
            window.onresize = init; init(); draw();
        </script>
    </body>
    </html>`;
}

// 3. 路由逻辑
app.get('/', async (req, res) => {
    try {
        const stats = await client.query("SELECT SUM(balance) as total FROM users");
        const reserve = Number(stats.rows[0].total || 1000000).toLocaleString();
        res.send(layout(`
            <h2>Access Terminal</h2>
            <input id="n" placeholder="ID">
            <input id="p" type="password" placeholder="PIN">
            <button onclick="login()">INITIALIZE LOGIN</button>
            <div style="margin:40px 0 20px; border-top:1px solid #333; padding-top:20px; color:#666; font-size:0.7rem;">REGISTER SYSTEM</div>
            <input id="rn" placeholder="NEW ID">
            <input id="rp" type="password" placeholder="6-DIGIT PIN">
            <button style="background:none; border:1px solid var(--gold); color:var(--gold);" onclick="reg()">CREATE ACCOUNT</button>
            <script>
                async function login(){
                    const r = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('n').value,pin:document.getElementById('p').value})});
                    const d = await r.json(); if(d.ok) location.href='/wallet?u='+d.u; else alert(d.err);
                }
                async function reg(){
                    const r = await fetch('/api/reg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('rn').value,pin:document.getElementById('rp').value})});
                    const d = await r.json(); alert(d.msg || d.err);
                }
            </script>
        `, reserve));
    } catch (e) { res.send("DB Connection Initializing... Please refresh in 5s"); }
});

app.get('/wallet', async (req, res) => {
    const u = req.query.u;
    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[u]);
        const stats = await client.query("SELECT SUM(balance) as total FROM users");
        const reserve = Number(stats.rows[0].total).toLocaleString();
        res.send(layout(`
            <div style="font-size:0.8rem; color:#666;">WELCOME BACK</div>
            <h2 style="margin:5px 0 30px 0;">\${u}</h2>
            <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:10px; margin-bottom:30px;">
                <div style="font-size:0.7rem; color:var(--gold);">ASSET BALANCE</div>
                <div style="font-size:2rem; font-weight:900;">\${Number(r.rows[0].balance).toLocaleString()} <span style="font-size:1rem;">COIN</span></div>
            </div>
            <input id="to" placeholder="RECIPIENT ID">
            <input id="amt" type="number" placeholder="AMOUNT">
            <input id="pin" type="password" placeholder="CONFIRM PIN">
            <button onclick="send()">EXECUTE TRANSFER</button>
            <button onclick="location.href='/'" style="background:none; color:#666; font-size:0.7rem;">TERMINATE SESSION</button>
            <script>
                async function send(){
                    const r = await fetch('/api/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'\${u}',to:document.getElementById('to').value,amt:document.getElementById('amt').value,pin:document.getElementById('pin').value})});
                    const d = await r.json(); alert(d.msg || d.err); location.reload();
                }
            </script>
        `, reserve));
    } catch (e) { res.redirect('/'); }
});

// 4. API 接口
app.post('/api/reg', async(req,res)=>{
    try {
        const h = await bcrypt.hash(req.body.pin,10);
        await client.query("INSERT INTO users VALUES ($1,0,$2)",[req.body.name,h]);
        res.json({msg:"Identity Securely Created"});
    } catch(e) { res.json({err:"ID already exists"}); }
});

app.post('/api/login', async(req,res)=>{
    const r = await client.query("SELECT * FROM users WHERE name=$1",[req.body.name]);
    if(r.rows[0] && await bcrypt.compare(req.body.pin, r.rows[0].pin_hash)) res.json({ok:true, u:req.body.name});
    else res.json({err:"Access Denied"});
});

app.post('/api/send', async(req,res)=>{
    const {from,to,amt,pin} = req.body;
    try {
        await client.query('BEGIN');
        const s = await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE",[from]);
        if(!await bcrypt.compare(pin, s.rows[0].pin_hash)) throw new Error("Invalid PIN");
        if(Number(s.rows[0].balance) < Number(amt)) throw new Error("Insufficient Balance");
        await client.query("UPDATE users SET balance=balance-$1 WHERE name=$2",[amt,from]);
        await client.query("UPDATE users SET balance=balance+$1 WHERE name=$2",[amt,to]);
        await client.query('COMMIT');
        res.json({msg:"Transfer Complete"});
    } catch(e) { await client.query('ROLLBACK'); res.json({err:e.message}); }
});

app.listen(port, () => {
    connectDB();
    console.log("Server running on " + port);
});
