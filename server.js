const express = require('express');
const { Client } = require('pg');
const app = express();
const port = process.env.PORT || 3000;

// 1. 自动读取你在 Render 设置的 DATABASE_URL “钥匙”
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Render 数据库必须开启 SSL
});

// 2. 初始化数据库：如果表不存在就创建它
async function initDatabase() {
    try {
        await client.connect();
        console.log("✅ 成功连接到永久数据库！");
        // 创建 users 表：name 是名字（唯一），balance 是余额
        await client.query('CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, balance INTEGER)');
        // 确保管理员 Admin 账户存在，初始 1,000,000 币
        await client.query("INSERT INTO users (name, balance) VALUES ('Admin', 1000000) ON CONFLICT DO NOTHING");
    } catch (err) {
        console.error("❌ 数据库连接失败:", err);
    }
}
initDatabase();

// 3. 首页界面
app.get('/', async (req, res) => {
    try {
        const result = await client.query('SELECT COUNT(*) FROM users');
        res.send(`
            <html>
                <head><title>MBA2509007 永久银行</title></head>
                <body style="background:#0b0e11; color:white; text-align:center; font-family:sans-serif; padding:50px;">
                    <h1 style="color:#f0b90b;">💰 MBA2509007 永久交易所</h1>
                    <div style="background:#1e2329; padding:20px; border-radius:10px; display:inline-block; border: 1px solid #f0b90b;">
                        <h3>系统状态：运行中 (已连接数据库)</h3>
                        <p>目前已有户头：<span style="color:#f0b90b; font-weight:bold;">${result.rows[0].count}</span> 个</p>
                        <hr style="border:0.5px solid #333;">
                        <button onclick="openWallet()" style="background:#f0b90b; border:none; padding:12px 25px; border-radius:5px; cursor:pointer; font-weight:bold; margin:5px;">🔍 开户 / 查账</button>
                        <button onclick="payMoney()" style="background:#28a745; border:none; padding:12px 25px; border-radius:5px; cursor:pointer; font-weight:bold; color:white; margin:5px;">💸 永久转账</button>
                    </div>
                    <script>
                        function openWallet() {
                            const name = prompt("请输入你的名字：");
                            if(name) window.location.href = '/api/balance?u=' + encodeURIComponent(name);
                        }
                        function payMoney() {
                            const f = prompt("你的名字：");
                            const t = prompt("转给谁：");
                            const a = prompt("转多少钱：");
                            if(f && t && a) window.location.href = '/api/pay?f='+encodeURIComponent(f)+'&t='+encodeURIComponent(t)+'&a='+a;
                        }
                    </script>
                </body>
            </html>
        `);
    } catch (err) {
        res.send("数据库读取错误，请检查 Render 的 Environment 设置。");
    }
});

// 4. 开户与余额查询接口
app.get('/api/balance', async (req, res) => {
    const name = req.query.u;
    const r = await client.query('SELECT balance FROM users WHERE name = $1', [name]);
    if (r.rows.length === 0) {
        // 新人开户，默认送 10 币
        await client.query('INSERT INTO users (name, balance) VALUES ($1, 10)', [name]);
        res.send("<h1>🎉 " + name + " 开户成功！</h1><h2>已赠送 10 个初始
