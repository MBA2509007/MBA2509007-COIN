require('dotenv').config();
const express = require('express');
const { Pool } = require('pg'); // 【优化】使用 Pool 替代 Client 以支持高并发
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // 【优化】引入 JWT 进行安全鉴权

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'quantum_super_secret_key_2026'; // 记得在 .env 中设置复杂密钥

app.use(express.json());

// 【优化】使用连接池管理数据库连接
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
});

// 1. 数据库初始化 (Database Initialization)
async function initDB() {
    try {
        await pool.query('SELECT NOW()'); // 测试连接
        console.log("DB_POOL_CONNECTED_SUCCESSFULLY");

        // 创建用户表 (增加高精度 NUMERIC)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                name TEXT PRIMARY KEY,
                balance NUMERIC(18, 6) DEFAULT 0,
                pin_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 【优化】创建交易流水表 (审计追踪)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                sender TEXT REFERENCES users(name),
                receiver TEXT REFERENCES users(name),
                amount NUMERIC(18, 6),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 默认 Admin 初始化: 发行 1,000,000 COIN
        const admin = await pool.query("SELECT * FROM users WHERE name='Admin'");
        if (admin.rows.length === 0) {
            const hash = await bcrypt.hash("888888", 10);
            await pool.query(
                "INSERT INTO users (name, balance, pin_hash) VALUES ('Admin', 1000000, $1)",
                [hash]
            );
            console.log("ADMIN_ACCOUNT_INITIALIZED");
        }
    } catch (err) {
        console.error("DB_INIT_ERROR:", err.message);
        process.exit(1);
    }
}

// 2. JWT 鉴权中间件 (Auth Middleware)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access Denied" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid Token" });
        req.user = user;
        next();
    });
}

