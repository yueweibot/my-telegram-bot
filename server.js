const express = require('express');
const { Telegraf } = require('telegraf');

// 从环境变量获取配置（Render 友好）
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default';

// 配置参数（从环境变量读取）
const WELCOME_MESSAGE = process.env.WELCOME_MESSAGE || '👋 欢迎使用我的机器人！';
const DEFAULT_REPLY = process.env.DEFAULT_REPLY || '我收到了你的消息！';
const KEYWORD_REPLY = process.env.KEYWORD_REPLY || '你好呀！很高兴见到你！😊';

if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// 机器人功能
bot.start((ctx) => ctx.reply(WELCOME_MESSAGE));
bot.hears(/你好|hello/i, (ctx) => ctx.reply(KEYWORD_REPLY));
bot.hears('按钮', (ctx) => {
    const githubUrl = process.env.BUTTON_URL1 || 'https://github.com';
    const googleUrl = process.env.BUTTON_URL2 || 'https://google.com';
    const buttonText1 = process.env.BUTTON_TEXT1 || 'GitHub';
    const buttonText2 = process.env.BUTTON_TEXT2 || 'Google';
    
    ctx.reply('点击下面的按钮：', {
        reply_markup: {
            inline_keyboard: [
                [{ text: buttonText1, url: githubUrl }],
                [{ text: buttonText2, url: googleUrl }]
            ]
        }
    });
});
bot.on('message', (ctx) => {
    if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        ctx.reply(DEFAULT_REPLY);
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

// 后台管理（只读显示当前配置）
app.get('/admin', (req, res) => {
    res.send(`
    <form method="POST">
        <h3>机器人后台管理</h3>
        <input type="password" name="password" placeholder="输入密码" required style="width:200px; padding:8px; margin:10px;">
        <button type="submit" style="padding:8px 16px; background:#007bff; color:white; border:none; cursor:pointer;">登录</button>
    </form>
    `);
});

app.post('/admin', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        // 显示当前配置（只读）
        const configHtml = `
        <h3>✅ 登录成功！</h3>
        <p><strong>当前配置：</strong></p>
        <ul>
            <li>欢迎消息: ${WELCOME_MESSAGE}</li>
            <li>默认回复: ${DEFAULT_REPLY}</li>
            <li>关键词回复: ${KEYWORD_REPLY}</li>
            <li>按钮1: ${process.env.BUTTON_TEXT1 || 'GitHub'} → ${process.env.BUTTON_URL1 || 'https://github.com'}</li>
            <li>按钮2: ${process.env.BUTTON_TEXT2 || 'Google'} → ${process.env.BUTTON_URL2 || 'https://google.com'}</li>
        </ul>
        <p><strong>💡 要修改配置：</strong><br>
        在 Render 环境变量中添加以下变量，然后重启服务：</p>
        <ul>
            <li>WELCOME_MESSAGE - 欢迎消息</li>
            <li>DEFAULT_REPLY - 默认回复</li>
            <li>KEYWORD_REPLY - 关键词回复</li>
            <li>BUTTON_TEXT1, BUTTON_URL1 - 按钮1</li>
            <li>BUTTON_TEXT2, BUTTON_URL2 - 按钮2</li>
        </ul>
        <a href="/admin" style="margin-top:20px; display:inline-block; padding:8px 16px; background:#6c757d; color:white; text-decoration:none;">返回登录</a>
        `;
        res.send(configHtml);
    } else {
        res.send('❌ 密码错误！<a href="/admin">返回重试</a>');
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
});