const express = require('express');
const { Telegraf } = require('telegraf');
const https = require('https');

// 从环境变量获取配置
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;

console.log('=== 启动配置 ===');
console.log('BOT_TOKEN:', BOT_TOKEN ? '已设置' : '未设置');
console.log('ADMIN_PASSWORD:', ADMIN_PASSWORD ? '已设置' : '使用默认');
console.log('FIREBASE_API_KEY:', FIREBASE_API_KEY ? '已设置' : '未设置');
console.log('FIREBASE_DATABASE_URL:', FIREBASE_DATABASE_URL ? '已设置' : '未设置');

if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
}

// Firebase Realtime Database 写入函数（带详细日志）
function writeToFirebase(path, data, callback) {
    console.log('=== Firebase 写入开始 ===');
    console.log('写入路径:', path);
    console.log('写入数据:', JSON.stringify(data, null, 2));
    
    if (!FIREBASE_API_KEY || !FIREBASE_DATABASE_URL) {
        console.log('Firebase 配置不完整，跳过写入');
        callback(null, data);
        return;
    }
    
    const url = `${FIREBASE_DATABASE_URL}${path}.json?auth=${FIREBASE_API_KEY}`;
    console.log('Firebase URL:', url);
    const postData = JSON.stringify(data);
    console.log('POST 数据长度:', postData.length);
    
    const options = {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    console.log('HTTP 请求选项:', options);
    
    const req = https.request(url, options, (res) => {
        console.log('Firebase 响应状态码:', res.statusCode);
        console.log('Firebase 响应头:', res.headers);
        
        let responseBody = '';
        res.on('data', (chunk) => {
            responseBody += chunk;
            console.log('收到响应数据块，长度:', chunk.length);
        });
        res.on('end', () => {
            console.log('Firebase 完整响应:', responseBody);
            try {
                const parsedResponse = JSON.parse(responseBody);
                console.log('✅ Firebase 写入成功！');
                callback(null, parsedResponse);
            } catch (parseError) {
                console.error('❌ Firebase 响应解析失败:', parseError);
                callback(parseError, null);
            }
        });
    });
    
    req.on('error', (error) => {
        console.error('❌ Firebase 写入错误:', error);
        console.error('错误详情:', error.message);
        callback(error, null);
    });
    
    req.on('timeout', () => {
        console.error('❌ Firebase 请求超时');
        req.destroy();
        callback(new Error('Request timeout'), null);
    });
    
    req.setTimeout(10000); // 10秒超时
    
    console.log('发送 POST 数据...');
    req.write(postData);
    req.end();
}

// Firebase Realtime Database 读取函数（带详细日志）
function readFromFirebase(path, callback) {
    console.log('=== Firebase 读取开始 ===');
    console.log('读取路径:', path);
    
    if (!FIREBASE_API_KEY || !FIREBASE_DATABASE_URL) {
        console.log('Firebase 配置不完整，返回默认配置');
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
    console.log('Firebase 读取 URL:', url);
    
    const req = https.get(url, (res) => {
        console.log('Firebase 读取状态码:', res.statusCode);
        console.log('Firebase 读取头:', res.headers);
        
        let responseBody = '';
        res.on('data', (chunk) => {
            responseBody += chunk;
            console.log('收到读取数据块，长度:', chunk.length);
        });
        res.on('end', () => {
            console.log('Firebase 读取完整响应:', responseBody);
            
            if (responseBody === 'null' || responseBody.trim() === '') {
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
                    const parsedResponse = JSON.parse(responseBody);
                    console.log('✅ Firebase 读取成功！');
                    callback(null, parsedResponse);
                } catch (parseError) {
                    console.error('❌ Firebase 读取响应解析失败:', parseError);
                    // 返回默认配置
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
        console.error('❌ Firebase 读取错误:', error);
        console.error('错误详情:', error.message);
        // 返回默认配置
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
    
    req.setTimeout(10000); // 10秒超时
}

const bot = new Telegraf(BOT_TOKEN);

// 动态消息处理
bot.start((ctx) => {
    console.log('收到 /start 命令');
    readFromFirebase('/config', (error, config) => {
        if (error) {
            console.log('读取配置失败，使用默认欢迎消息');
            ctx.reply('👋 欢迎使用我的机器人！');
        } else {
            console.log('使用配置的欢迎消息:', config.welcomeMessage);
            ctx.reply(config.welcomeMessage || '👋 欢迎使用我的机器人！');
        }
    });
});

bot.on('message', async (ctx) => {
    if (ctx.message.text && !ctx.message.text.startsWith('/')) {
        const text = ctx.message.text.trim();
        console.log('收到消息:', text);
        readFromFirebase('/config', (error, config) => {
            if (error) {
                console.log('读取配置失败，使用默认回复');
                ctx.reply('我收到了你的消息！发送 "按钮" 查看按钮功能。');
                return;
            }
            
            let replied = false;
            // 检查关键词
            if (config.keywords) {
                for (const [keyword, reply] of Object.entries(config.keywords)) {
                    if (text.toLowerCase().includes(keyword.toLowerCase())) {
                        console.log('匹配关键词:', keyword, '->', reply);
                        ctx.reply(reply);
                        replied = true;
                        break;
                    }
                }
            }
            
            // 默认回复
            if (!replied) {
                console.log('使用默认回复:', config.defaultReply);
                ctx.reply(config.defaultReply || '我收到了你的消息！发送 "按钮" 查看按钮功能。');
            }
        });
    }
});

bot.hears('按钮', (ctx) => {
    console.log('收到 "按钮" 命令');
    readFromFirebase('/config', (error, config) => {
        if (error || !config.buttons) {
            console.log('使用默认按钮');
            ctx.reply('点击下面的按钮：', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'GitHub', url: 'https://github.com' }],
                        [{ text: '返回主菜单', callback_data: 'menu' }]
                    ]
                }
            });
        } else {
            console.log('使用配置的按钮:', JSON.stringify(config.buttons));
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
        console.error('Webhook 设置失败:', error);
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
        <p><small>💡 调试版本 - 所有操作都会记录详细日志</small></p>
    </body>
    </html>
    `);
});

// 后台管理 - 登录处理
app.post('/admin/login', (req, res) => {
    const { password } = req.body;
    console.log('=== 后台登录尝试 ===');
    console.log('输入密码:', password);
    console.log('正确密码:', ADMIN_PASSWORD);
    
    if (password === ADMIN_PASSWORD) {
        console.log('✅ 后台登录成功');
        // 读取当前配置并显示编辑页面
        readFromFirebase('/config', (error, config) => {
            if (error) {
                console.log('读取配置失败，使用默认配置');
                config = {
                    welcomeMessage: "👋 欢迎使用我的机器人！",
                    keywords: { "你好": "你好呀！很高兴见到你！😊" },
                    buttons: [{ text: "GitHub", url: "https://github.com" }],
                    defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。"
                };
            }
            
            console.log('显示配置:', JSON.stringify(config, null, 2));
            
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
                <title>机器人管理面板 - 调试版</title>
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
                    .debug-info { background: #e9ecef; padding: 10px; border-radius: 4px; margin-top: 10px; }
                </style>
            </head>
            <body>
                <h2>🤖 机器人管理面板 - 调试版</h2>
                <a href="/admin/logout"><button class="logout">退出登录</button></a>
                
                <div class="debug-info">
                    <strong>🔧 调试信息:</strong><br>
                    • 所有保存操作都会记录详细日志<br>
                    • 请在保存后查看 Render 日志<br>
                    • 如果保存失败，请复制错误信息
                </div>
                
                <form action="/admin/save" method="POST">
                    <div class="section">
                        <h3>欢迎消息 (/start 命令)</h3>
                        <div class="form-group">
                            <textarea name="welcomeMessage" rows="3">${(config.welcomeMessage || '').replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>默认回复</h3>
                        <div class="form-group">
                            <textarea name="defaultReply" rows="2">${(config.defaultReply || '').replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>关键词回复</h3>
                        <p>格式: 关键词1=回复1;关键词2=回复2</p>
                        <div class="form-group">
                            <textarea name="keywords" rows="4">${keywordsStr.replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>按钮设置</h3>
                        <p>格式: 文字1|链接1;文字2|链接2</p>
                        <div class="form-group">
                            <textarea name="buttons" rows="2">${buttonsStr.replace(/"/g, '&quot;')}</textarea>
                        </div>
                    </div>
                    
                    <button type="submit">保存配置</button>
                </form>
            </body>
            </html>
            `);
        });
    } else {
        console.log('❌ 后台登录失败 - 密码错误');
        res.send('<script>alert("密码错误！"); window.history.back();</script>');
    }
});

// 后台管理 - 保存配置
app.post('/admin/save', (req, res) => {
    console.log('=== 收到保存请求 ===');
    console.log('请求体:', req.body);
    
    const { welcomeMessage, defaultReply, keywords, buttons } = req.body;
    
    // 解析关键词
    const keywordObj = {};
    if (keywords) {
        console.log('解析关键词:', keywords);
        keywords.split(';').forEach(pair => {
            if (pair.trim()) {
                const [key, value] = pair.split('=');
                if (key && value) {
                    keywordObj[key.trim()] = value.trim();
                    console.log('添加关键词:', key.trim(), '->', value.trim());
                }
            }
        });
    }
    
    // 解析按钮
    const buttonArray = [];
    if (buttons) {
        console.log('解析按钮:', buttons);
        buttons.split(';').forEach(pair => {
            if (pair.trim()) {
                const [text, url] = pair.split('|');
                if (text && url) {
                    buttonArray.push({ text: text.trim(), url: url.trim() });
                    console.log('添加按钮:', text.trim(), '->', url.trim());
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
    
    console.log('=== 准备保存的完整配置 ===');
    console.log(JSON.stringify(config, null, 2));
    
    // 保存到 Firebase
    writeToFirebase('/config', config, (error, result) => {
        if (error) {
            console.error('❌ 保存配置失败:', error);
            res.send('<script>alert("保存失败！请查看 Render 日志获取详细错误信息。"); window.history.back();</script>');
        } else {
            console.log('✅ 配置保存成功:', result);
            res.send('<script>alert("配置保存成功！"); window.location.href="/admin/login";</script>');
        }
    });
});

// 后台管理 - 退出登录
app.get('/admin/logout', (req, res) => {
    console.log('=== 后台退出登录 ===');
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
    console.log(`📊 调试模式: 所有操作都有详细日志`);
});