const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// 1. 配置数据库（增加连接池和容错）
const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000, // 增加到10秒防止超时
};

let client = null;
let isDbReady = false;

// 2. 异步初始化函数（关键：不阻塞主进程）
async function connectToDb() {
    console.log("MBA_SYSTEM: 正在尝试连接数据库...");
    client = new Client(dbConfig);
    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER, pin TEXT)');
        await client.query('CREATE TABLE IF NOT EXISTS logs (id SERIAL PRIMARY KEY, sender TEXT, receiver TEXT, amount INTEGER, time TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
        await client.query("INSERT INTO users (name, balance, pin) VALUES ('Admin', 1000000, '888888') ON CONFLICT (name) DO NOTHING");
        isDbReady = true;
        console.log("MBA_SYSTEM: 数据库已就绪，总量已锁定。");
    } catch (err) {
        console.error("MBA_SYSTEM_ERROR: 数据库连接失败。原因：", err.message);
        // 5秒后尝试重连，防止进程退出
        setTimeout(connectToDb, 5000);
    }
}

// 3. 基础布局
const getLayout = (content) => `
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Roboto+Mono&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #f0b90b; --bg: #050505; --panel: #0d0d0d; --border: #222; }
        body { background: var(--bg); color: #fff; font-family: 'Roboto Mono', monospace; margin: 0; overflow: hidden; }
        .header { position: fixed; top: 0; width: 100%; height: 60px; background: rgba(0,0,0,0.9); border-bottom: 1px solid var(--border); display: flex; justify-content: center; align-items: center; z-index: 100; }
        .supply { font-family: 'Orbitron'; font-size: 16px; color: var(--gold); letter-spacing: 2px; }
        .container { display: flex; height: 100vh; padding-top: 60px; box-sizing: border-box; }
        .visual { flex: 1; position: relative; background: #000; }
        .sidebar { width: 400px; background: var(--panel); border-left: 1px solid var(--border); padding: 25px; display: flex; flex-direction: column; overflow-y: auto; }
        .card { background: #111; border: 1px solid var(--border); padding: 18px; border-radius: 8px; margin-bottom: 20px; }
        input { width: 100%; padding: 12px; margin-bottom: 10px; background: #000; border: 1px solid #333; color: var(--gold); border-radius: 4px; box-sizing: border-box; font-family: inherit; outline: none; }
        .btn { width: 100%; padding: 14px; border-radius: 4px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.3s; margin-top: 5px; }
        .btn-gold { background: var(--gold); color: #000; }
        .btn-outline { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
        .log-item { font-size: 11px; padding: 8px 0; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; }
        .tab { background: #222; color: #666; border: none; padding: 8px; cursor: pointer; font-family: 'Orbitron'; font-size: 10px; border-radius: 4px; flex: 1; margin: 0 5px; }
        .tab.active { background: var(--gold); color: #000; }
        #status { position: absolute; top: 70px; left: 10px; font-size: 10px; color: var(--gold); }
    </style>
</head>
<body>${content}</body>
</html>`;

