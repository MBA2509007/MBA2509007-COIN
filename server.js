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

    // 默认 admin
    const admin = await client.query("SELECT * FROM users WHERE name='Admin'");
    if (admin.rows.length === 0) {
        const hash = await bcrypt.hash("888888", 10);
        await client.query(
            "INSERT INTO users VALUES ('Admin', 1000000, $1)",
            [hash]
        );
    }
}

// 📱 手机 UI（全新）
function layout(content) {
    return `
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
    body { font-family: sans-serif; background:#0b0b0b; color:#fff; margin:0; }
    .wrap { max-width:420px; margin:auto; padding:20px; }
    .card { background:#111; padding:20px; border-radius:15px; margin-bottom:20px; }
    .balance { font-size:32px; font-weight:bold; }
    input, button {
        width:100%; padding:12px; margin:8px 0;
        border-radius:8px; border:none;
    }
    button { background:#f0b90b; font-weight:bold; }
    </style>
    </head>
    <body>
    <div class="wrap">${content}</div>
    </body>
    </html>`;
}

// 首页（无排行榜）
app.get('/', (req, res) => {
    res.send(layout(`
        <h2>Quantum Wallet</h2>

        <div class="card">
            <h3>Login</h3>
            <input id="name" placeholder="Name">
            <input id="pin" placeholder="PIN" type="password">
            <button onclick="login()">Login</button>
        </div>

        <div class="card">
            <h3>Register</h3>
            <input id="rname" placeholder="New Name">
            <input id="rpin" placeholder="PIN" type="password">
            <button onclick="register()">Register</button>
        </div>

<script>
async function login(){
    const res = await fetch('/api/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            name:document.getElementById('name').value,
            pin:document.getElementById('pin').value
        })
    });
    const data = await res.json();
    if(data.ok) location.href='/wallet?u='+data.user;
    else alert(data.error);
}

async function register(){
    const res = await fetch('/api/register',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            name:document.getElementById('rname').value,
            pin:document.getElementById('rpin').value
        })
    });
    const data = await res.json();
    alert(data.msg || data.error);
}
</script>
    `));
});

// 钱包页面（手机优化）
app.get('/wallet', async (req, res) => {
    const u = req.query.u;
    const r = await client.query("SELECT * FROM users WHERE name=$1",[u]);
    if(r.rows.length===0) return res.redirect('/');

    const bal = r.rows[0].balance;

    res.send(layout(`
        <h2>${u}</h2>

        <div class="card">
            <div class="balance">${bal} COIN</div>
        </div>

        <div class="card">
            <h3>Transfer</h3>
            <input id="to" placeholder="Receiver">
            <input id="amt" placeholder="Amount">
            <button onclick="send()">Send</button>
        </div>

<script>
async function send(){
    const res = await fetch('/api/transfer',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            from:'${u}',
            to:document.getElementById('to').value,
            amount:document.getElementById('amt').value
        })
    });
    const data = await res.json();
    alert(data.msg || data.error);
    location.reload();
}
</script>
    `));
});

// 注册
app.post('/api/register', async (req,res)=>{
    const {name,pin} = req.body;
    const hash = await bcrypt.hash(pin,10);

    try{
        await client.query("INSERT INTO users VALUES ($1,0,$2)",[name,hash]);
        res.json({msg:"created"});
    }catch{
        res.json({error:"name exists"});
    }
});

// 登录
app.post('/api/login', async (req,res)=>{
    const {name,pin} = req.body;

    const r = await client.query("SELECT * FROM users WHERE name=$1",[name]);
    if(r.rows.length===0) return res.json({error:"no user"});

    const ok = await bcrypt.compare(pin,r.rows[0].pin_hash);
    if(!ok) return res.json({error:"wrong pin"});

    res.json({ok:true,user:name});
});

// 转账（带事务）
app.post('/api/transfer', async (req,res)=>{
    const {from,to,amount} = req.body;

    await client.query('BEGIN');

    const s = await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE",[from]);
    const r = await client.query("SELECT * FROM users WHERE name=$1 FOR UPDATE",[to]);

    if(s.rows.length===0 || r.rows.length===0){
        await client.query('ROLLBACK');
        return res.json({error:"user error"});
    }

    if(Number(s.rows[0].balance) < amount){
        await client.query('ROLLBACK');
        return res.json({error:"no money"});
    }

    await client.query("UPDATE users SET balance=balance-$1 WHERE name=$2",[amount,from]);
    await client.query("UPDATE users SET balance=balance+$1 WHERE name=$2",[amount,to]);

    await client.query('COMMIT');

    res.json({msg:"success"});
});

app.listen(port, async ()=>{
    await initDB();
    console.log("running");
});
