require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let client;

// 1. 数据库初始化：强制确保 Admin 存在且信息正确
async function initDB() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000, 
    });

    try {
        await client.connect();
        console.log("Database Connected.");
        
        // 创建表
        await client.query(`CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance NUMERIC DEFAULT 0, pin_hash TEXT)`);
        
        // 【核心修复】：不再只是 INSERT，而是 ON CONFLICT DO UPDATE
        // 这样可以解决你之前因为旧数据导致登录不到的问题
        const hash = await bcrypt.hash("888888", 10);
        await client.query(`
            INSERT INTO users (name, balance, pin_hash) 
            VALUES ('Admin', 1000000, $1) 
            ON CONFLICT (name) DO UPDATE 
            SET pin_hash = $1, balance = 1000000`, [hash]);
            
        console.log("Admin account synchronized successfully.");
    } catch (err) {
        console.error("Init Error:", err.message);
    }
}

// 2. 增强布局：找回时间、日期及光纤效果
function layout(content, totalReserve = "1,000,000") {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quantum Terminal</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&family=Roboto+Mono:wght@700&display=swap" rel="stylesheet">
        <style>
            :root { --gold: #f0b90b; --bg: #050505; --neon-green: #00ff88; }
            body { margin: 0; background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; overflow: hidden; }
            
            .top-bar { 
                position: fixed; top: 0; width: 100%; padding: 20px 40px; 
                display: flex; justify-content: space-between; align-items: center;
                z-index: 2000; box-sizing: border-box;
                background: linear-gradient(to bottom, rgba(5,5,5,0.9), transparent);
            }
            .reserve-box { color: var(--gold); font-size: 18px; font-weight: 900; }
            .time-box { text-align: center; color: rgba(255,255,255,0.5); font-size: 12px; }
            #live-clock { display: block; color: #fff; font-size: 16px; font-weight: 900; }
            .rate-card { background: rgba(0, 255, 136, 0.1); border: 1px solid var(--neon-green); padding: 6px 12px; border-radius: 4px; color: var(--neon-green); font-family: 'Roboto Mono', monospace; font-size: 16px; }

            .container { display: flex; height: 100vh; width: 100vw; }
            .left-zone { flex: 1.2; position: relative; }
            #canvas { width: 100%; height: 100%; }
            
            .right-zone { flex: 0.8; display: flex; align-items: center; justify-content: center; background: rgba(10,10,10,0.8); backdrop-filter: blur(20px); border-left: 1px solid rgba(255,255,255,0.05); }
            .panel { width: 85%; max-width: 380px; }
            .card { background: rgba(255,255,255,0.02); padding: 30px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.1); }
            
            h2 { color: var(--gold); font-size: 1.2rem; letter-spacing: 3px; text-align: center; margin-bottom: 25px; }
            input { width: 100%; padding: 14px; margin: 6px 0; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 6px; font-family: 'Orbitron'; font-size: 12px; box-sizing: border-box; }
            button { width: 100%; padding: 15px; margin-top: 10px; background: var(--gold); color: #000; border: none; border-radius: 6px; font-family: 'Orbitron'; font-weight: 900; cursor: pointer; text-transform: uppercase; }
            
            .leaderboard { position: absolute; bottom: 30px; left: 40px; font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Roboto Mono'; line-height: 1.5; }
        </style>
    </head>
    <body>
        <div class="top-bar">
            <div class="reserve-box">RESERVE: ${totalReserve} COIN</div>
            <div class="time-box">
                <span id="live-date">APR 06, 2026</span>
                <span id="live-clock">00:00:00</span>
            </div>
            <div class="rate-card">1 COIN = 100 USD</div>
        </div>
        <div class="container">
            <div class="left-zone">
                <canvas id="canvas"></canvas>
                <div class="leaderboard">SYSTEM_STATUS: ACTIVE<br>LOCATION: MALAYSIA_MP_OFFICE</div>
            </div>
            <div class="right-zone">
                <div class="panel">${content}</div>
            </div>
        </div>
        <script>
            // 时钟脚本
            function updateClock() {
                const now = new Date();
                const options = { year: 'numeric', month: 'short', day: '2-digit' };
                document.getElementById('live-date').innerText = now.toLocaleDateString('en-US', options).toUpperCase();
                document.getElementById('live-clock').innerText = now.toLocaleTimeString('en-US', { hour12: false });
            }
            setInterval(updateClock, 1000); updateClock();

            // 光纤球脚本
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            let w, h, particles = [];
            
            function init() {
                w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight;
                particles = [];
                for(let i=0; i<280; i++) {
                    let t = Math.random()*6.28, a = Math.acos(Math.random()*2-1);
                    particles.push({x: Math.sin(a)*Math.cos(t), y: Math.sin(a)*Math.sin(t), z: Math.cos(a)});
                }
            }

            let rot = 0;
            function draw() {
                ctx.fillStyle = '#050505'; ctx.fillRect(0,0,w,h);
                rot += 0.002;
                const r = Math.min(w, h) * 0.35;
                
                let projected = particles.map(p => {
                    let x1 = p.x * Math.cos(rot) - p.z * Math.sin(rot);
                    let z1 = p.z * Math.cos(rot) + p.x * Math.sin(rot);
                    return { x: x1 * r + w/2, y: p.y * r + h/2, z: z1 };
                });

                ctx.lineWidth = 0.5;
                for(let i=0; i<projected.length; i++) {
                    for(let j=i+1; j<projected.length; j++) {
                        let dist = Math.hypot(projected[i].x - projected[j].x, projected[i].y - projected[j].y);
                        if(dist < r * 0.25) {
                            let alpha = (1 - dist/(r*0.25)) * ((projected[i].z + projected[j].z + 2)/4);
                            ctx.strokeStyle = "rgba(240, 185, 11, " + (alpha * 0.3) + ")";
                            ctx.beginPath(); ctx.moveTo(projected[i].x, projected[i].y); ctx.lineTo(projected[j].x, projected[j].y); ctx.stroke();
                        }
                    }
                }

                projected.forEach(p => {
                    let s = (p.z + 1) / 2;
                    ctx.fillStyle = "rgba(240, 185, 11, " + (s * 0.8) + ")";
                    ctx.beginPath(); ctx.arc(p.x, p.y, s * 2, 0, 7); ctx.fill();
                });
                requestAnimationFrame(draw);
            }
            window.onresize = init; init(); draw();
        </script>
    </body>
    </html>`;
}

// 3. 路由
app.get('/', async (req, res) => {
    let reserve = "1,000,000";
    try {
        const stats = await client.query("SELECT SUM(balance) as total FROM users");
        reserve = Number(stats.rows[0].total || 1000000).toLocaleString();
    } catch(e) {}
    res.send(layout(`
        <div class="card">
            <h2>ACCESS TERMINAL</h2>
            <input id="name" placeholder="IDENTIFICATION ID">
            <input id="pin" type="password" placeholder="SECURITY PIN">
            <button onclick="login()">INITIALIZE LOGIN</button>
            <div style="margin:20px 0; border-top:1px solid rgba(255,255,255,0.05);"></div>
            <input id="rname" placeholder="NEW UNIQUE ID">
            <input id="rpin" type="password" placeholder="SET 6-DIGIT PIN">
            <button style="background:transparent; border:1px solid var(--gold); color:var(--gold);" onclick="register()">CREATE ACCOUNT</button>
        </div>
        <script>
            async function login(){
                const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('name').value,pin:document.getElementById('pin').value})});
                const data = await res.json(); if(data.ok) location.href='/wallet?u='+data.user; else alert("ACCESS DENIED");
            }
            async function register(){
                const res = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('rname').value,pin:document.getElementById('rpin').value})});
                const data = await res.json(); alert(data.msg || data.error);
            }
        </script>
    `, reserve));
});

app.get('/wallet', async (req, res) => {
    const u = req.query.u;
    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[u]);
        if(!r.rows[0]) return res.redirect('/');
        res.send(layout(`
            <div class="card">
                <div style="font-size:10px; color:rgba(255,255,255,0.4);">USER: ${u}</div>
                <div style="font-size:32px; margin:15px 0; color:var(--gold); font-weight:900;">${Number(r.rows[0].balance).toLocaleString()} <span style="font-size:12px;">COIN</span></div>
                <input id="to" placeholder="RECIPIENT ID">
                <input id="amt" type="number" placeholder="AMOUNT">
                <input id="auth_pin" type="password" placeholder="SECURITY PIN">
                <button onclick="send()">AUTHORIZE TRANSFER</button>
                <button onclick="location.href='/'" style="background:#111; color:#555; margin-top:10px; font-size:11px;">TERMINATE SESSION</button>
            </div>
            <script>
                async function send(){
                    const res = await fetch('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from:'${u}',to:document.getElementById('to').value,amount:document.getElementById('amt').value,pin:document.getElementById('auth_pin').value})});
                    const data = await res.json(); alert(data.msg || data.error); location.reload();
                }
            </script>
        `));
    } catch(e) { res.redirect('/'); }
});

// API 接口
app.post('/api/register', async (req,res)=>{
    try {
        const hash = await bcrypt.hash(req.body.pin, 10);
        await client.query("INSERT INTO users VALUES ($1,0,$2)",[req.body.name, hash]);
        res.json({msg:"ACCOUNT SECURED"});
    } catch(e) { res.json({error:"ID UNAVAILABLE"}); }
});

app.post('/api/login', async (req,res)=>{
    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[req.body.name]);
        if(r.rows.length && await bcrypt.compare(req.body.pin, r.rows[0].pin_hash)) {
            res.json({ok:true, user:req.body.name});
        } else res.json({error:"DENIED"});
    } catch(e) { res.json({error:"ERROR"}); }
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
            res.json({msg:"SUCCESS"});
        } else throw new Error();
    } catch(e) { await client.query('ROLLBACK'); res.json({error:"FAILED"}); }
});

app.listen(port, () => initDB());
