/**
 * Test runner for Enhanced MacrotellectLink SDK Implementation
 * Testing: Service initialization, early init, service ready events, retry logic
 * PRIORITY: BLE Supervision Timeout Prevention (15-second disconnection fix)
 */
import { runAllTests } from './utils/testUtils';
import EnhancedSDKTester from './testEnhancedSDK';
import EnhancedDirectBLETest from './testEnhancedDirectBLE';
import BLESupervisionTimeoutTest from './testBLESupervisionTimeout';

console.log('🚀 Starting Enhanced BrainLink App Tests...');
console.log('📱 Device: Pixel 9 Pro (Real Device)');
console.log('🎯 PRIORITY: BLE Supervision Timeout Prevention');
console.log('⏰ Time:', new Date().toLocaleString());
console.log('=' .repeat(60));

// PRIORITY TEST: BLE Supervision Timeout Prevention
console.log('\n🛡️ PRIORITY Phase: BLE Supervision Timeout Prevention');
console.log('-'.repeat(50));
const supervisionTimeoutTest = new BLESupervisionTimeoutTest();
supervisionTimeoutTest.runSupervisionTimeoutTest().then(() => {
  console.log('\n🔥 Phase 1: Enhanced DirectBLE Anti-Disconnection Tests');
  console.log('-'.repeat(50));
  const directBLETest = new EnhancedDirectBLETest();
  return directBLETest.runComprehensiveTest();
}).then(() => {
  console.log('\n🔥 Phase 2: Enhanced MacrotellectLink SDK Tests');
  console.log('-'.repeat(50));
  const enhancedTester = new EnhancedSDKTester();
  return enhancedTester.runAllTests();
}).then(() => {
  console.log('\n🔥 Phase 3: Legacy AsyncStorage & Bluetooth Tests');
  console.log('-'.repeat(50));
  
  // Run original tests
  return runAllTests();
}).then(results => {
  console.log('\n🏁 ALL Test Execution Complete!');
  console.log('Enhanced SDK + Legacy Results:', results);
}).catch(error => {
  console.error('❌ Test execution failed:', error);
});
