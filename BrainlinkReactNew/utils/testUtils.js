/**
 * Test AsyncStorage functionality
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const testAsyncStorage = async () => {
  console.log('🧪 Testing AsyncStorage...');
  
  try {
    // Test storing data
    const testKey = 'test_key';
    const testValue = 'test_value_' + Date.now();
    
    await AsyncStorage.setItem(testKey, testValue);
    console.log('✅ AsyncStorage.setItem successful');
    
    // Test retrieving data
    const retrievedValue = await AsyncStorage.getItem(testKey);
    console.log('✅ AsyncStorage.getItem successful, value:', retrievedValue);
    
    if (retrievedValue === testValue) {
      console.log('✅ AsyncStorage test PASSED');
      return true;
    } else {
      console.log('❌ AsyncStorage test FAILED - values don\'t match');
      return false;
    }
  } catch (error) {
    console.log('❌ AsyncStorage test FAILED with error:', error.message);
    return false;
  }
};

export const testBluetoothPermissions = async () => {
  console.log('🔵 Testing Bluetooth Permissions...');
  
  try {
    const PermissionService = require('../services/PermissionService').default;
    
    // Check current permissions
    const hasPermissions = await PermissionService.checkBluetoothPermissions();
    console.log('📱 Current permissions status:', hasPermissions);
    
    if (!hasPermissions) {
      console.log('🔄 Requesting permissions...');
      const granted = await PermissionService.requestBluetoothPermissions();
      console.log('📋 Permission request result:', granted);
      return granted;
    }
    
    console.log('✅ Bluetooth permissions test PASSED');
    return true;
  } catch (error) {
    console.log('❌ Bluetooth permissions test FAILED:', error.message);
    return false;
  }
};

export const runAllTests = async () => {
  console.log('🚀 Running all tests...\n');
  
  const asyncStorageResult = await testAsyncStorage();
  const bluetoothResult = await testBluetoothPermissions();
  
  console.log('\n📊 Test Results:');
  console.log('AsyncStorage:', asyncStorageResult ? '✅ PASS' : '❌ FAIL');
  console.log('Bluetooth Permissions:', bluetoothResult ? '✅ PASS' : '❌ FAIL');
  
  return {
    asyncStorage: asyncStorageResult,
    bluetooth: bluetoothResult,
    allPassed: asyncStorageResult && bluetoothResult
  };
};
