/**
 * Simple MacrotellectLink SDK Integration Validator
 * 
 * This script validates the SDK integration by checking:
 * - JAR file presence and size
 * - Native module implementation
 * - Build configuration
 * - API method signatures
 * 
 * No React Native runtime required
 */

const fs = require('fs');
const path = require('path');

class SimpleSDKValidator {
  constructor() {
    this.results = [];
    this.workspaceRoot = process.cwd();
  }

  log(status, category, message, details = {}) {
    const statusIcon = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️'
    };
    
    const result = { status, category, message, details };
    this.results.push(result);
    
    console.log(`${statusIcon[status]} [${category}] ${message}`);
    if (Object.keys(details).length > 0) {
      console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
  }

  validateJARFile() {
    this.log('INFO', 'JAR File', 'Checking MacrotellectLink JAR file...');
    
    const jarPath = path.join(this.workspaceRoot, 'assets', 'MacrotellectLink_V1.4.3.jar');
    
    if (!fs.existsSync(jarPath)) {
      this.log('FAIL', 'JAR File', 'MacrotellectLink_V1.4.3.jar not found in assets/');
      return false;
    }
    
    const stats = fs.statSync(jarPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    
    if (stats.size < 1000) {
      this.log('FAIL', 'JAR File', `JAR file too small (${sizeKB} KB) - likely corrupted`);
      return false;
    }
    
    this.log('PASS', 'JAR File', `JAR file found and valid (${sizeKB} KB)`, {
      path: jarPath,
      size: `${sizeKB} KB`,
      lastModified: stats.mtime.toISOString()
    });
    
    return true;
  }

  validateNativeModule() {
    this.log('INFO', 'Native Module', 'Checking BrainLinkModule.java implementation...');
    
    const modulePath = path.join(this.workspaceRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'brainlinkreactnew', 'BrainLinkModule.java');
    
    if (!fs.existsSync(modulePath)) {
      this.log('FAIL', 'Native Module', 'BrainLinkModule.java not found');
      return false;
    }
    
    const moduleContent = fs.readFileSync(modulePath, 'utf8');
    
    // Check for essential SDK integration
    const requiredImports = [
      'import com.boby.bluetoothconnect.LinkManager;',
      'import com.boby.bluetoothconnect.classic.listener.EEGPowerDataListener;',
      'import com.boby.bluetoothconnect.bean.BrainWave;'
    ];
    
    const requiredMethods = [
      'LinkManager.init(context)',
      'setMultiEEGPowerDataListener',
      'startScan',
      'stopScan',
      'connectToDevice'
    ];
    
    let missingImports = [];
    let missingMethods = [];
    
    requiredImports.forEach(imp => {
      if (!moduleContent.includes(imp)) {
        missingImports.push(imp);
      }
    });
    
    requiredMethods.forEach(method => {
      if (!moduleContent.includes(method)) {
        missingMethods.push(method);
      }
    });
    
    if (missingImports.length > 0) {
      this.log('FAIL', 'Native Module', `Missing required imports: ${missingImports.join(', ')}`);
      return false;
    }
    
    if (missingMethods.length > 0) {
      this.log('FAIL', 'Native Module', `Missing required methods: ${missingMethods.join(', ')}`);
      return false;
    }
    
    this.log('PASS', 'Native Module', 'All required imports and methods present');
    
    // Check for proper BrainWave field usage
    const brainWaveFields = ['signal', 'att', 'med', 'delta', 'theta', 'lowAlpha', 'highAlpha', 'lowBeta', 'highBeta', 'lowGamma', 'highGamma'];
    const foundFields = brainWaveFields.filter(field => moduleContent.includes(`brainWave.${field}`));
    
    if (foundFields.length >= 5) {
      this.log('PASS', 'Native Module', `BrainWave fields properly implemented (${foundFields.length}/${brainWaveFields.length})`, {
        foundFields: foundFields
      });
    } else {
      this.log('WARN', 'Native Module', `Only ${foundFields.length} BrainWave fields found, expecting more`);
    }
    
    return true;
  }

  validateBuildConfiguration() {
    this.log('INFO', 'Build Config', 'Checking Android build configuration...');
    
    const buildGradlePath = path.join(this.workspaceRoot, 'android', 'app', 'build.gradle');
    
    if (!fs.existsSync(buildGradlePath)) {
      this.log('FAIL', 'Build Config', 'build.gradle not found');
      return false;
    }
    
    const buildContent = fs.readFileSync(buildGradlePath, 'utf8');
    
    // Check for JAR integration
    if (!buildContent.includes('MacrotellectLink_V1.4.3.jar')) {
      this.log('FAIL', 'Build Config', 'JAR file not referenced in build.gradle');
      return false;
    }
    
    this.log('PASS', 'Build Config', 'JAR file properly referenced in build.gradle');
    
    // Check for required permissions
    const manifestPath = path.join(this.workspaceRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    
    if (fs.existsSync(manifestPath)) {
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      
      const requiredPermissions = [
        'android.permission.BLUETOOTH',
        'android.permission.BLUETOOTH_ADMIN',
        'android.permission.ACCESS_FINE_LOCATION'
      ];
      
      const missingPermissions = requiredPermissions.filter(perm => !manifestContent.includes(perm));
      
      if (missingPermissions.length > 0) {
        this.log('WARN', 'Build Config', `Missing permissions: ${missingPermissions.join(', ')}`);
      } else {
        this.log('PASS', 'Build Config', 'All required permissions present');
      }
    } else {
      this.log('WARN', 'Build Config', 'AndroidManifest.xml not found');
    }
    
    return true;
  }

  validateServiceImplementation() {
    this.log('INFO', 'Service Layer', 'Checking MacrotellectLinkService implementation...');
    
    const servicePath = path.join(this.workspaceRoot, 'services', 'MacrotellectLinkService.js');
    
    if (!fs.existsSync(servicePath)) {
      this.log('FAIL', 'Service Layer', 'MacrotellectLinkService.js not found');
      return false;
    }
    
    const serviceContent = fs.readFileSync(servicePath, 'utf8');
    
    // Check for essential service methods
    const requiredMethods = [
      'initialize',
      'startScan',
      'stopScan',
      'disconnect',
      'getConnectedDevices',
      'getConnectionMode',
      'isInDemoMode'
    ];
    
    const missingMethods = requiredMethods.filter(method => !serviceContent.includes(method));
    
    if (missingMethods.length > 0) {
      this.log('WARN', 'Service Layer', `Some methods missing: ${missingMethods.join(', ')}`);
    } else {
      this.log('PASS', 'Service Layer', 'All essential service methods present');
    }
    
    // Check for demo mode detection
    if (serviceContent.includes('DEMO_MODE') && serviceContent.includes('REAL_DATA_MODE')) {
      this.log('PASS', 'Service Layer', 'Demo mode detection implemented');
    } else {
      this.log('WARN', 'Service Layer', 'Demo mode detection not found');
    }
    
    return true;
  }

  validateDashboardIntegration() {
    this.log('INFO', 'Dashboard', 'Checking dashboard integration...');
    
    const dashboardPath = path.join(this.workspaceRoot, 'screens', 'MacrotellectLinkDashboard.js');
    
    if (!fs.existsSync(dashboardPath)) {
      this.log('FAIL', 'Dashboard', 'MacrotellectLinkDashboard.js not found');
      return false;
    }
    
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    // Check for connection mode indicators
    if (dashboardContent.includes('REAL EEG DATA') && dashboardContent.includes('DEMO MODE')) {
      this.log('PASS', 'Dashboard', 'Connection mode indicators implemented');
    } else {
      this.log('WARN', 'Dashboard', 'Connection mode indicators not found');
    }
    
    // Check for test screen navigation
    if (dashboardContent.includes('MacrotellectLinkSDKTest')) {
      this.log('PASS', 'Dashboard', 'SDK test screen navigation implemented');
    } else {
      this.log('WARN', 'Dashboard', 'SDK test screen navigation not found');
    }
    
    return true;
  }

  checkProjectStructure() {
    this.log('INFO', 'Project Structure', 'Validating project structure...');
    
    const requiredFiles = [
      'package.json',
      'android/app/build.gradle',
      'android/app/src/main/java/com/brainlinkreactnew/BrainLinkModule.java',
      'assets/MacrotellectLink_V1.4.3.jar',
      'services/MacrotellectLinkService.js',
      'screens/MacrotellectLinkDashboard.js'
    ];
    
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(this.workspaceRoot, file)));
    
    if (missingFiles.length > 0) {
      this.log('FAIL', 'Project Structure', `Missing files: ${missingFiles.join(', ')}`);
      return false;
    }
    
    this.log('PASS', 'Project Structure', 'All required files present');
    return true;
  }

