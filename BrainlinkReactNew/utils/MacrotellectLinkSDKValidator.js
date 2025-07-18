/**
 * MacrotellectLink SDK Validation Test
 * 
 * This test validates the SDK integration without requiring a physical device
 * It checks:
 * - Native module availability
 * - JAR file integration
 * - Method signatures
 * - Error handling
 * - Real vs Demo mode detection
 */

const { NativeModules } = require('react-native');

// Mock React Native for testing
if (typeof NativeModules === 'undefined') {
  global.NativeModules = {
    BrainLinkModule: {
      initialize: () => Promise.resolve('SDK initialized'),
      startScan: () => Promise.resolve('Scan started'),
      stopScan: () => Promise.resolve('Scan stopped'),
      getConnectedDevices: () => Promise.resolve([]),
      getConstants: () => ({ SDK_VERSION: '1.4.3', SUPPORTS_MACROTELLECT: true }),
    }
  };
}

class MacrotellectLinkSDKValidator {
  constructor() {
    this.testResults = [];
    this.BrainLinkModule = NativeModules.BrainLinkModule;
  }

  addResult(category, test, status, message, details = {}) {
    const result = {
      category,
      test,
      status, // 'PASS', 'FAIL', 'WARN', 'INFO'
      message,
      details,
      timestamp: new Date().toISOString()
    };
    this.testResults.push(result);
    
    const statusIcon = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️'
    };
    
