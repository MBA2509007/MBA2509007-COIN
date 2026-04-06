require('dotenv').config();
const express  = require('express');
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');   // Node.js 内置，无需安装

const app  = express();
const port = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json());

// ═══════════════════════════════════════════════
//  1. 内置 Session 管理（零依赖）
// ═══════════════════════════════════════════════
const SESSION_MAX_AGE = 30 * 60 * 1000; // 30 分钟
const sessions = new Map();

function createSession(username) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { user: username, created: Date.now() });
    return token;
}

function getSession(token) {
    if (!token) return null;
    const sess = sessions.get(token);
    if (!sess) return null;
    if (Date.now() - sess.created > SESSION_MAX_AGE) {
        sessions.delete(token);
        return null;
    }
    return sess;
}

function destroySession(token) {
    if (token) sessions.delete(token);
}

// 定时清理过期 Session
setInterval(() => {
    const now = Date.now();
    for (const [token, sess] of sessions) {
        if (now - sess.created > SESSION_MAX_AGE) sessions.delete(token);
    }
}, 5 * 60 * 1000);

// 解析 Cookie
function parseCookies(req) {
    const cookies = {};
    const header = req.headers.cookie;
    if (!header) return cookies;
    header.split(';').forEach(c => {
        const parts = c.split('=');
        const name  = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (name && value) cookies[name] = decodeURIComponent(value);
    });
    return cookies;
}

// Session 中间件：每个请求解析登录态
app.use((req, res, next) => {
    const cookies = parseCookies(req);
    const sess = getSession(cookies.sid);
    req.currentUser = sess ? sess.user : null;
    req.sessionToken = cookies.sid || null;
    next();
});

// 需要登录的中间件
function requireAuth(req, res, next) {
    if (!req.currentUser) return res.redirect('/');
    next();
}

// ═══════════════════════════════════════════════
//  2. 内置限流器（零依赖）
// ═══════════════════════════════════════════════
const rateLimitStore = new Map();

function rateLimit(maxAttempts, windowMs) {
    return (req, res, next) => {
        const ip  = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const record = rateLimitStore.get(ip);
        if (!record || now - record.start > windowMs) {
            rateLimitStore.set(ip, { count: 1, start: now });
            return next();
        }
        record.count++;
        if (record.count > maxAttempts) {
            return res.status(429).json({ error: 'Too many attempts. Please wait and try again.' });
        }
        next();
    };
}

// 定时清理
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore) {
        if (now - record.start > 15 * 60 * 1000) rateLimitStore.delete(ip);
    }
}, 5 * 60 * 1000);

const loginLimiter    = rateLimit(10, 15 * 60 * 1000); // 15 分钟 10 次
const transferLimiter = rateLimit(20, 60 * 1000);       // 1 分钟 20 次

// ═══════════════════════════════════════════════
//  3. 数据库连接池
// ═══════════════════════════════════════════════
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
    console.error('DB pool error:', err.message);
});

