const glob = require('glob');
const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing C++20 compatibility issues...');

// Downgrade C++20 to C++17 in CMakeLists.txt files
const cmakeFiles = glob.sync('node_modules/**/CMakeLists.txt');
console.log(`Found ${cmakeFiles.length} CMakeLists.txt files`);

cmakeFiles.forEach(file => {
  console.log(`📝 Checking ${file}`);
  let code = fs.readFileSync(file, 'utf8');
  const originalCode = code;
  
  code = code.replace(/-std=c\+\+20/g, '-std=c++17');
  
  if (code !== originalCode) {
    fs.writeFileSync(file, code);
    console.log(`✅ Updated ${file} (C++20 → C++17)`);
  }
});

// Fix C++20 specific issues in source files
const cppFiles = glob.sync('node_modules/**/src/**/*.{cpp,cc,cxx}');
console.log(`Found ${cppFiles.length} C++ source files`);

cppFiles.forEach(file => {
  console.log(`📝 Checking ${file}`);
  let code = fs.readFileSync(file, 'utf8');
  const originalCode = code;
  
  // Replace C++20 contains() with C++17 compatible version
  code = code.replace(/\.contains\(/g, '.find(') !== code ? code.replace(/\.contains\(/g, '.count(') : code;
  
  if (code !== originalCode) {
    fs.writeFileSync(file, code);
    console.log(`✅ Updated ${file} (C++20 compatibility)`);
  }
});

console.log('✅ C++ compatibility fixed');
