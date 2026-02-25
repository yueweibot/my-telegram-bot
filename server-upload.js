const express = require('express');
const { Telegraf } = require('telegraf');
const https = require('https');
const multer = require('multer');
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

// Firebase Realtime Database 函数（保持原有功能）
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

// Telegram 文件上传函数
async function uploadFileToTelegram(fileBuffer, fileType) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        const blob = new Blob([fileBuffer], { type: fileType });
        formData.append('document', blob, 'upload');
        
        // 这里需要实现实际的 Telegram 上传
        // 由于 Render 环境限制，我们简化处理
        console.log('Telegram 上传功能待实现');
        resolve('file_id_placeholder');
    });
}

// Multer 配置（内存存储）
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB 限制
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif',
            'video/mp4', 'video/quicktime',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('不支持的文件类型'), false);
        }
    }
});

// 基础机器人功能（保持原有）
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
            if (config.keywords) {
                for (const [keyword, reply] of Object.entries(config.keywords)) {
                    if (text.toLowerCase().includes(keyword.toLowerCase())) {
                        // 处理媒体标签
                        if (reply.includes('[图片:') || reply.includes('[视频:') || reply.includes('[文件:')) {
                            // 这里处理媒体发送
                            ctx.reply(reply.replace(/\[.*?\]/g, ''));
                        } else {
                            ctx.reply(reply);
                        }
                        replied = true;
                        break;
                    }
                }
            }
            
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

