require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let client;

// 数据库初始化
async function initDB() {
    client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            name TEXT PRIMARY KEY,
            balance NUMERIC DEFAULT 0,
            pin_hash TEXT
        )
    `);

    // 默认 admin 初始化
    const admin = await client.query("SELECT * FROM users WHERE name='Admin'");
    if (admin.rows.length === 0) {
        const hash = await bcrypt.hash("888888", 10);
        await client.query(
            "INSERT INTO users VALUES ('Admin', 1000000, $1)",
            [hash]
        );
    }
}

// 📱 手机 UI
function layout(content) {
    return `
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Quantum Wallet</title>
    <style>
    body { font-family: sans-serif; background:#0b0b0b; color:#fff; margin:0; }
    .wrap { max-width:420px; margin:auto; padding:20px; }
    .card { background:#111; padding:20px; border-radius:15px; margin-bottom:20px; }
    .balance { font-size:32px; font-weight:bold; word-wrap: break-word; }
    input, button {
        width:100%; padding:14px; margin:8px 0;
        border-radius:8px; border:none; box-sizing: border-box;
    }
    input { background: #222; color: #fff; outline: none; transition: 0.3s; }
    input:focus { border: 1px solid #f0b90b; }
    button { background:#f0b90b; font-weight:bold; color:#000; cursor:pointer; }
    button:disabled { background:#555; color:#888; }
    </style>
    </head>
    <body>
    <div class="wrap">${content}</div>
    </body>
    </html>`;
}

// 首页
app.get('/', (req, res) => {
    res.send(layout(`
        <h2 style="text-align:center; color:#f0b90b; margin-bottom:30px;">Quantum Wallet</h2>

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

// 钱包页面（增加退出登录与转账密码验证）
app.get('/wallet', async (req, res) => {
    const u = req.query.u;
    if(!u) return res.redirect('/');

    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[u]);
        if(r.rows.length===0) return res.redirect('/');

        const bal = r.rows[0].balance;

        res.send(layout(`
            <h2 style="color:#f0b90b;">${u} 的钱包</h2>

            <div class="card">
                <div style="font-size:12px; color:#888;">账户余额 (Balance)</div>
                <div class="balance">${bal} COIN</div>
                <button onclick="location.href='/'" style="background:#333; color:#fff; margin-top:15px; padding:10px;">退出登录 (Logout)</button>
            </div>

            <div class="card">
                <h3>转账 (Transfer)</h3>
                <input id="to" placeholder="收款人 (Receiver)">
                <input id="amt" type="number" placeholder="金额 (Amount)">
                <input id="auth_pin" type="password" placeholder="请输入你的 PIN 码确认">
                <button id="send-btn" onclick="send()">发送 (Send)</button>
            </div>

<script>
async function send(){
    const to = document.getElementById('to').value;
    const amt = document.getElementById('amt').value;
    const pin = document.getElementById('auth_pin').value;

    if(!to || !amt || !pin) return alert("请填写完整信息");

    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    btn.innerText = "处理中...";

    try {
        const res = await fetch('/api/transfer',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                from:'${u}',
                to: to,
                amount: amt,
                pin: pin
            })
        });
        const data = await res.json();
        alert(data.msg || data.error);
        location.reload();
    } catch(e) {
        alert("网络异常，请重试");
        btn.disabled = false;
        btn.innerText = "发送 (Send)";
    }
}
</script>
        `));
    } catch (e) {
        res.redirect('/');
    }
});

// 注册接口
app.post('/api/register', async (req,res)=>{
    const {name,pin} = req.body;
    if(!name || !pin) return res.json({error:"数据不完整"});

    try {
        const hash = await bcrypt.hash(pin,10);
        await client.query("INSERT INTO users VALUES ($1,0,$2)",[name,hash]);
        res.json({msg:"账号创建成功"});
    } catch(e) {
        res.json({error:"用户名已存在"});
    }
});

// 登录接口
app.post('/api/login', async (req,res)=>{
    const {name,pin} = req.body;
    if(!name || !pin) return res.json({error:"数据不完整"});

    try {
        const r = await client.query("SELECT * FROM users WHERE name=$1",[name]);
        if(r.rows.length===0) return res.json({error:"用户不存在"});

        const ok = await bcrypt.compare(pin,r.rows[0].pin_hash);
        if(!ok) return res.json({error:"密码错误"});

        res.json({ok:true, user:name});
    } catch(e) {
        res.json({error:"系统异常"});
    }
});

// 转账接口（彻底修复逻辑漏洞、负数漏洞与崩溃问题）
app.post('/api/transfer', async (req,res)=>{
    const {from, to, amount, pin} = req.body;

    // 1. 基础拦截：确保金额有效且大于 0
    const amt = Number(amount);
    if(isNaN(amt) || amt <= 0) return res.json({error:"无效的转账金额"});
    if(from === to) return res.json({error:"不能转账给自己"});
    if(!pin) return res.json({error:"需要验证 PIN 码"});

    try {
        await client.query('BEGIN'); // 开启事务

        // 2. 为了防止死锁，始终按照字母顺序给行加锁
        const users = [from, to].sort();
        await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE", [users[0]]);
        await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE", [users[1]]);

        const s = await client.query("SELECT * FROM users WHERE name=$1",[from]);
        const r = await client.query("SELECT * FROM users WHERE name=$1",[to]);

        if(s.rows.length===0) throw new Error("发送方不存在");
        if(r.rows.length===0) throw new Error("收款方不存在");

        // 3. 安全验证：校验发起人的 PIN 码
        const isPinValid = await bcrypt.compare(pin, s.rows[0].pin_hash);
        if(!isPinValid) throw new Error("转账 PIN 码错误");

        // 4. 余额校验
        if(Number(s.rows[0].balance) < amt) throw new Error("余额不足");

        // 5. 执行扣款和加钱
        await client.query("UPDATE users SET balance=balance-$1 WHERE name=$2",[amt, from]);
        await client.query("UPDATE users SET balance=balance+$1 WHERE name=$2",[amt, to]);

        await client.query('COMMIT'); // 提交事务
        res.json({msg:"转账成功"});

    } catch (err) {
        await client.query('ROLLBACK'); // 只要出错，全面回滚撤销
        res.json({error: err.message || "系统错误"});
    }
});

app.listen(port, async ()=>{
    try {
        await initDB();
        console.log("Database connected & System running on port " + port);
    } catch (e) {
        console.error("Failed to start:", e.message);
    }
});
