require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcryptjs'); // 切换为 bcryptjs 确保兼容性

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let client;

// 数据库初始化 (Database Initialization)
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

        // 默认 Admin 初始化
        const admin = await client.query("SELECT * FROM users WHERE name='Admin'");
        if (admin.rows.length === 0) {
            const hash = await bcrypt.hash("888888", 10);
            await client.query(
                "INSERT INTO users VALUES ('Admin', 1000000, $1)",
                [hash]
            );
        }
    } catch (err) {
        console.error("DB_INIT_ERROR:", err.message);
        process.exit(1); 
    }
}

// 📱 手机 UI 布局 (Mobile UI Layout)
function layout(content) {
    return `
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Quantum Wallet</title>
    <style>
    body { font-family: sans-serif; background:#0b0b0b; color:#fff; margin:0; }
    .wrap { max-width:420px; margin:auto; padding:20px; }
    .card { background:#111; padding:20px; border-radius:15px; margin-bottom:20px; border: 1px solid #222; }
    .balance { font-size:32px; font-weight:bold; color: #f0b90b; word-wrap: break-word; }
    input, button {
        width:100%; padding:14px; margin:8px 0;
        border-radius:8px; border:none; box-sizing: border-box; font-size: 16px;
    }
    input { background: #222; color: #fff; outline: none; }
    input:focus { border: 1px solid #f0b90b; }
    button { background:#f0b90b; font-weight:bold; color:#000; cursor:pointer; transition: 0.2s; }
    button:active { transform: scale(0.98); opacity: 0.8; }
    button:disabled { background:#555; color:#888; }
    </style>
    </head>
    <body>
    <div class="wrap">${content}</div>
    </body>
    </html>`;
}

// --- 路由页面 (Routes) ---

// 首页：登录与注册
app.get('/', (req, res) => {
    res.send(layout(`
        <h2 style="text-align:center; color:#f0b90b;">Quantum Wallet</h2>
        <div class="card">
            <h3>Login (登录)</h3>
            <input id="name" placeholder="Name">
            <input id="pin" placeholder="PIN" type="password">
            <button onclick="login()">Login</button>
        </div>
        <div class="card">
            <h3>Register (注册)</h3>
            <input id="rname" placeholder="New Name">
            <input id="rpin" placeholder="PIN" type="password">
            <button onclick="register()">Register</button>
        </div>
<script>
async function login(){
    const name = document.getElementById('name').value;
    const pin = document.getElementById('pin').value;
    if(!name || !pin) return alert("请填写完整信息");
    const res = await fetch('/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ name, pin })
    });
    const data = await res.json();
    if(data.ok) location.href='/wallet?u='+data.user;
    else alert(data.error);
}
async function register(){
    const name = document.getElementById('rname').value;
    const pin = document.getElementById('rpin').value;
    if(!name || !pin) return alert("请填写完整信息");
    const res = await fetch('/api/register',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ name, pin })
    });
    const data = await res.json();
    alert(data.msg || data.error);
}
</script>
    `));
});

// 钱包页面
app.get('/wallet', async (req, res) => {
    const u = req.query.u;
    if(!u) return res.redirect('/');
    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[u]);
        if(r.rows.length===0) return res.redirect('/');
        const bal = r.rows[0].balance;
        res.send(layout(`
            <h2 style="color:#f0b90b;">${u}</h2>
            <div class="card">
                <div style="font-size:12px; color:#888;">Current Balance</div>
                <div class="balance">${bal} COIN</div>
                <button onclick="location.href='/'" style="background:#333; color:#fff; margin-top:15px;">Logout</button>
            </div>
            <div class="card">
                <h3>Transfer (转账)</h3>
                <input id="to" placeholder="Recipient Name">
                <input id="amt" type="number" placeholder="Amount">
                <input id="auth_pin" type="password" placeholder="Confirm PIN">
                <button id="send-btn" onclick="send()">Authorize Transfer</button>
            </div>
<script>
async function send(){
    const to = document.getElementById('to').value;
    const amt = document.getElementById('amt').value;
    const pin = document.getElementById('auth_pin').value;
    if(!to || !amt || !pin) return alert("请完整填写转账信息");
    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    btn.innerText = "Processing...";
    try {
        const res = await fetch('/api/transfer',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ from:'${u}', to, amount:amt, pin })
        });
        const data = await res.json();
        alert(data.msg || data.error);
        location.reload();
    } catch(e) {
        alert("Transaction Failed");
        btn.disabled = false;
        btn.innerText = "Authorize Transfer";
    }
}
</script>
        `));
    } catch (e) { res.redirect('/'); }
});

// --- API 接口 ---

app.post('/api/register', async (req,res)=>{
    const {name,pin} = req.body;
    try {
        const hash = await bcrypt.hash(pin,10);
        await client.query("INSERT INTO users VALUES ($1,0,$2)",[name,hash]);
        res.json({msg:"Account Created"});
    } catch(e) { res.json({error:"Name already exists"}); }
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
    const amt = Number(amount);

    if(isNaN(amt) || amt <= 0) return res.json({error:"Invalid Amount"});
    if(from === to) return res.json({error:"Cannot send to self"});

    try {
        await client.query('BEGIN');
        // 排序锁定，防止死锁 (Deadlock Prevention)
        const sortedUsers = [from, to].sort();
        await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE", [sortedUsers[0]]);
        await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE", [sortedUsers[1]]);

        const s = await client.query("SELECT * FROM users WHERE name=$1",[from]);
        const r = await client.query("SELECT * FROM users WHERE name=$1",[to]);

        if(!s.rows[0] || !r.rows[0]) throw new Error("User error");
        
        // 核心安全：校验转账发起人的 PIN
        const isPinValid = await bcrypt.compare(pin, s.rows[0].pin_hash);
        if(!isPinValid) throw new Error("Wrong PIN Code");

        if(Number(s.rows[0].balance) < amt) throw new Error("Insufficient Funds");

        await client.query("UPDATE users SET balance=balance-$1 WHERE name=$2",[amt, from]);
        await client.query("UPDATE users SET balance=balance+$1 WHERE name=$2",[amt, to]);

        await client.query('COMMIT');
        res.json({msg:"Success"});
    } catch (err) {
        await client.query('ROLLBACK');
        res.json({error: err.message});
    }
});

app.listen(port, async ()=>{
    await initDB();
    console.log("Server running on port " + port);
});
