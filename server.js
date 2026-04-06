const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 数据库连接配置 (针对 Render 优化)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Render 必须开启 SSL 才能连接
    }
});

app.use(express.json());
app.use(express.static('public')); // 确保你的 index.html 在 public 文件夹里

// --- 核心逻辑 A: 管理员协议 (获取系统总额) ---
app.get('/api/system/status', async (req, res) => {
    try {
        const result = await pool.query('SELECT SUM(balance) as total FROM users');
        res.json({
            status: "NODE_ACTIVE",
            location: "PENANG_TERMINAL",
            total_supply: "1,000,000 COIN",
            valuation: "1 COIN = 100 USD"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 核心逻辑 B: 账户查账 (C - Coin Valuation) ---
app.get('/api/balance/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const result = await pool.query('SELECT balance FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: "USER_NOT_FOUND" });

        const balance = parseFloat(result.rows[0].balance);
        res.json({
            username: username,
            coin_balance: balance,
            usd_valuation: (balance * 100).toLocaleString() // 1 COIN = 100 USD
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 核心逻辑 D: 安全转账 (D - Database Lock & L - Ledger Integrity) ---
app.post('/api/transfer', async (req, res) => {
    const { sender_id, receiver_username, amount, pin } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // 开启事务

        // 1. 锁定发送者并验证 PIN (B - Bcrypt Security)
        const senderRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [sender_id]);
        if (senderRes.rows.length === 0) throw new Error('SENDER_NOT_FOUND');
        
        const sender = senderRes.rows[0];
        const validPin = await bcrypt.compare(pin.toString(), sender.pin_hash);
        if (!validPin) throw new Error('INVALID_SECURITY_PIN');

        // 2. 检查余额
        if (parseFloat(sender.balance) < parseFloat(amount)) throw new Error('INSUFFICIENT_LEDGER_FUNDS');

        // 3. 锁定接收者
        const receiverRes = await client.query('SELECT * FROM users WHERE username = $1 FOR UPDATE', [receiver_username]);
        if (receiverRes.rows.length === 0) throw new Error('RECEIVER_NODE_NOT_FOUND');
        const receiver = receiverRes.rows[0];

        // 4. 执行账本变更 (E - Encryption Phrases)
        await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, sender_id]);
        await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, receiver.id]);

        // 5. 记录交易流水
        await client.query(
            'INSERT INTO transactions (sender_id, receiver_id, amount) VALUES ($1, $2, $3)',
            [sender_id, receiver.id, amount]
        );

        await client.query('COMMIT'); // 提交事务
        res.json({ status: "LEDGER SETTLED", message: "TRANSACTION VERIFIED." });

    } catch (err) {
        await client.query('ROLLBACK'); // 报错自动回滚，确保一分钱不差
        res.status(400).json({ status: "TRANSACTION_FAILED", reason: err.message });
    } finally {
        client.release();
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`
    ===========================================
    MBA_EXCHANGE_TERMINAL ONLINE
    PORT: ${port}
    NODE: PENANG_MAIN_SERVER
    STATUS: LEDGER_READY
    ===========================================
    `);
});
