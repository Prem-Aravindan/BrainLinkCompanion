/**
 * Debug the full processing pipeline step by step
 */

const { createEEGProcessor } = require('./utils/eegProcessing.js');

// Simple test: pure 10Hz sine wave
const fs = 512;
const amplitude = 20;
const freq = 10;

// Generate test signal
const data = [];
for (let i = 0; i < 512; i++) {
  const t = i / fs;
  data[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
}

console.log("Test Signal:");
console.log(`Samples: ${data.length}`);
console.log(`Mean: ${data.reduce((sum, v) => sum + v, 0) / data.length}`);
console.log(`Variance: ${data.reduce((sum, val) => sum + Math.pow(val - data.reduce((s, v) => s + v, 0) / data.length, 2), 0) / data.length}`);

// Create processor
const processor = createEEGProcessor(fs);

// Step 1: Parse raw data
console.log("\nStep 1: Parse raw data");
const rawData = processor.parseRawData(data);
console.log(`Raw data length: ${rawData.length}`);
console.log(`Raw data max: ${Math.max(...rawData)}`);

// Step 2: Artifact removal
console.log("\nStep 2: Artifact removal");
const cleanedData = processor.removeEyeBlinkArtifacts(rawData);
console.log(`Cleaned data max: ${Math.max(...cleanedData)}`);

// Step 3: Notch filter
console.log("\nStep 3: Notch filter");
const notchedData = processor.applyNotchFilter(cleanedData);
console.log(`Notched data max: ${Math.max(...notchedData)}`);

// Step 4: Bandpass filter
console.log("\nStep 4: Bandpass filter");
const filteredData = processor.applyBandpassFilter(notchedData);
console.log(`Filtered data max: ${Math.max(...filteredData)}`);

// Step 5: PSD
console.log("\nStep 5: PSD calculation");
const { psd, freqs } = processor.computePSD(filteredData);
console.log(`PSD max: ${Math.max(...psd)}`);
console.log(`PSD total: ${psd.reduce((sum, p) => sum + p, 0) * (freqs[1] - freqs[0])}`);

// Step 6: Variance calculation
console.log("\nStep 6: Variance of filtered data");
const variance = processor.calculateVariance(filteredData);
console.log(`Calculated variance: ${variance}`);

// Step 7: Band powers
console.log("\nStep 7: Band powers");
const bands = {
  delta: [0.5, 4],
  theta: [4, 8],
  alpha: [8, 12],
  beta: [12, 30],
  gamma: [30, 45]
};

for (const [name, band] of Object.entries(bands)) {
  const power = processor.bandpower(psd, freqs, band);
  console.log(`${name} power: ${power}`);
}

// Full process to see where the huge numbers come from
console.log("\nStep 8: Full process");
try {
  const result = processor.process(data);
  console.log(`Total power from result: ${result.thetaMetrics.totalPower}`);
  console.log(`Alpha power from result: ${result.bandPowers.alpha}`);
} catch (error) {
  console.error(`Process failed: ${error.message}`);
}
