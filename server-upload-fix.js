const express = require('express');
const { Telegraf } = require('telegraf');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 从环境变量获取配置
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;

if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Firebase 读取函数
function readFromFirebase(path, callback) {
    if (!FIREBASE_API_KEY || !FIREBASE_DATABASE_URL) {
        const defaultConfig = {
            welcomeMessage: "👋 欢迎使用我的机器人！",
            keywords: { "你好": "你好呀！很高兴见到你！😊" },
            buttons: [{ text: "GitHub", url: "https://github.com" }],
            defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
        };
        callback(null, defaultConfig);
        return;
    }
    
    const url = `${FIREBASE_DATABASE_URL}${path}.json?auth=${FIREBASE_API_KEY}`;
    
    https.get(url, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
            responseBody += chunk;
        });
        res.on('end', () => {
            if (responseBody === 'null') {
                const defaultConfig = {
                    welcomeMessage: "👋 欢迎使用我的机器人！",
                    keywords: { "你好": "你好呀！很高兴见到你！😊" },
                    buttons: [{ text: "GitHub", url: "https://github.com" }],
                    defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
                };
                callback(null, defaultConfig);
            } else {
                callback(null, JSON.parse(responseBody));
            }
        });
    }).on('error', (error) => {
        console.error('Firebase 读取错误:', error);
        const defaultConfig = {
            welcomeMessage: "👋 欢迎使用我的机器人！",
            keywords: { "你好": "你好呀！很高兴见到你！😊" },
            buttons: [{ text: "GitHub", url: "https://github.com" }],
            defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
        };
        callback(null, defaultConfig);
    });
}

// Firebase 写入函数
function writeToFirebase(path, data, callback) {
    if (!FIREBASE_API_KEY || !FIREBASE_DATABASE_URL) {
        console.log('Firebase 配置不完整，跳过写入');
        callback(null, data);
        return;
    }
    
    const url = `${FIREBASE_DATABASE_URL}${path}.json?auth=${FIREBASE_API_KEY}`;
    const postData = JSON.stringify(data);
    
    const options = {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    const req = https.request(url, options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
            responseBody += chunk;
        });
        res.on('end', () => {
            callback(null, JSON.parse(responseBody));
        });
    });
    
    req.on('error', (error) => {
        console.error('Firebase 写入错误:', error);
        callback(error, null);
    });
    
    req.write(postData);
    req.end();
}

// 处理媒体消息
function sendMediaMessage(ctx, mediaType, mediaUrl) {
    try {
        if (mediaType === '图片') {
            ctx.replyWithPhoto(mediaUrl);
        } else if (mediaType === '视频') {
            ctx.replyWithVideo(mediaUrl);
        } else if (mediaType === '文件') {
            ctx.replyWithDocument(mediaUrl);
        }
    } catch (error) {
        console.error('发送媒体消息失败:', error);
        ctx.reply('抱歉，无法发送该媒体文件。');
    }
}

// 消息处理
bot.start((ctx) => {
    readFromFirebase('/config', (error, config) => {
        if (error) {
            ctx.reply('👋 欢迎使用我的机器人！');
        } else {
            ctx.reply(config.welcomeMessage || '👋 欢迎使用我的机器人！');
        }
    });
});

bot.on('message', async (ctx) => {
    if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        const text = ctx.message.text.trim();
        readFromFirebase('/config', (error, config) => {
            if (error) {
                ctx.reply('我收到了你的消息！发送 "按钮" 查看按钮功能。');
                return;
            }
            
            let replied = false;
            // 检查关键词
            if (config.keywords) {
                for (const [keyword, reply] of Object.entries(config.keywords)) {
                    if (text.toLowerCase().includes(keyword.toLowerCase())) {
                        // 检查是否包含媒体标签
                        if (reply.includes('[图片:') || reply.includes('[视频:') || reply.includes('[文件:')) {
                            // 提取媒体信息
                            const mediaRegex = /\[(图片|视频|文件):([^\]]+)\]/g;
                            let match;
                            const parts = [];
                            let lastIndex = 0;
                            
                            while ((match = mediaRegex.exec(reply)) !== null) {
                                // 添加文本部分
                                if (match.index > lastIndex) {
                                    parts.push({ type: 'text', content: reply.substring(lastIndex, match.index) });
                                }
                                // 添加媒体部分
                                parts.push({ type: 'media', mediaType: match[1], url: match[2] });
                                lastIndex = match.index + match[0].length;
                            }
                            
                            // 添加剩余文本
                            if (lastIndex < reply.length) {
                                parts.push({ type: 'text', content: reply.substring(lastIndex) });
                            }
                            
                            // 发送消息
                            for (const part of parts) {
                                if (part.type === 'text' && part.content.trim()) {
                                    await ctx.reply(part.content);
                                } else if (part.type === 'media') {
                                    sendMediaMessage(ctx, part.mediaType, part.url);
                                }
                            }
                        } else {
                            ctx.reply(reply);
                        }
                        replied = true;
                        break;
                    }
                }
            }
            
            // 默认回复
            if (!replied) {
                ctx.reply(config.defaultReply || '我收到了你的消息！发送 "按钮" 查看按钮功能。');
            }
        });
    }
});

