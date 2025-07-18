/**
 * Test script for BLE Foreground Service
 * Verifies the 15-second disconnection fix
 */

import { NativeModules } from 'react-native';
import DirectBLEServiceManager from './services/DirectBLEServiceManager';
import DirectBLEScanner from './services/DirectBLEScanner';

const { BLEServiceModule } = NativeModules;

async function testForegroundService() {
  console.log('🚀 Testing BLE Foreground Service...');
  console.log('📱 Device: Pixel 9 Pro');
  console.log('🎯 Goal: Verify no 15-second disconnection');
  console.log('=' .repeat(50));

  try {
    // Test 1: Direct native module call
    console.log('\n🔧 Test 1: Direct Native Module Call');
    console.log('-'.repeat(30));
    
    if (BLEServiceModule) {
      const result = await BLEServiceModule.startForegroundService();
      console.log('✅ Native module result:', result);
      
      // Wait 2 seconds then stop
      setTimeout(async () => {
        const stopResult = await BLEServiceModule.stopForegroundService();
        console.log('✅ Stop result:', stopResult);
      }, 2000);
    } else {
      console.error('❌ BLEServiceModule not available');
    }

    // Test 2: Service Manager wrapper
    console.log('\n🔧 Test 2: Service Manager Wrapper');
    console.log('-'.repeat(30));
    
    const serviceManager = new DirectBLEServiceManager();
    const startResult = await serviceManager.startForegroundService();
    console.log('✅ Service manager start:', startResult);
    
    setTimeout(async () => {
      const stopResult = await serviceManager.stopForegroundService();
      console.log('✅ Service manager stop:', stopResult);
    }, 3000);

    // Test 3: DirectBLE with foreground service
    console.log('\n🔧 Test 3: DirectBLE with Foreground Service');
    console.log('-'.repeat(30));
    console.log('🎯 This should NOT disconnect after 15 seconds');
    
    const scanner = new DirectBLEScanner();
    
    scanner.on('deviceFound', (device) => {
      console.log(`📱 Found device: ${device.name || 'Unknown'} (${device.id})`);
    });
    
    scanner.on('connected', (device) => {
      console.log(`🔗 Connected to: ${device.name || 'Unknown'} (${device.id})`);
      console.log('⏱️ Monitor connection for > 15 seconds...');
    });
    
    scanner.on('disconnected', (device) => {
      console.log(`💔 Disconnected from: ${device.name || 'Unknown'} (${device.id})`);
    });
    
    scanner.on('eegData', (data) => {
      console.log(`🧠 EEG Data: Raw=${data.rawValue}, Bands=${JSON.stringify(data.bandPowers)}`);
    });

    // Start the enhanced scan with foreground service
    await scanner.startScan(
      (device) => console.log(`📡 Scan found: ${device.name}`),
      (error, devices) => {
        if (error) {
          console.error('❌ Scan finished with error:', error.message);
        } else {
          console.log(`✅ Scan finished. Found ${devices.length} devices`);
        }
      }
    );

    // Stop after 30 seconds (well past the 15-second limit)
    setTimeout(async () => {
      console.log('\n⏰ 30 seconds elapsed - stopping scan');
      await scanner.stopScan();
      console.log('🏁 Test complete!');
    }, 30000);

    console.log('\n📊 Expected Results:');
    console.log('✅ BLE foreground service starts successfully');
    console.log('✅ Persistent notification appears');
    console.log('✅ Connection maintained > 15 seconds');
    console.log('✅ No automatic disconnection');
    console.log('✅ Service stops cleanly when scan ends');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in other test scripts
export { testForegroundService };

// Run immediately if this file is executed directly
if (require.main === module) {
  testForegroundService();
}
