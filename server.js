require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let client;

// 1. 数据库初始化 (精准修复 Admin 余额显示问题)
async function initDB() {
    try {
        client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000, 
        });

        await client.connect();
        console.log("DB_CONNECTED_SUCCESSFULLY");

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                name TEXT PRIMARY KEY,
                balance NUMERIC DEFAULT 0,
                pin_hash TEXT
            )
        `);

        // 使用 UPSERT 逻辑：强制确保 Admin 存在且余额、密码正确
        const hash = await bcrypt.hash("888888", 10);
        await client.query(`
            INSERT INTO users (name, balance, pin_hash) 
            VALUES ('Admin', 1000000, $1) 
            ON CONFLICT (name) DO UPDATE 
            SET balance = 1000000, pin_hash = $1`, [hash]);
            
        console.log("ADMIN_SYNC_COMPLETED: ID: Admin / PIN: 888888 / Balance: 1,000,000");
    } catch (err) {
        console.error("DB_INIT_ERROR:", err.message);
        process.exit(1); 
    }
}

// 2. 核心视觉布局 (修复重叠问题)
function layout(content, totalReserve = "1,000,000") {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Quantum Financial Terminal</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&display=swap" rel="stylesheet">
        <style>
            :root { --gold: #f0b90b; --bg: #050505; --neon-green: #00ff88; }
            body { margin: 0; background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; overflow: hidden; }
            
            /* 顶部状态栏 */
            .top-bar { 
                position: fixed; top: 0; width: 100%; padding: 20px 40px; 
                display: flex; justify-content: space-between; align-items: center;
                background: linear-gradient(to bottom, rgba(0,0,0,0.95), transparent);
                z-index: 1000; box-sizing: border-box;
            }
            .reserve-box { color: var(--gold); font-size: 20px; font-weight: 900; letter-spacing: 2px; flex: 1; }
            .time-box { flex: 1; text-align: center; color: rgba(255,255,255,0.6); font-size: 14px; letter-spacing: 1px; }
            #live-clock { display: block; color: #fff; font-size: 18px; font-weight: 900; }

            .rate-container { flex: 1; display: flex; justify-content: flex-end; }
            .rate-card { 
                background: rgba(0, 255, 136, 0.1); 
                border: 1px solid var(--neon-green);
                padding: 10px 25px;
                border-radius: 12px;
                color: var(--neon-green);
                font-size: 24px;
                font-weight: 900;
                text-shadow: 0 0 10px rgba(0,255,136,0.5);
                box-shadow: inset 0 0 15px rgba(0,255,136,0.1), 0 0 20px rgba(0,255,136,0.2);
                animation: pulse 2s infinite;
            }

            @keyframes pulse {
                0% { opacity: 0.8; transform: scale(1); }
                50% { opacity: 1; transform: scale(1.02); }
                100% { opacity: 0.8; transform: scale(1); }
            }

            .container { display: flex; height: 100vh; width: 100vw; }
            .left-zone { flex: 1.2; position: relative; display: flex; align-items: center; justify-content: center; }
            #canvas { width: 100%; height: 100%; }

            .right-zone { flex: 0.8; display: flex; align-items: center; justify-content: center; background: rgba(10,10,10,0.5); backdrop-filter: blur(10px); border-left: 1px solid rgba(255,255,255,0.05); }
            
            /* 关键修复：通过 margin-top 解决文字重叠 */
            .panel { width: 85%; max-width: 400px; margin-top: 80px; }
            
            .card { background: rgba(255,255,255,0.03); padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
            h2 { color: var(--gold); margin-top: 0; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 3px; }
            
            input { width: 100%; padding: 16px; margin: 10px 0; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 8px; font-family: 'Orbitron'; font-size: 14px; box-sizing: border-box; }
            button { width: 100%; padding: 18px; margin-top: 15px; background: var(--gold); color: #000; border: none; border-radius: 8px; font-family: 'Orbitron'; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.3s; }
            button:hover { background: #fff; transform: translateY(-2px); }
            
            .leaderboard { position: absolute; bottom: 40px; left: 40px; font-size: 12px; color: rgba(255,255,255,0.4); line-height: 2; }

            @media (max-width: 768px) {
                .container { flex-direction: column; overflow-y: auto; }
                .left-zone { height: 50vh; width: 100%; }
                .right-zone { width: 100%; padding: 40px 0; }
                .panel { margin-top: 20px; }
            }
        </style>
    </head>
    <body>
        <div class="top-bar">
            <div class="reserve-box">RESERVE: ${totalReserve} COIN</div>
            <div class="time-box">
                <span id="live-date">---</span>
                <span id="live-clock">00:00:00</span>
            </div>
            <div class="rate-container">
                <div class="rate-card">1 COIN = 100 USD</div>
            </div>
        </div>

        <div class="container">
            <div class="left-zone">
                <canvas id="canvas"></canvas>
                <div class="leaderboard">
                    SYSTEM_STATUS: ACTIVE<br>
                    ENCRYPTION: QUANTUM_AES_256<br>
                    LOCATION: PENANG_TERMINAL
                </div>
            </div>
            <div class="right-zone">
                <div class="panel">${content}</div>
            </div>
        </div>

        <script>
            function updateClock() {
                const now = new Date();
                const options = { year: 'numeric', month: 'short', day: '2-digit' };
                document.getElementById('live-date').innerText = now.toLocaleDateString('en-US', options).toUpperCase();
                document.getElementById('live-clock').innerText = now.toLocaleTimeString('en-US', { hour12: false });
            }
            setInterval(updateClock, 1000); updateClock();

            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            let w, h, particles = [];

            function init() {
                w = canvas.width = window.innerWidth > 768 ? window.innerWidth * 0.6 : window.innerWidth;
                h = canvas.height = window.innerHeight;
                particles = [];
                for(let i=0; i<400; i++) {
                    let theta = Math.random() * Math.PI * 2;
                    let phi = Math.acos((Math.random() * 2) - 1);
                    particles.push({x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: Math.cos(phi)});
                }
            }

            let angleY = 0;
            function draw() {
                ctx.clearRect(0,0,w,h);
                angleY += 0.002;
                const radius = Math.min(w, h) * 0.35;
                
                particles.forEach(p => {
                    let cosY = Math.cos(angleY), sinY = Math.sin(angleY);
                    let x1 = p.x * cosY - p.z * sinY;
                    let z1 = p.z * cosY + p.x * sinY;
                    let opacity = (z1 + 1) / 2;
                    ctx.fillStyle = "rgba(240, 185, 11, " + opacity + ")";
                    ctx.beginPath();
                    ctx.arc(x1 * radius + w/2, p.y * radius + h/2, opacity * 2, 0, 7);
                    ctx.fill();
                });
                requestAnimationFrame(draw);
            }
            window.addEventListener('resize', init); init(); draw();
        </script>
    </body>
    </html>`;
}

