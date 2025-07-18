/**
 * Simple Band Power Test
 * Run this to verify the EEG processing is working correctly
 */

import { createEEGProcessor } from './utils/eegProcessing.js';

console.log('🧪 Testing Band Power Calculation...');

// Test 1: Simple synthetic data
console.log('\n📊 Test 1: Synthetic EEG data');
const processor = createEEGProcessor(512);
const testData = [];

// Generate 512 samples of synthetic EEG data
for (let i = 0; i < 512; i++) {
  const t = i / 512;
  // Mix of frequencies that should appear in different bands
  const signal = 
    100 * Math.sin(2 * Math.PI * 2 * t) +   // 2 Hz (delta)
    80 * Math.sin(2 * Math.PI * 6 * t) +    // 6 Hz (theta)
    60 * Math.sin(2 * Math.PI * 10 * t) +   // 10 Hz (alpha)
    40 * Math.sin(2 * Math.PI * 20 * t) +   // 20 Hz (beta)
    20 * Math.sin(2 * Math.PI * 35 * t) +   // 35 Hz (gamma)
    Math.random() * 10 - 5;                 // noise
  testData.push(signal);
}

const result1 = processor.process(testData);
if (result1 && result1.bandPowers) {
  console.log('✅ Synthetic test PASSED');
  console.log('Band powers:', {
    delta: result1.bandPowers.delta.toFixed(3),
    theta: result1.bandPowers.theta.toFixed(3),
    alpha: result1.bandPowers.alpha.toFixed(3),
    beta: result1.bandPowers.beta.toFixed(3),
    gamma: result1.bandPowers.gamma.toFixed(3)
  });
} else {
  console.log('❌ Synthetic test FAILED');
}

// Test 2: Data similar to what was failing
console.log('\n📊 Test 2: Real-world problematic data');
const problematicData = [];
for (let i = 0; i < 256; i++) {
  // Generate data similar to the failing case: min=-5897.88, max=5305.5, avg=-912.65
  const value = -912.65 + (Math.random() - 0.5) * 10000;
  problematicData.push(value);
}

const result2 = processor.process(problematicData);
if (result2 && result2.bandPowers) {
  console.log('✅ Problematic data test PASSED');
  console.log('Band powers:', {
    delta: result2.bandPowers.delta.toFixed(3),
    theta: result2.bandPowers.theta.toFixed(3),
    alpha: result2.bandPowers.alpha.toFixed(3),
    beta: result2.bandPowers.beta.toFixed(3),
    gamma: result2.bandPowers.gamma.toFixed(3)
  });
} else {
  console.log('❌ Problematic data test FAILED');
}

// Test 3: Constant data (demo mode simulation)
console.log('\n📊 Test 3: Constant data (demo mode)');
const constantData = new Array(256).fill(65); // Like the demo mode constant value

const result3 = processor.process(constantData);
if (result3 === null) {
  console.log('✅ Constant data correctly rejected (likely demo mode)');
} else {
  console.log('⚠️ Constant data was processed (unexpected)');
}

console.log('\n🏁 Band power tests completed');

export default function testBandPowers() {
  console.log('Band power test executed');
}