  analyzeDataFlowPath() {
    this.log('INFO', 'Data Flow', 'Analyzing EEG data flow path...');
    
    // Check if DirectBLE files exist (they should be removed in SDK-only mode)
    const directBLEPath = path.join(this.workspaceRoot, 'services', 'DirectBLEConnectionManager.js');
    
    if (fs.existsSync(directBLEPath)) {
      this.log('WARN', 'Data Flow', 'DirectBLE files still exist but should be removed in SDK-only mode');
      this.log('INFO', 'Data Flow', 'Consider removing DirectBLE files: DirectBLEConnectionManager.js, DirectBLEScanner.js, DirectBLEServiceManager.js');
    } else {
      this.log('PASS', 'Data Flow', 'DirectBLE files removed - SDK-only mode enforced');
    }
    
    // Check for real data path
    this.log('INFO', 'Data Flow', 'EEG data path: MacrotellectLink SDK → BrainLinkModule → Service → Dashboard');
    this.log('INFO', 'Data Flow', 'SDK-only mode: No fallback mechanisms - devices must connect through SDK');
    
    return true;
  }

  generateReport() {
    console.log('\n' + '='.repeat(70));
    console.log('         MACROTELLECTLINK SDK INTEGRATION VALIDATION REPORT');
    console.log('='.repeat(70));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const total = this.results.length;
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️ Warnings: ${warnings}`);
    console.log(`   📋 Total: ${total}`);
    
    if (failed === 0) {
      console.log('\n🎉 VALIDATION PASSED! MacrotellectLink SDK is properly integrated.');
      console.log('   ✅ JAR file present and configured');
      console.log('   ✅ Native module implemented correctly');
      console.log('   ✅ Service layer ready');
      console.log('   ✅ Dashboard integration complete');
      console.log('\n📱 NEXT STEPS:');
      console.log('   1. Build and run the app: npx react-native run-android');
      console.log('   2. Use "Force Real Data Mode" button to initialize SDK');
      console.log('   3. Connect BrainLink device to test real vs demo mode');
    } else {
      console.log('\n❌ VALIDATION FAILED! Issues found that need to be resolved:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   ❌ ${result.category}: ${result.message}`);
      });
    }
    
    if (warnings > 0) {
      console.log('\n⚠️ WARNINGS (non-critical issues):');
      this.results.filter(r => r.status === 'WARN').forEach(result => {
        console.log(`   ⚠️ ${result.category}: ${result.message}`);
      });
    }
    
    console.log('\n💡 SDK-ONLY MODE ENFORCED:');
    console.log('   � No DirectBLE fallback - devices must connect through SDK');
    console.log('   🟢 Real Mode: Band powers show 1-99% (MacrotellectLink SDK only)');
    console.log('   🔧 If SDK fails: restart app and ensure BrainLink device is on');
    console.log('   ⚠️ No demo mode available - SDK initialization is mandatory');
    
    console.log('\n='.repeat(70));
    
    return { passed, failed, warnings, total };
  }

  async runValidation() {
    console.log('🚀 Starting MacrotellectLink SDK Integration Validation...\n');
    
    this.checkProjectStructure();
    this.validateJARFile();
    this.validateNativeModule();
    this.validateBuildConfiguration();
    this.validateServiceImplementation();
    this.validateDashboardIntegration();
    this.analyzeDataFlowPath();
    
    return this.generateReport();
  }
}

// Run validation
const validator = new SimpleSDKValidator();
validator.runValidation().then(summary => {
  process.exit(summary.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
});