// 3. 页面路由 (逻辑保持不变，确保稳定性)
app.get('/', async (req, res) => {
    try {
        const stats = await client.query("SELECT SUM(balance) as total FROM users");
        const reserve = Number(stats.rows[0].total || 1000000).toLocaleString();
        res.send(layout(`
            <div class="card">
                <h2>Access Terminal</h2>
                <input id="name" placeholder="IDENTIFICATION ID">
                <input id="pin" type="password" placeholder="SECURITY PIN">
                <button onclick="login()">INITIALIZE LOGIN</button>
                <div style="margin:20px 0; height:1px; background:rgba(255,255,255,0.1);"></div>
                <input id="rname" placeholder="NEW UNIQUE ID">
                <input id="rpin" type="password" placeholder="SET 6-DIGIT PIN">
                <button style="background:transparent; border:1px solid var(--gold); color:var(--gold);" onclick="register()">CREATE ACCOUNT</button>
            </div>
            <script>
                async function login(){
                    const name = document.getElementById('name').value;
                    const pin = document.getElementById('pin').value;
                    const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pin})});
                    const data = await res.json();
                    if(data.ok) location.href='/wallet?u='+data.user; else alert(data.error);
                }
                async function register(){
                    const name = document.getElementById('rname').value;
                    const pin = document.getElementById('rpin').value;
                    const res = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pin})});
                    const data = await res.json(); alert(data.msg || data.error);
                }
            </script>
        `, reserve));
    } catch (e) { res.send("System Error"); }
});

