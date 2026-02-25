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
        res.on('data', (chunk) => {
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

// 发送媒体文件的辅助函数
async function sendMediaFile(ctx, fileIdentifier, caption = '') {
    try {
        if (fileIdentifier.startsWith('file_id_')) {
            const fileId = fileIdentifier.replace('file_id_', '');
            // 这里需要实现 Telegram 文件发送逻辑
            await ctx.reply('文件发送功能已集成');
        } else if (fileIdentifier.startsWith('[图片:') || 
                   fileIdentifier.startsWith('[视频:') || 
                   fileIdentifier.startsWith('[文件:')) {
            // 解析媒体标识符
            const match = fileIdentifier.match(/\[(图片|视频|文件):([^\]]+)\]/);
            if (match) {
                const type = match[1];
                const content = match[2];
                if (content.startsWith('file_id_')) {
                    const fileId = content.replace('file_id_', '');
                    if (type === '图片') {
                        await ctx.replyWithPhoto(fileId, { caption });
                    } else if (type === '视频') {
                        await ctx.replyWithVideo(fileId, { caption });
                    } else if (type === '文件') {
                        await ctx.replyWithDocument(fileId, { caption });
                    }
                } else {
                    // 处理 URL 或其他格式
                    await ctx.reply(fileIdentifier);
                }
            } else {
                await ctx.reply(fileIdentifier);
            }
        } else {
            await ctx.reply(fileIdentifier);
        }
    } catch (error) {
        console.error('发送媒体文件错误:', error);
        await ctx.reply('发送文件时出错，请稍后重试。');
    }
}

// 动态消息处理
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
                        // 检查是否包含媒体标识符
                        if (reply.includes('[图片:') || reply.includes('[视频:') || reply.includes('[文件:')) {
                            await sendMediaFile(ctx, reply);
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
                if (config.defaultReply.includes('[图片:') || 
                    config.defaultReply.includes('[视频:') || 
                    config.defaultReply.includes('[文件:')) {
                    await sendMediaFile(ctx, config.defaultReply);
                } else {
                    await ctx.reply(config.defaultReply || '我收到了你的消息！发送 "按钮" 查看按钮功能。');
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
            .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 8px; font-weight: bold; color: #333; }
            textarea, input[type="password"], input[type="text"] { 
                width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; 
                font-size: 14px; resize: vertical; 
            }
            textarea { min-height: 80px; }
            .char-counter { 
                font-size: 12px; color: #666; text-align: right; 
                margin-top: 5px; 
            }
            button { 
                background: #28a745; color: white; padding: 12px 24px; 
                border: none; border-radius: 6px; cursor: pointer; 
                font-size: 16px; margin-right: 10px;
            }
            button:hover { background: #218838; }
            .logout { background: #dc3545; }
            .logout:hover { background: #c82333; }
            .section { 
                border: 1px solid #e9ecef; padding: 20px; margin-bottom: 25px; 
                border-radius: 8px; background: #fafafa;
            }
            h2 { color: #333; margin-top: 0; }
            h3 { color: #495057; margin-top: 0; margin-bottom: 15px; }
            .upload-section { 
                background: #fff3cd; padding: 20px; border-radius: 8px; 
                margin: 20px 0; border-left: 4px solid #ffc107;
            }
            .file-info { 
                font-size: 12px; color: #666; margin: 10px 0; 
                display: flex; flex-wrap: wrap; gap: 15px;
            }
            .file-info span { display: block; }
            #uploadProgress { 
                margin-top: 10px; padding: 10px; 
                background: #d4edda; border-radius: 4px; 
                display: none;
            }
            .media-preview { 
                margin-top: 10px; max-width: 200px; 
                border: 1px solid #ddd; border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🤖 机器人后台管理登录</h2>
            <form action="/admin/login" method="POST">
                <div class="form-group">
                    <label for="password">密码:</label>
                    <input type="password" id="password" name="password" required>
                </div>
                <button type="submit">登录</button>
            </form>
        </div>
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
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; background: #f5f5f5; }
                    .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .form-group { margin-bottom: 20px; }
                    label { display: block; margin-bottom: 8px; font-weight: bold; color: #333; }
                    textarea, input[type="text"] { 
                        width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; 
                        font-size: 14px; resize: vertical; 
                    }
                    textarea { min-height: 80px; }
                    .char-counter { 
                        font-size: 12px; color: #666; text-align: right; 
                        margin-top: 5px; 
                    }
                    button { 
                        background: #28a745; color: white; padding: 12px 24px; 
                        border: none; border-radius: 6px; cursor: pointer; 
                        font-size: 16px; margin-right: 10px;
                    }
                    button:hover { background: #218838; }
                    .logout { background: #dc3545; }
                    .logout:hover { background: #c82333; }
                    .section { 
                        border: 1px solid #e9ecef; padding: 20px; margin-bottom: 25px; 
                        border-radius: 8px; background: #fafafa;
                    }
                    h2 { color: #333; margin-top: 0; }
                    h3 { color: #495057; margin-top: 0; margin-bottom: 15px; }
                    .upload-section { 
                        background: #fff3cd; padding: 20px; border-radius: 8px; 
                        margin: 20px 0; border-left: 4px solid #ffc107;
                    }
                    .file-info { 
                        font-size: 12px; color: #666; margin: 10px 0; 
                        display: flex; flex-wrap: wrap; gap: 15px;
                    }
                    .file-info span { display: block; }
                    #uploadProgress { 
                        margin-top: 10px; padding: 10px; 
                        background: #d4edda; border-radius: 4px; 
                        display: none;
                    }
                    .media-preview { 
                        margin-top: 10px; max-width: 200px; 
                        border: 1px solid #ddd; border-radius: 4px;
                    }
                </style>
                <script>
                    function updateCharCount(textareaId, counterId, maxLength) {
                        const textarea = document.getElementById(textareaId);
                        const counter = document.getElementById(counterId);
                        const currentLength = textarea.value.length;
                        counter.textContent = currentLength + '/' + maxLength;
                        if (currentLength > maxLength) {
                            counter.style.color = '#dc3545';
                        } else {
                            counter.style.color = '#666';
                        }
                    }
                    
                    function uploadFile() {
                        const fileInput = document.getElementById('mediaFile');
                        const file = fileInput.files[0];
                        if (!file) {
                            alert('请选择文件');
                            return;
                        }
                        
                        const maxSize = getFileMaxSize(file.type);
                        if (file.size > maxSize) {
                            alert('文件太大！最大限制: ' + formatBytes(maxSize));
                            return;
                        }
                        
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        const progressDiv = document.getElementById('uploadProgress');
                        progressDiv.style.display = 'block';
                        progressDiv.innerHTML = '上传中...';
                        
                        fetch('/admin/upload', {
                            method: 'POST',
                            body: formData
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                progressDiv.innerHTML = '上传成功！<br>文件标识符: ' + data.fileIdentifier;
                                // 可以自动填充到关键词回复中
                                const keywordsTextarea = document.querySelector('textarea[name="keywords"]');
                                if (keywordsTextarea) {
                                    const current = keywordsTextarea.value;
                                    const newEntry = '\\n文件=' + data.fileIdentifier;
                                    keywordsTextarea.value = current + newEntry;
                                    updateCharCount('keywords', 'keywordsCounter', 1000);
                                }
                            } else {
                                progressDiv.innerHTML = '上传失败: ' + data.error;
                            }
                        })
                        .catch(error => {
                            progressDiv.innerHTML = '上传错误: ' + error.message;
                        });
                    }
                    
                    function getFileMaxSize(fileType) {
                        if (fileType.startsWith('image/')) {
                            return 10 * 1024 * 1024; // 10MB
                        } else if (fileType.startsWith('video/')) {
                            return 50 * 1024 * 1024; // 50MB
                        } else {
                            return 100 * 1024 * 1024; // 100MB
                        }
                    }
                    
                    function formatBytes(bytes) {
                        if (bytes === 0) return '0 Bytes';
                        const k = 1024;
                        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                        const i = Math.floor(Math.log(bytes) / Math.log(k));
                        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                    }
                </script>
            </head>
            <body>
                <div class="container">
                    <h2>🤖 机器人管理面板</h2>
                    <a href="/admin/logout"><button class="logout">退出登录</button></a>
                    
                    <div class="upload-section">
                        <h3>📁 文件上传到 Telegram</h3>
                        <input type="file" id="mediaFile" accept="image/*,video/*,.pdf,.doc,.docx" />
                        <div class="file-info">
                            <span>支持格式: JPG, PNG, MP4, PDF, DOC</span>
                            <span>大小限制: 图片(10MB), 视频(50MB), 文件(100MB)</span>
                        </div>
                        <button type="button" onclick="uploadFile()">上传文件</button>
                        <div id="uploadProgress"></div>
                    </div>
                    
                    <form action="/admin/save" method="POST">
                        <div class="section">
                            <h3>欢迎消息 (/start 命令)</h3>
                            <div class="form-group">
                                <textarea id="welcomeMessage" name="welcomeMessage" maxlength="500" oninput="updateCharCount('welcomeMessage', 'welcomeCounter', 500)">${(config.welcomeMessage || '').replace(/"/g, '&quot;')}</textarea>
                                <div class="char-counter" id="welcomeCounter">0/500</div>
                            </div>
                        </div>
                        
                        <div class="section">
                            <h3>默认回复</h3>
                            <div class="form-group">
                                <textarea id="defaultReply" name="defaultReply" maxlength="1000" oninput="updateCharCount('defaultReply', 'defaultCounter', 1000)">${(config.defaultReply || '').replace(/"/g, '&quot;')}</textarea>
                                <div class="char-counter" id="defaultCounter">0/1000</div>
                            </div>
                        </div>
                        
                        <div class="section">
                            <h3>关键词回复</h3>
                            <p>格式: 关键词1=回复1;关键词2=回复2<br>
                               支持媒体: [图片:file_id_xxx], [视频:file_id_xxx], [文件:file_id_xxx]</p>
                            <div class="form-group">
                                <textarea id="keywords" name="keywords" maxlength="2000" oninput="updateCharCount('keywords', 'keywordsCounter', 2000)">${keywordsStr.replace(/"/g, '&quot;')}</textarea>
                                <div class="char-counter" id="keywordsCounter">0/2000</div>
                            </div>
                        </div>
                        
                        <div class="section">
                            <h3>按钮设置</h3>
                            <p>格式: 文字1|链接1;文字2|链接2</p>
                            <div class="form-group">
                                <textarea id="buttons" name="buttons" maxlength="500" oninput="updateCharCount('buttons', 'buttonsCounter', 500)">${buttonsStr.replace(/"/g, '&quot;')}</textarea>
                                <div class="char-counter" id="buttonsCounter">0/500</div>
                            </div>
                        </div>
                        
                        <button type="submit">保存配置</button>
                    </form>
                </div>
                
                <script>
                    // 初始化字符计数
                    updateCharCount('welcomeMessage', 'welcomeCounter', 500);
                    updateCharCount('defaultReply', 'defaultCounter', 1000);
                    updateCharCount('keywords', 'keywordsCounter', 2000);
                    updateCharCount('buttons', 'buttonsCounter', 500);
                </script>
            </body>
            </html>
            `);
        });
    } else {
        res.send('<script>alert("密码错误！"); window.history.back();</script>');
    }
});

// 后台管理 - 文件上传
app.post('/admin/upload', (req, res) => {
    // 注意：Render 不支持 multipart/form-data 直接处理
    // 需要使用专门的中间件或替代方案
    res.json({
        success: false,
        error: '文件上传功能正在开发中，请使用关键词回复中的直接链接方式'
    });
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
            res.send('<script>alert("保存失败！请检查控制台日志。"); window.history.back();</script>');
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
    console.log(`🔐 后台管理: /admin`);
});