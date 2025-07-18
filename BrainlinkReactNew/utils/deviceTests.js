/**
 * Device connection test - Run this to test connection with your actual device
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PermissionService from '../services/PermissionService';
import MacrotellectLinkService from '../services/MacrotellectLinkService';

export const runDeviceTests = async () => {
  console.log('\n🔬 === DEVICE DIAGNOSTIC TESTS ===\n');
  
  // 1. Platform check
  console.log('📱 Platform:', Platform.OS, Platform.Version);
  
  // 2. AsyncStorage test
  console.log('\n📦 Testing AsyncStorage...');
  try {
    await AsyncStorage.setItem('test', 'working');
    const value = await AsyncStorage.getItem('test');
    console.log(value === 'working' ? '✅ AsyncStorage: WORKING' : '❌ AsyncStorage: FAILED');
    await AsyncStorage.removeItem('test');
  } catch (error) {
    console.log('❌ AsyncStorage ERROR:', error.message);
  }
  
  // 3. Permissions test
  console.log('\n🔐 Testing Bluetooth Permissions...');
  try {
    const hasPermissions = await PermissionService.checkBluetoothPermissions();
    console.log('Current permissions:', hasPermissions ? '✅ GRANTED' : '⚠️ NOT GRANTED');
    
    if (!hasPermissions) {
      console.log('🔄 Requesting permissions...');
      const granted = await PermissionService.requestBluetoothPermissions();
      console.log('Permission request result:', granted ? '✅ GRANTED' : '❌ DENIED');
    }
  } catch (error) {
    console.log('❌ Permission test ERROR:', error.message);
  }
  
  // 4. Native module test
  console.log('\n🔗 Testing BrainLink Native Module...');
  try {
    await MacrotellectLinkService.initialize();
    console.log('✅ BrainLink module: INITIALIZED');
    
    const status = await MacrotellectLinkService.getConnectionStatus();
    console.log('📡 Connection status:', status);
  } catch (error) {
    console.log('❌ Native module ERROR:', error.message);
  }
  
  // 5. Bluetooth scan test
  console.log('\n📡 Testing Bluetooth Scan...');
  try {
    console.log('🔍 Starting scan...');
    await MacrotellectLinkService.startScan();
    
    // Listen for devices
    let deviceCount = 0;
    const unsubscribe = MacrotellectLinkService.onConnectionChange((status, device) => {
      if (status === 'found') {
        deviceCount++;
        console.log(`📱 Device found (#${deviceCount}):`, device?.name || 'Unknown');
      }
    });
    
    // Stop after 15 seconds
    setTimeout(async () => {
      await MacrotellectLinkService.stopScan();
      unsubscribe && unsubscribe();
      console.log(`✅ Scan completed. Found ${deviceCount} devices.`);
    }, 15000);
    
  } catch (error) {
    console.log('❌ Bluetooth scan ERROR:', error.message);
  }
  
  console.log('\n🎯 Device tests initiated. Check logs for results.');
};

// Export for easy import
export default runDeviceTests;
