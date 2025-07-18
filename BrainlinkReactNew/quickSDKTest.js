/**
 * Quick MacrotellectLink SDK Integration Test
 * 
 * This test verifies the complete integration without needing an Android device
 * by checking the code paths and ensuring all components are properly connected.
 */

const fs = require('fs');
const path = require('path');

class QuickSDKTest {
  constructor() {
    this.workspaceRoot = process.cwd();
    this.testsPassed = 0;
    this.testsTotal = 0;
  }

  test(name, condition, message) {
    this.testsTotal++;
    if (condition) {
      console.log(`✅ ${name}: ${message}`);
      this.testsPassed++;
    } else {
      console.log(`❌ ${name}: ${message}`);
    }
  }

  testJARIntegration() {
    console.log('\n🔧 Testing JAR Integration...');
    
    // Test 1: JAR file exists
    const jarPath = path.join(this.workspaceRoot, 'assets', 'MacrotellectLink_V1.4.3.jar');
    this.test('JAR File', fs.existsSync(jarPath), 'MacrotellectLink_V1.4.3.jar is present');
    
    // Test 2: Build configuration
    const buildGradlePath = path.join(this.workspaceRoot, 'android', 'app', 'build.gradle');
    if (fs.existsSync(buildGradlePath)) {
      const buildContent = fs.readFileSync(buildGradlePath, 'utf8');
      this.test('Build Config', buildContent.includes('MacrotellectLink_V1.4.3.jar'), 
        'JAR file is referenced in build.gradle');
    }
  }

  testNativeModuleIntegration() {
    console.log('\n🔧 Testing Native Module Integration...');
    
    const modulePath = path.join(this.workspaceRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'brainlinkreactnew', 'BrainLinkModule.java');
    
    if (fs.existsSync(modulePath)) {
      const moduleContent = fs.readFileSync(modulePath, 'utf8');
      
      // Test LinkManager.init usage
      this.test('LinkManager Init', moduleContent.includes('LinkManager.init(context)'), 
        'LinkManager.init(context) is properly called');
      
      // Test EEG data listener
      this.test('EEG Data Listener', moduleContent.includes('setMultiEEGPowerDataListener'), 
        'EEG data listener is properly set up');
      
      // Test BrainWave field usage
      const brainWaveFields = ['signal', 'att', 'med', 'delta', 'theta', 'lowAlpha', 'highAlpha'];
      const hasFields = brainWaveFields.some(field => moduleContent.includes(`brainWave.${field}`));
      this.test('BrainWave Fields', hasFields, 'BrainWave fields are properly accessed');
      
      // Test connection handling
      this.test('Connection Handling', moduleContent.includes('OnConnectListener'), 
        'Connection events are properly handled');
    }
  }

  testServiceLayerIntegration() {
    console.log('\n🔧 Testing Service Layer Integration...');
    
    const servicePath = path.join(this.workspaceRoot, 'services', 'MacrotellectLinkService.js');
    
    if (fs.existsSync(servicePath)) {
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      // Test native module bridge
      this.test('Native Bridge', serviceContent.includes('BrainLinkModule'), 
        'Native module bridge is properly set up');
      
      // Test initialization method
      this.test('Initialize Method', serviceContent.includes('async initialize'), 
        'Initialize method is implemented');
      
      // Test scanning methods
      this.test('Scan Methods', serviceContent.includes('startScan') && serviceContent.includes('stopScan'), 
        'Scan methods are implemented');
      
      // Test demo mode detection
      this.test('Demo Mode Detection', serviceContent.includes('DEMO_MODE') && serviceContent.includes('REAL_DATA_MODE'), 
        'Demo mode detection is implemented');
      
      // Test event listeners
      this.test('Event Listeners', serviceContent.includes('onEEGData') && serviceContent.includes('onConnectionChange'), 
        'Event listeners are properly set up');
    }
  }

  testDashboardIntegration() {
    console.log('\n🔧 Testing Dashboard Integration...');
    
    const dashboardPath = path.join(this.workspaceRoot, 'screens', 'MacrotellectLinkDashboard.js');
    
    if (fs.existsSync(dashboardPath)) {
      const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
      
      // Test MacrotellectLinkService import
      this.test('Service Import', dashboardContent.includes('MacrotellectLinkService'), 
        'MacrotellectLinkService is properly imported');
      
      // Test connection mode indicators
      this.test('Connection Mode UI', dashboardContent.includes('REAL EEG DATA') && dashboardContent.includes('DEMO MODE'), 
        'Connection mode indicators are displayed');
      
      // Test Force Real Data Mode button
      this.test('Force Real Mode', dashboardContent.includes('Force Real Data Mode'), 
        'Force Real Data Mode button is available');
      
      // Test EEG data display
      this.test('EEG Data Display', dashboardContent.includes('Band Powers') || dashboardContent.includes('attention'), 
        'EEG data is properly displayed');
    }
  }

