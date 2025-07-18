/**
 * Real Device Connection Test
 * Tests both MacrotellectLink SDK and direct BLE scanning
 */

import DirectBLEScanner from '../services/DirectBLEScanner';
import MacrotellectLinkService from '../services/MacrotellectLinkService';

export const testRealDeviceConnection = async () => {
  console.log('\n🔍 === REAL DEVICE CONNECTION TEST ===');
  console.log('📱 Device: Pixel 9 Pro');
  console.log('🎯 Goal: Find and connect to real BrainLink devices');
  console.log('⏰ Time:', new Date().toLocaleTimeString());
  
  let results = {
    macrotellectScan: false,
    directBleScan: false,
    devicesFound: [],
    method: null
  };
  
  try {
    // Method 1: Try MacrotellectLink SDK first
    console.log('\n🧠 Method 1: Testing MacrotellectLink SDK scanning...');
    
    try {
      if (MacrotellectLinkService.isAvailable()) {
        await MacrotellectLinkService.initialize();
        console.log('✅ MacrotellectLink SDK initialized');
        
        await MacrotellectLinkService.startScan();
        console.log('✅ MacrotellectLink scan started successfully!');
        results.macrotellectScan = true;
        results.method = 'MacrotellectLink SDK';
        
        // Wait for devices
        await new Promise(resolve => setTimeout(resolve, 10000));
        await MacrotellectLinkService.stopScan();
        
      } else {
        console.log('⚠️ MacrotellectLink SDK not available');
      }
    } catch (error) {
      console.log('❌ MacrotellectLink scan failed:', error.message);
      results.macrotellectScan = false;
    }
    
    // Method 2: Direct BLE scanning (always test this for real connections)
    console.log('\n📡 Method 2: Testing Direct BLE scanning...');
    
    try {
      const bleScanner = new DirectBLEScanner();
      
      const devicesFound = [];
      const scanPromise = new Promise((resolve) => {
        bleScanner.startScan(
          (device) => {
            console.log('🧠 BrainLink device found via direct BLE:', device);
            devicesFound.push(device);
          },
          (allDevices) => {
            console.log(`✅ Direct BLE scan completed. Found ${allDevices.length} devices`);
            resolve(allDevices);
          }
        );
      });
      
      // Wait for scan to complete
      const foundDevices = await scanPromise;
      
      results.directBleScan = true;
      results.devicesFound = foundDevices;
      results.method = results.method || 'Direct BLE';
      
      console.log('✅ Direct BLE scan successful!');
      
      // Cleanup
      bleScanner.destroy();
      
    } catch (error) {
      console.log('❌ Direct BLE scan failed:', error.message);
      results.directBleScan = false;
    }
    
    // Summary
    console.log('\n📊 === REAL DEVICE TEST RESULTS ===');
    console.log(`MacrotellectLink SDK: ${results.macrotellectScan ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Direct BLE Scanning: ${results.directBleScan ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Devices Found: ${results.devicesFound.length}`);
    console.log(`Working Method: ${results.method || 'None'}`);
    
    if (results.devicesFound.length > 0) {
      console.log('\n🧠 Found BrainLink Devices:');
      results.devicesFound.forEach((device, index) => {
        console.log(`  ${index + 1}. ${device.name} (${device.address}) - RSSI: ${device.rssi}`);
      });
    } else {
      console.log('\n💡 No BrainLink devices found. Tips:');
      console.log('   • Ensure BrainLink device is powered on');
      console.log('   • Make sure device is not already connected to another app');
      console.log('   • Try moving closer to the device');
      console.log('   • Check if device needs to be in pairing mode');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Real device test failed:', error);
    return results;
  }
};

export default testRealDeviceConnection;
