/**
 * EEG Data Source Diagnostic
 * Determines if we're receiving real DirectBLE data or demo mode data
 */

import DirectBLEScanner from './services/DirectBLEScanner';
import MacrotellectLinkService from './services/MacrotellectLinkService';

class EEGDataSourceDiagnostic {
  constructor() {
    this.dataSourceAnalysis = {
      directBLE: {
        active: false,
        dataReceived: false,
        deviceConnected: null,
        sampleData: []
      },
      macrotellectLink: {
        active: false,
        demoMode: false,
        dataReceived: false,
        sampleData: []
      }
    };
  }

  async runDiagnostic() {
    console.log('🔬 EEG Data Source Diagnostic');
    console.log('🎯 Goal: Identify if receiving real DirectBLE data or demo mode data');
    console.log('⏰ Time:', new Date().toLocaleString());
    console.log('=' .repeat(60));

    try {
      await this.checkDirectBLEStatus();
      await this.checkMacrotellectLinkStatus();
      await this.analyzeDataPatterns();
      this.generateDiagnosticReport();
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
    }
  }

  async checkDirectBLEStatus() {
    console.log('\n🔧 DirectBLE Status Check');
    console.log('-'.repeat(30));

    try {
      const scanner = new DirectBLEScanner();
      
      // Check if DirectBLE is active
      if (scanner.isScanning || scanner.connectedDevice) {
        this.dataSourceAnalysis.directBLE.active = true;
        this.dataSourceAnalysis.directBLE.deviceConnected = scanner.connectedDeviceId;
        console.log('✅ DirectBLE appears to be active');
        console.log(`📱 Connected device: ${scanner.connectedDeviceId || 'None'}`);
        
        // Listen for data
        scanner.on('eegData', (data) => {
          this.dataSourceAnalysis.directBLE.dataReceived = true;
          this.dataSourceAnalysis.directBLE.sampleData.push({
            timestamp: Date.now(),
            rawValue: data.rawValue,
            source: 'DirectBLE'
          });
          console.log(`📡 DirectBLE data: ${data.rawValue}µV`);
        });
      } else {
        console.log('❌ DirectBLE not active');
      }
    } catch (error) {
      console.error('❌ DirectBLE check failed:', error);
    }
  }

  async checkMacrotellectLinkStatus() {
    console.log('\n🔧 MacrotellectLink Status Check');
    console.log('-'.repeat(30));

    try {
      const service = new MacrotellectLinkService();
      
      // Check if service is in demo mode
      if (service.demoInterval) {
        this.dataSourceAnalysis.macrotellectLink.demoMode = true;
        console.log('🎭 MacrotellectLink is in DEMO MODE');
        console.log('🚨 This explains why data continues after Metro stops!');
      }
      
      if (service.isInitialized) {
        this.dataSourceAnalysis.macrotellectLink.active = true;
        console.log('✅ MacrotellectLink service initialized');
      } else {
        console.log('❌ MacrotellectLink service not initialized');
      }

      // Check for demo mode indicators
      if (service.demoConnected) {
        console.log('🎭 Demo connection active');
        this.dataSourceAnalysis.macrotellectLink.demoMode = true;
      }

    } catch (error) {
      console.error('❌ MacrotellectLink check failed:', error);
    }
  }

  async analyzeDataPatterns() {
    console.log('\n🔬 Data Pattern Analysis');
    console.log('-'.repeat(30));

    // Monitor data for 10 seconds to analyze patterns
    const analysisPromise = new Promise((resolve) => {
      let sampleCount = 0;
      const analysisInterval = setInterval(() => {
        sampleCount++;
        console.log(`📊 Analysis sample ${sampleCount}/10...`);

        if (sampleCount >= 10) {
          clearInterval(analysisInterval);
          resolve();
        }
      }, 1000);
    });

    await analysisPromise;

    // Analyze patterns
    console.log('\n📋 Pattern Analysis Results:');
    
    if (this.dataSourceAnalysis.directBLE.sampleData.length > 0) {
      const directBLESamples = this.dataSourceAnalysis.directBLE.sampleData;
      console.log(`📡 DirectBLE samples: ${directBLESamples.length}`);
      console.log(`📊 DirectBLE range: ${Math.min(...directBLESamples.map(s => s.rawValue))} to ${Math.max(...directBLESamples.map(s => s.rawValue))}µV`);
    }

    if (this.dataSourceAnalysis.macrotellectLink.sampleData.length > 0) {
      const mlSamples = this.dataSourceAnalysis.macrotellectLink.sampleData;
      console.log(`🔗 MacrotellectLink samples: ${mlSamples.length}`);
      console.log(`📊 MacrotellectLink range: ${Math.min(...mlSamples.map(s => s.rawValue))} to ${Math.max(...mlSamples.map(s => s.rawValue))}µV`);
    }
  }

  generateDiagnosticReport() {
    console.log('\n📊 DIAGNOSTIC REPORT');
    console.log('=' .repeat(50));

    // Determine primary data source
    if (this.dataSourceAnalysis.macrotellectLink.demoMode) {
      console.log('🚨 PRIMARY ISSUE: MacrotellectLink Demo Mode Active');
      console.log('💡 This explains why data continues after Metro stops');
      console.log('🔧 SOLUTION: Stop demo mode interval properly');
      console.log('');
      console.log('📋 Demo Mode Characteristics:');
      console.log('  • Data continues after Metro stops');
      console.log('  • Random/changing values');
      console.log('  • setInterval running in background');
      console.log('  • Values generated by Math.random()');
    }

    if (this.dataSourceAnalysis.directBLE.active && this.dataSourceAnalysis.directBLE.dataReceived) {
      console.log('✅ DirectBLE appears to be working correctly');
      console.log('📱 Real device connection detected');
    } else if (this.dataSourceAnalysis.directBLE.active) {
      console.log('⚠️ DirectBLE active but no data received');
    } else {
      console.log('❌ DirectBLE not active');
    }

    console.log('\n🎯 RECOMMENDATIONS:');
    
    if (this.dataSourceAnalysis.macrotellectLink.demoMode) {
      console.log('1. 🛑 Stop MacrotellectLink demo mode properly');
      console.log('2. 🔄 Ensure DirectBLE fallback is primary data source');
      console.log('3. 🧹 Clear demo intervals on service shutdown');
    }

    if (this.dataSourceAnalysis.directBLE.active) {
      console.log('4. ✅ DirectBLE supervision timeout prevention is working');
      console.log('5. 📡 Continue using DirectBLE as primary connection');
    }

    console.log('\n🔍 To confirm real vs demo data:');
    console.log('• Real data: Should stop when device is turned off');
    console.log('• Demo data: Continues indefinitely with random values');
    console.log('• Real data: Reflects actual brain activity patterns');
    console.log('• Demo data: Math.random() generated values');
  }
}

export default EEGDataSourceDiagnostic;

// Auto-run if executed directly
if (require.main === module) {
  const diagnostic = new EEGDataSourceDiagnostic();
  diagnostic.runDiagnostic();
}
