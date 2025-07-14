#!/usr/bin/env node

/**
 * High Delta Power Debug Tool
 * 
 * This script analyzes why the EEG processing is showing extremely high delta power
 * and very low theta values, replicating the exact problem reported.
 */

const { createEEGProcessor } = require('./utils/eegProcessing');

// Simulate the problematic scenario based on reported values
const PROBLEMATIC_OUTPUT = {
  "Alpha power": 0.029502225512605958,
  "Beta power": 0.011448597013721112,
  "Delta power": 1365654.6578904884,
  "Gamma power": 0.000545968854088644,
  "Theta SNR broad": 3.848171033382221e-8,
  "Theta SNR peak": 0.49144016471546265,
  "Theta contribution": 0.0025906527957240497,
  "Theta power": 0.3147009908053586,
  "Theta relative": 0.000025906527957240496,
  "Total variance (power)": 12147.555678815086
};

function analyzeProblematicOutput() {
  console.log('🔍 === Analyzing Problematic EEG Output ===');
  
  const totalBandPower = PROBLEMATIC_OUTPUT["Delta power"] + 
                        PROBLEMATIC_OUTPUT["Theta power"] + 
                        PROBLEMATIC_OUTPUT["Alpha power"] + 
                        PROBLEMATIC_OUTPUT["Beta power"] + 
                        PROBLEMATIC_OUTPUT["Gamma power"];
  
  console.log('\n📊 Band Power Analysis:');
  console.log(`  Delta: ${PROBLEMATIC_OUTPUT["Delta power"].toFixed(2)} (${((PROBLEMATIC_OUTPUT["Delta power"] / totalBandPower) * 100).toFixed(1)}%)`);
  console.log(`  Theta: ${PROBLEMATIC_OUTPUT["Theta power"].toFixed(2)} (${((PROBLEMATIC_OUTPUT["Theta power"] / totalBandPower) * 100).toFixed(1)}%)`);
  console.log(`  Alpha: ${PROBLEMATIC_OUTPUT["Alpha power"].toFixed(2)} (${((PROBLEMATIC_OUTPUT["Alpha power"] / totalBandPower) * 100).toFixed(1)}%)`);
  console.log(`  Beta: ${PROBLEMATIC_OUTPUT["Beta power"].toFixed(2)} (${((PROBLEMATIC_OUTPUT["Beta power"] / totalBandPower) * 100).toFixed(1)}%)`);
  console.log(`  Gamma: ${PROBLEMATIC_OUTPUT["Gamma power"].toFixed(2)} (${((PROBLEMATIC_OUTPUT["Gamma power"] / totalBandPower) * 100).toFixed(1)}%)`);
  console.log(`  Total Band Power: ${totalBandPower.toFixed(2)}`);
  console.log(`  Total Variance: ${PROBLEMATIC_OUTPUT["Total variance (power)"].toFixed(2)}`);
  
  console.log('\n🚨 Issues Identified:');
  console.log('1. Delta power is 1,365,654 - extremely high (99.97% of total)');
  console.log('2. All other bands are near zero in comparison');
  console.log('3. This suggests a severe DC offset or constant signal issue');
  
  // Calculate what the input signal might look like
  const estimatedDCOffset = Math.sqrt(PROBLEMATIC_OUTPUT["Delta power"]);
  console.log(`\n💡 Estimated DC offset: ~${estimatedDCOffset.toFixed(2)} µV`);
  console.log('This suggests the EEG signal has a large constant component');
}

function createProblematicSignals() {
  console.log('\n🧪 === Creating Signals That Produce High Delta ===');
  
  const fs = 512;
  const duration = 1.0;
  const samples = fs * duration;
  const processor = createEEGProcessor(fs);
  
  // Test 1: Constant signal with DC offset
  console.log('\n📊 Test 1: Pure DC offset (constant 1000µV)');
  const constantSignal = new Array(samples).fill(1000);
  testSignal(processor, constantSignal, 'Constant 1000µV');
  
  // Test 2: High DC with small variations
  console.log('\n📊 Test 2: High DC with small noise');
  const dcWithNoise = [];
  for (let i = 0; i < samples; i++) {
    dcWithNoise.push(1000 + (Math.random() - 0.5) * 10); // 1000µV ± 5µV
  }
  testSignal(processor, dcWithNoise, 'DC + small noise');
  
  // Test 3: Slowly varying signal (very low frequency)
  console.log('\n📊 Test 3: Very slow variation (0.1 Hz)');
  const slowSignal = [];
  for (let i = 0; i < samples; i++) {
    const t = i / fs;
    slowSignal.push(1000 + 500 * Math.sin(2 * Math.PI * 0.1 * t)); // 0.1 Hz sine wave
  }
  testSignal(processor, slowSignal, 'Slow 0.1Hz variation');
  
  // Test 4: What BrainLink might be sending (constant high value)
  console.log('\n📊 Test 4: BrainLink constant value scenario');
  const brainLinkConstant = new Array(samples).fill(4095.5); // Max 14-bit converted value
  testSignal(processor, brainLinkConstant, 'BrainLink max constant');
  
  // Test 5: Realistic EEG with DC offset
  console.log('\n📊 Test 5: Real EEG + DC offset');
  const eegWithDC = [];
  for (let i = 0; i < samples; i++) {
    const t = i / fs;
    // Real EEG components
    const delta = 5 * Math.sin(2 * Math.PI * 2 * t);
    const theta = 10 * Math.sin(2 * Math.PI * 6 * t);
    const alpha = 15 * Math.sin(2 * Math.PI * 10 * t);
    const noise = (Math.random() - 0.5) * 5;
    
    // Add large DC offset
    const dcOffset = 1000;
    eegWithDC.push(dcOffset + delta + theta + alpha + noise);
  }
  testSignal(processor, eegWithDC, 'EEG + 1000µV DC offset');
}

