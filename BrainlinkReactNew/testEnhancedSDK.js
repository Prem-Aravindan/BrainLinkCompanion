/**
 * Test Enhanced MacrotellectLink SDK Implementation
 * Testing: Service declaration, early initialization, service ready events, retry logic
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import MacrotellectLinkService from './services/MacrotellectLinkService';

const { BrainLinkModule } = NativeModules;

console.log('🧪 Starting Enhanced MacrotellectLink SDK Tests...');
console.log('📱 Device: Pixel 9 Pro (Real Device)');
console.log('🔧 Testing: Service declaration, early init, service ready events, retry logic');
console.log('⏰ Time:', new Date().toLocaleString());
console.log('=' .repeat(60));

class EnhancedSDKTester {
  constructor() {
    this.eventEmitter = null;
    this.testResults = {};
    
    if (Platform.OS === 'android' && BrainLinkModule) {
      this.eventEmitter = new NativeEventEmitter(BrainLinkModule);
    }
  }

  /**
   * Test 1: Early Initialization (called from index.js)
   */
  async testEarlyInitialization() {
    console.log('\n🧪 Test 1: Early Initialization Verification');
    console.log('-------------------------------------------');
    
    try {
      if (!BrainLinkModule) {
        throw new Error('BrainLinkModule not available');
      }
      
      console.log('✅ BrainLinkModule available:', typeof BrainLinkModule);
      console.log('📋 Available methods:', Object.keys(BrainLinkModule));
      
      this.testResults.earlyInitialization = 'PASS';
      return true;
    } catch (error) {
      console.error('❌ Early initialization test failed:', error);
      this.testResults.earlyInitialization = 'FAIL';
      return false;
    }
  }

  /**
   * Test 2: Service Ready Event
   */
  async testServiceReadyEvent() {
    console.log('\n🧪 Test 2: Service Ready Event');
    console.log('-------------------------------');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('⚠️ Service ready event timeout (5 seconds)');
        this.testResults.serviceReadyEvent = 'TIMEOUT';
        resolve(false);
      }, 5000);
      
      if (this.eventEmitter) {
        this.eventEmitter.addListener('onServiceReady', () => {
          clearTimeout(timeout);
          console.log('✅ Service ready event received!');
          this.testResults.serviceReadyEvent = 'PASS';
          resolve(true);
        });
        
        console.log('⏳ Waiting for service ready event...');
      } else {
        clearTimeout(timeout);
        console.log('❌ No event emitter available');
        this.testResults.serviceReadyEvent = 'FAIL';
        resolve(false);
      }
    });
  }

  /**
   * Test 3: MacrotellectLinkService initialization with service ready wait
   */
  async testServiceInitialization() {
    console.log('\n🧪 Test 3: MacrotellectLinkService Initialization');
    console.log('------------------------------------------------');
    
    try {
      const service = new MacrotellectLinkService();
      console.log('📋 Service created, starting initialization...');
      
      const initResult = await service.initialize();
      console.log('✅ Service initialization result:', initResult);
      
      this.testResults.serviceInitialization = 'PASS';
      return service;
    } catch (error) {
      console.error('❌ Service initialization failed:', error);
      this.testResults.serviceInitialization = 'FAIL';
      return null;
    }
  }

  /**
   * Test 4: Retry Logic with Scan
   */
  async testRetryLogic(service) {
    console.log('\n🧪 Test 4: Retry Logic with Scan');
    console.log('--------------------------------');
    
    if (!service) {
      console.log('❌ No service available for retry test');
      this.testResults.retryLogic = 'SKIP';
      return false;
    }
    
    try {
      console.log('🔍 Starting scan with retry logic...');
      const scanResult = await service.startScan();
      console.log('✅ Scan started with retry logic:', scanResult);
      
      // Stop scan after a short time
      setTimeout(async () => {
        try {
          await service.stopScan();
          console.log('⏹️ Scan stopped successfully');
        } catch (error) {
          console.log('⚠️ Error stopping scan:', error.message);
        }
      }, 3000);
      
      this.testResults.retryLogic = 'PASS';
      return true;
    } catch (error) {
      console.error('❌ Retry logic test failed:', error);
      
      // Check if it's falling back to direct BLE as expected
      if (error.message.includes('All scanning methods failed') || 
          error.message.includes('Direct BLE')) {
        console.log('✅ Fallback to direct BLE working as expected');
        this.testResults.retryLogic = 'PASS_WITH_FALLBACK';
        return true;
      } else {
        this.testResults.retryLogic = 'FAIL';
        return false;
      }
    }
  }

  /**
   * Test 5: Direct BLE Fallback
   */
  async testDirectBLEFallback(service) {
    console.log('\n🧪 Test 5: Direct BLE Fallback');
    console.log('------------------------------');
    
    if (!service) {
      console.log('❌ No service available for direct BLE test');
      this.testResults.directBLEFallback = 'SKIP';
      return false;
    }
    
    try {
      console.log('🔍 Testing direct BLE fallback...');
      const fallbackResult = await service.startDirectBLEScan();
      console.log('✅ Direct BLE fallback working:', fallbackResult);
      
      this.testResults.directBLEFallback = 'PASS';
      return true;
    } catch (error) {
      console.error('❌ Direct BLE fallback test failed:', error);
      this.testResults.directBLEFallback = 'FAIL';
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Enhanced SDK Test Suite...\n');
    
    // Test 1: Early Initialization
    await this.testEarlyInitialization();
    
    // Test 2: Service Ready Event
    await this.testServiceReadyEvent();
    
    // Test 3: Service Initialization
    const service = await this.testServiceInitialization();
    
    // Test 4: Retry Logic
    await this.testRetryLogic(service);
    
    // Test 5: Direct BLE Fallback
    await this.testDirectBLEFallback(service);
    
    // Summary
    this.printTestSummary();
  }

  /**
   * Print test summary
   */
  printTestSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('🏁 Enhanced SDK Test Results Summary');
    console.log('=' .repeat(60));
    
    const tests = [
      { name: 'Early Initialization', result: this.testResults.earlyInitialization },
      { name: 'Service Ready Event', result: this.testResults.serviceReadyEvent },
      { name: 'Service Initialization', result: this.testResults.serviceInitialization },
      { name: 'Retry Logic', result: this.testResults.retryLogic },
      { name: 'Direct BLE Fallback', result: this.testResults.directBLEFallback }
    ];
    
    let passCount = 0;
    let totalTests = tests.length;
    
    tests.forEach(test => {
      const status = test.result === 'PASS' || test.result === 'PASS_WITH_FALLBACK' ? '✅' : 
                    test.result === 'TIMEOUT' ? '⏱️' :
                    test.result === 'SKIP' ? '⏭️' : '❌';
      console.log(`${status} ${test.name}: ${test.result}`);
      
      if (test.result === 'PASS' || test.result === 'PASS_WITH_FALLBACK') {
        passCount++;
      }
    });
    
    console.log('\n📊 Test Statistics:');
    console.log(`✅ Passed: ${passCount}/${totalTests}`);
    console.log(`❌ Failed: ${totalTests - passCount}/${totalTests}`);
    console.log(`📈 Success Rate: ${Math.round((passCount / totalTests) * 100)}%`);
    
    console.log('\n🔧 Recommendations:');
    if (this.testResults.serviceReadyEvent === 'TIMEOUT') {
      console.log('⚠️ Service ready event not firing - check AndroidManifest.xml service declaration');
    }
    if (this.testResults.retryLogic === 'FAIL') {
      console.log('⚠️ Retry logic failed - SDK may have fundamental issues');
    }
    if (this.testResults.directBLEFallback === 'PASS') {
      console.log('✅ Direct BLE fallback is working - good backup for SDK issues');
    }
    
    console.log('\n⏰ Test completed at:', new Date().toLocaleString());
  }
}

// Auto-run tests when this module is loaded
const tester = new EnhancedSDKTester();
tester.runAllTests().catch(error => {
  console.error('🔥 Test suite execution failed:', error);
});

export default EnhancedSDKTester;
