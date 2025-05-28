const fs = require('fs');
const path = require('path');

// Simple syntax validation for JavaScript files
function validateJSFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for basic syntax issues
    const issues = [];
    
    // Check for unmatched brackets
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    if (openBrackets !== closeBrackets) {
      issues.push(`Unmatched curly brackets: ${openBrackets} open, ${closeBrackets} close`);
    }
    
    // Check for unmatched parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Unmatched parentheses: ${openParens} open, ${closeParens} close`);
    }
    
    // Check for basic import/export syntax
    const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
    const exportLines = content.split('\n').filter(line => line.trim().startsWith('export'));
    
    if (importLines.length > 0 || exportLines.length > 0) {
      console.log(`✓ ${filePath}: ${importLines.length} imports, ${exportLines.length} exports`);
    }
    
    if (issues.length > 0) {
      console.log(`✗ ${filePath}:`);
      issues.forEach(issue => console.log(`  - ${issue}`));
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(`✗ ${filePath}: ${error.message}`);
    return false;
  }
}

// Files to validate
const filesToCheck = [
  'App.js',
  'screens/LoginScreen.js',
  'screens/DashboardScreen.js',
  'services/ApiService.js',
  'services/BluetoothService.js',
  'utils/EEGProcessor.js',
  'components/EEGChart.js',
  'components/BandPowerDisplay.js',
  'components/DeviceListModal.js',
  'constants/index.js'
];

console.log('🔍 Validating React Native project files...\n');

let allValid = true;
filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    const isValid = validateJSFile(file);
    if (!isValid) allValid = false;
  } else {
    console.log(`✗ ${file}: File not found`);
    allValid = false;
  }
});

console.log(`\n${allValid ? '✅' : '❌'} Validation ${allValid ? 'passed' : 'failed'}`);

if (allValid) {
  console.log('\n📱 Project structure looks good!');
  console.log('Next steps:');
  console.log('1. Update Node.js to version 18+');
  console.log('2. Run: npm install');
  console.log('3. Run: npx expo start');
  console.log('4. Test on device with Expo Go app');
}

process.exit(allValid ? 0 : 1);