// 3. 核心视觉布局 (合并为一个 SPA 页面)
function layout(totalReserve = "1,000,000") {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Quantum Financial Terminal</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&display=swap" rel="stylesheet">
        <style>
            /* ...(保留你原有的全部 CSS 样式)... */
            :root { --gold: #f0b90b; --bg: #050505; --neon-green: #00ff88; }
            body { margin: 0; background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; overflow: hidden; }
            .top-bar { position: fixed; top: 0; width: 100%; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(to bottom, rgba(0,0,0,0.9), transparent); z-index: 100; box-sizing: border-box; }
            .reserve-box { color: var(--gold); font-size: 20px; font-weight: 900; letter-spacing: 2px; flex: 1; }
            .time-box { flex: 1; text-align: center; color: rgba(255,255,255,0.6); font-size: 14px; letter-spacing: 1px; }
            #live-clock { display: block; color: #fff; font-size: 18px; font-weight: 900; }
            .rate-container { flex: 1; display: flex; justify-content: flex-end; }
            .rate-card { background: rgba(0, 255, 136, 0.1); border: 1px solid var(--neon-green); padding: 10px 25px; border-radius: 12px; color: var(--neon-green); font-size: 24px; font-weight: 900; text-shadow: 0 0 10px rgba(0,255,136,0.5); box-shadow: inset 0 0 15px rgba(0,255,136,0.1), 0 0 20px rgba(0,255,136,0.2); animation: pulse 2s infinite; }
            @keyframes pulse { 0% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.02); } 100% { opacity: 0.8; transform: scale(1); } }
            .container { display: flex; height: 100vh; width: 100vw; }
            .left-zone { flex: 1.2; position: relative; display: flex; align-items: center; justify-content: center; }
            #canvas { width: 100%; height: 100%; cursor: move; }
            .right-zone { flex: 0.8; display: flex; align-items: center; justify-content: center; background: rgba(10,10,10,0.5); backdrop-filter: blur(10px); border-left: 1px solid rgba(255,255,255,0.05); }
            .panel { width: 85%; max-width: 400px; }
            .card { background: rgba(255,255,255,0.03); padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
            h2 { color: var(--gold); margin-top: 0; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 3px; }
            input { width: 100%; padding: 16px; margin: 10px 0; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 8px; font-family: 'Orbitron'; font-size: 14px; box-sizing: border-box; }
            button { width: 100%; padding: 18px; margin-top: 15px; background: var(--gold); color: #000; border: none; border-radius: 8px; font-family: 'Orbitron'; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.3s; }
            button:hover { background: #fff; transform: translateY(-2px); }
            .leaderboard { position: absolute; bottom: 40px; left: 40px; font-size: 12px; color: rgba(255,255,255,0.4); line-height: 2; }
            @media (max-width: 768px) { .container { flex-direction: column; overflow-y: auto; } .left-zone { height: 50vh; width: 100%; } .right-zone { width: 100%; padding: 40px 0; } .top-bar { padding: 10px 20px; flex-wrap: wrap; } .rate-card { font-size: 16px; padding: 5px 15px; } .reserve-box { font-size: 14px; } }
            /* 隐藏元素类 */
            .hidden { display: none !important; }
        </style>
    </head>
    <body>
        <div class="top-bar">
            <div class="reserve-box">RESERVE: ${totalReserve} COIN</div>
            <div class="time-box"><span id="live-date">---</span> <span id="live-clock">00:00:00</span></div>
            <div class="rate-container"><div class="rate-card">1 COIN = 100 USD</div></div>
        </div>

        <div class="container">
            <div class="left-zone">
                <canvas id="canvas"></canvas>
                <div class="leaderboard">SYSTEM_STATUS: ACTIVE<br>ENCRYPTION: QUANTUM_AES_256_JWT<br>LOCATION: PENANG_TERMINAL</div>
            </div>
            <div class="right-zone">
                <div class="panel">
                    
                    <div id="auth-view" class="card">
                        <h2>Access Terminal</h2>
                        <input id="name" placeholder="IDENTIFICATION ID">
                        <input id="pin" type="password" placeholder="SECURITY PIN">
                        <button onclick="login()">INITIALIZE LOGIN</button>
                        <div style="margin:20px 0; height:1px; background:rgba(255,255,255,0.1);"></div>
                        <input id="rname" placeholder="NEW UNIQUE ID">
                        <input id="rpin" type="password" placeholder="SET 6-DIGIT PIN">
                        <button style="background:transparent; border:1px solid var(--gold); color:var(--gold);" onclick="register()">CREATE ACCOUNT</button>
                    </div>

                    <div id="wallet-view" class="card hidden">
                        <div style="font-size:10px; color:rgba(255,255,255,0.4); letter-spacing:2px;">AUTHENTICATED USER</div>
                        <h2 id="wallet-user-name" style="margin-bottom:5px;">---</h2>
                        <div style="font-size:32px; color:#fff; font-weight:900; margin:20px 0;">
                            <span style="font-size:14px; color:var(--gold);">BALANCE:</span><br>
                            <span id="wallet-balance">0.00</span> <span style="font-size:14px;">COIN</span>
                        </div>
                        <div style="margin:25px 0; border-top:1px solid rgba(255,255,255,0.1); padding-top:20px;">
                            <h2 style="font-size:14px;">Transfer Fund</h2>
                            <input id="to" placeholder="RECIPIENT ID">
                            <input id="amt" type="number" placeholder="AMOUNT">
                            <input id="auth_pin" type="password" placeholder="CONFIRM PIN">
                            <button id="send-btn" onclick="send()">AUTHORIZE TRANSFER</button>
                            <button onclick="logout()" style="background:#222; color:#fff; margin-top:10px; font-size:12px;">LOGOUT TERMINAL</button>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <script>
            // ---------------- 1. 核心业务逻辑 (SPA Router & Auth) ----------------
            const authView = document.getElementById('auth-view');
            const walletView = document.getElementById('wallet-view');
            
            async function checkSession() {
                const token = localStorage.getItem('jwt_token');
                if (!token) {
                    authView.classList.remove('hidden');
                    walletView.classList.add('hidden');
                    return;
                }
                
                // 验证 Token 并获取用户信息
                const res = await fetch('/api/me', { headers: { 'Authorization': 'Bearer ' + token } });
                const data = await res.json();
                
                if (data.ok) {
                    document.getElementById('wallet-user-name').innerText = data.user.name;
                    document.getElementById('wallet-balance').innerText = Number(data.user.balance).toLocaleString();
                    authView.classList.add('hidden');
                    walletView.classList.remove('hidden');
                } else {
                    logout(); // Token 过期或无效
                }
            }

            async function login() {
                const name = document.getElementById('name').value;
                const pin = document.getElementById('pin').value;
                if(!name || !pin) return alert("Required: ID & PIN");
                
                const res = await fetch('/api/login', {
                    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,pin})
                });
                const data = await res.json();
                if(data.token) {
                    localStorage.setItem('jwt_token', data.token);
                    checkSession();
                } else alert(data.error);
            }

            async function register() {
                const name = document.getElementById('rname').value;
                const pin = document.getElementById('rpin').value;
                if(!name || !pin) return alert("Required: ID & PIN");
                const res = await fetch('/api/register', {
                    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,pin})
                });
                const data = await res.json(); alert(data.msg || data.error);
            }

            async function send() {
                const to = document.getElementById('to').value;
                const amt = document.getElementById('amt').value;
                const pin = document.getElementById('auth_pin').value;
                const token = localStorage.getItem('jwt_token');

                if(!to || !amt || !pin) return alert("Complete all fields");
                const btn = document.getElementById('send-btn');
                btn.disabled = true; btn.innerText = "ENCRYPTING...";
                
                try {
                    const res = await fetch('/api/transfer', {
                        method:'POST', 
                        headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ to, amount: amt, pin })
                    });
                    const data = await res.json();
                    alert(data.msg || data.error);
                    
                    document.getElementById('to').value = '';
                    document.getElementById('amt').value = '';
                    document.getElementById('auth_pin').value = '';
                    checkSession(); // 刷新余额
                } catch(e) { 
                    alert("Network Error"); 
                } finally {
                    btn.disabled = false; btn.innerText = "AUTHORIZE TRANSFER";
                }
            }

            function logout() {
                localStorage.removeItem('jwt_token');
                document.getElementById('name').value = '';
                document.getElementById('pin').value = '';
                checkSession();
            }

            // 初始化检查状态
            checkSession();

            // ---------------- 2. UI 动效逻辑 (Clock & 3D Canvas) ----------------
            /* ...(保留你原有的时钟和 3D 地球仪动画代码，这部分完全没变)... */
            function updateClock() {
                const now = new Date();
                const options = { year: 'numeric', month: 'short', day: '2-digit' };
                document.getElementById('live-date').innerText = now.toLocaleDateString('en-US', options).toUpperCase();
                document.getElementById('live-clock').innerText = now.toLocaleTimeString('en-US', { hour12: false });
            }
            setInterval(updateClock, 1000); updateClock();

            const canvas = document.getElementById('canvas'); const ctx = canvas.getContext('2d');
            let w, h, particles = [];
            function initCanvas() {
                w = canvas.width = window.innerWidth > 768 ? window.innerWidth * 0.6 : window.innerWidth;
                h = canvas.height = window.innerHeight;
                particles = [];
                for(let i=0; i<400; i++) {
                    let theta = Math.random() * Math.PI * 2; let phi = Math.acos((Math.random() * 2) - 1);
                    particles.push({ x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: Math.cos(phi) });
                }
            }
            let angleY = 0;
            function draw() {
                ctx.clearRect(0,0,w,h); angleY += 0.002; const radius = Math.min(w, h) * 0.35;
                ctx.beginPath(); ctx.strokeStyle = 'rgba(240, 185, 11, 0.05)';
                for(let i=0; i<particles.length; i+=10) {
                    for(let j=0; j<particles.length; j+=40) {
                        let p1 = project(particles[i], radius); let p2 = project(particles[j], radius);
                        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
                    }
                }
                ctx.stroke();
                particles.forEach(p => {
                    let proj = project(p, radius); let opacity = (p.transformedZ + 1) / 2;
                    ctx.fillStyle = \`rgba(240, 185, 11, \${opacity})\`;
                    ctx.beginPath(); ctx.arc(proj.x, proj.y, opacity * 2, 0, Math.PI * 2); ctx.fill();
                });
                requestAnimationFrame(draw);
            }
            function project(p, r) {
                let x = p.x, y = p.y, z = p.z;
                let cosY = Math.cos(angleY), sinY = Math.sin(angleY);
                let x1 = x * cosY - z * sinY; let z1 = z * cosY + x * sinY;
                p.transformedZ = z1;
                return { x: x1 * r + w/2, y: y * r + h/2 };
            }
            window.addEventListener('resize', initCanvas); initCanvas(); draw();
        </script>
    </body>
    </html>`;
}

// 4. API 接口 (API Endpoints)
app.get('/', (req, res) => {
    // 改为单页应用，总量这里为了性能不再每次去 count DB，毕竟总量是锁定的 100 万
    res.send(layout("1,000,000"));
});

app.post('/api/register', async (req,res)=>{
    const {name,pin} = req.body;
    try {
        const hash = await bcrypt.hash(pin, 10);
        await pool.query("INSERT INTO users (name, balance, pin_hash) VALUES ($1, 0, $2)", [name, hash]);
        res.json({msg:"Account Created Successfully"});
    } catch(e) { res.json({error:"Name already exists or Invalid"}); }
});

app.post('/api/login', async (req,res)=>{
    const {name,pin} = req.body;
    try {
        const r = await pool.query("SELECT * FROM users WHERE name=$1", [name]);
        if(r.rows.length === 0) return res.json({error:"User not found"});
        
        const ok = await bcrypt.compare(pin, r.rows[0].pin_hash);
        if(!ok) return res.json({error:"Invalid PIN"});
        
        // 签发 JWT 令牌，有效期 1 小时
        const token = jwt.sign({ name: r.rows[0].name }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch(e) { res.json({error:"System Error"}); }
});

// 获取当前用户信息 (需要 JWT 验证)
app.get('/api/me', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query("SELECT name, balance FROM users WHERE name=$1", [req.user.name]);
        if(r.rows.length === 0) return res.status(404).json({error: "User not found"});
        res.json({ ok: true, user: r.rows[0] });
    } catch(e) {
        res.status(500).json({ error: "Database error" });
    }
});

// 转账接口 (结合 JWT 验证和事务管理)
app.post('/api/transfer', authenticateToken, async (req,res)=>{
    const from = req.user.name; // 发送方直接从 Token 中获取，防止篡改伪造
    const { to, amount, pin } = req.body;
    const amt = Number(amount);
    
    if(isNaN(amt) || amt <= 0) return res.json({error:"Invalid Amount"});
    if(from === to) return res.json({error:"Cannot send to self"});

    const client = await pool.connect(); // 使用独立客户端处理事务
    try {
        await client.query('BEGIN');
        
        // 锁定行，防止死锁
        const sortedUsers = [from, to].sort();
        await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE", [sortedUsers[0]]);
        await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE", [sortedUsers[1]]);

        const s = await client.query("SELECT * FROM users WHERE name=$1", [from]);
        const r = await client.query("SELECT * FROM users WHERE name=$1", [to]);

        if(!s.rows[0] || !r.rows[0]) throw new Error("Recipient ID not found");
        
        const isPinValid = await bcrypt.compare(pin, s.rows[0].pin_hash);
        if(!isPinValid) throw new Error("Security PIN Denied");
        if(Number(s.rows[0].balance) < amt) throw new Error("Insufficient Funds");

        // 扣款与加钱
        await client.query("UPDATE users SET balance=balance-$1 WHERE name=$2", [amt, from]);
        await client.query("UPDATE users SET balance=balance+$1 WHERE name=$2", [amt, to]);
        
        // 记录交易流水 (非常重要！)
        await client.query(
            "INSERT INTO transactions (sender, receiver, amount) VALUES ($1, $2, $3)", 
            [from, to, amt]
        );

        await client.query('COMMIT');
        res.json({msg:"Transfer Successful"});
    } catch (err) {
        await client.query('ROLLBACK');
        res.json({error: err.message});
    } finally {
        client.release(); // 释放连接回连接池
    }
});

// 5. 启动服务器
app.listen(port, async ()=>{
    await initDB();
    console.log("Terminal Online: " + port);
});
