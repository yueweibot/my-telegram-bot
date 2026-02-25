const express = require('express');
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

// 从环境变量获取 Bot Token 和管理员密码
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

if (!BOT_TOKEN) {
  console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
  process.exit(1);
}

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, 'config.json');

// 读取配置
function loadConfig() {
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ 无法读取配置文件:', error.message);
    // 返回默认配置
    return {
      welcomeMessage: "👋 欢迎使用我的机器人！\n\n发送任意消息测试自动回复功能。",
      keywords: {
        "你好": "你好呀！很高兴见到你！😊",
        "hello": "Hello! Nice to meet you! 😊",
        "帮助": "🤖 机器人功能说明：\n\n🔹 自动回复关键词\n🔹 按钮跳转链接\n🔹 随时与我对话\n\n试试发送 \"按钮\" 来查看按钮功能！",
        "help": "🤖 Bot Features:\n\n🔹 Auto-reply to keywords\n🔹 Button links\n🔹 Chat anytime\n\nTry sending \"buttons\" to see button features!"
      },
      buttons: [
        { text: "GitHub", url: "https://github.com" },
        { text: "Google", url: "https://google.com" }
      ],
      defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能，或发送 \"帮助\" 查看所有功能。"
    };
  }
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('❌ 无法保存配置文件:', error.message);
    return false;
  }
}

// 初始化机器人
const config = loadConfig();
const bot = new Telegraf(BOT_TOKEN);

// 机器人功能
bot.start((ctx) => ctx.reply(config.welcomeMessage));

