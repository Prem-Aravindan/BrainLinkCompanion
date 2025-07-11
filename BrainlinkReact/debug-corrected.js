/**
 * Test the corrected PSD implementation
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
console.log(`Max: ${Math.max(...data)}`);
console.log(`First 5: [${data.slice(0, 5).map(v => v.toFixed(2)).join(', ')}]`);

// Create processor and compute PSD
const processor = createEEGProcessor(fs);
const { psd, freqs } = processor.computePSD(data);

console.log("\nPSD Results:");
console.log(`PSD length: ${psd.length}`);
console.log(`Max PSD: ${Math.max(...psd)}`);
console.log(`Peak frequency: ${freqs[psd.indexOf(Math.max(...psd))]?.toFixed(1)} Hz`);
console.log(`Total power: ${psd.reduce((sum, p) => sum + p, 0) * (freqs[1] - freqs[0])}`);

// Find alpha band power
const alphaBand = [8, 12];
let alphaPower = 0;
for (let i = 0; i < freqs.length; i++) {
  if (freqs[i] >= alphaBand[0] && freqs[i] <= alphaBand[1]) {
    alphaPower += psd[i] * (freqs[1] - freqs[0]);
  }
}
console.log(`Alpha band power (8-12 Hz): ${alphaPower}`);

// Expected: Peak at ~10 Hz should be around 133, alpha power around 200
