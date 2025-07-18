/**
 * Test Script for MacrotellectLink Integration
 * This script verifies that the native module is properly integrated
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { MacrotellectLink } = NativeModules;

console.log('=== MacrotellectLink Integration Test ===');
console.log('Platform:', Platform.OS);
console.log('Available Native Modules:', Object.keys(NativeModules));
console.log('MacrotellectLink Module:', MacrotellectLink);

if (MacrotellectLink) {
  console.log('✅ MacrotellectLink native module is available!');
  
  // Test basic functionality
  const testSDK = async () => {
    try {
      console.log('Testing SDK initialization...');
      const result = await MacrotellectLink.initialize();
      console.log('✅ SDK Initialize Result:', result);
      
      console.log('Testing scan functionality...');
      const scanResult = await MacrotellectLink.startScan();
      console.log('✅ Scan Start Result:', scanResult);
      
      setTimeout(async () => {
        try {
          const stopResult = await MacrotellectLink.stopScan();
          console.log('✅ Scan Stop Result:', stopResult);
        } catch (error) {
          console.log('❌ Scan Stop Error:', error);
        }
      }, 2000);
      
    } catch (error) {
      console.log('❌ SDK Test Error:', error);
    }
  };
  
  // Run test after component mount
  setTimeout(testSDK, 1000);
  
} else {
  console.log('❌ MacrotellectLink native module is NOT available');
  console.log('Available modules:', Object.keys(NativeModules));
}

export { MacrotellectLink };