async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                name      TEXT PRIMARY KEY,
                balance   NUMERIC DEFAULT 0,
                pin_hash  TEXT
            )
        `);
        const admin = await pool.query("SELECT name FROM users WHERE name='Admin'");
        if (admin.rows.length === 0) {
            const hash = await bcrypt.hash("888888", 10);
            await pool.query("INSERT INTO users VALUES ('Admin', 1000000, $1)", [hash]);
        }
        console.log("DB_INITIALIZED_SUCCESSFULLY");
    } catch (err) {
        console.error("DB_INIT_ERROR:", err.message);
        process.exit(1);
    }
}

// ═══════════════════════════════════════════════
//  4. 输入验证
// ═══════════════════════════════════════════════
function validateName(name) {
    return typeof name === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(name);
}
function validatePin(pin) {
    return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

// ═══════════════════════════════════════════════
//  5. HTML 布局模板
// ═══════════════════════════════════════════════
function layout(content, totalReserve) {
    totalReserve = totalReserve || "1,000,000";
    return `<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Quantum Financial Terminal</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;900&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --neon-green: #00ff88; }
        body { margin: 0; background: var(--bg); color: #fff; font-family: 'Orbitron', sans-serif; overflow: hidden; }

        .top-bar {
            position: fixed; top: 0; width: 100%; padding: 20px 40px;
            display: flex; justify-content: space-between; align-items: center;
            background: linear-gradient(to bottom, rgba(0,0,0,0.9), transparent);
            z-index: 100; box-sizing: border-box;
        }
        .reserve-box { color: var(--gold); font-size: 20px; font-weight: 900; letter-spacing: 2px; flex: 1; }
        .time-box    { flex: 1; text-align: center; color: rgba(255,255,255,0.6); font-size: 14px; letter-spacing: 1px; }
        #live-clock  { display: block; color: #fff; font-size: 18px; font-weight: 900; }

        .rate-container { flex: 1; display: flex; justify-content: flex-end; }
        .rate-card {
            background: rgba(0,255,136,0.1);
            border: 1px solid var(--neon-green);
            padding: 10px 25px; border-radius: 12px;
            color: var(--neon-green); font-size: 24px; font-weight: 900;
            text-shadow: 0 0 10px rgba(0,255,136,0.5);
            box-shadow: inset 0 0 15px rgba(0,255,136,0.1), 0 0 20px rgba(0,255,136,0.2);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%   { opacity: 0.8; transform: scale(1); }
            50%  { opacity: 1;   transform: scale(1.02); }
            100% { opacity: 0.8; transform: scale(1); }
        }

        .container  { display: flex; height: 100vh; width: 100vw; }
        .left-zone  { flex: 1.2; position: relative; display: flex; align-items: center; justify-content: center; }
        #canvas     { width: 100%; height: 100%; cursor: move; }
        .right-zone { flex: 0.8; display: flex; align-items: center; justify-content: center; background: rgba(10,10,10,0.5); backdrop-filter: blur(10px); border-left: 1px solid rgba(255,255,255,0.05); }
        .panel      { width: 85%; max-width: 400px; }

        .card { background: rgba(255,255,255,0.03); padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        h2    { color: var(--gold); margin-top: 0; font-size: 1.5rem; text-transform: uppercase; letter-spacing: 3px; }

        input  { width: 100%; padding: 16px; margin: 10px 0; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 8px; font-family: 'Orbitron'; font-size: 14px; box-sizing: border-box; }
        button { width: 100%; padding: 18px; margin-top: 15px; background: var(--gold); color: #000; border: none; border-radius: 8px; font-family: 'Orbitron'; font-weight: 900; font-size: 16px; cursor: pointer; transition: 0.3s; }
        button:hover { background: #fff; transform: translateY(-2px); }

        .leaderboard { position: absolute; bottom: 40px; left: 40px; font-size: 12px; color: rgba(255,255,255,0.4); line-height: 2; }

        @media (max-width: 768px) {
            .container  { flex-direction: column; overflow-y: auto; }
            .left-zone  { height: 50vh; width: 100%; }
            .right-zone { width: 100%; padding: 40px 0; }
            .top-bar    { padding: 10px 20px; flex-wrap: wrap; }
            .rate-card  { font-size: 16px; padding: 5px 15px; }
            .reserve-box { font-size: 14px; }
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
        function updateClock(){
            var now=new Date();
            document.getElementById('live-date').innerText=now.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'2-digit'}).toUpperCase();
            document.getElementById('live-clock').innerText=now.toLocaleTimeString('en-US',{hour12:false});
        }
        setInterval(updateClock,1000);
        updateClock();

        var canvas=document.getElementById('canvas');
        var ctx=canvas.getContext('2d');
        var w,h,particles=[];
        function init(){
            w=canvas.width=window.innerWidth>768?window.innerWidth*0.6:window.innerWidth;
            h=canvas.height=window.innerHeight;
            particles=[];
            for(var i=0;i<400;i++){
                var theta=Math.random()*Math.PI*2;
                var phi=Math.acos((Math.random()*2)-1);
                particles.push({x:Math.sin(phi)*Math.cos(theta),y:Math.sin(phi)*Math.sin(theta),z:Math.cos(phi)});
            }
        }
        var angleY=0;
        function draw(){
            ctx.clearRect(0,0,w,h);
            angleY+=0.002;
            var radius=Math.min(w,h)*0.35;
            ctx.beginPath();
            ctx.strokeStyle='rgba(240,185,11,0.05)';
            for(var i=0;i<particles.length;i+=10){
                for(var j=0;j<particles.length;j+=40){
                    var p1=project(particles[i],radius);
                    var p2=project(particles[j],radius);
                    ctx.moveTo(p1.x,p1.y);
                    ctx.lineTo(p2.x,p2.y);
                }
            }
            ctx.stroke();
            particles.forEach(function(p){
                var proj=project(p,radius);
                var opacity=(p.transformedZ+1)/2;
                ctx.fillStyle='rgba(240,185,11,'+opacity+')';
                ctx.beginPath();
                ctx.arc(proj.x,proj.y,opacity*2,0,Math.PI*2);
                ctx.fill();
                if(opacity>0.8){ctx.shadowBlur=10;ctx.shadowColor='#f0b90b';ctx.fill();ctx.shadowBlur=0;}
            });
            requestAnimationFrame(draw);
        }
        function project(p,r){
            var cosY=Math.cos(angleY),sinY=Math.sin(angleY);
            var x1=p.x*cosY-p.z*sinY;
            var z1=p.z*cosY+p.x*sinY;
            p.transformedZ=z1;
            return{x:x1*r+w/2,y:p.y*r+h/2};
        }
        window.addEventListener('resize',init);
        init();draw();
    </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════
//  6. 页面路由
// ═══════════════════════════════════════════════

// 首页（登录 / 注册）
app.get('/', async (req, res) => {
    if (req.currentUser) return res.redirect('/wallet');
    try {
        var stats   = await pool.query("SELECT SUM(balance) as total FROM users");
        var reserve = Number(stats.rows[0].total || 1000000).toLocaleString();
        res.send(layout('<div class="card">'
            + '<h2>Access Terminal</h2>'
            + '<input id="name" placeholder="IDENTIFICATION ID" maxlength="30">'
            + '<input id="pin" type="password" placeholder="6-DIGIT PIN" maxlength="6">'
            + '<button onclick="login()">INITIALIZE LOGIN</button>'
            + '<div style="margin:20px 0;height:1px;background:rgba(255,255,255,0.1);"></div>'
            + '<input id="rname" placeholder="NEW UNIQUE ID" maxlength="30">'
            + '<input id="rpin" type="password" placeholder="SET 6-DIGIT PIN" maxlength="6">'
            + '<button style="background:transparent;border:1px solid var(--gold);color:var(--gold);" onclick="register()">CREATE ACCOUNT</button>'
            + '</div>'
            + '<script>'
            + 'async function login(){'
            +   'var name=document.getElementById("name").value.trim();'
            +   'var pin=document.getElementById("pin").value;'
            +   'if(!name||!pin)return alert("Required: ID & PIN");'
            +   'var r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name,pin:pin})});'
            +   'var data=await r.json();'
            +   'if(data.ok)location.href="/wallet";else alert(data.error);'
            + '}'
            + 'async function register(){'
            +   'var name=document.getElementById("rname").value.trim();'
            +   'var pin=document.getElementById("rpin").value;'
            +   'if(!name||!pin)return alert("Required: ID & PIN");'
            +   'var r=await fetch("/api/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:name,pin:pin})});'
            +   'var data=await r.json();'
            +   'alert(data.msg||data.error);'
            + '}'
            + '<\/script>'
        , reserve));
    } catch (e) {
        console.error("GET / error:", e.message);
        res.status(500).send("System Error");
    }
});

// 钱包页面（需要登录）
app.get('/wallet', requireAuth, async (req, res) => {
    var u = req.currentUser;
    try {
        var r = await pool.query("SELECT name, balance FROM users WHERE name=$1", [u]);
        if (!r.rows[0]) {
            destroySession(req.sessionToken);
            return res.redirect('/');
        }
        var stats   = await pool.query("SELECT SUM(balance) as total FROM users");
        var reserve = Number(stats.rows[0].total || 1000000).toLocaleString();
        var balance = Number(r.rows[0].balance).toLocaleString();

        res.send(layout('<div class="card">'
            + '<div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:2px;">AUTHENTICATED USER</div>'
            + '<h2 style="margin-bottom:5px;">' + u + '</h2>'
            + '<div style="font-size:32px;color:#fff;font-weight:900;margin:20px 0;">'
            +   '<span style="font-size:14px;color:var(--gold);">BALANCE:</span><br>'
            +   balance + ' <span style="font-size:14px;">COIN</span>'
            + '</div>'
            + '<div style="margin:25px 0;border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;">'
            +   '<h2 style="font-size:14px;">Transfer Fund</h2>'
            +   '<input id="to" placeholder="RECIPIENT ID" maxlength="30">'
            +   '<input id="amt" type="number" placeholder="AMOUNT" min="1">'
            +   '<input id="auth_pin" type="password" placeholder="CONFIRM PIN" maxlength="6">'
            +   '<button id="send-btn" onclick="send()">AUTHORIZE TRANSFER</button>'
            +   '<button onclick="logout()" style="background:#222;color:#fff;margin-top:10px;font-size:12px;">LOGOUT TERMINAL</button>'
            + '</div>'
            + '</div>'
            + '<script>'
            + 'async function send(){'
            +   'var to=document.getElementById("to").value.trim();'
            +   'var amt=document.getElementById("amt").value;'
            +   'var pin=document.getElementById("auth_pin").value;'
            +   'if(!to||!amt||!pin)return alert("Complete all fields");'
            +   'var btn=document.getElementById("send-btn");'
            +   'btn.disabled=true;btn.innerText="ENCRYPTING...";'
            +   'try{'
            +     'var r=await fetch("/api/transfer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:to,amount:amt,pin:pin})});'
            +     'var data=await r.json();'
            +     'alert(data.msg||data.error);'
            +     'if(data.ok)location.reload();'
            +   '}catch(e){alert("Network Error");}'
            +   'btn.disabled=false;btn.innerText="AUTHORIZE TRANSFER";'
            + '}'
            + 'async function logout(){'
            +   'await fetch("/api/logout",{method:"POST"});'
            +   'location.href="/";'
            + '}'
            + '<\/script>'
        , reserve));
    } catch (e) {
        console.error("GET /wallet error:", e.message);
        res.redirect('/');
    }
});

// ═══════════════════════════════════════════════
//  7. API 接口
// ═══════════════════════════════════════════════

// 注册
app.post('/api/register', async (req, res) => {
    var name = req.body.name;
    var pin  = req.body.pin;
    if (!validateName(name)) return res.json({ error: "ID must be 3-30 alphanumeric characters" });
    if (!validatePin(pin))   return res.json({ error: "PIN must be exactly 6 digits" });
    try {
        var hash = await bcrypt.hash(pin, 10);
        await pool.query("INSERT INTO users VALUES ($1, 0, $2)", [name, hash]);
        res.json({ msg: "Account Created Successfully" });
    } catch (e) {
        res.json({ error: "Name already exists" });
    }
});

// 登录
app.post('/api/login', loginLimiter, async (req, res) => {
    var name = req.body.name;
    var pin  = req.body.pin;
    if (!validateName(name) || !validatePin(pin)) return res.json({ error: "Invalid credentials format" });
    try {
        var r = await pool.query("SELECT * FROM users WHERE name=$1", [name]);
        if (r.rows.length === 0) return res.json({ error: "User not found" });
        var ok = await bcrypt.compare(pin, r.rows[0].pin_hash);
        if (!ok) return res.json({ error: "Invalid PIN" });

        // 销毁旧 session，创建新 session
        destroySession(req.sessionToken);
        var token = createSession(name);
        res.setHeader('Set-Cookie', 'sid=' + token + '; HttpOnly; Path=/; Max-Age=1800; SameSite=Lax');
        res.json({ ok: true });
    } catch (e) {
        console.error("Login error:", e.message);
        res.json({ error: "System Error" });
    }
});

// 登出
app.post('/api/logout', (req, res) => {
    destroySession(req.sessionToken);
    res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
    res.json({ ok: true });
});

// 转账
app.post('/api/transfer', transferLimiter, async (req, res) => {
    var from = req.currentUser;
    if (!from) return res.status(401).json({ error: "Not logged in" });

    var to     = req.body.to;
    var amount = req.body.amount;
    var pin    = req.body.pin;
    var amt    = Number(amount);

    if (!validateName(to))           return res.json({ error: "Invalid recipient ID" });
    if (!validatePin(pin))           return res.json({ error: "Invalid PIN format" });
    if (isNaN(amt) || amt <= 0)      return res.json({ error: "Invalid Amount" });
    if (amt !== Math.floor(amt))     return res.json({ error: "Amount must be a whole number" });
    if (from === to)                 return res.json({ error: "Cannot send to self" });

    var client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 按字典序锁定，防止死锁
        var sorted = [from, to].sort();
        await client.query("SELECT 1 FROM users WHERE name=$1 FOR UPDATE", [sorted[0]]);
        await client.query("SELECT 1 FROM users WHERE name=$1 FOR UPDATE", [sorted[1]]);

        var sender   = await client.query("SELECT * FROM users WHERE name=$1", [from]);
        var receiver = await client.query("SELECT name FROM users WHERE name=$1", [to]);

        if (!receiver.rows[0])                                         throw new Error("Recipient ID not found");
        if (!(await bcrypt.compare(pin, sender.rows[0].pin_hash)))     throw new Error("Security PIN Denied");
        if (Number(sender.rows[0].balance) < amt)                      throw new Error("Insufficient Funds");

        await client.query("UPDATE users SET balance = balance - $1 WHERE name = $2", [amt, from]);
        await client.query("UPDATE users SET balance = balance + $1 WHERE name = $2", [amt, to]);

        await client.query('COMMIT');
        res.json({ ok: true, msg: "Transfer Successful" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.json({ error: err.message });
    } finally {
        client.release();
    }
});

// ═══════════════════════════════════════════════
//  8. 全局错误处理
// ═══════════════════════════════════════════════
app.use(function(err, req, res, next) {
    console.error("Unhandled error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
});

// ═══════════════════════════════════════════════
//  9. 启动
// ═══════════════════════════════════════════════
app.listen(port, async function() {
    await initDB();
    console.log("Terminal Online: " + port);
});
