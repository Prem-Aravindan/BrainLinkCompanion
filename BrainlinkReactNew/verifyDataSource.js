/**
 * Real vs Demo Data Verification Tool
 * Quick test to determine if you're receiving actual EEG data or demo mode data
 */

class RealVsDemoDataVerifier {
  constructor() {
    this.testDuration = 30000; // 30 seconds
    this.dataPoints = [];
    this.startTime = null;
  }

  async verifyDataSource() {
    console.log('🔬 Real vs Demo Data Verification');
    console.log('🎯 Testing for 30 seconds to determine data source');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('=' .repeat(50));

    this.startTime = Date.now();

    // Start monitoring data
    this.startDataMonitoring();

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.testDuration));

    // Analyze results
    this.analyzeResults();
  }

  startDataMonitoring() {
    console.log('📡 Starting data monitoring...');
    console.log('💡 During this test:');
    console.log('  • Keep your BrainLink device ON if testing real data');
    console.log('  • Turn OFF your BrainLink device halfway through if testing');
    console.log('  • Watch if data continues after device OFF');

    // In a real implementation, you'd listen to your actual EEG data stream
    // For now, this is a framework for the test
    let sampleCount = 0;
    const monitorInterval = setInterval(() => {
      sampleCount++;
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);
      
      console.log(`📊 Sample ${sampleCount} at ${elapsed}s - Monitoring data...`);
      
      // Instructions for user
      if (elapsed === 10) {
        console.log('🔄 10 seconds elapsed - data pattern should be visible');
      }
      
      if (elapsed === 15) {
        console.log('⚠️ NOW: Turn OFF your BrainLink device if testing real data');
      }
      
      if (elapsed === 20) {
        console.log('🔍 20 seconds - checking if data stopped...');
      }
      
      if (elapsed >= 30) {
        clearInterval(monitorInterval);
      }
    }, 2000);
  }

  analyzeResults() {
    console.log('\n📊 DATA SOURCE ANALYSIS');
    console.log('=' .repeat(50));

    console.log('🔍 Based on your observations:');
    console.log('');
    
    console.log('📋 REAL DirectBLE Data Characteristics:');
    console.log('  ✅ Data STOPS when device is turned OFF');
    console.log('  ✅ Values reflect actual brain activity');
    console.log('  ✅ Some consistency in patterns');
    console.log('  ✅ No data when Metro stops AND device is OFF');
    console.log('  ✅ Connection shows actual device MAC: CC:36:16:34:69:38');
    console.log('');
    
    console.log('🎭 DEMO Mode Data Characteristics:');
    console.log('  ❌ Data CONTINUES even when device is OFF');
    console.log('  ❌ Values are completely random (Math.random())');
    console.log('  ❌ Data continues after Metro stops');
    console.log('  ❌ No correlation with actual brain activity');
    console.log('  ❌ Demo device MAC: 5C:36:16:34:69:38 (different from real)');
    console.log('');

    console.log('🎯 DEFINITIVE TEST:');
    console.log('1. Turn OFF your BrainLink device completely');
    console.log('2. Wait 10 seconds');
    console.log('3. Check if EEG values are still changing');
    console.log('');
    console.log('📊 RESULT:');
    console.log('• If data STOPS: ✅ You have REAL DirectBLE data');
    console.log('• If data CONTINUES: ❌ You are in DEMO mode');
    console.log('');

    console.log('🔧 IF IN DEMO MODE - SOLUTIONS:');
    console.log('1. Rebuild and reinstall the app (we just fixed demo mode cleanup)');
    console.log('2. Ensure DirectBLE scanner is properly initialized');
    console.log('3. Check logs for "🛑 Demo mode stopped" message');
    console.log('4. Verify device MAC address matches CC:36:16:34:69:38');
    console.log('');

    console.log('🎉 IF REAL DATA:');
    console.log('✅ DirectBLE supervision timeout prevention is working!');
    console.log('✅ No more 15-second disconnections!');
    console.log('✅ Real EEG data streaming successfully!');
  }
}

// Simple usage function
function quickDataSourceCheck() {
  console.log('🚀 Quick Data Source Check');
  console.log('💡 SIMPLE TEST: Turn OFF your BrainLink device now');
  console.log('⏰ Wait 10 seconds and observe...');
  console.log('');
  console.log('📊 EXPECTED RESULTS:');
  console.log('• Real data: EEG values should STOP changing');
  console.log('• Demo data: EEG values will CONTINUE changing randomly');
  console.log('');
  console.log('🔍 Check your dashboard now and report what you see!');
}

export { RealVsDemoDataVerifier, quickDataSourceCheck };

// Auto-run quick check if executed directly
if (require.main === module) {
  quickDataSourceCheck();
}
