const express = require('express');
const { Telegraf } = require('telegraf');

// 简单的后台管理系统（无文件写入，无复杂依赖）
const config = {
    welcomeMessage: process.env.WELCOME_MESSAGE || "👋 欢迎使用我的机器人！\n\n发送任意消息测试自动回复功能。",
    defaultReply: process.env.DEFAULT_REPLY || "我收到了你的消息！发送 \"按钮\" 查看按钮功能，或发送 \"帮助\" 查看所有功能。",
    keywords: parseKeywords(process.env.KEYWORDS || "你好=你好呀！很高兴见到你！😊;help=🤖 机器人功能说明：\n\n🔹 自动回复关键词\n🔹 按钮跳转链接\n🔹 随时与我对话\n\n试试发送 \"按钮\" 来查看按钮功能！"),
    buttons: parseButtons(process.env.BUTTONS || "GitHub|https://github.com;Google|https://google.com")
};

function parseKeywords(keywordsStr) {
    const keywords = {};
    if (keywordsStr) {
        keywordsStr.split(';').forEach(pair => {
            if (pair.trim()) {
                const [key, value] = pair.split('=');
                if (key && value) {
                    keywords[key.trim()] = value.trim();
                }
            }
        });
    }
    return keywords;
}

function parseButtons(buttonsStr) {
    const buttons = [];
    if (buttonsStr) {
        buttonsStr.split(';').forEach(pair => {
            if (pair.trim()) {
                const [text, url] = pair.split('|');
                if (text && url) {
                    buttons.push({ text: text.trim(), url: url.trim() });
                }
            }
        });
    }
    return buttons;
}

// 从环境变量获取 Bot Token
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
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

// 启动
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
    console.log(`📝 访问 /set-webhook 来自动设置 webhook`);
});