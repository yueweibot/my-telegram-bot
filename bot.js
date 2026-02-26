#!/usr/bin/env node

const { Telegraf, Markup } = require('telegraf');
const https = require('https');

// 配置你的 Bot Token
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8237145457:AAFyADU5nz4eyS0G950rH5hBRn1BvVhMBHc';

// 创建机器人实例
const bot = new Telegraf(BOT_TOKEN, {
  telegram: {
    // 添加超时配置
    webhookReply: false,
    apiRoot: 'https://api.telegram.org',
    agent: new https.Agent({
      keepAlive: true,
      timeout: 10000,
      maxSockets: 10
    })
  }
});

// 启动命令
bot.start((ctx) => {
  ctx.reply('👋 欢迎使用我的机器人！\n\n我可以帮你：\n• 自动回复消息\n• 提供快捷按钮\n• 跳转到指定链接\n\n试试发送 "你好" 或点击下面的按钮！', 
    Markup.keyboard([
      ['官网', '帮助'],
      ['联系我', '功能列表']
    ]).resize().oneTime()
  );
});

// 帮助命令
bot.command('help', (ctx) => {
  ctx.reply('🛠️ 机器人功能说明：\n\n• 发送任意消息获取自动回复\n• 点击键盘按钮快速操作\n• 支持自定义链接跳转\n\n使用 /start 重新开始');
});

// 自动回复逻辑
bot.hears('你好', (ctx) => {
  ctx.reply('你好呀！很高兴见到你 😊');
});

bot.hears('官网', (ctx) => {
  ctx.reply('🔗 点击下面的链接访问官网：', 
    Markup.inlineKeyboard([
      Markup.button.url('🚀 访问官网', 'https://example.com')
    ])
  );
});

bot.hears('帮助', (ctx) => {
  ctx.reply('📖 需要什么帮助呢？\n\n你可以：\n• 询问功能\n• 请求技术支持\n• 了解使用方法');
});

bot.hears('联系我', (ctx) => {
  ctx.reply('📧 联系方式：\n\n可以通过以下方式联系：\n• 邮箱：contact@example.com\n• Telegram: @yourusername');
});

bot.hears('功能列表', (ctx) => {
  ctx.reply('📋 当前功能列表：\n\n✅ 自动聊天回复\n✅ 快捷按钮菜单\n✅ 内联链接跳转\n✅ 命令支持 (/start, /help)\n\n更多功能正在开发中...');
});

// 通用消息回复
bot.on('text', (ctx) => {
  const text = ctx.message.text.toLowerCase();
  
  if (text.includes('谢谢') || text.includes('感谢')) {
    ctx.reply('不客气！随时为你服务 🙌');
  } else if (text.includes('再见') || text.includes('拜拜')) {
    ctx.reply('再见！期待下次见面 👋');
  } else if (text.includes('机器人') || text.includes('bot')) {
    ctx.reply('是的，我就是机器人！有什么我可以帮你的吗？🤖');
  } else {
    // 默认回复
    ctx.reply('我收到你的消息了！\n\n你可以试试：\n• 发送 "你好"\n• 点击底部的按钮\n• 使用 /help 命令', 
      Markup.keyboard([
        ['你好', '官网'],
        ['帮助', '联系我']
      ]).resize().oneTime()
    );
  }
});

// 错误处理
bot.catch((err, ctx) => {
  console.log('❌ 机器人错误:', err);
  // 可以选择向用户发送错误消息
  // ctx.reply('抱歉，刚才出了点小问题，请稍后再试。');
});

// 启动机器人
async function startBot() {
  try {
    await bot.launch();
    console.log('✅ Telegram 机器人启动成功！');
    console.log('🤖 机器人正在运行中...');
    console.log('💡 在 Telegram 中搜索你的机器人并开始对话吧！');
    
    // 启用优雅关闭
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ 机器人启动失败:', error.message);
    console.error('💡 请检查：');
    console.error('   1. Bot Token 是否正确');
    console.error('   2. 网络连接是否正常');
    console.error('   3. 是否能访问 api.telegram.org');
    
    // 如果启动失败，5秒后重试
    setTimeout(startBot, 5000);
  }
}

// 开始运行
startBot();