function testSignal(processor, signal, name) {
  try {
    const result = processor.process(signal);
    
    const totalBandPower = result.bandPowers.delta + result.bandPowers.theta + 
                          result.bandPowers.alpha + result.bandPowers.beta + 
                          result.bandPowers.gamma;
    
    console.log(`\n   ${name}:`);
    console.log(`     Signal stats: min=${Math.min(...signal).toFixed(2)}, max=${Math.max(...signal).toFixed(2)}, avg=${(signal.reduce((s, v) => s + v, 0) / signal.length).toFixed(2)}`);
    console.log(`     Delta: ${result.bandPowers.delta.toFixed(2)} (${((result.bandPowers.delta / totalBandPower) * 100).toFixed(1)}%)`);
    console.log(`     Theta: ${result.bandPowers.theta.toFixed(2)} (${((result.bandPowers.theta / totalBandPower) * 100).toFixed(1)}%)`);
    console.log(`     Total Power: ${result.thetaMetrics.totalPower.toFixed(2)}`);
    
    // Check if this matches the problematic pattern
    const deltaDominance = (result.bandPowers.delta / totalBandPower) * 100;
    if (deltaDominance > 95) {
      console.log(`     🚨 MATCHES problematic pattern! (${deltaDominance.toFixed(1)}% delta)`);
    }
    
  } catch (error) {
    console.log(`     ❌ Processing failed: ${error.message}`);
  }
}

function generateFixes() {
  console.log('\n🔧 === Proposed Fixes ===');
  
  console.log('\n1. High-Pass Filter Enhancement:');
  console.log('   - Current: 1 Hz high-pass might not be enough');
  console.log('   - Suggestion: Increase to 0.5 Hz or add DC removal');
  console.log('   - Add explicit DC removal: signal = signal - mean(signal)');
  
  console.log('\n2. BrainLink Protocol Debugging:');
  console.log('   - Check if device needs initialization command');
  console.log('   - Verify packet parsing is extracting correct bytes');
  console.log('   - Test with different BLE characteristics/services');
  
  console.log('\n3. Data Validation:');
  console.log('   - Reject samples that are constant for >1 second');
  console.log('   - Add adaptive DC removal');
  console.log('   - Implement signal quality metrics');
  
  console.log('\n4. EEG Processing Improvements:');
  console.log('   - Add detrending before filtering');
  console.log('   - Use median filter for artifact removal');
  console.log('   - Implement robust PSD estimation');
}

function createDCRemovalFilter() {
  console.log('\n🔧 === Testing DC Removal Solutions ===');
  
  const fs = 512;
  const samples = 512;
  
  // Create problematic signal (DC + small EEG)
  const problematicSignal = [];
  for (let i = 0; i < samples; i++) {
    const t = i / fs;
    const dcOffset = 1000; // Large DC component
    const theta = 10 * Math.sin(2 * Math.PI * 6 * t); // Small theta wave
    const noise = (Math.random() - 0.5) * 2;
    problematicSignal.push(dcOffset + theta + noise);
  }
  
  console.log('\n📊 Original signal (with DC offset):');
  testSignal(createEEGProcessor(fs), problematicSignal, 'With DC offset');
  
  // Method 1: Simple DC removal (subtract mean)
  const mean = problematicSignal.reduce((sum, val) => sum + val, 0) / problematicSignal.length;
  const dcRemoved1 = problematicSignal.map(val => val - mean);
  
  console.log('\n📊 After DC removal (subtract mean):');
  testSignal(createEEGProcessor(fs), dcRemoved1, 'DC removed (mean)');
  
  // Method 2: High-pass filter at 0.1 Hz
  console.log('\n📊 After high-pass filtering at 0.1 Hz:');
  // This would require implementing a proper high-pass filter
  // For now, demonstrate the concept with detrending
  const detrended = [];
  for (let i = 0; i < samples; i++) {
    // Simple linear detrending
    const trend = problematicSignal[0] + (problematicSignal[samples-1] - problematicSignal[0]) * (i / (samples - 1));
    detrended.push(problematicSignal[i] - trend);
  }
  testSignal(createEEGProcessor(fs), detrended, 'Detrended');
}

// Main execution
async function main() {
  console.log('🚀 High Delta Power Debug Tool');
  console.log('===============================');
  
  try {
    // Analyze the actual problematic output
    analyzeProblematicOutput();
    
    // Create signals that produce similar results
    createProblematicSignals();
    
    // Test DC removal methods
    createDCRemovalFilter();
    
    // Generate fix recommendations
    generateFixes();
    
    console.log('\n🎯 === Summary ===');
    console.log('The extremely high delta power (1,365,654) suggests:');
    console.log('1. 🚨 BrainLink device is sending constant/DC-biased values');
    console.log('2. 🔧 Need to verify actual device output via enhanced logging');
    console.log('3. 💡 Consider adding DC removal preprocessing step');
    console.log('4. 🧪 Test with different BrainLink models/firmware versions');
    
    console.log('\n🔮 Next Steps:');
    console.log('1. Deploy enhanced BluetoothService logging');
    console.log('2. Check raw BLE packets from device');
    console.log('3. Verify BrainLink initialization sequence');
    console.log('4. Test DC removal preprocessing');
    
  } catch (error) {
    console.error('❌ Debug tool failed:', error);
    process.exit(1);
  }
}

// Run the debug tool
if (require.main === module) {
  main();
}

module.exports = {
  analyzeProblematicOutput,
  createProblematicSignals,
  testSignal
};
