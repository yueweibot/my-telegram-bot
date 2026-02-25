const express = require('express');
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  databaseURL: process.env.FIREBASE_DATABASE_URL
};

// 初始化 Firebase
if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
  // 使用服务账户密钥（更安全）
  // 但为了简化，我们使用 Realtime Database REST API
  console.log('✅ Firebase 配置已加载');
} else {
  console.error('❌ Firebase 配置缺失，请设置 FIREBASE_API_KEY 和 FIREBASE_DATABASE_URL');
}

// 从环境变量获取 Bot Token
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'default_password';

if (!BOT_TOKEN) {
  console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// 默认配置
let config = {
  welcomeMessage: "👋 欢迎使用我的机器人！",
  defaultReply: "我收到了你的消息！发送 \"按钮\" 查看按钮功能。",
  keywords: {
    "你好": "你好呀！很高兴见到你！😊",
    "hello": "你好呀！很高兴见到你！😊"
  },
  buttons: [
    { text: "GitHub", url: "https://github.com" },
    { text: "Google", url: "https://google.com" }
  ]
};

// 从 Firebase 加载配置（简化版 - 使用 REST API）
async function loadConfigFromFirebase() {
  try {
    const response = await fetch(`${firebaseConfig.databaseURL}/config.json?auth=${firebaseConfig.apiKey}`);
    const data = await response.json();
    if (data) {
      config = { ...config, ...data };
      console.log('✅ 从 Firebase 加载配置成功');
    }
  } catch (error) {
    console.log('ℹ️ Firebase 配置未找到，使用默认配置');
  }
}

// 保存配置到 Firebase（简化版 - 使用 REST API）
async function saveConfigToFirebase(newConfig) {
  try {
    const response = await fetch(`${firebaseConfig.databaseURL}/config.json?auth=${firebaseConfig.apiKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
    if (response.ok) {
      config = newConfig;
      console.log('✅ 配置保存到 Firebase 成功');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 保存配置到 Firebase 失败:', error);
    return false;
  }
}

// 初始化配置
if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
  loadConfigFromFirebase();
}

// Telegram 机器人功能
bot.start((ctx) => ctx.reply(config.welcomeMessage));

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

bot.hears('按钮', async (ctx) => {
  const keyboard = config.buttons.map(btn => [{ text: btn.text, url: btn.url }]);
  keyboard.push([{ text: '返回主菜单', callback_data: 'menu' }]);
  
  await ctx.reply('点击下面的按钮：', {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
});

bot.action('menu', (ctx) => {
  ctx.answerCbQuery();
  ctx.editMessageText('回到主菜单了！');
});

// Webhook 处理
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
    res.cookie('admin_auth', 'true', { httpOnly: true, maxAge: 3600000 });
    res.redirect('/admin/dashboard');
  } else {
    res.send('<script>alert("密码错误！"); window.history.back();</script>');
  }
});

// 后台管理 - 仪表板
app.get('/admin/dashboard', async (req, res) => {
  if (req.cookies.admin_auth !== 'true') {
    return res.redirect('/admin');
  }
  
  // 确保有最新配置
  if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
    await loadConfigFromFirebase();
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
    </style>
  </head>
  <body>
    <h2>🤖 机器人管理面板</h2>
    <a href="/admin/logout"><button class="logout">退出登录</button></a>
    
    <form action="/admin/save" method="POST">
      <div class="section">
        <h3>欢迎消息 (/start 命令)</h3>
        <div class="form-group">
          <textarea name="welcomeMessage" rows="3">${config.welcomeMessage.replace(/"/g, '&quot;')}</textarea>
        </div>
      </div>
      
      <div class="section">
        <h3>默认回复</h3>
        <div class="form-group">
          <textarea name="defaultReply" rows="2">${config.defaultReply.replace(/"/g, '&quot;')}</textarea>
        </div>
      </div>
      
      <div class="section">
        <h3>关键词回复</h3>
        <p>格式: 关键词1=回复1;关键词2=回复2</p>
        <div class="form-group">
          <textarea name="keywords" rows="4">${Object.entries(config.keywords).map(([k,v]) => \`\${k}=\${v}\`).join(';')}</textarea>
        </div>
      </div>
      
      <div class="section">
        <h3>按钮设置</h3>
        <p>格式: 文字1|链接1;文字2|链接2</p>
        <div class="form-group">
          <textarea name="buttons" rows="2">${config.buttons.map(btn => \`\${btn.text}|\${btn.url}\`).join(';')}</textarea>
        </div>
      </div>
      
      <button type="submit">保存配置</button>
    </form>
  </body>
  </html>
  `);
});

// 后台管理 - 保存配置
app.post('/admin/save', async (req, res) => {
  if (req.cookies.admin_auth !== 'true') {
    return res.redirect('/admin');
  }
  
  try {
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
    
    // 构建新配置
    const newConfig = {
      welcomeMessage: welcomeMessage || config.welcomeMessage,
      defaultReply: defaultReply || config.defaultReply,
      keywords: keywordObj,
      buttons: buttonArray.length > 0 ? buttonArray : config.buttons
    };
    
    // 保存到 Firebase
    if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
      const success = await saveConfigToFirebase(newConfig);
      if (success) {
        res.send('<script>alert("配置保存成功！"); window.location.href="/admin/dashboard";</script>');
      } else {
        res.send('<script>alert("保存失败！"); window.history.back();</script>');
      }
    } else {
      // 如果没有 Firebase，只在内存中保存（重启后丢失）
      config = newConfig;
      res.send('<script>alert("配置已更新（仅当前会话）！"); window.location.href="/admin/dashboard";</script>');
    }
  } catch (error) {
    console.error('保存配置错误:', error);
    res.send('<script>alert("保存出错！"); window.history.back();</script>');
  }
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