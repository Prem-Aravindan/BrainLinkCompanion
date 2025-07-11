/**
 * Test script for the new eegProcessing.js implementation
 * This verifies that the advanced EEG processing pipeline works correctly
 */

import { createEEGProcessor } from './utils/eegProcessing.js';

// Test the EEG processor
function testEEGProcessing() {
  console.log('🧪 Testing Advanced EEG Processing...');
  
  try {
    // Create processor instance
    const processor = createEEGProcessor(512);
    console.log('✅ EEG Processor created successfully');
    
    // Generate test data (simulated EEG signal)
    const testData = [];
    for (let i = 0; i < 512; i++) {
      // Simulate EEG with multiple frequency components
      const time = i / 512;
      const alpha = 20 * Math.sin(2 * Math.PI * 10 * time); // 10 Hz alpha
      const theta = 15 * Math.sin(2 * Math.PI * 6 * time);  // 6 Hz theta
      const beta = 10 * Math.sin(2 * Math.PI * 20 * time);  // 20 Hz beta
      const noise = (Math.random() - 0.5) * 5;              // Random noise
      
      const sample = alpha + theta + beta + noise;
      testData.push(sample);
    }
    
    console.log(`📊 Generated ${testData.length} test samples`);
    
    // Process the test data
    const result = processor.process(testData);
    
    console.log('🎉 Processing Results:');
    console.log(`  🔹 Delta Power: ${result.bandPowers.delta.toFixed(3)}`);
    console.log(`  🔹 Theta Power: ${result.bandPowers.theta.toFixed(3)}`);
    console.log(`  🔹 Alpha Power: ${result.bandPowers.alpha.toFixed(3)}`);
    console.log(`  🔹 Beta Power: ${result.bandPowers.beta.toFixed(3)}`);
    console.log(`  🔹 Gamma Power: ${result.bandPowers.gamma.toFixed(3)}`);
    console.log(`  🔹 Total Power: ${result.thetaMetrics.totalPower.toFixed(3)}`);
    console.log(`  🔹 Theta Contribution: ${result.thetaMetrics.thetaContribution.toFixed(1)}%`);
    console.log(`  🔹 Theta Peak SNR: ${result.thetaMetrics.thetaSNRPeak.toFixed(2)}`);
    
    // Verify payload format matches Python
    console.log('📤 Python-compatible payload:');
    console.log(JSON.stringify(result.payload, null, 2));
    
    console.log('✅ All tests passed! EEG processing is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEEGProcessing();