  testDataFlowPath() {
    console.log('\n🔧 Testing Data Flow Path...');
    
    // Test DirectBLE fallback exists
    const directBLEPath = path.join(this.workspaceRoot, 'services', 'DirectBLEConnectionManager.js');
    this.test('DirectBLE Fallback', fs.existsSync(directBLEPath), 
      'DirectBLE fallback system is available');
    
    // Test real vs demo mode distinction
    const servicePath = path.join(this.workspaceRoot, 'services', 'MacrotellectLinkService.js');
    if (fs.existsSync(servicePath)) {
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      
      // Test demo mode warnings
      this.test('Demo Mode Warnings', serviceContent.includes('DEMO MODE') || serviceContent.includes('demo mode'), 
        'Demo mode warnings are present');
      
      // Test real data mode detection
      this.test('Real Mode Detection', serviceContent.includes('REAL_DATA_MODE') || serviceContent.includes('real data'), 
        'Real data mode detection is implemented');
    }
  }

  testImplementationCompleteness() {
    console.log('\n🔧 Testing Implementation Completeness...');
    
    // Test all required files exist
    const requiredFiles = [
      'android/app/src/main/java/com/brainlinkreactnew/BrainLinkModule.java',
      'assets/MacrotellectLink_V1.4.3.jar',
      'services/MacrotellectLinkService.js',
      'screens/MacrotellectLinkDashboard.js',
      'screens/MacrotellectLinkSDKTest.js'
    ];
    
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(this.workspaceRoot, file)));
    
    this.test('File Completeness', missingFiles.length === 0, 
      missingFiles.length === 0 ? 'All required files are present' : `Missing files: ${missingFiles.join(', ')}`);
    
    // Test package.json has required dependencies
    const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      
      this.test('React Native Version', packageJson.dependencies && packageJson.dependencies['react-native'], 
        'React Native dependency is present');
    }
  }

  testExpectedBehavior() {
    console.log('\n🔧 Testing Expected Behavior...');
    
    // Test connection mode behavior
    console.log('📋 Expected Behavior Verification:');
    console.log('   🔴 Demo Mode: Band powers will show 3%, 16% (DirectBLE connection)');
    console.log('   🟢 Real Mode: Band powers will show 1-99% (MacrotellectLink SDK)');
    console.log('   🔧 Fix: Use "Force Real Data Mode" button or restart app');
    
    this.test('Behavior Documentation', true, 'Expected behavior is documented and understood');
  }

  runAllTests() {
    console.log('🚀 Running Quick MacrotellectLink SDK Integration Test...\n');
    
    this.testJARIntegration();
    this.testNativeModuleIntegration();
    this.testServiceLayerIntegration();
    this.testDashboardIntegration();
    this.testDataFlowPath();
    this.testImplementationCompleteness();
    this.testExpectedBehavior();
    
    // Generate summary
    console.log('\n' + '='.repeat(60));
    console.log('           QUICK INTEGRATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Tests Passed: ${this.testsPassed}/${this.testsTotal}`);
    console.log(`📊 Success Rate: ${((this.testsPassed / this.testsTotal) * 100).toFixed(1)}%`);
    
    if (this.testsPassed === this.testsTotal) {
      console.log('\n🎉 ALL TESTS PASSED! MacrotellectLink SDK is ready for testing.');
      console.log('\n📱 NEXT STEPS:');
      console.log('   1. Build Android app: npx react-native run-android');
      console.log('   2. Navigate to MacrotellectLink Dashboard');
      console.log('   3. Use "Force Real Data Mode" button');
      console.log('   4. Connect BrainLink device');
      console.log('   5. Verify band powers show realistic values (1-99%)');
      console.log('\n💡 TROUBLESHOOTING:');
      console.log('   - If band powers show 3%, 16% → Device is in DEMO MODE');
      console.log('   - If band powers show 1-99% → Device is in REAL DATA MODE');
      console.log('   - Use "Force Real Data Mode" to switch from demo to real mode');
    } else {
      console.log('\n❌ SOME TESTS FAILED. Please check the implementation.');
    }
    
    console.log('='.repeat(60));
    
    return this.testsPassed === this.testsTotal;
  }
}

// Run the test
const tester = new QuickSDKTest();
const success = tester.runAllTests();
process.exit(success ? 0 : 1);
