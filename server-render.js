const express = require('express');
const { Telegraf } = require('telegraf');

// 从环境变量获取配置（Render 友好）
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';

if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
}

// 配置从环境变量读取（支持多行文本）
const config = {
    welcomeMessage: process.env.WELCOME_MESSAGE || "👋 欢迎使用我的机器人！\n\n发送任意消息测试自动回复功能。",
    defaultReply: process.env.DEFAULT_REPLY || "我收到了你的消息！发送 \"按钮\" 查看按钮功能，或发送 \"帮助\" 查看所有功能。",
    keywords: parseKeywords(process.env.KEYWORDS || "你好=你好呀！很高兴见到你！😊;help=🤖 机器人功能说明：\n\n🔹 自动回复关键词\n🔹 按钮跳转链接\n🔹 随时与我对话\n\n试试发送 \"按钮\" 来查看按钮功能！"),
    buttons: parseButtons(process.env.BUTTONS || "GitHub|https://github.com;Google|https://google.com")
};

function parseKeywords(keywordStr) {
    const keywords = {};
    keywordStr.split(';').forEach(pair => {
        if (pair.trim()) {
            const [key, value] = pair.split('=');
            if (key && value) {
                keywords[key.trim()] = value.trim();
            }
        }
    });
    return keywords;
}

function parseButtons(buttonStr) {
    const buttons = [];
    buttonStr.split(';').forEach(pair => {
        if (pair.trim()) {
            const [text, url] = pair.split('|');
            if ( text && url) {
                buttons.push({ text: text.trim(), url: url.trim() });
            }
        }
    });
    return buttons;
}

const bot = new Telegraf(BOT_TOKEN);

// 基础命令
bot.start((ctx) => ctx.reply(config.welcomeMessage));

// 自动回复关键词
bot.on('message', async (ctx) => {
    if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        const text = ctx.message.text.trim();
        let replied = false;
        
        // 检查关键词
        for (const [keyword, reply] of Object.entries(config.keywords)) {
            if (text.toLowerCase().includes(keyword.toLowerCase())) {
                await ctx.reply(reply);
                replied = true;
                break;
            }
        }
        
        // 默认回复
        if (!replied) {
            await ctx.reply(config.defaultReply);
        }
    }
});

