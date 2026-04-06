const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Render 会自动注入此环境变量
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static('public'));

// 转账接口：包含行级锁与事务回滚 (L - Ledger Integrity)
app.post('/api/transfer', async (req, res) => {
    const { senderId, receiverUsername, amount, pin } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN'); // 开启事务

        // 1. 锁定并获取发送者账户 (D - Database Lock)
        const senderRes = await client.query(
            'SELECT * FROM users WHERE id = $1 FOR UPDATE', [senderId]
        );
        const sender = senderRes.rows[0];

        // 2. 验证 PIN (B - Bcrypt Security)
        const pinMatch = await bcrypt.compare(pin, sender.pin_hash);
        if (!pinMatch || sender.balance < amount) {
            throw new Error('INSUFFICIENT_FUNDS_OR_INVALID_PIN');
        }

        // 3. 锁定并获取接收者账户
        const receiverRes = await client.query(
            'SELECT * FROM users WHERE username = $1 FOR UPDATE', [receiverUsername]
        );
        if (receiverRes.rows.length === 0) throw new Error('RECEIVER_NOT_FOUND');

        // 4. 执行账本变更
        await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, senderId]);
        await client.query('UPDATE users SET balance = balance + $1 WHERE username = $2', [amount, receiverUsername]);

        await client.query('COMMIT'); // 提交事务
        res.json({ status: "LEDGER SETTLED", message: "TRANSACTION VERIFIED." });

    } catch (e) {
        await client.query('ROLLBACK'); // 报错自动回滚
        res.status(400).json({ status: "ERROR", message: e.message });
    } finally {
        client.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MBA_TERMINAL_ONLINE_AT_${PORT}`));
