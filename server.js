const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// 模拟数据库：这里存着两个账户的钱
let accounts = {
    "admin": 1000000, // 你（管理员）
    "friend": 0       // 你的朋友
};

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>MBA2509007 Exchange</title></head>
            <body style="background:#0b0e11; color:white; text-align:center; font-family:sans-serif; padding:50px;">
                <h1 style="color:#f0b90b;">MBA2509007 国际交易所</h1>
                
                <div style="background:#1e2329; padding:20px; border-radius:10px; display:inline-block; border: 1px solid #f0b90b; margin:10px;">
                    <h3>我的账户 (Admin)</h3>
                    <h2 style="color:#f0b90b;">${accounts.admin} COIN</h2>
                </div>

                <div style="background:#1e2329; padding:20px; border-radius:10px; display:inline-block; border: 1px solid #28a745; margin:10px;">
                    <h3>朋友账户 (Friend)</h3>
                    <h2 style="color:#28a745;">${accounts.friend} COIN</h2>
                </div>

                <br><br>
                <button onclick="transfer()" style="background:#f0b90b; border:none; padding:15px 30px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:16px;">
                    💸 免费转账给朋友
                </button>

                <script>
                    function transfer() {
                        const amount = prompt("请输入要转账给朋友的金额：");
                        if(amount && !isNaN(amount)) {
                            window.location.href = '/api/transfer?amount=' + amount;
                        }
                    }
                </script>
            </body>
        </html>
    `);
});

// 转账逻辑：从 Admin 扣钱，给 Friend 加钱
app.get('/api/transfer', (req, res) => {
    const amount = parseInt(req.query.amount);
    if (accounts.admin >= amount) {
        accounts.admin -= amount;
        accounts.friend += amount;
        res.send("<h1>✅ 转账成功！</h1><p>已成功转出 " + amount + " 币。</p><a href='/'>返回首页</a>");
    } else {
        res.send("<h1>❌ 余额不足！</h1><p>你没有那么多币可以转账。</p><a href='/'>返回首页</a>");
    }
});

app.listen(port, () => console.log('交易所升级版运行中'));
