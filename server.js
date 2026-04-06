require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let client;

// 1. 数据库初始化 (保持 Admin 1,000,000)
async function initDB() {
    try {
        client = new Client({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000, 
        });
        await client.connect();
        
        // 1. 确保表存在
        await client.query(`CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance NUMERIC DEFAULT 0, pin_hash TEXT)`);
        
        // 2. 强制同步 Admin 账号（解决你登录不到的问题）
        const hash = await bcrypt.hash("888888", 10);
        await client.query(`
            INSERT INTO users (name, balance, pin_hash) 
            VALUES ('Admin', 1000000, $1) 
            ON CONFLICT (name) DO UPDATE 
            SET pin_hash = $1, balance = 1000000`, [hash]);
            
        console.log("Admin 账号已就绪：ID 为 Admin, PIN 为 888888");
    } catch (err) {
        console.error("数据库初始化失败:", err);
        process.exit(1); 
    }
}

// 2. 增强布局：找回“光纤”连线效果
function layout(content, totalReserve = "1,000,000") {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Quantum Terminal</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&family=Roboto+Mono:wght@700&display=swap" rel="stylesheet">
        <style>
            :root { --gold: #f0b90b; --bg: #050505; --neon-green: #00ff88; }
            body { margin: 0; background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; overflow: hidden; }
            
            .top-bar { 
                position: fixed; top: 0; width: 100%; padding: 20px 40px; 
                display: flex; justify-content: space-between; align-items: center;
                z-index: 2000; box-sizing: border-box;
                background: linear-gradient(to bottom, rgba(5,5,5,0.9), rgba(5,5,5,0));
            }
            .reserve-box { color: var(--gold); font-size: 18px; font-weight: 900; text-shadow: 0 0 10px rgba(240,185,11,0.3); }
            .time-box { text-align: center; color: rgba(255,255,255,0.5); font-size: 12px; }
            #live-clock { display: block; color: #fff; font-size: 16px; font-weight: 900; }
            .rate-card { background: rgba(0, 255, 136, 0.1); border: 1px solid var(--neon-green); padding: 6px 12px; border-radius: 4px; color: var(--neon-green); font-family: 'Roboto Mono', monospace; font-size: 16px; font-weight: 700; }

            .container { display: flex; height: 100vh; width: 100vw; }
            .left-zone { flex: 1.2; position: relative; background: #000; }
            #canvas { width: 100%; height: 100%; display: block; }
            
            .right-zone { flex: 0.8; display: flex; align-items: center; justify-content: center; background: rgba(10,10,10,0.85); backdrop-filter: blur(25px); border-left: 1px solid rgba(255,255,255,0.05); z-index: 1000; }
            .panel { width: 80%; max-width: 380px; }
            
            .card { background: rgba(255,255,255,0.02); padding: 30px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
            h2 { color: var(--gold); font-size: 1.2rem; letter-spacing: 4px; text-align: center; margin-bottom: 25px; text-transform: uppercase; }
            .section-label { color: rgba(255,255,255,0.3); font-size: 9px; margin-top: 20px; margin-bottom: 5px; display: block; letter-spacing: 1px; }
            
            input { width: 100%; padding: 14px; margin: 6px 0; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 6px; font-family: 'Orbitron'; font-size: 12px; box-sizing: border-box; }
            button { width: 100%; padding: 15px; margin-top: 10px; background: var(--gold); color: #000; border: none; border-radius: 6px; font-family: 'Orbitron'; font-weight: 900; cursor: pointer; text-transform: uppercase; }
            
            .leaderboard { position: absolute; bottom: 30px; left: 40px; font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Roboto Mono'; line-height: 1.5; }

            @media (max-width: 768px) { .container { flex-direction: column; } .left-zone { height: 40vh; } .top-bar { padding: 10px 20px; } }
        </style>
    </head>
    <body>
        <div class="top-bar">
            <div class="reserve-box">RESERVE: ${totalReserve}</div>
            <div class="time-box">
                <span id="live-date">APR 06, 2026</span>
                <span id="live-clock">00:00:00</span>
            </div>
            <div class="rate-card">1 COIN = 100 USD</div>
        </div>
        <div class="container">
            <div class="left-zone">
                <canvas id="canvas"></canvas>
                <div class="leaderboard">SYSTEM: ONLINE<br>MP_TERMINAL: ACTIVE<br>PENANG_NODE_01</div>
            </div>
            <div class="right-zone">
                <div class="panel">${content}</div>
            </div>
        </div>
        <script>
            function updateClock() {
                const now = new Date();
                document.getElementById('live-clock').innerText = now.toLocaleTimeString('en-US', {hour12: false});
            }
            setInterval(updateClock, 1000); updateClock();

            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            let w, h, particles = [];
            
            function init() {
                w = canvas.width = canvas.offsetWidth; 
                h = canvas.height = canvas.offsetHeight;
                particles = []; 
                // 适当减少点数以换取连线的流畅度
                for(let i=0; i<280; i++) {
                    let t = Math.random() * 6.28, a = Math.acos(Math.random()*2-1);
                    particles.push({x: Math.sin(a)*Math.cos(t), y: Math.sin(a)*Math.sin(t), z: Math.cos(a)});
                }
            }

            let rot = 0;
            function draw() {
                ctx.fillStyle = '#050505'; ctx.fillRect(0,0,w,h);
                rot += 0.002;
                const r = Math.min(w, h) * 0.35;
                
                // 计算投影坐标
                let projected = particles.map(p => {
                    let x1 = p.x * Math.cos(rot) - p.z * Math.sin(rot);
                    let z1 = p.z * Math.cos(rot) + p.x * Math.sin(rot);
                    return { x: x1 * r + w/2, y: p.y * r + h/2, z: z1 };
                });

                // 绘制“光纤”连线
                ctx.lineWidth = 0.5;
                for(let i=0; i<projected.length; i++) {
                    for(let j=i+1; j<projected.length; j++) {
                        let dx = projected[i].x - projected[j].x;
                        let dy = projected[i].y - projected[j].y;
                        let dist = Math.sqrt(dx*dx + dy*dy);
                        if(dist < r * 0.25) { // 只连接较近的点
                            let alpha = (1 - dist/(r*0.25)) * ((projected[i].z + projected[j].z + 2)/4);
                            ctx.strokeStyle = "rgba(240, 185, 11, " + (alpha * 0.3) + ")";
                            ctx.beginPath();
                            ctx.moveTo(projected[i].x, projected[i].y);
                            ctx.lineTo(projected[j].x, projected[j].y);
                            ctx.stroke();
                        }
                    }
                }

                // 绘制点阵
                projected.forEach(p => {
                    let s = (p.z + 1) / 2;
                    ctx.fillStyle = "rgba(240, 185, 11, " + (s * 0.8) + ")";
                    ctx.beginPath(); 
                    ctx.arc(p.x, p.y, s * 2, 0, 7); 
                    ctx.fill();
                });
                requestAnimationFrame(draw);
            }
            window.onresize = init; init(); draw();
        </script>
    </body>
    </html>`;
}

// 3. 路由与接口 (保持原有逻辑)
app.get('/', async (req, res) => {
    const stats = await client.query("SELECT SUM(balance) as total FROM users");
    const reserve = Number(stats.rows[0].total || 1000000).toLocaleString();
    res.send(layout(`
        <div class="card">
            <h2>Access Terminal</h2>
            <span class="section-label">ACCOUNT LOGIN</span>
            <input id="name" placeholder="User ID">
            <input id="pin" type="password" placeholder="PIN">
            <button onclick="login()">Sign In</button>
            <div style="margin:20px 0; border-top:1px solid rgba(255,255,255,0.05);"></div>
            <span class="section-label">NEW CLIENT</span>
            <input id="rname" placeholder="Register ID">
            <input id="rpin" type="password" placeholder="Set PIN">
            <button style="background:transparent; border:1px solid var(--gold); color:var(--gold);" onclick="register()">Create Account</button>
        </div>
        <script>
            async function login(){
                const name = document.getElementById('name').value;
                const pin = document.getElementById('pin').value;
                const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pin})});
                const data = await res.json();
                if(data.ok) location.href='/wallet?u='+data.user; else alert("Denied");
            }
            async function register(){
                const name = document.getElementById('rname').value;
                const pin = document.getElementById('rpin').value;
                const res = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pin})});
                const data = await res.json(); alert(data.msg || data.error);
            }
        </script>
    `, reserve));
});

app.get('/wallet', async (req, res) => {
    const u = req.query.u;
    const r = await client.query("SELECT * FROM users WHERE name=$1",[u]);
    if(!r.rows[0]) return res.redirect('/');
    res.send(layout(`
        <div class="card">
            <div style="font-size:10px; color:rgba(255,255,255,0.4);">ACTIVE USER: ${u}</div>
            <div style="font-size:32px; margin:15px 0; color:var(--gold); font-weight:900;">${Number(r.rows[0].balance).toLocaleString()} <span style="font-size:12px;">COIN</span></div>
            <span class="section-label">ASSET TRANSFER</span>
            <input id="to" placeholder="Target ID">
            <input id="amt" type="number" placeholder="Amount">
            <input id="auth_pin" type="password" placeholder="Confirm PIN">
            <button onclick="send()">Authorize</button>
            <button onclick="location.href='/'" style="background:#111; color:#555; margin-top:10px; font-size:11px;">Logout</button>
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
    `));
});

// API 逻辑保持稳定
app.post('/api/register', async (req,res)=>{
    try {
        const hash = await bcrypt.hash(req.body.pin, 10);
        await client.query("INSERT INTO users VALUES ($1,0,$2)",[req.body.name, hash]);
        res.json({msg:"Success"});
    } catch(e) { res.json({error:"ID Taken"}); }
});

app.post('/api/login', async (req,res)=>{
    const r = await client.query("SELECT * FROM users WHERE name=$1",[req.body.name]);
    if(r.rows.length && await bcrypt.compare(req.body.pin, r.rows[0].pin_hash)) {
        res.json({ok:true, user:req.body.name});
    } else res.json({error:"Error"});
});

app.post('/api/transfer', async (req,res)=>{
    const {from, to, amount, pin} = req.body;
    try {
        await client.query('BEGIN');
        const s = await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE",[from]);
        if(s.rows.length && await bcrypt.compare(pin, s.rows[0].pin_hash) && s.rows[0].balance >= amount) {
            await client.query("UPDATE users SET balance=balance-$1 WHERE name=$2",[amount, from]);
            await client.query("UPDATE users SET balance=balance+$1 WHERE name=$2",[amount, to]);
            await client.query('COMMIT');
            res.json({msg:"Done"});
        } else throw new Error();
    } catch(e) { await client.query('ROLLBACK'); res.json({error:"Failed"}); }
});

app.listen(port, () => initDB());
