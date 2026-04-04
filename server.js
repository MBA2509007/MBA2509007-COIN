const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

let balance = 0; 

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>MBA2509007 COIN</title></head>
            <body style="background:#0b0e11; color:white; text-align:center; font-family:sans-serif; padding:50px;">
                <h1 style="color:#f0b90b;">MBA2509007 COIN 交易所</h1>
                <div style="background:#1e2329; padding:20px; border-radius:10px; display:inline-block; border: 1px solid #f0b90b;">
                    <h2>我的资产: <span id="bal">${balance}</span> MBA2509007</h2>
                    <button onclick="mint()" style="background:#f0b90b; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold;">管理员印钞 (Mint)</button>
                </div>
                <script>
                    async function mint() {
                        const pwd = prompt("请输入管理员暗号：");
                        const val = prompt("请输入数量：");
                        if(pwd && val) { window.location.href = '/api/mint?pwd=' + pwd + '&val=' + val; }
                    }
                </script>
            </body>
        </html>
    `);
});

app.get('/api/mint', (req, res) => {
    const { pwd, val } = req.query;
    if (pwd === "mba666") { 
        balance += parseInt(val);
        res.send("<h1>增发成功！</h1><a href='/'>返回首页</a>");
    } else {
        res.send("<h1>暗号错误！</h1><a href='/'>返回首页</a>");
    }
});

app.listen(port, () => console.log('MBA2509007 COIN 运行中'));
