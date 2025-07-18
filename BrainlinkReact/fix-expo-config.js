const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Expo configuration conflicts...');

// Fix app.json/app.config.js conflicts
if (fs.existsSync('app.config.js') && fs.existsSync('app.json')) {
  console.log('📝 Found both app.json and app.config.js - backing up app.json');
  if (fs.existsSync('app.json.backup')) {
    fs.unlinkSync('app.json.backup');
  }
  fs.renameSync('app.json', 'app.json.backup');
}

console.log('✅ Expo configuration fixed');
