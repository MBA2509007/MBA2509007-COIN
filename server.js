const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// 核心数据库：存储所有人的钱
let db = {
    "Admin": 1000000 // 你初始有100万
};

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>MBA2509007 Wallet System</title></head>
            <body style="background:#0b0e11; color:white; text-align:center; font-family:sans-serif; padding:50px;">
                <h1 style="color:#f0b90b;">MBA2509007 个人钱包系统</h1>
                
                <div style="background:#1e2329; padding:20px; border-radius:10px; display:inline-block; border: 1px solid #f0b90b;">
                    <h3>当前注册钱包总数: ${Object.keys(db).length} 个</h3>
                    <button onclick="openWallet()" style="background:#f0b90b; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; margin:5px;">🔍 查看/开通我的钱包</button>
                    <button onclick="sendMoney()" style="background:#28a745; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; font-weight:bold; color:white; margin:5px;">💸 立即转账</button>
                </div>

                <div id="result" style="margin-top:20px; color:#f0b90b; font-size:20px;"></div>

                <script>
                    function openWallet() {
                        const name = prompt("请输入你的名字开通/查看钱包：");
                        if(name) { window.location.href = '/api/balance?user=' + name; }
                    }
                    function sendMoney() {
                        const from = prompt("你的名字：");
                        const to = prompt("转账给谁：");
                        const amount = prompt("转账金额：");
                        if(from && to && amount) {
                            window.location.href = '/api/transfer?from=' + from + '&to=' + to + '&amount=' + amount;
                        }
                    }
                </script>
            </body>
        </html>
    `);
});

// 接口：查看余额（如果没有这个用户，就自动帮他开户送10个币）
app.get('/api/balance', (req, res) => {
    const user = req.query.user;
    if (!db[user]) {
        db[user] = 10; // 新用户自动开户送10个币
    }
    res.send("<h1>" + user + " 的钱包</h1><h2>余额: " + db[user] + " COIN</h2><a href='/'>返回首页</a>");
});

// 接口：转账逻辑
app.get('/api/transfer', (req, res) => {
    const { from, to, amount } = req.query;
    const val = parseInt(amount);
    if (!db[from] || db[from] < val) {
        res.send("<h1>❌ 转账失败！余额不足或账户不存在</h1><a href='/'>返回首页</a>");
    } else {
        if (!db[to]) db[to] = 0; // 如果接收方还没开户，自动帮他开户
        db[from] -= val;
        db[to] += val;
        res.send("<h1>✅ 转账成功！</h1><p>" + from + " 已转账 " + val + " 给 " + to + "</p><a href='/'>返回首页</a>");
    }
});

app.listen(port, () => console.log('多用户系统已启动'));