// 关键词回复
bot.on('message', async (ctx) => {
  if (ctx.message.text && !ctx.message.text.startsWith('/')) {
    const text = ctx.message.text.trim();
    let replied = false;
    
    // 检查关键词（不区分大小写）
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
bot.hears(/按钮|buttons/i, async (ctx) => {
  if (config.buttons && config.buttons.length > 0) {
    const keyboard = [];
    const row = [];
    
    config.buttons.forEach((btn, index) => {
      row.push({ text: btn.text, url: btn.url });
      if (row.length === 2 || index === config.buttons.length - 1) {
        keyboard.push([...row]);
        row.length = 0;
      }
    });
    
    await ctx.reply('点击下面的按钮：', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
});

// Express 服务器
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 简单的登录页面
const sessions = new Set();

function requireAuth(req, res, next) {
  if (sessions.has(req.headers.authorization)) {
    next();
  } else {
    res.status(401).json({ error: '未授权访问' });
  }
}

// 登录接口
app.post('/admin/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    const token = Math.random().toString(36).substring(2, 15);
    sessions.add(token);
    res.json({ success: true, token: token });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

// 获取配置
app.get('/admin/config', requireAuth, (req, res) => {
  res.json(loadConfig());
});

// 保存配置
app.post('/admin/config', requireAuth, (req, res) => {
  const success = saveConfig(req.body);
  if (success) {
    res.json({ success: true, message: '配置保存成功！' });
  } else {
    res.status(500).json({ error: '保存配置失败' });
  }
});

// 后台管理页面
app.get('/admin', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram 机器人后台管理</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        textarea, input[type="text"], input[type="password"] { 
            width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; 
        }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .keywords-container, .buttons-container { border: 1px solid #ddd; padding: 10px; margin: 10px 0; }
        .keyword-item, .button-item { display: flex; gap: 10px; margin: 5px 0; }
        .keyword-item input, .button-item input { flex: 1; }
        .remove-btn { background: #dc3545; padding: 5px 10px; }
    </style>
</head>
<body>
    <h1>Telegram 机器人后台管理</h1>
    
    <div id="login-section">
        <h2>管理员登录</h2>
        <div class="form-group">
            <label for="password">密码:</label>
            <input type="password" id="password" placeholder="请输入管理员密码">
        </div>
        <button onclick="login()">登录</button>
        <p id="login-message"></p>
    </div>

    <div id="admin-section" style="display: none;">
        <h2>机器人配置</h2>
        
        <div class="form-group">
            <label for="welcomeMessage">欢迎消息 (/start):</label>
            <textarea id="welcomeMessage" rows="3"></textarea>
        </div>

        <div class="form-group">
            <label>关键词回复:</label>
            <div id="keywords-container" class="keywords-container"></div>
            <button type="button" onclick="addKeyword()">添加关键词</button>
        </div>

        <div class="form-group">
            <label>按钮配置:</label>
            <div id="buttons-container" class="buttons-container"></div>
            <button type="button" onclick="addButton()">添加按钮</button>
        </div>

        <div class="form-group">
            <label for="defaultReply">默认回复:</label>
            <textarea id="defaultReply" rows="3"></textarea>
        </div>

        <button onclick="saveConfig()">保存配置</button>
        <p id="save-message"></p>
    </div>

    <script>
        let authToken = '';
        
        function login() {
            const password = document.getElementById('password').value;
            fetch('/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    authToken = data.token;
                    document.getElementById('login-section').style.display = 'none';
                    document.getElementById('admin-section').style.display = 'block';
                    loadConfig();
                } else {
                    document.getElementById('login-message').textContent = '密码错误，请重试';
                }
            })
            .catch(error => {
                document.getElementById('login-message').textContent = '登录失败，请重试';
            });
        }

        function loadConfig() {
            fetch('/admin/config', {
                headers: { 'Authorization': authToken }
            })
            .then(response => response.json())
            .then(config => {
                document.getElementById('welcomeMessage').value = config.welcomeMessage || '';
                document.getElementById('defaultReply').value = config.defaultReply || '';
                
                // 加载关键词
                const keywordsContainer = document.getElementById('keywords-container');
                keywordsContainer.innerHTML = '';
                for (const [keyword, reply] of Object.entries(config.keywords || {})) {
                    addKeywordToUI(keyword, reply);
                }
                
                // 加载按钮
                const buttonsContainer = document.getElementById('buttons-container');
                buttonsContainer.innerHTML = '';
                (config.buttons || []).forEach(btn => {
                    addButtonToUI(btn.text, btn.url);
                });
            });
        }

        function addKeywordToUI(keyword = '', reply = '') {
            const container = document.getElementById('keywords-container');
            const div = document.createElement('div');
            div.className = 'keyword-item';
            div.innerHTML = \`
                <input type="text" placeholder="关键词" value="\${keyword}">
                <input type="text" placeholder="回复内容" value="\${reply}">
                <button class="remove-btn" onclick="this.parentElement.remove()">删除</button>
            \`;
            container.appendChild(div);
        }

        function addButtonToUI(text = '', url = '') {
            const container = document.getElementById('buttons-container');
            const div = document.createElement('div');
            div.className = 'button-item';
            div.innerHTML = \`
                <input type="text" placeholder="按钮文字" value="\${text}">
                <input type="text" placeholder="链接URL" value="\${url}">
                <button class="remove-btn" onclick="this.parentElement.remove()">删除</button>
            \`;
            container.appendChild(div);
        }

        function addKeyword() {
            addKeywordToUI();
        }

        function addButton() {
            addButtonToUI();
        }

        function saveConfig() {
            const config = {
                welcomeMessage: document.getElementById('welcomeMessage').value,
                defaultReply: document.getElementById('defaultReply').value,
                keywords: {},
                buttons: []
            };

            // 收集关键词
            document.querySelectorAll('.keyword-item').forEach(item => {
                const inputs = item.querySelectorAll('input');
                const keyword = inputs[0].value.trim();
                const reply = inputs[1].value.trim();
                if (keyword && reply) {
                    config.keywords[keyword] = reply;
                }
            });

            // 收集按钮
            document.querySelectorAll('.button-item').forEach(item => {
                const inputs = item.querySelectorAll('input');
                const text = inputs[0].value.trim();
                const url = inputs[1].value.trim();
                if (text && url) {
                    config.buttons.push({ text, url });
                }
            });

            fetch('/admin/config', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': authToken 
                },
                body: JSON.stringify(config)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('save-message').textContent = '配置保存成功！';
                    document.getElementById('save-message').style.color = 'green';
                } else {
                    document.getElementById('save-message').textContent = '保存失败：' + data.error;
                    document.getElementById('save-message').style.color = 'red';
                }
            })
            .catch(error => {
                document.getElementById('save-message').textContent = '保存失败，请重试';
                document.getElementById('save-message').style.color = 'red';
            });
        }
    </script>
</body>
</html>
  `);
});

// Webhook 处理
app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// 设置 webhook
app.get('/set-webhook', async (req, res) => {
  try {
    const webhookUrl = \`\${process.env.RENDER_EXTERNAL_URL || \`http://localhost:\${process.env.PORT || 10000}\`}/webhook\`;
    await bot.telegram.setWebhook(webhookUrl);
    res.send('✅ Webhook 设置成功！');
  } catch (error) {
    console.error('Webhook 设置失败:', error);
    res.status(500).send('❌ Webhook 设置失败');
  }
});

// 健康检查
app.get('/', (req, res) => {
  res.send('✅ Telegram 机器人运行中！<br><a href="/admin">后台管理</a>');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(\`🚀 服务器启动在端口 \${PORT}\`);
  console.log(\`🔐 后台管理地址: http://localhost:\${PORT}/admin\`);
  console.log(\`📝 管理员密码: \${ADMIN_PASSWORD}\`);
});