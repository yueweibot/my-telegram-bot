const express = require('express');
const { Telegraf } = require('telegraf');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 从环境变量获取配置
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID || '8604144287'; // 你的 Telegram User ID
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;

if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Firebase Realtime Database 写入函数
function writeToFirebase(path, data, callback) {
    if (!FIREBASE_API_KEY || !FIREBASE_DATABASE_URL) {
        console.log('⚠️ Firebase 配置不完整，跳过写入');
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
            try {
                const result = JSON.parse(responseBody);
                callback(null, result);
            } catch (error) {
                console.error('Firebase 响应解析错误:', error);
                callback(error, null);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('Firebase 写入错误:', error);
        callback(error, null);
    });
    
    req.write(postData);
    req.end();
}

// Firebase Realtime Database 读取函数
function readFromFirebase(path, callback) {
    if (!FIREBASE_API_KEY || !FIREBASE_DATABASE_URL) {
        console.log('⚠️ Firebase 配置不完整，返回默认配置');
        const defaultConfig = {
            welcomeMessage: "👋 欢迎使用我的机器人！",
            keywords: {
                "你好": "你好呀！很高兴见到你！😊"
            },
            buttons: [
                { text: "GitHub", url: "https://github.com" }
            ],
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
                console.log('Firebase 返回 null，使用默认配置');
                const defaultConfig = {
                    welcomeMessage: "👋 欢迎使用我的机器人！",
                    keywords: {
                        "你好": "你好呀！很高兴见到你！😊"
                    },
                    buttons: [
                        { text: "GitHub", url: "https://github.com" }
                    ],
                    defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
                };
                callback(null, defaultConfig);
            } else {
                try {
                    const result = JSON.parse(responseBody);
                    callback(null, result);
                } catch (error) {
                    console.error('Firebase 响应解析错误:', error);
                    const defaultConfig = {
                        welcomeMessage: "👋 欢迎使用我的机器人！",
                        keywords: {
                            "你好": "你好呀！很高兴见到你！😊"
                        },
                        buttons: [
                            { text: "GitHub", url: "https://github.com" }
                        ],
                        defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
                    };
                    callback(null, defaultConfig);
                }
            }
        });
    }).on('error', (error) => {
        console.error('Firebase 读取错误:', error);
        const defaultConfig = {
            welcomeMessage: "👋 欢迎使用我的机器人！",
            keywords: {
                "你好": "你好呀！很高兴见到你！😊"
            },
            buttons: [
                { text: "GitHub", url: "https://github.com" }
            ],
            defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
        };
        callback(null, defaultConfig);
    });
}

