/**
 * Manual permission test to verify Bluetooth and AsyncStorage functionality
 * Run this via Metro console by importing it
 */

export const testPermissionsManually = async () => {
  console.log('\n🔧 Manual Permission Test Starting...');
  console.log('📱 Device: Pixel 9 Pro');
  console.log('🕐 Time:', new Date().toLocaleTimeString());
  
  try {
    // Test 1: AsyncStorage
    console.log('\n📦 Testing AsyncStorage...');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('manual_test', 'working');
    const value = await AsyncStorage.getItem('manual_test');
    console.log('✅ AsyncStorage test result:', value === 'working' ? 'PASS' : 'FAIL');
    
    // Test 2: Permission Service
    console.log('\n🔐 Testing Permission Service...');
    const PermissionService = require('./services/PermissionService').default;
    const hasPermissions = await PermissionService.checkBluetoothPermissions();
    console.log('📋 Current permissions status:', hasPermissions);
    
    if (!hasPermissions) {
      console.log('🔄 Requesting permissions...');
      const granted = await PermissionService.requestBluetoothPermissions();
      console.log('📝 Permission request result:', granted);
    }
    
    // Test 3: MacrotellectLink Scan (should now work with permissions)
    console.log('\n🔍 Testing MacrotellectLink Scan...');
    const MacrotellectLinkService = require('./services/MacrotellectLinkService').default;
    
    if (MacrotellectLinkService.isAvailable()) {
      await MacrotellectLinkService.initialize();
      console.log('✅ MacrotellectLink initialized');
      
      try {
        await MacrotellectLinkService.startScan();
        console.log('✅ Device scan started successfully!');
        
        // Stop scan after 5 seconds
        setTimeout(async () => {
          await MacrotellectLinkService.stopScan();
          console.log('⏹️ Scan stopped');
        }, 5000);
        
      } catch (error) {
        console.error('❌ Scan failed:', error.message);
      }
    } else {
      console.log('ℹ️ MacrotellectLink not available - using demo mode');
    }
    
    console.log('\n🎉 Manual test complete!');
    
  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
};

// Auto-run if this file is imported
console.log('📋 Manual test module loaded. Call testPermissionsManually() to run tests.');

export default testPermissionsManually;
