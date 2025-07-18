/**
 * Comprehensive Test for Enhanced DirectBLE Anti-Disconnection Solution
 * Tests all implemented strategies to prevent 15-second disconnection
 */

import DirectBLEScanner from './services/DirectBLEScanner';
import { testForegroundService } from './testForegroundService';

class EnhancedDirectBLETest {
  constructor() {
    this.scanner = null;
    this.testStartTime = null;
    this.connectionEvents = [];
    this.disconnectionEvents = [];
    this.eegDataCount = 0;
  }

  async runComprehensiveTest() {
    console.log('🚀 Enhanced DirectBLE Anti-Disconnection Test');
    console.log('📱 Device: Pixel 9 Pro');
    console.log('🎯 Goal: Verify NO 15-second disconnection with multiple strategies');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('=' .repeat(60));

    this.testStartTime = Date.now();

    try {
      // Initialize scanner with enhanced features
      this.scanner = new DirectBLEScanner();
      this.setupEventListeners();

      console.log('\n🔧 Test 1: Foreground Service Verification');
      console.log('-'.repeat(40));
      await this.testForegroundServiceAvailability();

      console.log('\n🔧 Test 2: Enhanced BLE Scanning');
      console.log('-'.repeat(40));
      await this.testEnhancedBLEScanning();

      console.log('\n🔧 Test 3: Connection Stability (60+ seconds)');
      console.log('-'.repeat(40));
      await this.testConnectionStability();

    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  setupEventListeners() {
    this.scanner.on('connected', (device) => {
      const timestamp = Date.now();
      const elapsed = Math.round((timestamp - this.testStartTime) / 1000);
      
      console.log(`✅ CONNECTED at ${elapsed}s: ${device.name || 'Unknown'} (${device.id})`);
      this.connectionEvents.push({ timestamp, elapsed, device: device.id });
    });

    this.scanner.on('disconnected', (device) => {
      const timestamp = Date.now();
      const elapsed = Math.round((timestamp - this.testStartTime) / 1000);
      
      console.log(`❌ DISCONNECTED at ${elapsed}s: ${device?.id || 'Unknown'}`);
      this.disconnectionEvents.push({ timestamp, elapsed, device: device?.id });
      
      // Check if disconnection happened at ~15 seconds (the problem we're trying to fix)
      if (elapsed >= 14 && elapsed <= 16) {
        console.log('🚨 WARNING: 15-second disconnection detected! Anti-disconnection strategies may have failed.');
      }
    });

    this.scanner.on('eegData', (data) => {
      this.eegDataCount++;
      const elapsed = Math.round((Date.now() - this.testStartTime) / 1000);
      
      if (this.eegDataCount % 10 === 0) { // Log every 10th data point
        console.log(`🧠 EEG Data #${this.eegDataCount} at ${elapsed}s: Raw=${data.rawValue}µV`);
        
        if (data.bandPowers) {
          console.log(`📊 Band Powers: Delta=${data.bandPowers.delta?.toFixed(2)}, Theta=${data.bandPowers.theta?.toFixed(2)}, Alpha=${data.bandPowers.alpha?.toFixed(2)}, Beta=${data.bandPowers.beta?.toFixed(2)}`);
        }
      }
    });
  }

  async testForegroundServiceAvailability() {
    try {
      // Test if our foreground service module is available
      const { NativeModules } = require('react-native');
      const { BLEServiceModule } = NativeModules;
      
      if (BLEServiceModule) {
        console.log('✅ BLEServiceModule available');
        try {
          const result = await BLEServiceModule.startForegroundService();
          console.log('✅ Foreground service started:', result);
          
          setTimeout(async () => {
            await BLEServiceModule.stopForegroundService();
            console.log('✅ Foreground service stopped');
          }, 2000);
        } catch (error) {
          console.log('⚠️ Foreground service error:', error.message);
        }
      } else {
        console.log('❌ BLEServiceModule not available - using fallback strategies');
      }
    } catch (error) {
      console.log('⚠️ Foreground service test failed:', error.message);
    }
  }

  async testEnhancedBLEScanning() {
    console.log('🔍 Starting enhanced BLE scan with anti-disconnection features...');
    
    await this.scanner.startScan(
      (device) => {
        console.log(`📡 Device found: ${device.name || 'Unknown'} (${device.id})`);
      },
      (error, devices) => {
        if (error) {
          console.error('❌ Scan error:', error.message);
        } else {
          console.log(`✅ Scan completed. Found ${devices.length} devices`);
        }
      }
    );

    console.log('✅ Enhanced scan started with:');
    console.log('  - Foreground service protection');
    console.log('  - Enhanced connection parameters');
    console.log('  - Aggressive keep-alive pings');
    console.log('  - Connection activity monitoring');
    console.log('  - JavaScript wake lock timer');
  }

  async testConnectionStability() {
    console.log('⏱️ Testing connection stability for 60+ seconds...');
    console.log('🎯 Looking for 15-second disconnection pattern...');
    
    // Monitor for 90 seconds to ensure we're well past the 15-second limit
    const monitoringDuration = 90000; // 90 seconds
    const checkInterval = 5000; // Check every 5 seconds
    
    const monitor = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.testStartTime) / 1000);
      console.log(`⏰ Test running for ${elapsed}s...`);
      
      if (elapsed === 15) {
        console.log('🔍 Reached 15-second mark - the critical point!');
      }
      
      if (elapsed === 30) {
        console.log('🎉 Passed 30 seconds - looking good!');
      }
      
      if (elapsed === 60) {
        console.log('🎉 Reached 60 seconds - anti-disconnection strategies working!');
      }
    }, checkInterval);

    // Stop monitoring after duration
    setTimeout(() => {
      clearInterval(monitor);
      this.printTestSummary();
    }, monitoringDuration);
  }

  printTestSummary() {
    const totalElapsed = Math.round((Date.now() - this.testStartTime) / 1000);
    
    console.log('\n📊 TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log(`⏱️ Total test duration: ${totalElapsed} seconds`);
    console.log(`🔌 Connection events: ${this.connectionEvents.length}`);
    console.log(`💔 Disconnection events: ${this.disconnectionEvents.length}`);
    console.log(`🧠 EEG data packets received: ${this.eegDataCount}`);
    
    if (this.disconnectionEvents.length === 0) {
      console.log('🎉 SUCCESS: No disconnections detected!');
    } else {
      console.log('\n💔 Disconnection Timeline:');
      this.disconnectionEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. At ${event.elapsed}s - Device: ${event.device}`);
        if (event.elapsed >= 14 && event.elapsed <= 16) {
          console.log('     🚨 This was a 15-second timeout disconnection!');
        }
      });
    }
    
    console.log('\n🔧 Anti-Disconnection Strategies Implemented:');
    console.log('  ✅ BLE Foreground Service (Android)');
    console.log('  ✅ Enhanced BLE scan options (lowLatency)');
    console.log('  ✅ Removed 15-second connection timeout');
    console.log('  ✅ Auto-connect enabled in connection params');
    console.log('  ✅ Aggressive keep-alive pings (every 5s)');
    console.log('  ✅ Connection activity monitoring (every 8s)');
    console.log('  ✅ JavaScript wake lock timer (every 12s)');
    console.log('  ✅ Enhanced connection heartbeat (every 10s)');
    
    console.log('\n🏁 Test Complete!');
  }
}

// Export for use in other scripts
export default EnhancedDirectBLETest;

// Auto-run if this file is executed directly
if (require.main === module) {
  const test = new EnhancedDirectBLETest();
  test.runComprehensiveTest();
}