// 4. 路由处理
app.get('/', async (req, res) => {
    if (!isDbReady) return res.send(getLayout("<div style='display:flex;justify-content:center;align-items:center;height:100vh;color:var(--gold);'>MBA NODE INITIALIZING... REFRESH IN 5s</div>"));
    
    try {
        const stats = await client.query('SELECT SUM(balance) as b FROM users');
        const logs = await client.query('SELECT * FROM logs ORDER BY time DESC LIMIT 10');
        const total = stats.rows[0].b || 1000000;
        let logHtml = logs.rows.map(l => `<div class="log-item"><span>${l.sender} > ${l.receiver}</span><b>${l.amount}</b></div>`).join('');

        res.send(getLayout(`
            <div class="header"><div class="supply">MBA2509007 SUPPLY: ${total.toLocaleString()}</div></div>
            <div id="status">DATABASE: ONLINE</div>
            <div class="container">
                <div class="visual"><canvas id="g"></canvas></div>
                <div class="sidebar">
                    <div style="display:flex; margin-bottom:15px;">
                        <button class="tab active" id="t1" onclick="sw('tx')">TX</button>
                        <button class="tab" id="t2" onclick="sw('rg')">REG</button>
                    </div>
                    <div id="box-tx" class="card">
                        <input type="text" id="f" placeholder="YOUR ID">
                        <input type="password" id="p" placeholder="PIN">
                        <input type="text" id="t" placeholder="TO ID">
                        <input type="number" id="a" placeholder="AMOUNT">
                        <button class="btn btn-gold" onclick="send()">EXECUTE</button>
                        <button class="btn btn-outline" style="margin-top:10px;" onclick="check()">VAULT</button>
                    </div>
                    <div id="box-rg" class="card" style="display:none;">
                        <input type="text" id="rn" placeholder="NEW ID">
                        <input type="password" id="rp" placeholder="SET PIN">
                        <button class="btn btn-gold" onclick="reg()">INITIALIZE</button>
                    </div>
                    <div style="font-family:'Orbitron'; font-size:10px; color:#444; margin-bottom:10px;">LEDGER_STATUS</div>
                    <div style="flex:1; overflow-y:auto;">${logHtml || 'AWAITING ACTIVITY...'}</div>
                </div>
            </div>
            <script>
                const c=document.getElementById('g'), x=c.getContext('2d'); let w,h,p=[];
                function resize(){ w=c.width=c.parentElement.offsetWidth; h=c.height=c.parentElement.offsetHeight; p=[]; for(let i=0;i<400;i++){ let t=Math.random()*Math.PI*2, a=Math.acos(Math.random()*2-1); p.push({x:Math.sin(a)*Math.cos(t),y:Math.sin(a)*Math.sin(t),z:Math.cos(a)}); } }
                let r=0; function draw(){ x.fillStyle='#000'; x.fillRect(0,0,w,h); r+=0.003; x.save(); x.translate(w/2,h/2); p.forEach(i=>{ let x1=i.x*Math.cos(r)-i.z*Math.sin(r),z1=i.z*Math.cos(r)+i.x*Math.sin(r); x.fillStyle="rgba(240,185,11,"+(z1+1)/2+")"; x.beginPath(); x.arc(x1*Math.min(w,h)*0.4,i.y*Math.min(w,h)*0.4,(z1+1.2)*1.2,0,Math.PI*2); x.fill(); }); x.restore(); requestAnimationFrame(draw); }
                window.onresize=resize; resize(); draw();
                function sw(m){ document.getElementById('box-tx').style.display=m==='tx'?'block':'none'; document.getElementById('box-rg').style.display=m==='rg'?'block':'none'; document.getElementById('t1').className=m==='tx'?'tab active':'tab'; document.getElementById('t2').className=m==='rg'?'tab active':'tab'; }
                function reg(){ const n=document.getElementById('rn').value, p=document.getElementById('rp').value; if(n&&p) location.href=\`/api/reg?u=\${encodeURIComponent(n)}&p=\${p}\`; }
                function send(){ const f=document.getElementById('f').value, p=document.getElementById('p').value, t=document.getElementById('t').value, a=document.getElementById('a').value; if(f&&p&&t&&a) location.href=\`/api/pay?f=\${encodeURIComponent(f)}&p=\${p}&t=\${encodeURIComponent(t)}&a=\${a}\`; }
                function check(){ const n=prompt("ID?"); if(n) location.href='/api/bal?u='+encodeURIComponent(n); }
            </script>
        `));
    } catch (e) { res.send("DB ERROR: PLEASE REFRESH"); }
});

// API 实现
app.get('/api/reg', async (req, res) => {
    try { await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, 0, $2)', [req.query.u, req.query.p]); res.send("<script>alert('Success');location.href='/';</script>"); }
    catch (e) { res.send("<script>alert('Error');location.href='/';</script>"); }
});

app.get('/api/pay', async (req, res) => {
    const { f, p, t, a } = req.query;
    try {
        const amt = Math.abs(parseInt(a));
        const auth = await client.query('SELECT * FROM users WHERE name = $1 AND pin = $2', [f, p]);
        if(auth.rows.length === 0) return res.send("<script>alert('PIN Error');location.href='/';</script>");
        const dec = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if(dec.rowCount === 0) return res.send("<script>alert('No Balance');location.href='/';</script>");
        await client.query('INSERT INTO users (name, balance, pin) VALUES ($1, $2, "123456") ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        await client.query('INSERT INTO logs (sender, receiver, amount) VALUES ($1, $2, $3)', [f, t, amt]);
        res.redirect('/');
    } catch (e) { res.redirect('/'); }
});

app.get('/api/bal', async (req, res) => {
    try {
        const r = await client.query('SELECT balance FROM users WHERE name = $1', [req.query.u]);
        const b = r.rows.length ? r.rows[0].balance : 0;
        res.send(getLayout(`<div style="display:flex;justify-content:center;align-items:center;height:100vh;"><div class="card" style="width:300px;text-align:center;border:1px solid var(--gold);"><div style="font-family:'Orbitron';color:var(--gold);">${req.query.u}</div><div style="font-size:3rem;margin:20px 0;font-family:'Orbitron';">${b}</div><button class="btn btn-outline" onclick="location.href='/'">RETURN</button></div></div>`));
    } catch (e) { res.redirect('/'); }
});

// 5. 核心：优先启动 Web 服务器
app.listen(port, () => {
    console.log(`WEB_SERVER_ALIVE: 端口 ${port}`);
    connectToDb(); // 异步启动数据库，不干扰主线程
});