app.get('/wallet', async (req, res) => {
    const u = req.query.u;
    if(!u) return res.redirect('/');
    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[u]);
        if(!r.rows[0]) return res.redirect('/');
        const stats = await client.query("SELECT SUM(balance) as total FROM users");
        const reserve = Number(stats.rows[0].total || 1000000).toLocaleString();
        
        res.send(layout(`
            <div class="card">
                <div style="font-size:10px; color:rgba(255,255,255,0.4);">AUTHENTICATED USER</div>
                <h2 style="margin-bottom:5px;">${u}</h2>
                <div style="font-size:32px; color:#fff; font-weight:900; margin:20px 0;">
                    <span style="font-size:14px; color:var(--gold);">BALANCE:</span><br>
                    ${Number(r.rows[0].balance).toLocaleString()} <span style="font-size:14px;">COIN</span>
                </div>
                <div style="margin:25px 0; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
                    <input id="to" placeholder="RECIPIENT ID">
                    <input id="amt" type="number" placeholder="AMOUNT">
                    <input id="auth_pin" type="password" placeholder="CONFIRM PIN">
                    <button onclick="send()">AUTHORIZE TRANSFER</button>
                    <button onclick="location.href='/'" style="background:#222; color:#fff; margin-top:10px; font-size:12px;">LOGOUT</button>
                </div>
            </div>
            <script>
                async function send(){
                    const to = document.getElementById('to').value;
                    const amt = document.getElementById('amt').value;
                    const pin = document.getElementById('auth_pin').value;
                    const res = await fetch('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'${u}',to,amount:amt,pin})});
                    const data = await res.json(); alert(data.msg || data.error); location.reload();
                }
            </script>
        `, reserve));
    } catch (e) { res.redirect('/'); }
});

// 4. API 接口
app.post('/api/register', async (req,res)=>{
    const {name,pin} = req.body;
    try {
        const hash = await bcrypt.hash(pin,10);
        await client.query("INSERT INTO users VALUES ($1,0,$2)",[name,hash]);
        res.json({msg:"Account Created"});
    } catch(e) { res.json({error:"ID Taken"}); }
});

app.post('/api/login', async (req,res)=>{
    const {name,pin} = req.body;
    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[name]);
        if(r.rows.length===0) return res.json({error:"User not found"});
        const ok = await bcrypt.compare(pin,r.rows[0].pin_hash);
        if(!ok) return res.json({error:"Invalid PIN"});
        res.json({ok:true, user:name});
    } catch(e) { res.json({error:"System Error"}); }
});

app.post('/api/transfer', async (req,res)=>{
    const {from, to, amount, pin} = req.body;
    try {
        await client.query('BEGIN');
        const s = await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE",[from]);
        if(s.rows.length && await bcrypt.compare(pin, s.rows[0].pin_hash) && Number(s.rows[0].balance) >= Number(amount)) {
            await client.query("UPDATE users SET balance=balance-$1 WHERE name=$2",[amount, from]);
            await client.query("UPDATE users SET balance=balance+$1 WHERE name=$2",[amount, to]);
            await client.query('COMMIT');
            res.json({msg:"Transfer Successful"});
        } else throw new Error("Unauthorized or Insufficient Funds");
    } catch (err) {
        await client.query('ROLLBACK');
        res.json({error: err.message});
    }
});

// 5. 启动
app.listen(port, async ()=>{
    await initDB();
    console.log("Terminal Online");
});