bot.hears('按钮', (ctx) => {
    readFromFirebase('/config', (error, config) => {
        if (error || !config.buttons) {
            ctx.reply('点击下面的按钮：', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'GitHub', url: 'https://github.com' }],
                        [{ text: '返回主菜单', callback_data: 'menu' }]
                    ]
                }
            });
        } else {
            const keyboard = config.buttons.map(btn => [{ text: btn.text, url: btn.url }]);
            keyboard.push([{ text: '返回主菜单', callback_data: 'menu' }]);
            ctx.reply('点击下面的按钮：', {
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });
        }
    });
});

bot.action('menu', (ctx) => {
    ctx.answerCbQuery();
    ctx.editMessageText('回到主菜单了！');
});

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

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
        readFromFirebase('/config', (error, config) => {
            if (error) {
                config = {
                    welcomeMessage: "👋 欢迎使用我的机器人！",
                    keywords: { "你好": "你好呀！很高兴见到你！😊" },
                    buttons: [{ text: "GitHub", url: "https://github.com" }],
                    defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
                };
            }
            
            let keywordsStr = '';
            if (config.keywords) {
                keywordsStr = Object.entries(config.keywords).map(([k,v]) => `${k}=${v}`).join(';');
            }
            
            let buttonsStr = '';
            if (config.buttons) {
                buttonsStr = config.buttons.map(btn => `${btn.text}|${btn.url}`).join(';');
            }
            
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
                    .upload-section { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px; }
                    .upload-section h3 { margin-top: 0; }
                    .upload-section p { margin: 5px 0; color: #666; }
                </style>
            </head>
            <body>
                <h2>🤖 机器人管理面板</h2>
                <a href="/admin/logout"><button class="logout">退出登录</button></a>
                
                <form action="/admin/save" method="POST">
                    <div class="section">
                        <h3>欢迎消息 (/start 命令)</h3>
                        <div class="form-group">
                            <textarea name="welcomeMessage" rows="3" maxlength="500">${(config.welcomeMessage || '').replace(/"/g, '&quot;')}</textarea>
                            <small>最多 500 字符</small>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>默认回复</h3>
                        <div class="form-group">
                            <textarea name="defaultReply" rows="2" maxlength="1000">${(config.defaultReply || '').replace(/"/g, '&quot;')}</textarea>
                            <small>最多 1000 字符</small>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>关键词回复</h3>
                        <p>格式: 关键词1=回复1;关键词2=回复2</p>
                        <p>媒体支持: [图片:URL], [视频:URL], [文件:URL]</p>
                        <div class="form-group">
                            <textarea name="keywords" rows="4" maxlength="2000">${keywordsStr.replace(/"/g, '&quot;')}</textarea>
                            <small>最多 2000 字符</small>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>按钮设置</h3>
                        <p>格式: 文字1|链接1;文字2|链接2</p>
                        <div class="form-group">
                            <textarea name="buttons" rows="2" maxlength="500">${buttonsStr.replace(/"/g, '&quot;')}</textarea>
                            <small>最多 500 字符</small>
                        </div>
                    </div>
                    
                    <div class="upload-section">
                        <h3>📁 文件上传（开发中）</h3>
                        <p>⚠️ 文件上传功能正在开发中，请使用关键词回复中的直接链接方式</p>
                        <p>✅ 支持格式: [图片:https://...], [视频:https://...], [文件:https://...]</p>
                        <p>📋 示例: 产品图片=[图片:https://example.com/image.jpg]</p>
                    </div>
                    
                    <button type="submit">保存配置</button>
                </form>
            </body>
            </html>
            `);
        });
    } else {
        res.send('<script>alert("密码错误！"); window.history.back();</script>');
    }
});

// 后台管理 - 保存配置
app.post('/admin/save', (req, res) => {
    const { welcomeMessage, defaultReply, keywords, buttons } = req.body;
    
    const keywordObj = {};
    if (keywords) {
        keywords.split(';').forEach(pair => {
            if (pair.trim()) {
                const [key, value] = pair.split('=');
                if (key && value) {
                    keywordObj[key.trim()] = value.trim();
                }
            }
        });
    }
    
    const buttonArray = [];
    if (buttons) {
        buttons.split(';').forEach(pair => {
            if (pair.trim()) {
                const [text, url] = pair.split('|');
                if (text && url) {
                    buttonArray.push({ text: text.trim(), url: url.trim() });
                }
            }
        });
    }
    
    const config = {
        welcomeMessage: welcomeMessage || "👋 欢迎使用我的机器人！",
        defaultReply: defaultReply || "我收到了你的消息！发送 \"按钮\" 查看按钮功能。",
        keywords: keywordObj,
        buttons: buttonArray.length > 0 ? buttonArray : [{ text: "GitHub", url: "https://github.com" }]
    };
    
    writeToFirebase('/config', config, (error, result) => {
        if (error) {
            console.error('保存失败:', error);
            res.send('<script>alert("保存失败！请检查配置。"); window.history.back();</script>');
        } else {
            res.send('<script>alert("配置保存成功！"); window.location.href="/admin/login";</script>');
        }
    });
});

// 后台管理 - 退出登录
app.get('/admin/logout', (req, res) => {
    res.redirect('/admin');
});

// 后台管理 - 登录后重定向
app.get('/admin/login', (req, res) => {
    res.redirect('/admin');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
    console.log(`🔐 后台管理: /admin`);
});