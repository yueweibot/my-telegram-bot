const express = require('express');
const { Telegraf } = require('telegraf');

// 从环境变量获取配置
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';

if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// 基础功能
bot.start((ctx) => ctx.reply('👋 欢迎使用我的机器人！'));
bot.hears(/你好|hello/i, (ctx) => ctx.reply('你好呀！很高兴见到你！😊'));
bot.hears('按钮', (ctx) => {
    ctx.reply('点击下面的按钮：', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'GitHub', url: 'https://github.com' }],
                [{ text: '返回主菜单', callback_data: 'menu' }]
            ]
        }
    });
});
bot.action('menu', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText('回到主菜单了！');
});
bot.on('message', (ctx) => {
    if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        ctx.reply('我收到了你的消息！发送 "按钮" 查看按钮功能。');
    }
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/', (req, res) => {
    res.send('✅ Telegram 机器人运行中！');
});

// Webhook 设置
app.get('/set-webhook', async (req, res) => {
    try {
        const webhookUrl = `${process.env.RENDER_EXTERNAL_URL || `https://${req.get('host')}`}/webhook`;
        await bot.telegram.setWebhook(webhookUrl);
        res.send(`✅ Webhook 设置成功！`);
    } catch (error) {
        res.status(500).send(`❌ Webhook 设置失败: ${error.message}`);
    }
});

// Webhook 接收
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// 简单后台（仅密码验证）
app.get('/admin', (req, res) => {
    res.send(`
    <form method="POST">
        <input type="password" name="password" placeholder="密码" required>
        <button type="submit">登录</button>
    </form>
    `);
});

app.post('/admin', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        res.send('✅ 登录成功！<br>当前功能：基础聊天、按钮跳转<br>要修改功能，请在 Render 环境变量中设置相关参数。');
    } else {
        res.send('❌ 密码错误！<a href="/admin">返回</a>');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
});