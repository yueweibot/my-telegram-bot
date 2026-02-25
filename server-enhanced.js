const express = require('express');
const { Telegraf } = require('telegraf');
const https = require('https');

// 从环境变量获取配置
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;

if (!BOT_TOKEN) {
    console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
    process.exit(1);
}

// Firebase Realtime Database 写入函数
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

// Firebase Realtime Database 读取函数
function readFromFirebase(path, callback) {
    if (!FIREBASE_API_KEY || !FIREBASE_DATABASE_URL) {
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
        return;
    }
    
    const url = `${FIREBASE_DATABASE_URL}${path}.json?auth=${FIREBASE_API_KEY}`;
    
    https.get(url, (res) => {
        let responseBody = '';
        res.on('td', (chunk) => {
            responseBody += chunk;
        });
        res.on('end', () => {
            if (responseBody === 'null') {
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
            } else {
                callback(null, JSON.parse(responseBody));
            }
        });
    }).on('error', (error) => {
        console.error('Firebase 读取错误:', error);
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
}

const bot = new Telegraf(BOT_TOKEN);

// 发送媒体内容的函数
function sendMediaContent(ctx, content) {
    // 检查是否为图片 URL
    if (content.startsWith('image:') && content.length > 6) {
        const imageUrl = content.substring(6).trim();
        if (isValidUrl(imageUrl)) {
            ctx.replyWithPhoto(imageUrl);
            return true;
        }
    }
    
    // 检查是否为视频 URL
    if (content.startsWith('video:') && content.length > 6) {
        const videoUrl = content.substring(6).trim();
        if (isValidUrl(videoUrl)) {
            ctx.replyWithVideo(videoUrl);
            return true;
        }
    }
    
    // 检查是否为文件 URL
    if (content.startsWith('file:') && content.length > 5) {
        const fileUrl = content.substring(5).trim();
        if (isValidUrl(fileUrl)) {
            ctx.replyWithDocument(fileUrl);
            return true;
        }
    }
    
    // 检查是否为普通 URL（自动发送为链接预览）
    if (isValidUrl(content)) {
        ctx.reply(content);
        return true;
    }
    
    return false;
}

// 验证 URL 格式
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// 动态消息处理
bot.start((ctx) => {
    readFromFirebase('/config', (error, config) => {
        if (error) {
            ctx.reply('👋 欢迎使用我的机器人！');
        } else {
            // 检查是否包含媒体内容
            if (!sendMediaContent(ctx, config.welcomeMessage || '👋 欢迎使用我的机器人！')) {
                ctx.reply(config.welcomeMessage || '👋 欢迎使用我的机器人！');
            }
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
                        // 检查是否包含媒体内容
                        if (!sendMediaContent(ctx, reply)) {
                            ctx.reply(reply);
                        }
                        replied = true;
                        break;
                    }
                }
            }
            
            // 默认回复
            if (!replied) {
                if (!sendMediaContent(ctx, config.defaultReply || '我收到了你的消息！发送 "按钮" 查看按钮功能。')) {
                    ctx.reply(config.defaultReply || '我收到了你的消息！发送 "按钮" 查看按钮功能。');
                }
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
                    .media-help { background: #e9ecef; padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 12px; }
                </style>
                <script>
                    function updateCounter(textareaId, counterId, maxLength) {
                        const textarea = document.getElementById(textareaId);
                        const counter = document.getElementById(counterId);
                        const currentLength = textarea.value.length;
                        counter.textContent = currentLength + '/' + maxLength;
                        if (currentLength > maxLength) {
                            counter.style.color = 'red';
                        } else {
                            counter.style.color = '#666';
                        }
                    }
                    
                    function addMediaExample(type) {
                        const textarea = document.getElementById('keywords');
                        const examples = {
                            'image': '图片示例=image:https://example.com/image.jpg',
                            'video': '视频示例=video:https://example.com/video.mp4',
                            'file': '文件示例=file:https://example.com/document.pdf'
                        };
                        const example = examples[type];
                        if (textarea.value) {
                            textarea.value += ';' + example;
                        } else {
                            textarea.value = example;
                        }
                        updateCounter('keywords', 'keywords-counter', 2000);
                    }
                </script>
            </head>
            <body>
                <h2>🤖 机器人管理面板</h2>
                <a href="/admin/logout"><button class="logout">退出登录</button></a>
                
                <form action="/admin/save" method="POST">
                    <div class="section">
                        <h3>欢迎消息 (/start 命令)</h3>
                        <p>支持文本、图片、视频、文件（见下方说明）</p>
                        <div class="form-group">
                            <textarea name="welcomeMessage" id="welcomeMessage" rows="3" maxlength="500" oninput="updateCounter('welcomeMessage', 'welcome-counter', 500)">${(config.welcomeMessage || '').replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter" id="welcome-counter">0/500</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>默认回复</h3>
                        <p>支持文本、图片、视频、文件（见下方说明）</p>
                        <div class="form-group">
                            <textarea name="defaultReply" id="defaultReply" rows="2" maxlength="1000" oninput="updateCounter('defaultReply', 'default-counter', 1000)">${(config.defaultReply || '').replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter" id="default-counter">0/1000</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>关键词回复</h3>
                        <p>格式: 关键词1=回复1;关键词2=回复2</p>
                        <p><strong>媒体功能：</strong>在回复前添加前缀</p>
                        <ul>
                            <li><code>image:图片URL</code> - 发送图片</li>
                            <li><code>video:视频URL</code> - 发送视频</li>
                            <li><code>file:文件URL</code> - 发送文件</li>
                        </ul>
                        <button type="button" onclick="addMediaExample('image')" style="margin-right: 10px;">添加图片示例</button>
                        <button type="button" onclick="addMediaExample('video')" style="margin-right: 10px;">添加视频示例</button>
                        <button type="button" onclick="addMediaExample('file')">添加文件示例</button>
                        <div class="form-group">
                            <textarea name="keywords" id="keywords" rows="4" maxlength="2000" oninput="updateCounter('keywords', 'keywords-counter', 2000)">${keywordsStr.replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter" id="keywords-counter">0/2000</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>按钮设置</h3>
                        <p>格式: 文字1|链接1;文字2|链接2</p>
                        <p><strong>注意：</strong>按钮文字限制 50 字符，链接限制 200 字符</p>
                        <div class="form-group">
                            <textarea name="buttons" id="buttons" rows="2" maxlength="500" oninput="updateCounter('buttons', 'buttons-counter', 500)">${buttonsStr.replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter" id="buttons-counter">0/500</div>
                        </div>
                    </div>
                    
                    <button type="submit">保存配置</button>
                </form>
                
                <div class="media-help">
                    <h4>💡 媒体功能使用说明：</h4>
                    <p><strong>图片：</strong>回复内容以 <code>image:</code> 开头，例如：<br><code>查看图片=image:https://example.com/photo.jpg</code></p>
                    <p><strong>视频：</strong>回复内容以 <code>video:</code> 开头，例如：<br><code>观看视频=video:https://example.com/movie.mp4</code></p>
                    <p><strong>文件：</strong>回复内容以 <code>file:</code> 开头，例如：<br><code>下载文件=file:https://example.com/document.pdf</code></p>
                </div>
            </body>
            </html>
            <script>
                // 初始化字符计数器
                updateCounter('welcomeMessage', 'welcome-counter', 500);
                updateCounter('defaultReply', 'default-counter', 1000);
                updateCounter('keywords', 'keywords-counter', 2000);
                updateCounter('buttons', 'buttons-counter', 500);
            </script>
            `);
        });
    } else {
        res.send('<script>alert("密码错误！"); window.history.back();</script>');
    }
});

// 后台管理 - 保存配置
app.post('/admin/save', (req, res) => {
    const { welcomeMessage, defaultReply, keywords, buttons } = req.body;
    
    // 验证输入长度
    if (welcomeMessage && welcomeMessage.length > 500) {
        return res.send('<script>alert("欢迎消息不能超过 500 字符！"); window.history.back();</script>');
    }
    if (defaultReply && defaultReply.length > 1000) {
        return res.send('<script>alert("默认回复不能超过 1000 字符！"); window.history.back();</script>');
    }
    if (keywords && keywords.length > 2000) {
        return res.send('<script>alert("关键词回复不能超过 2000 字符！"); window.history.back();</script>');
    }
    if (buttons && buttons.length > 500) {
        return res.send('<script>alert("按钮设置不能超过 500 字符！"); window.history.back();</script>');
    }
    
    // 解析关键词
    const keywordObj = {};
    if (keywords) {
        keywords.split(';').forEach(pair => {
            if (pair.trim()) {
                const [key, value] = pair.split('=');
                if (key && value) {
                    // 验证关键词长度
                    if (key.trim().length > 100) {
                        console.warn('关键词过长:', key);
                    }
                    if (value.trim().length > 1000) {
                        console.warn('回复内容过长:', value);
                    }
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
                    // 验证按钮长度
                    if (text.trim().length > 50) {
                        console.warn('按钮文字过长:', text);
                    }
                    if (url.trim().length > 200) {
                        console.warn('按钮链接过长:', url);
                    }
                    buttonArray.push({ 
                        text: text.trim().substring(0, 50), 
                        url: url.trim().substring(0, 200) 
                    });
                }
            }
        });
    }
    
    // 构建配置对象
    const config = {
        welcomeMessage: welcomeMessage ? welcomeMessage.substring(0, 500) : "👋 欢迎使用我的机器人！",
        defaultReply: defaultReply ? defaultReply.substring(0, 1000) : "我收到了你的消息！发送 \"按钮\" 查看按钮功能。",
        keywords: keywordObj,
        buttons: buttonArray.length > 0 ? buttonArray : [{ text: "GitHub", url: "https://github.com" }]
    };
    
    // 保存到 Firebase
    writeToFirebase('/config', config, (error, result) => {
        if (error) {
            console.error('保存失败:', error);
            res.send('<script>alert("保存失败！请检查网络连接和配置。"); window.history.back();</script>');
        } else {
            console.log('保存成功:', result);
            res.send('<script>alert("配置保存成功！所有更改已生效。"); window.location.href="/admin/login";</script>');
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