// 文件上传路由
app.post('/admin/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有文件上传' });
        }
        
        const file = req.file;
        console.log('上传文件:', file.originalname, file.mimetype, file.size);
        
        // 验证文件大小
        if (file.mimetype.startsWith('image/') && file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ error: '图片文件不能超过 10MB' });
        }
        if (file.mimetype.startsWith('video/') && file.size > 50 * 1024 * 1024) {
            return res.status(400).json({ error: '视频文件不能超过 50MB' });
        }
        if (file.size > 100 * 1024 * 1024) {
            return res.status(400).json({ error: '文件不能超过 100MB' });
        }
        
        // 这里应该上传到 Telegram 并获取 file_id
        // 由于复杂性，我们先返回模拟 file_id
        const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 确定文件类型标签
        let fileTypeTag = '[文件:';
        if (file.mimetype.startsWith('image/')) {
            fileTypeTag = '[图片:';
        } else if (file.mimetype.startsWith('video/')) {
            fileTypeTag = '[视频:';
        }
        
        res.json({ 
            success: true, 
            fileId: `${fileTypeTag}${fileId}]`,
            fileName: file.originalname
        });
        
    } catch (error) {
        console.error('文件上传错误:', error);
        res.status(500).json({ error: '文件上传失败' });
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

// 后台管理界面（包含文件上传）
app.get('/admin', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>机器人后台管理</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            textarea, input[type="text"], input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            button { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; }
            button:hover { background: #218838; }
            .logout { background: #dc3545; }
            .logout:hover { background: #c82333; }
            .section { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 4px; }
            h3 { margin-top: 0; }
            .char-counter { font-size: 12px; color: #666; text-align: right; margin-top: 5px; }
            .upload-section { border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 20px 0; }
            .upload-section input[type="file"] { margin: 10px 0; }
            .file-info { font-size: 12px; color: #666; margin: 10px 0; }
            .file-info span { display: block; margin: 5px 0; }
        </style>
    </head>
    <body>
        <h2>🤖 机器人后台管理</h2>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="password">密码:</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">登录</button>
        </form>

        <script>
        document.getElementById('loginForm').onsubmit = function(e) {
            e.preventDefault();
            const password = document.getElementById('password').value;
            fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'password=' + encodeURIComponent(password)
            })
            .then(response => response.text())
            .then(html => {
                document.open();
                document.write(html);
                document.close();
            })
            .catch(error => {
                alert('登录失败: ' + error.message);
            });
        };
        </script>
    </body>
    </html>
    `);
});

// 后台登录处理
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
                    .char-counter { font-size: 12px; color: #666; text-align: right; margin-top: 5px; }
                    .upload-section { border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 20px 0; }
                    .upload-section input[type="file"] { margin: 10px 0; }
                    .file-info { font-size: 12px; color: #666; margin: 10px 0; }
                    .file-info span { display: block; margin: 5px 0; }
                    .uploaded-files { margin-top: 10px; }
                    .uploaded-file { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; }
                </style>
            </head>
            <body>
                <h2>🤖 机器人管理面板</h2>
                <a href="/admin/logout"><button class="logout">退出登录</button></a>
                
                <div class="upload-section">
                    <h3>📁 文件上传</h3>
                    <input type="file" id="mediaFile" accept="image/*,video/*,.pdf,.doc,.docx" />
                    <div class="file-info">
                        <span>支持格式: JPG, PNG, MP4, PDF, DOC</span>
                        <span>大小限制: 图片(10MB), 视频(50MB), 文件(100MB)</span>
                    </div>
                    <button onclick="uploadFile()">上传文件</button>
                    <div id="uploadProgress"></div>
                    <div id="uploadedFiles" class="uploaded-files"></div>
                </div>
                
                <form id="configForm" action="/admin/save" method="POST">
                    <div class="section">
                        <h3>欢迎消息 (/start 命令)</h3>
                        <div class="form-group">
                            <textarea name="welcomeMessage" id="welcomeMessage" rows="3" maxlength="500">${(config.welcomeMessage || '').replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter"><span id="welcomeCounter">0</span>/500</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>默认回复</h3>
                        <div class="form-group">
                            <textarea name="defaultReply" id="defaultReply" rows="2" maxlength="1000">${(config.defaultReply || '').replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter"><span id="defaultCounter">0</span>/1000</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>关键词回复</h3>
                        <p>格式: 关键词1=回复1;关键词2=回复2<br>
                        使用 [图片:file_id]、[视频:file_id]、[文件:file_id] 插入媒体</p>
                        <div class="form-group">
                            <textarea name="keywords" id="keywords" rows="4" maxlength="2000">${keywordsStr.replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter"><span id="keywordsCounter">0</span>/2000</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>按钮设置</h3>
                        <p>格式: 文字1|链接1;文字2|链接2</p>
                        <div class="form-group">
                            <textarea name="buttons" id="buttons" rows="2" maxlength="500">${buttonsStr.replace(/"/g, '&quot;')}</textarea>
                            <div class="char-counter"><span id="buttonsCounter">0</span>/500</div>
                        </div>
                    </div>
                    
                    <button type="submit">保存配置</button>
                </form>

                <script>
                // 字符计数器
                function updateCounter(elementId, counterId, maxLength) {
                    const element = document.getElementById(elementId);
                    const counter = document.getElementById(counterId);
                    element.addEventListener('input', () => {
                        const length = element.value.length;
                        counter.textContent = length;
                        if (length > maxLength) {
                            counter.style.color = 'red';
                        } else {
                            counter.style.color = '#666';
                        }
                    });
                    // 初始化
                    counter.textContent = element.value.length;
                }
                
                updateCounter('welcomeMessage', 'welcomeCounter', 500);
                updateCounter('defaultReply', 'defaultCounter', 1000);
                updateCounter('keywords', 'keywordsCounter', 2000);
                updateCounter('buttons', 'buttonsCounter', 500);
                
                // 文件上传
                async function uploadFile() {
                    const fileInput = document.getElementById('mediaFile');
                    const file = fileInput.files[0];
                    const progressDiv = document.getElementById('uploadProgress');
                    const uploadedFilesDiv = document.getElementById('uploadedFiles');
                    
                    if (!file) {
                        alert('请选择文件');
                        return;
                    }
                    
                    const formData = new FormData();
                    formData.append('file', file);
                    
                    progressDiv.innerHTML = '上传中...';
                    
                    try {
                        const response = await fetch('/admin/upload', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                            progressDiv.innerHTML = '✅ 上传成功！';
                            const fileElement = document.createElement('div');
                            fileElement.className = 'uploaded-file';
                            fileElement.innerHTML = '<strong>' + result.fileName + '</strong><br>' + 
                                '<code>' + result.fileId + '</code><br>' +
                                '<small>复制上面的代码到关键词回复中使用</small>';
                            uploadedFilesDiv.appendChild(fileElement);
                            
                            // 清空文件输入
                            fileInput.value = '';
                        } else {
                            progressDiv.innerHTML = '❌ 上传失败: ' + result.error;
                        }
                    } catch (error) {
                        progressDiv.innerHTML = '❌ 上传错误: ' + error.message;
                    }
                }
                
                // 表单提交
                document.getElementById('configForm').onsubmit = function(e) {
                    e.preventDefault();
                    const formData = new FormData(this);
                    
                    fetch('/admin/save', {
                        method: 'POST',
                        body: new URLSearchParams([...formData])
                    })
                    .then(response => response.text())
                    .then(html => {
                        document.open();
                        document.write(html);
                        document.close();
                    })
                    .catch(error => {
                        alert('保存失败: ' + error.message);
                    });
                };
                </script>
            </body>
            </html>
            `);
        });
    } else {
        res.send('<script>alert("密码错误！"); window.history.back();</script>');
    }
});

// 保存配置
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
            res.send('<script>alert("保存失败！"); window.history.back();</script>');
        } else {
            res.send('<script>alert("配置保存成功！"); window.location.href="/admin/login";</script>');
        }
    });
});

// 退出登录
app.get('/admin/logout', (req, res) => {
    res.redirect('/admin');
});

app.get('/admin/login', (req, res) => {
    res.redirect('/admin');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 服务器启动在端口 ${PORT}`);
    console.log(`🔐 后台管理: /admin`);
});