// 按钮功能
bot.hears('按钮', async (ctx) => {
    const keyboard = config.buttons.map(btn => [{ text: btn.text, url: btn.url }]);
    keyboard.push([{ text: '返回主菜单', callback_data: 'menu' }]);
    
    await ctx.reply('点击下面的按钮：', {
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
});

// 回调处理
bot.action('menu', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText('回到主菜单了！发送 "帮助" 查看功能。');
});

// Webhook 处理
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Render 健康检查
app.get('/', (req, res) => {
    res.send('✅ Telegram 机器人运行中！');
});

// 手动设置 webhook 的路由
app.get('/set-webhook', async (req, res) => {
    try {
        const webhookUrl = `${process.env.RENDER_EXTERNAL_URL || `https://${req.get('host')}`}/webhook`;
        await bot.telegram.setWebhook(webhookUrl);
        res.send(`✅ Webhook 设置成功！\nWebhook URL: ${webhookUrl}`);
    } catch (error) {
        console.error('Webhook 设置失败:', error);
        res.status(500).send(`❌ Webhook 设置失败: ${error.message}`);
    }
});

// Telegram Webhook 端点
app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// 后台管理 - 登录页面
app.get('/admin', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>机器人后台管理</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
        </style>
    </head>
    <body>
        <h2>机器人后台管理登录</h2>
        <form action="/admin/login" method="POST">
            <div class="form-group">
                <label for="password">密码:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">登录</button>
        </form>
    </body>
    </html>
    `);
});

// 后台管理 - 登录处理
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        // 登录成功，设置 session（简单实现）
        res.cookie('admin_auth', 'true', { httpOnly: true, maxAge: 3600000 });
        res.redirect('/admin/dashboard');
    } else {
        res.send('<script>alert("密码错误！"); window.history.back();</script>');
    }
});

// 后台管理 - 仪表板
app.get('/admin/dashboard', (req, res) => {
    if (req.cookies.admin_auth !== 'true') {
        return res.redirect('/admin');
    }
    
    // 从环境变量获取当前配置用于显示
    const currentConfig = {
        welcomeMessage: process.env.WELCOME_MESSAGE || "👋 欢迎使用我的机器人！\n\n发送任意消息测试自动回复功能。",
        defaultReply: process.env.DEFAULT_REPLY || "我收到了你的消息！发送 \"按钮\" 查看按钮功能，或发送 \"帮助\" 查看所有功能。",
        keywords: process.env.KEYWORDS || "你好=你好呀！很高兴见到你！😊;help=🤖 机器人功能说明：\n\n🔹 自动回复关键词\n🔹 按钮跳转链接\n🔹 随时与我对话\n\n试试发送 \"按钮\" 来查看按钮功能！",
        buttons: process.env.BUTTONS || "GitHub|https://github.com;Google|https://google.com"
    };
    
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>机器人管理面板</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            textarea, input[type="text"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            button { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; }
            button:hover { background: #218838; }
            .logout { background: #dc3545; }
            .logout:hover { background: #c82333; }
            .section { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
            h3 { margin-top: 0; }
            .instructions { background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <h2>🤖 机器人管理面板</h2>
        <a href="/admin/logout"><button class="logout">退出登录</button></a>
        
        <div class="instructions">
            <strong>💡 使用说明：</strong><br>
            由于 Render 平台限制，配置修改后需要在 Render 环境变量中手动更新对应变量，然后重启服务。
        </div>
        
        <div class="section">
            <h3>欢迎消息 (/start 命令)</h3>
            <div class="form-group">
                <textarea readonly rows="3">${currentConfig.welcomeMessage.replace(/"/g, '&quot;')}</textarea>
                <p><small>修改方法：在 Render 环境变量中设置 WELCOME_MESSAGE</small></p>
            </div>
        </div>
        
        <div class="section">
            <h3>默认回复</h3>
            <div class="form-group">
                <textarea readonly rows="2">${currentConfig.defaultReply.replace(/"/g, '&quot;')}</textarea>
                <p><small>修改方法：在 Render 环境变量中设置 DEFAULT_REPLY</small></p>
            </div>
        </div>
        
        <div class="section">
            <h3>关键词回复</h3>
            <p>格式: 关键词1=回复1;关键词2=回复2</p>
            <div class="form-group">
                <textarea readonly rows="4">${currentConfig.keywords.replace(/"/g, '&quot;')}</textarea>
                <p><small>修改方法：在 Render 环境变量中设置 KEYWORDS</small></p>
            </div>
        </div>
        
        <div class="section">
            <h3>按钮设置</h3>
            <p>格式: 文字1|链接1;文字2|链接2</p>
            <div class="form-group">
                <textarea readonly rows="2">${currentConfig.buttons.replace(/"/g, '&quot;')}</textarea>
                <p><small>修改方法：在 Render 环境变量中设置 BUTTONS</small></p>
            </div>
        </div>
        
        <div class="section">
            <h3>Render 环境变量设置指南</h3>
            <p>要修改配置，请在 Render 控制台的 Environment Variables 中添加/修改以下变量：</p>
            <ul>
                <li><code>WELCOME_MESSAGE</code> - 欢迎消息</li>
                <li><code>DEFAULT_REPLY</code> - 默认回复</li>
                <li><code>KEYWORDS</code> - 关键词回复（格式：关键词=回复;关键词2=回复2）</li>
                <li><code>BUTTONS</code> - 按钮设置（格式：文字|链接;文字2|链接2）</li>
            </ul>
            <p>修改后点击 "Save" 并重启服务即可生效。</p>
        </div>
    </body>
    </html>
    `);
});

// 后台管理 - 退出登录
app.get('/admin/logout', (req, res) => {
    res.clearCookie('admin_auth');
    res.redirect('/admin');
});

// 启动
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
    console.log(`📝 访问 /set-webhook 来自动设置 webhook`);
    console.log(`🔐 后台管理: /admin`);
});