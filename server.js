const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDB() {
    try {
        await client.connect();
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT (name) DO UPDATE SET balance = 1000000");
        // 修正非 Admin 用户的初始状态，确保总量 1,000,000
        await client.query("UPDATE users SET balance = 0 WHERE name != 'Admin'");
    } catch (e) { console.error("DB Error"); }
}
initDB();

app.use(express.static('.'));

// 主页面渲染
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>MBA2509007 TERMINAL</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500&family=Noto+Sans+SC:wght@300&display=swap" rel="stylesheet">
    <style>
        :root { --gold: #c99c54; --dim: #1a1a1a; --bg: #050505; }
        body { background: var(--bg); color: #fff; font-family: 'Noto Sans SC', sans-serif; margin: 0; overflow: hidden; }
        
        /* 顶部状态栏 */
        .header { height: 60px; border-bottom: 1px solid #222; display: flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.8); }
        .supply { font-family: 'Orbitron'; color: var(--gold); font-size: 20px; letter-spacing: 2px; }

        .container { display: flex; height: calc(100vh - 60px); }
        
        /* 左侧：动态背景 */
        .visuals { flex: 1; position: relative; background: radial-gradient(circle at center, #111 0%, #000 100%); }
        
        /* 右侧：控制面板 */
        .panel { width: 400px; background: #0a0a0a; border-left: 1px solid #222; padding: 40px; display: flex; flex-direction: column; }
        .coin-wrap { text-align: center; margin-bottom: 40px; }
        .coin { width: 160px; height: 160px; border-radius: 50%; border: 2px solid var(--gold); box-shadow: 0 0 30px rgba(201,156,84,0.2); }
        
        .input-group { background: var(--dim); padding: 20px; border-radius: 12px; border: 1px solid #333; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; background: #000; border: 1px solid #444; color: var(--gold); border-radius: 4px; box-sizing: border-box; font-family: 'Orbitron'; }
        
        .btn { width: 100%; padding: 15px; border-radius: 6px; border: none; cursor: pointer; font-family: 'Orbitron'; font-weight: bold; transition: 0.3s; margin-top: 10px; }
        .btn-main { background: var(--gold); color: #000; }
        .btn-sub { background: transparent; color: var(--gold); border: 1px solid var(--gold); margin-top: 20px; }
        .btn:hover { filter: brightness(1.2); transform: translateY(-2px); }

        /* 弹窗样式 */
        #msg { position: fixed; bottom: 20px; right: 20px; padding: 15px 25px; border-radius: 4px; background: var(--dim); border-left: 4px solid var(--gold); display: none; z-index: 100; }
    </style>
</head>
<body>
    <div class="header"><div class="supply">MBA2509007 : 1,000,000 WOW</div></div>
    <div class="container">
        <div class="visuals"><canvas id="gl"></canvas></div>
        <div class="panel">
            <div class="coin-wrap">
                <img src="/古代中国金币设计.jpg" class="coin" onerror="this.src='https://i.imgur.com/8K9M4sK.png'">
                <h2 style="font-family:'Orbitron'; color:var(--gold); margin-top:20px;">SYSTEM TERMINAL</h2>
            </div>
            
            <div class="input-group">
                <input type="text" id="f" placeholder="FROM ID">
                <input type="text" id="t" placeholder="TO ID">
                <input type="number" id="a" placeholder="AMOUNT">
                <button class="btn btn-main" onclick="doAction('pay')">EXECUTE TRANSFER</button>
            </div>
            
            <button class="btn btn-sub" onclick="doAction('balance')">QUERY VAULT</button>
        </div>
    </div>
    <div id="msg"></div>

    <script>
        // 核心逻辑：不再刷新页面，改用异步获取数据
        async function doAction(type) {
            const f = document.getElementById('f').value;
            const t = document.getElementById('t').value;
            const a = document.getElementById('a').value;
            const msgBox = document.getElementById('msg');

            let url = type === 'pay' ? \`/api/pay?f=\${f}&t=\${t}&a=\${a}\` : \`/api/balance?u=\${f}\`;
            
            if(type === 'balance' && !f) return alert("Please enter FROM ID to query.");

            const res = await fetch(url);
            const data = await res.text();
            
            msgBox.style.display = 'block';
            msgBox.innerHTML = data;
            setTimeout(() => { msgBox.style.display = 'none'; }, 5000);
        }

        // 背景动画优化
        const cvs = document.getElementById('gl'); const ctx = cvs.getContext('2d');
        let w, h;
        function resize() { w = cvs.width = cvs.parentElement.offsetWidth; h = cvs.height = cvs.parentElement.offsetHeight; }
        window.onresize = resize; resize();

        function draw() {
            ctx.fillStyle = 'rgba(5,5,5,0.2)'; ctx.fillRect(0,0,w,h);
            for(let i=0; i<3; i++) {
                ctx.strokeStyle = i === 0 ? '#c99c54' : '#222';
                ctx.beginPath();
                ctx.arc(w/2, h/2, (Math.sin(Date.now()/1000 + i)*20) + 150 + i*50, 0, Math.PI*2);
                ctx.stroke();
            }
            requestAnimationFrame(draw);
        }
        draw();
    </script>
</body>
</html>
    `);
});

// 余额 API (返回结果文本而非跳转)
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    let r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 0)', [name]);
        return res.send(\`New Identity Created: \${name} | Balance: 0 WOW\`);
    }
    res.send(\`Vault ID: \${name} | Current Balance: \${r.rows[0].balance} WOW\`);
});

// 转账 API (返回结果文本而非跳转)
app.get('/api/pay', async (req, res) => {
    const { f, t, a } = req.query;
    if(!f || !t || !a) return res.send("Missing Parameters");
    try {
        const amt = Math.abs(parseInt(a));
        const s = await client.query('UPDATE users SET balance = balance - $1 WHERE name = $2 AND balance >= $1', [amt, f]);
        if (s.rowCount === 0) return res.send("Insufficient funds or invalid ID.");
        await client.query('INSERT INTO users (name, balance) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET balance = users.balance + $2', [t, amt]);
        res.send(\`Transfer Success: \${amt} WOW sent to \${t}\`);
    } catch (e) { res.send("System Error"); }
});

app.listen(port);