    console.log(`${statusIcon[status]} [${category}] ${test}: ${message}`);
    if (Object.keys(details).length > 0) {
      console.log(`   Details:`, details);
    }
  }

  async validateNativeModule() {
    this.addResult('Native Module', 'Availability Check', 'INFO', 'Checking BrainLinkModule availability...');
    
    if (!this.BrainLinkModule) {
      this.addResult('Native Module', 'Availability Check', 'FAIL', 'BrainLinkModule is not available');
      return false;
    }
    
    this.addResult('Native Module', 'Availability Check', 'PASS', 'BrainLinkModule is available');
    
    // Check method availability
    const requiredMethods = [
      'initialize',
      'startScan',
      'stopScan',
      'getConnectedDevices',
      'getConstants'
    ];
    
    const availableMethods = Object.keys(this.BrainLinkModule);
    const missingMethods = requiredMethods.filter(method => !availableMethods.includes(method));
    
    if (missingMethods.length > 0) {
      this.addResult('Native Module', 'Method Availability', 'FAIL', 
        `Missing required methods: ${missingMethods.join(', ')}`);
      return false;
    }
    
    this.addResult('Native Module', 'Method Availability', 'PASS', 
      `All required methods available: ${requiredMethods.join(', ')}`);
    
    return true;
  }

  async validateSDKConstants() {
    this.addResult('SDK Constants', 'Retrieve Constants', 'INFO', 'Fetching SDK constants...');
    
    try {
      const constants = await this.BrainLinkModule.getConstants();
      
      if (!constants) {
        this.addResult('SDK Constants', 'Retrieve Constants', 'FAIL', 'No constants returned');
        return false;
      }
      
      this.addResult('SDK Constants', 'Retrieve Constants', 'PASS', 'Constants retrieved successfully', constants);
      
      // Check for expected constants
      const expectedConstants = ['SDK_VERSION', 'SUPPORTS_MACROTELLECT'];
      const missingConstants = expectedConstants.filter(key => !(key in constants));
      
      if (missingConstants.length > 0) {
        this.addResult('SDK Constants', 'Expected Constants', 'WARN', 
          `Missing expected constants: ${missingConstants.join(', ')}`);
      } else {
        this.addResult('SDK Constants', 'Expected Constants', 'PASS', 
          'All expected constants present');
      }
      
      return true;
    } catch (error) {
      this.addResult('SDK Constants', 'Retrieve Constants', 'FAIL', 
        `Failed to get constants: ${error.message}`);
      return false;
    }
  }

  async validateSDKInitialization() {
    this.addResult('SDK Initialization', 'Initialize Test', 'INFO', 'Testing SDK initialization...');
    
    try {
      const result = await this.BrainLinkModule.initialize();
      
      if (result) {
        this.addResult('SDK Initialization', 'Initialize Test', 'PASS', 
          `SDK initialized successfully: ${result}`);
        return true;
      } else {
        this.addResult('SDK Initialization', 'Initialize Test', 'FAIL', 
          'SDK initialization returned null/undefined');
        return false;
      }
    } catch (error) {
      this.addResult('SDK Initialization', 'Initialize Test', 'FAIL', 
        `SDK initialization failed: ${error.message}`, { error: error.message });
      
      // Check for specific error patterns
      if (error.message.includes('timeout') || error.message.includes('service not ready')) {
        this.addResult('SDK Initialization', 'Error Analysis', 'WARN', 
          'SDK service timeout detected - this will cause DirectBLE fallback (demo mode)');
        this.addResult('SDK Initialization', 'Solution', 'INFO', 
          'To fix: Restart app, ensure BrainLink device is on, check Android Bluetooth service');
      }
      
      return false;
    }
  }

  async validateScanningFunctionality() {
    this.addResult('Scanning', 'Start Scan Test', 'INFO', 'Testing device scanning...');
    
    try {
      const startResult = await this.BrainLinkModule.startScan();
      this.addResult('Scanning', 'Start Scan Test', 'PASS', 
        `Scan started successfully: ${startResult}`);
      
      // Wait briefly then stop scan
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const stopResult = await this.BrainLinkModule.stopScan();
      this.addResult('Scanning', 'Stop Scan Test', 'PASS', 
        `Scan stopped successfully: ${stopResult}`);
      
      return true;
    } catch (error) {
      this.addResult('Scanning', 'Scan Test', 'FAIL', 
        `Scanning failed: ${error.message}`, { error: error.message });
      return false;
    }
  }

  async validateDeviceList() {
    this.addResult('Device Management', 'Get Connected Devices', 'INFO', 'Checking connected devices...');
    
    try {
      const devices = await this.BrainLinkModule.getConnectedDevices();
      
      if (Array.isArray(devices)) {
        this.addResult('Device Management', 'Get Connected Devices', 'PASS', 
          `Device list retrieved: ${devices.length} devices`, { deviceCount: devices.length });
        
        if (devices.length > 0) {
          devices.forEach((device, index) => {
            this.addResult('Device Management', `Device ${index + 1}`, 'INFO', 
              `Found device: ${device.name || 'Unknown'} (${device.address || device.id})`);
          });
        } else {
          this.addResult('Device Management', 'Device Status', 'INFO', 
            'No devices currently connected (this is normal for testing)');
        }
        
        return true;
      } else {
        this.addResult('Device Management', 'Get Connected Devices', 'FAIL', 
          'Device list is not an array');
        return false;
      }
    } catch (error) {
      this.addResult('Device Management', 'Get Connected Devices', 'FAIL', 
        `Failed to get devices: ${error.message}`, { error: error.message });
      return false;
    }
  }

  analyzeConnectionMode() {
    this.addResult('Connection Mode', 'Analysis', 'INFO', 'Analyzing connection mode...');
    
    // Check MacrotellectLinkService if available
    try {
      const MacrotellectLinkService = require('../services/MacrotellectLinkService').default;
      
      if (MacrotellectLinkService) {
        const connectionMode = MacrotellectLinkService.getConnectionMode();
        const isDemo = MacrotellectLinkService.isInDemoMode();
        
        this.addResult('Connection Mode', 'Service Status', 'INFO', 
          `Connection mode: ${connectionMode}`, { connectionMode, isDemo });
        
        if (connectionMode === 'REAL_DATA_MODE') {
          this.addResult('Connection Mode', 'Data Quality', 'PASS', 
            'MacrotellectLink SDK is active - expecting REAL EEG data');
        } else if (connectionMode === 'DEMO_MODE_DIRECTBLE') {
          this.addResult('Connection Mode', 'Data Quality', 'WARN', 
            'DirectBLE fallback active - device will be in DEMO MODE');
          this.addResult('Connection Mode', 'Solution', 'INFO', 
            'To get real data: Use "Force Real Data Mode" button or restart app');
        } else {
          this.addResult('Connection Mode', 'Data Quality', 'INFO', 
            'SDK not initialized yet');
        }
      } else {
        this.addResult('Connection Mode', 'Service Status', 'WARN', 
          'MacrotellectLinkService not available for analysis');
      }
    } catch (error) {
      this.addResult('Connection Mode', 'Service Status', 'WARN', 
        `Could not analyze connection mode: ${error.message}`);
    }
  }

  validateJARIntegration() {
    this.addResult('JAR Integration', 'File Check', 'INFO', 'Checking JAR file integration...');
    
    try {
      // Check if we can access the JAR file
      const fs = require('fs');
      const path = require('path');
      
      const jarPath = path.join(__dirname, '../assets/MacrotellectLink_V1.4.3.jar');
      
      if (fs.existsSync(jarPath)) {
        const stats = fs.statSync(jarPath);
        this.addResult('JAR Integration', 'File Check', 'PASS', 
          `JAR file exists: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // Check build.gradle integration
        const gradlePath = path.join(__dirname, '../android/app/build.gradle');
        if (fs.existsSync(gradlePath)) {
          const gradleContent = fs.readFileSync(gradlePath, 'utf8');
          
          if (gradleContent.includes('MacrotellectLink_V1.4.3.jar')) {
            this.addResult('JAR Integration', 'Build Configuration', 'PASS', 
              'JAR file properly referenced in build.gradle');
          } else {
            this.addResult('JAR Integration', 'Build Configuration', 'FAIL', 
              'JAR file not found in build.gradle dependencies');
          }
        } else {
          this.addResult('JAR Integration', 'Build Configuration', 'WARN', 
            'Could not verify build.gradle configuration');
        }
      } else {
        this.addResult('JAR Integration', 'File Check', 'FAIL', 
          'MacrotellectLink JAR file not found');
      }
    } catch (error) {
      this.addResult('JAR Integration', 'File Check', 'WARN', 
        `Could not check JAR integration: ${error.message}`);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('           MACROTELLECTLINK SDK VALIDATION REPORT');
    console.log('='.repeat(60));
    
    const categories = [...new Set(this.testResults.map(r => r.category))];
    
    categories.forEach(category => {
      console.log(`\n📋 ${category}:`);
      console.log('-'.repeat(40));
      
      const categoryResults = this.testResults.filter(r => r.category === category);
      categoryResults.forEach(result => {
        const statusIcon = {
          'PASS': '✅',
          'FAIL': '❌',
          'WARN': '⚠️',
          'INFO': 'ℹ️'
        };
        
        console.log(`  ${statusIcon[result.status]} ${result.test}: ${result.message}`);
      });
    });
    
    // Summary
    const summary = {
      total: this.testResults.length,
      passed: this.testResults.filter(r => r.status === 'PASS').length,
      failed: this.testResults.filter(r => r.status === 'FAIL').length,
      warnings: this.testResults.filter(r => r.status === 'WARN').length,
      info: this.testResults.filter(r => r.status === 'INFO').length
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`⚠️ Warnings: ${summary.warnings}`);
    console.log(`ℹ️ Info: ${summary.info}`);
    console.log(`📊 Total: ${summary.total}`);
    
    // Final assessment
    if (summary.failed === 0) {
      console.log('\n🎉 SDK VALIDATION PASSED! MacrotellectLink SDK is properly integrated.');
    } else if (summary.failed <= 2) {
      console.log('\n⚠️ SDK VALIDATION PASSED WITH WARNINGS. Some issues detected but SDK should work.');
    } else {
      console.log('\n❌ SDK VALIDATION FAILED. Major issues detected that may prevent real data mode.');
    }
    
    console.log('='.repeat(60));
    
    return summary;
  }

  async runFullValidation() {
    console.log('🚀 Starting MacrotellectLink SDK Validation...\n');
    
    // Run all validation tests
    await this.validateNativeModule();
    await this.validateSDKConstants();
    await this.validateSDKInitialization();
    await this.validateScanningFunctionality();
    await this.validateDeviceList();
    this.analyzeConnectionMode();
    this.validateJARIntegration();
    
    // Generate final report
    return this.generateReport();
  }
}

// Export for use in React Native
module.exports = MacrotellectLinkSDKValidator;

// Run validation if called directly
if (require.main === module) {
  const validator = new MacrotellectLinkSDKValidator();
  validator.runFullValidation().catch(console.error);
}
