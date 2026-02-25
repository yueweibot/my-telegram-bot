# Telegram 机器人 Render 部署指南

## 准备工作

1. **GitHub 账号** - 需要将代码推送到 GitHub
2. **Render 账号** - 免费注册 https://render.com
3. **你的 Bot Token** - 已经有了 ✅

## 部署步骤

### 步骤 1: 创建 GitHub 仓库
- 登录 GitHub
- 点击 "New repository" 
- 仓库名：`telegram-bot`
- 选择 Public（免费）
- 不要初始化 README

### 步骤 2: 上传代码到 GitHub
```bash
# 在你的本地电脑执行（不是在当前服务器）
git clone https://github.com/你的用户名/telegram-bot.git
cd telegram-bot

# 复制我提供的所有文件到这个目录
# 包括: bot.js, server.js, package.json, render.yaml, .gitignore

git add .
git commit -m "Initial commit"
git push origin main
```

### 步骤 3: 在 Render 部署
1. 登录 Render Dashboard
2. 点击 "New Web Service"
3. 连接你的 GitHub 仓库
4. 设置环境变量：
   - `BOT_TOKEN` = 你的 Bot Token (8237145457:AAFyADU5nz4eyS0G950rH5hBRn1BvVhMBHc)
5. 点击 "Create Web Service"

### 步骤 4: 配置 Webhook
部署完成后，Render 会给你一个 URL，比如：
`https://your-app.onrender.com`

在 Telegram 发送命令给 @BotFather：
```
/setwebhook
```
然后选择你的机器人，输入：
```
https://your-app.onrender.com/webhook
```

## 功能说明

✅ 自动回复  
✅ 按钮跳转（需要替换示例链接）  
✅ 支持文本消息处理  
✅ 错误处理和日志  

## 自定义修改

编辑 `bot.js` 文件中的 `handleMessage` 函数来添加更多功能。

## 注意事项

- Render 免费版有休眠限制（15分钟无请求会休眠）
- 休眠后首次请求会稍慢（需要唤醒）
- 如果需要 24/7 运行，考虑升级到付费计划