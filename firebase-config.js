// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDyIhlf8uJWn7-CwVz5jz9Btw-BuADhdi8",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://telegram-bot-a1d79-default-rtdb.asia-southeast1.firebasedatabase.app"
};

module.exports = firebaseConfig;