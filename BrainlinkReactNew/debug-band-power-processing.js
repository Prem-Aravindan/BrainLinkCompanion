/**
 * Debug Band Power Processing
 * This script helps identify exactly where the band power calculation is failing
 */

import { createEEGProcessor } from './utils/eegProcessing.js';

// Test with actual data that was failing
const testData = [];

// Generate similar data to what was failing: min=-5897.88, max=5305.5, avg=-912.65
for (let i = 0; i < 256; i++) {
  // Generate data that matches the problematic range
  const value = -912.65 + (Math.random() - 0.5) * 10000; // Around -912.65 with wide variation
  testData.push(value);
}

console.log('🔍 Debug Band Power Processing');
console.log(`📊 Test data: min=${Math.min(...testData)}, max=${Math.max(...testData)}, avg=${(testData.reduce((a,b) => a+b) / testData.length).toFixed(2)}`);

// Create processor
const processor = createEEGProcessor(512);

// Step-by-step debugging
console.log('\n🔬 Step-by-step processing:');

try {
  console.log('Step 1: Parse raw data...');
  const rawData = processor.parseRawData(testData);
  console.log(`✅ Raw data parsed: ${rawData.length} samples`);
  
  console.log('Step 2: Remove artifacts...');
  const cleanedData = processor.removeEyeBlinkArtifacts(rawData);
  console.log(`✅ Artifacts removed: range ${Math.min(...cleanedData).toFixed(2)} to ${Math.max(...cleanedData).toFixed(2)}`);
  
  console.log('Step 3: Apply notch filter...');
  const notchedData = processor.applyNotchFilter(cleanedData);
  console.log(`✅ Notch filter applied: range ${Math.min(...notchedData).toFixed(2)} to ${Math.max(...notchedData).toFixed(2)}`);
  
  console.log('Step 4: Apply bandpass filter...');
  const filteredData = processor.applyBandpassFilter(notchedData);
  console.log(`✅ Bandpass filter applied: range ${Math.min(...filteredData).toFixed(2)} to ${Math.max(...filteredData).toFixed(2)}`);
  
  console.log('Step 5: Compute PSD...');
  const { psd, freqs } = processor.computePSD(filteredData);
  console.log(`✅ PSD computed: ${psd.length} frequency bins, max freq = ${Math.max(...freqs).toFixed(2)} Hz`);
  
  if (psd.length === 0) {
    console.error('❌ PSD computation returned empty array!');
    throw new Error('PSD computation failed');
  }
  
  console.log('Step 6: Calculate band powers...');
  const deltaPower = processor.bandpower(psd, freqs, [0.5, 4]);
  const thetaPower = processor.bandpower(psd, freqs, [4, 8]);
  const alphaPower = processor.bandpower(psd, freqs, [8, 12]);
  const betaPower = processor.bandpower(psd, freqs, [12, 30]);
  const gammaPower = processor.bandpower(psd, freqs, [30, 45]);
  
  console.log(`✅ Band powers calculated:`);
  console.log(`   Delta: ${deltaPower.toFixed(6)}`);
  console.log(`   Theta: ${thetaPower.toFixed(6)}`);
  console.log(`   Alpha: ${alphaPower.toFixed(6)}`);
  console.log(`   Beta: ${betaPower.toFixed(6)}`);
  console.log(`   Gamma: ${gammaPower.toFixed(6)}`);
  
  console.log('Step 7: Full process method...');
  const result = processor.process(testData);
  
  if (result) {
    console.log('✅ Full processing successful!');
    console.log('📊 Final band powers:', {
      delta: result.bandPowers.delta.toFixed(3),
      theta: result.bandPowers.theta.toFixed(3),
      alpha: result.bandPowers.alpha.toFixed(3),
      beta: result.bandPowers.beta.toFixed(3),
      gamma: result.bandPowers.gamma.toFixed(3)
    });
  } else {
    console.error('❌ Full process method returned null!');
  }
  
} catch (error) {
  console.error('❌ Processing failed at step:', error.message);
  console.error('Full error:', error.stack);
}

// Test with known good data
console.log('\n🧪 Testing with synthetic EEG data...');
const syntheticData = [];
for (let i = 0; i < 512; i++) {
  const t = i / 512;
  // Generate realistic EEG signal (µV range)
  const signal = 
    20 * Math.sin(2 * Math.PI * 2 * t) +   // 2 Hz delta
    15 * Math.sin(2 * Math.PI * 6 * t) +   // 6 Hz theta  
    10 * Math.sin(2 * Math.PI * 10 * t) +  // 10 Hz alpha
    5 * Math.sin(2 * Math.PI * 20 * t) +   // 20 Hz beta
    Math.random() * 2 - 1;                 // noise
  syntheticData.push(signal);
}

const syntheticResult = processor.process(syntheticData);
if (syntheticResult) {
  console.log('✅ Synthetic data processed successfully!');
  console.log('📊 Synthetic band powers:', {
    delta: syntheticResult.bandPowers.delta.toFixed(3),
    theta: syntheticResult.bandPowers.theta.toFixed(3),
    alpha: syntheticResult.bandPowers.alpha.toFixed(3),
    beta: syntheticResult.bandPowers.beta.toFixed(3),
    gamma: syntheticResult.bandPowers.gamma.toFixed(3)
  });
} else {
  console.error('❌ Synthetic data processing failed!');
}

export default function debugBandPowerProcessing() {
  console.log('🔍 Debug script executed');
}