// 发送媒体消息
async function sendMediaMessage(ctx, mediaType, mediaUrl) {
    try {
        if (mediaType === '图片') {
            await ctx.replyWithPhoto(mediaUrl);
        } else if (mediaType === '视频') {
            await ctx.replyWithVideo(mediaUrl);
        } else if (mediaType === '文件') {
            await ctx.replyWithDocument(mediaUrl);
        }
    } catch (error) {
        console.error('发送媒体消息失败:', error);
        ctx.reply('抱歉，无法发送该媒体内容。');
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
        readFromFirebase('/config', async (error, config) => {
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
                            // 处理媒体标签
                            let replyText = reply;
                            const mediaRegex = /\[(图片|视频|文件):([^\]]+)\]/g;
                            let match;
                            const mediaPromises = [];
                            
                            while ((match = mediaRegex.exec(reply)) !== null) {
                                const mediaType = match[1];
                                const mediaUrl = match[2];
                                mediaPromises.push(sendMediaMessage(ctx, mediaType, mediaUrl));
                                replyText = replyText.replace(match[0], '');
                            }
                            
                            if (mediaPromises.length > 0) {
                                await Promise.all(mediaPromises);
                                if (replyText.trim()) {
                                    await ctx.reply(replyText.trim());
                                }
                            } else {
                                await ctx.reply(reply);
                            }
                        } else {
                            await ctx.reply(reply);
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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 文件上传中间件
const multer = require('multer');
const upload = multer({ 
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

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
        // 读取当前配置并显示编辑页面
        readFromFirebase('/config', (error, config) => {
            if (error) {
                config = {
                    welcomeMessage: "👋 欢迎使用我的机器人！",
                    keywords: { "你好": "你好呀！很高兴见到你！😊" },
                    buttons: [{ text: "GitHub", url: "https://github.com" }],
                    defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
                };
            }
            
            // 格式化关键词为字符串
            let keywordsStr = '';
            if (config.keywords) {
                keywordsStr = Object.entries(config.keywords).map(([k,v]) => `${k}=${v}`).join(';');
            }
            
            // 格式化按钮为字符串
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
                    .char-counter { font-size: 12px; color: #666; margin-top: 5px; }
                </style>
            </head>
            <body>
                <h2>🤖 机器人管理面板</h2>
                <a href="/admin/logout"><button class="logout">退出登录</button></a>
                
                <div class="section">
                    <h3>💡 媒体功能说明</h3>
                    <p>在关键词回复中使用以下格式：</p>
                    <ul>
                        <li><strong>图片</strong>: [图片:https://example.com/image.jpg]</li>
                        <li><strong>视频</strong>: [视频:https://example.com/video.mp4]</li>
                        <li><strong>文件</strong>: [文件:https://example.com/file.pdf]</li>
                    </ul>
                    <p><em>上传功能正在开发中，请先使用直接链接方式。</em></p>
                </div>
                
                <form action="/admin/save" method="POST">
                    <div class="section">
                        <h3>欢迎消息 (/start 命令) <span class="char-counter"><span id="welcomeCounter">0</span>/500</span></h3>
                        <div class="form-group">
                            <textarea name="welcomeMessage" id="welcomeMessage" rows="3" maxlength="500">${(config.welcomeMessage || '').replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>默认回复 <span class="char-counter"><span id="defaultCounter">0</span>/1000</span></h3>
                        <div class="form-group">
                            <textarea name="defaultReply" id="defaultReply" rows="2" maxlength="1000">${(config.defaultReply || '').replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>关键词回复 <span class="char-counter"><span id="keywordsCounter">0</span>/2000</span></h3>
                        <p>格式: 关键词1=回复1;关键词2=回复2</p>
                        <div class="form-group">
                            <textarea name="keywords" id="keywords" rows="4" maxlength="2000">${keywordsStr.replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>按钮设置 <span class="char-counter"><span id="buttonsCounter">0</span>/500</span></h3>
                        <p>格式: 文字1|链接1;文字2|链接2</p>
                        <div class="form-group">
                            <textarea name="buttons" id="buttons" rows="2" maxlength="500">${buttonsStr.replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <button type="submit">保存配置</button>
                </form>
                
                <script>
                    function updateCounter(textareaId, counterId, maxLength) {
                        const textarea = document.getElementById(textareaId);
                        const counter = document.getElementById(counterId);
                        counter.textContent = textarea.value.length;
                        
                        textarea.addEventListener('input', () => {
                            counter.textContent = textarea.value.length;
                            if (textarea.value.length > maxLength) {
                                textarea.value = textarea.value.substring(0, maxLength);
                                counter.textContent = maxLength;
                            }
                        });
                    }
                    
                    updateCounter('welcomeMessage', 'welcomeCounter', 500);
                    updateCounter('defaultReply', 'defaultCounter', 1000);
                    updateCounter('keywords', 'keywordsCounter', 2000);
                    updateCounter('buttons', 'buttonsCounter', 500);
                </script>
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
    
    // 解析关键词
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
    
    // 解析按钮
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
    
    // 构建配置对象
    const config = {
        welcomeMessage: welcomeMessage || "👋 欢迎使用我的机器人！",
        defaultReply: defaultReply || "我收到了你的消息！发送 \"按钮\" 查看按钮功能。",
        keywords: keywordObj,
        buttons: buttonArray.length > 0 ? buttonArray : [{ text: "GitHub", url: "https://github.com" }]
    };
    
    // 保存到 Firebase
    writeToFirebase('/config', config, (error, result) => {
        if (error) {
            console.error('保存配置失败:', error);
            res.send('<script>alert("保存失败！请查看日志。"); window.history.back();</script>');
        } else {
            console.log('配置保存成功:', result);
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

// ===== 代理功能配置 =====
// 请在环境变量中设置 ADMIN_TELEGRAM_ID
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// 存储对话映射 (message_id -> user_id)
const conversationMap = new Map();

// 消息转发处理
bot.on('message', async (ctx) => {
    // 跳过命令消息和 bot 自己的消息
    if (ctx.message.text && ctx.message.text.startsWith('/')) {
        return;
    }
    
    if (ctx.from.is_bot) {
        return;
    }
    
    const userId = ctx.from.id.toString();
    const message = ctx.message;
    
    try {
        if (ADMIN_TELEGRAM_ID && userId === ADMIN_TELEGRAM_ID) {
            // 管理员发送的消息 - 转发给目标用户
            if (message.reply_to_message) {
                const replyText = message.reply_to_message.text || '';
                // 从回复消息中提取用户ID
                const userMatch = replyText.match(/👤 用户 \((\d+)\):/);
                if (userMatch) {
                    const targetUserId = userMatch[1];
                    await ctx.telegram.sendMessage(targetUserId, message.text);
                    console.log(`📤 管理员消息转发给用户 ${targetUserId}`);
                }
            }
        } else {
            // 普通用户发送的消息 - 转发给管理员
            if (ADMIN_TELEGRAM_ID) {
                const forwarded = await ctx.telegram.sendMessage(
                    ADMIN_TELEGRAM_ID,
                    `👤 用户 (${userId}):\n${message.text}`,
                    { 
                        reply_to_message_id: message.message_id,
                        allow_sending_without_reply: true
                    }
                );
                // 记录对话映射
                conversationMap.set(forwarded.message_id.toString(), userId);
                console.log(`📥 收到用户 ${userId} 的消息，已转发给管理员`);
            } else {
                // 如果没有设置管理员ID，使用默认回复
                readFromFirebase('/config', async (error, config) => {
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
                                    // 处理媒体标签
                                    let replyText = reply;
                                    const mediaRegex = /\[(图片|视频|文件):([^\]]+)\]/g;
                                    let match;
                                    const mediaPromises = [];
                                    
                                    while ((match = mediaRegex.exec(reply)) !== null) {
                                        const mediaType = match[1];
                                        const mediaUrl = match[2];
                                        mediaPromises.push(sendMediaMessage(ctx, mediaType, mediaUrl));
                                        replyText = replyText.replace(match[0], '');
                                    }
                                    
                                    if (mediaPromises.length > 0) {
                                        await Promise.all(mediaPromises);
                                        if (replyText.trim()) {
                                            await ctx.reply(replyText.trim());
                                        }
                                    } else {
                                        await ctx.reply(reply);
                                    }
                                } else {
                                    await ctx.reply(reply);
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
        }
    } catch (error) {
        console.error('消息转发错误:', error);
        if (userId !== ADMIN_TELEGRAM_ID) {
            ctx.reply('抱歉，消息转发出现问题，请稍后再试。');
        }
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
    console.log(`🔐 后台管理: /admin`);
    if (ADMIN_TELEGRAM_ID) {
        console.log(`👥 代理模式: 已启用 (管理员ID: ${ADMIN_TELEGRAM_ID})`);
    } else {
        console.log('🤖 自动回复模式: 未设置管理员ID');
    }
});