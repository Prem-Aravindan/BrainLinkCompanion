/**
 * Debug the cascaded bandpass filter
 */

const { createEEGProcessor } = require('./utils/eegProcessing.js');

// Test signal: pure 10Hz sine wave
const fs = 512;
const amplitude = 20;
const freq = 10;

const data = [];
for (let i = 0; i < 512; i++) {
  const t = i / fs;
  data[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
}

const processor = createEEGProcessor(fs);

console.log("Original data max:", Math.max(...data));

// Check filter coefficients
console.log("\nFilter coefficients:");
console.log("Highpass b:", processor.highpassCoeffs?.b);
console.log("Highpass a:", processor.highpassCoeffs?.a);
console.log("Lowpass b:", processor.lowpassCoeffs?.b);
console.log("Lowpass a:", processor.lowpassCoeffs?.a);

// Test individual filters
if (processor.highpassCoeffs && processor.lowpassCoeffs) {
  const highpassed = processor.filtfilt(data, processor.highpassCoeffs);
  console.log("\nAfter high-pass (1 Hz):");
  console.log("Max:", Math.max(...highpassed));
  console.log("Mean:", highpassed.reduce((sum, v) => sum + v, 0) / highpassed.length);
  
  const bandpassed = processor.filtfilt(highpassed, processor.lowpassCoeffs);
  console.log("\nAfter low-pass (45 Hz):");
  console.log("Max:", Math.max(...bandpassed));
  console.log("Mean:", bandpassed.reduce((sum, v) => sum + v, 0) / bandpassed.length);
} else {
  console.log("Filter coefficients not initialized");
}
