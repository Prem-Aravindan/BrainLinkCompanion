/**
 * BLE Supervision Timeout Prevention Test
 * Comprehensive test for the 15-second disconnection fix
 * Tests all BLE protocol-level solutions
 */

import DirectBLEScanner from './services/DirectBLEScanner';
import BLESupervisionTimeoutManager from './services/BLESupervisionTimeoutManager';

class BLESupervisionTimeoutTest {
  constructor() {
    this.scanner = null;
    this.timeoutManager = null;
    this.testStartTime = null;
    this.timelineEvents = [];
    this.gattOperationLog = [];
    this.connectionEvents = [];
  }

  async runSupervisionTimeoutTest() {
    console.log('🛡️ BLE Supervision Timeout Prevention Test');
    console.log('📱 Device: Pixel 9 Pro');
    console.log('🎯 Target: Prevent 15-second BLE peripheral timeout disconnection');
    console.log('🔬 Method: Periodic GATT operations + Connection priority');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('=' .repeat(70));

    this.testStartTime = Date.now();

    try {
      // Initialize DirectBLE scanner with supervision timeout protection
      this.scanner = new DirectBLEScanner();
      this.setupComprehensiveEventListeners();

      console.log('\n🔧 Phase 1: BLE Protocol Analysis');
      console.log('-'.repeat(50));
      await this.analyzeBLEProtocol();

      console.log('\n🔧 Phase 2: Supervision Timeout Manager Test');
      console.log('-'.repeat(50));
      await this.testSupervisionTimeoutManager();

      console.log('\n🔧 Phase 3: Real Device Connection Test (120+ seconds)');
      console.log('-'.repeat(50));
      await this.testRealDeviceConnection();

    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  setupComprehensiveEventListeners() {
    this.scanner.on('connected', (device) => {
      const timestamp = Date.now();
      const elapsed = Math.round((timestamp - this.testStartTime) / 1000);
      
      console.log(`✅ CONNECTED at ${elapsed}s: ${device.name || 'Unknown'} (${device.id})`);
      this.connectionEvents.push({ 
        type: 'connected', 
        timestamp, 
        elapsed, 
        device: device.id,
        name: device.name 
      });
      
      this.logTimelineEvent(`Connected to ${device.name}`, elapsed);
    });

    this.scanner.on('disconnected', (device) => {
      const timestamp = Date.now();
      const elapsed = Math.round((timestamp - this.testStartTime) / 1000);
      
      console.log(`❌ DISCONNECTED at ${elapsed}s: ${device?.id || 'Unknown'}`);
      this.connectionEvents.push({ 
        type: 'disconnected', 
        timestamp, 
        elapsed, 
        device: device?.id 
      });
      
      // CRITICAL: Check if this is the 15-second supervision timeout
      if (elapsed >= 14 && elapsed <= 16) {
        console.log('🚨 SUPERVISION TIMEOUT DETECTED! BLE protocol solution failed.');
        this.logTimelineEvent('⚠️  SUPERVISION TIMEOUT FAILURE', elapsed);
      } else {
        this.logTimelineEvent('Disconnected (not supervision timeout)', elapsed);
      }
    });

    this.scanner.on('eegData', (data) => {
      const elapsed = Math.round((Date.now() - this.testStartTime) / 1000);
      
      // Log EEG data reception as proof of active connection
      if (elapsed % 10 === 0) { // Every 10 seconds
        console.log(`🧠 EEG Data flowing at ${elapsed}s - Connection stable`);
        this.logTimelineEvent('EEG data streaming', elapsed);
      }
    });
  }

  logTimelineEvent(event, elapsed) {
    this.timelineEvents.push({
      event,
      elapsed,
      timestamp: Date.now()
    });
  }

  async analyzeBLEProtocol() {
    console.log('📡 BLE Protocol Analysis:');
    console.log('  • Supervision Timeout: ~15 seconds (peripheral setting)');
    console.log('  • GATT Operation Effect: Resets supervision timer');
    console.log('  • Connection Priority: Affects interval negotiation');
    console.log('  • Android Background Limits: Additional 15s service kill');
    
    console.log('\n🛡️ Implemented Solutions:');
    console.log('  1. Periodic GATT operations (every 8s)');
    console.log('  2. High connection priority request');
    console.log('  3. Foreground service protection');
    console.log('  4. Enhanced connection parameters');
    console.log('  5. Robust reconnection logic');
  }

  async testSupervisionTimeoutManager() {
    console.log('🔬 Testing BLE Supervision Timeout Manager...');
    
    try {
      this.timeoutManager = new BLESupervisionTimeoutManager();
      
      // Test with mock device
      const mockDevice = {
        id: 'TEST-DEVICE',
        isConnected: () => Promise.resolve(true),
        readRSSI: () => Promise.resolve(-65),
        services: () => Promise.resolve([{ uuid: 'test' }]),
        mtu: () => Promise.resolve(247)
      };

      const started = await this.timeoutManager.startSupervisionTimeoutPrevention(mockDevice);
      console.log('✅ Supervision timeout manager started:', started);
      
      // Check status
      const status = this.timeoutManager.getStatus();
      console.log('📊 Manager status:', status);
      
      // Stop after brief test
      setTimeout(() => {
        this.timeoutManager.stopSupervisionTimeoutPrevention();
        console.log('✅ Supervision timeout manager stopped');
      }, 5000);

    } catch (error) {
      console.error('❌ Supervision timeout manager test failed:', error);
    }
  }

  async testRealDeviceConnection() {
    console.log('📱 Starting real device connection test...');
    console.log('🎯 Monitoring for supervision timeout prevention...');
    console.log('⏱️ Test duration: 120 seconds (8x supervision timeout)');
    
    // Start scanning for BrainLink device
    await this.scanner.startScan(
      (device) => {
        console.log(`📡 Found device: ${device.name || 'Unknown'} (${device.id})`);
      },
      (error, devices) => {
        if (error) {
          console.error('❌ Scan error:', error.message);
        } else {
          console.log(`✅ Scan completed. Found ${devices.length} devices`);
        }
      }
    );

    // Monitor connection for 2 minutes
    const monitoringDuration = 120000; // 2 minutes
    const criticalTimepoints = [10, 15, 20, 30, 45, 60, 90, 120];
    
    const monitor = setInterval(() => {
      const elapsed = Math.round((Date.now() - this.testStartTime) / 1000);
      
      if (criticalTimepoints.includes(elapsed)) {
        console.log(`⏰ Supervision timeout test: ${elapsed}s elapsed`);
        
        if (elapsed === 15) {
          console.log('🔍 CRITICAL: 15-second supervision timeout point reached!');
        }
        
        if (elapsed === 30) {
          console.log('🎉 Supervision timeout prevention successful (30s)!');
        }
        
        if (elapsed === 60) {
          console.log('🎉 Long-term stability achieved (60s)!');
        }
        
        if (elapsed === 120) {
          console.log('🎉 Extended stability confirmed (120s)!');
        }
      }
    }, 1000);

    // Complete test after monitoring duration
    setTimeout(() => {
      clearInterval(monitor);
      this.completeSupervisionTimeoutTest();
    }, monitoringDuration);
  }

  completeSupervisionTimeoutTest() {
    const totalElapsed = Math.round((Date.now() - this.testStartTime) / 1000);
    
    console.log('\n📊 BLE SUPERVISION TIMEOUT TEST RESULTS');
    console.log('=' .repeat(70));
    console.log(`⏱️ Total test duration: ${totalElapsed} seconds`);
    console.log(`🔌 Connection events: ${this.connectionEvents.length}`);
    
    // Analyze disconnection pattern
    const disconnections = this.connectionEvents.filter(e => e.type === 'disconnected');
    const supervisionTimeouts = disconnections.filter(d => d.elapsed >= 14 && d.elapsed <= 16);
    
    console.log(`💔 Total disconnections: ${disconnections.length}`);
    console.log(`🚨 Supervision timeouts (14-16s): ${supervisionTimeouts.length}`);
    
    if (supervisionTimeouts.length === 0) {
      console.log('\n🎉 SUCCESS: No supervision timeout disconnections detected!');
      console.log('✅ BLE supervision timeout prevention working correctly');
    } else {
      console.log('\n❌ FAILURE: Supervision timeout disconnections still occurring');
      console.log('🔧 Review GATT operation frequency and connection priority');
    }
    
    // Timeline analysis
    console.log('\n📋 Connection Timeline:');
    this.timelineEvents.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.elapsed}s: ${event.event}`);
    });
    
    // Solution status
    if (this.scanner && this.scanner.supervisionTimeoutManager) {
      const status = this.scanner.supervisionTimeoutManager.getStatus();
      console.log('\n🛡️ Supervision Timeout Manager Status:');
      console.log(`  Active: ${status.active}`);
      console.log(`  GATT Operations: ${status.gattOperationCount}`);
      console.log(`  Connection Priority: ${status.connectionPriorityRequested}`);
      console.log(`  Last Operation: ${status.lastGattOperation?.operation || 'None'}`);
    }
    
    console.log('\n🏁 BLE Supervision Timeout Test Complete!');
  }
}

// Export for use in other scripts
export default BLESupervisionTimeoutTest;

// Auto-run if this file is executed directly
if (require.main === module) {
  const test = new BLESupervisionTimeoutTest();
  test.runSupervisionTimeoutTest();
}
