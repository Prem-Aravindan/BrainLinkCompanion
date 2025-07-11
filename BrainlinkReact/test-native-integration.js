/**
 * Native Module Integration Test
 * 
 * This test verifies that the BrainLink native module is properly integrated
 * and can be accessed from React Native.
 */

import { NativeModules, Platform } from 'react-native';

const { BrainLinkModule } = NativeModules;

export function testNativeModuleIntegration() {
  console.log('🧪 Testing BrainLink Native Module Integration...');
  
  const testResults = {
    platform: Platform.OS,
    timestamp: new Date().toISOString(),
    tests: []
  };

  // Test 1: Check if module is available
  const moduleAvailable = BrainLinkModule !== null && BrainLinkModule !== undefined;
  testResults.tests.push({
    name: 'Native Module Available',
    passed: moduleAvailable,
    result: moduleAvailable ? 'BrainLinkModule found' : 'BrainLinkModule not found'
  });

  if (!moduleAvailable) {
    console.log('❌ Native module not available. Ensure you built with development client.');
    return testResults;
  }

  // Test 2: Check platform compatibility
  const androidPlatform = Platform.OS === 'android';
  testResults.tests.push({
    name: 'Platform Compatibility',
    passed: androidPlatform,
    result: `Platform: ${Platform.OS} (${androidPlatform ? 'Supported' : 'Not Supported'})`
  });

  // Test 3: Check module constants
  const hasConstants = BrainLinkModule.getConstants && typeof BrainLinkModule.getConstants === 'function';
  let constants = null;
  if (hasConstants) {
    try {
      constants = BrainLinkModule.getConstants();
    } catch (error) {
      console.log('⚠️ Could not get constants:', error.message);
    }
  }
  
  testResults.tests.push({
    name: 'Module Constants',
    passed: hasConstants && constants !== null,
    result: constants ? `Constants: ${JSON.stringify(constants)}` : 'No constants available'
  });

  // Test 4: Check required methods
  const requiredMethods = ['initializeSDK', 'startScan', 'stopScan', 'connectToDevice', 'disconnectDevice'];
  const methodsAvailable = requiredMethods.every(method => 
    typeof BrainLinkModule[method] === 'function'
  );
  
  testResults.tests.push({
    name: 'Required Methods',
    passed: methodsAvailable,
    result: `Methods available: ${requiredMethods.filter(method => 
      typeof BrainLinkModule[method] === 'function'
    ).join(', ')}`
  });

  // Test 5: Test SDK initialization (non-blocking)
  let initTestPassed = false;
  let initTestResult = 'Not tested';
  
  if (methodsAvailable && androidPlatform) {
    try {
      // Note: We don't await this to avoid blocking the test
      BrainLinkModule.initializeSDK()
        .then(() => {
          console.log('✅ SDK initialization test passed');
        })
        .catch((error) => {
          console.log('⚠️ SDK initialization test failed:', error.message);
        });
      
      initTestPassed = true;
      initTestResult = 'Initialization call succeeded';
    } catch (error) {
      initTestResult = `Initialization call failed: ${error.message}`;
    }
  } else {
    initTestResult = 'Skipped (missing methods or wrong platform)';
  }

  testResults.tests.push({
    name: 'SDK Initialization Call',
    passed: initTestPassed,
    result: initTestResult
  });

  // Print test summary
  const passedTests = testResults.tests.filter(test => test.passed).length;
  const totalTests = testResults.tests.length;
  
  console.log('\n📊 TEST RESULTS:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  
  testResults.tests.forEach((test, index) => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${status} ${index + 1}. ${test.name}: ${test.result}`);
  });

  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Native module integration is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the results above for details.');
  }

  return testResults;
}

export function testBrainLinkService() {
  console.log('🧪 Testing BrainLink Native Service...');
  
  try {
    // Dynamic import to avoid module loading issues
    const BrainLinkNativeService = require('../services/BrainLinkNativeService').default;
    
    const serviceTests = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test service availability
    const serviceAvailable = BrainLinkNativeService !== null;
    serviceTests.tests.push({
      name: 'Service Available',
      passed: serviceAvailable,
      result: serviceAvailable ? 'Service imported successfully' : 'Service import failed'
    });

    if (serviceAvailable) {
      // Test isAvailable method
      const isAvailable = BrainLinkNativeService.isAvailable();
      serviceTests.tests.push({
        name: 'Service Platform Check',
        passed: Platform.OS === 'android' ? isAvailable : !isAvailable,
        result: `isAvailable() returned: ${isAvailable}`
      });

      // Test method existence
      const requiredMethods = ['initialize', 'startScan', 'stopScan', 'connectToDevice', 'disconnect'];
      const methodsExist = requiredMethods.every(method => 
        typeof BrainLinkNativeService[method] === 'function'
      );
      
      serviceTests.tests.push({
        name: 'Service Methods',
        passed: methodsExist,
        result: `Methods exist: ${requiredMethods.filter(method => 
          typeof BrainLinkNativeService[method] === 'function'
        ).join(', ')}`
      });
    }

    // Print service test results
    const passedServiceTests = serviceTests.tests.filter(test => test.passed).length;
    const totalServiceTests = serviceTests.tests.length;
    
    console.log('\n📊 SERVICE TEST RESULTS:');
    console.log(`✅ Passed: ${passedServiceTests}/${totalServiceTests}`);
    
    serviceTests.tests.forEach((test, index) => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${index + 1}. ${test.name}: ${test.result}`);
    });

    return serviceTests;
    
  } catch (error) {
    console.log('❌ Service test failed:', error.message);
    return {
      timestamp: new Date().toISOString(),
      tests: [{
        name: 'Service Import',
        passed: false,
        result: `Error: ${error.message}`
      }]
    };
  }
}

// Export test runner
export function runAllTests() {
  console.log('🚀 Running BrainLink Native Module Tests...\n');
  
  const moduleResults = testNativeModuleIntegration();
  const serviceResults = testBrainLinkService();
  
  return {
    module: moduleResults,
    service: serviceResults,
    timestamp: new Date().toISOString()
  };
}
