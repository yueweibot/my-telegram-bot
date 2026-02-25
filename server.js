const express = require('express');
const { Telegraf } = require('telegraf');

// 从环境变量获取 Bot Token
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ 错误: 请设置 BOT_TOKEN 环境变量');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// 基础命令
bot.start((ctx) => ctx.reply('👋 欢迎使用我的机器人！\n\n发送任意消息测试自动回复功能。'));

// 自动回复
bot.hears(/你好|hello/i, (ctx) => {
  ctx.reply('你好呀！很高兴见到你！😊');
});

bot.hears(/帮助|help/i, (ctx) => {
  const helpText = `🤖 机器人功能说明：
  
🔹 自动回复关键词
🔹 按钮跳转链接
🔹 随时与我对话

试试发送 "按钮" 来查看按钮功能！`;
  ctx.reply(helpText);
});

// 按钮功能
bot.hears('按钮', async (ctx) => {
  await ctx.reply('点击下面的按钮：', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'GitHub', url: 'https://github.com' },
          { text: 'Google', url: 'https://google.com' }
        ],
        [
          { text: '返回主菜单', callback_data: 'menu' }
        ]
      ]
    }
  });
});

// 回调处理
bot.action('menu', (ctx) => {
  ctx.answerCbQuery();
  ctx.editMessageText('回到主菜单了！发送 "帮助" 查看功能。');
});

// 默认回复
bot.on('message', (ctx) => {
  if (ctx.message.text && !ctx.message.text.startsWith('/')) {
    ctx.reply('我收到了你的消息！发送 "按钮" 查看按钮功能，或发送 "帮助" 查看所有功能。');
  }
});

// Webhook 处理
const app = express();
app.use(express.json());

// Render 健康检查
app.get('/', (req, res) => {
  res.send('✅ Telegram 机器人运行中！');
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
  console.log(`📝 请在 Telegram @BotFather 中设置 webhook 到: https://your-render-url.onrender.com/webhook`);
});