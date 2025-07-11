/**
 * Debug bandpass filter coefficients
 */

const { createEEGProcessor } = require('./utils/eegProcessing.js');

const processor = createEEGProcessor(512);

// Check the pre-calculated coefficients
console.log("Notch filter coefficients:");
console.log("b:", processor.notchCoeffs.b);
console.log("a:", processor.notchCoeffs.a);

console.log("\nBandpass filter coefficients:");
console.log("b:", processor.bandpassCoeffs.b);
console.log("a:", processor.bandpassCoeffs.a);

// Check if any coefficients are NaN or infinite
const hasNaN = (arr) => arr.some(x => !isFinite(x));
console.log("\nCoefficient validity:");
console.log("Notch b has NaN/inf:", hasNaN(processor.notchCoeffs.b));
console.log("Notch a has NaN/inf:", hasNaN(processor.notchCoeffs.a));
console.log("Bandpass b has NaN/inf:", hasNaN(processor.bandpassCoeffs.b));
console.log("Bandpass a has NaN/inf:", hasNaN(processor.bandpassCoeffs.a));

// Test the filter design manually
try {
  const manualCoeffs = processor.designBandpassFilter(1.0, 45.0, 2);
  console.log("\nManual bandpass design:");
  console.log("b:", manualCoeffs.b);
  console.log("a:", manualCoeffs.a);
  console.log("Has NaN/inf:", hasNaN(manualCoeffs.b) || hasNaN(manualCoeffs.a));
} catch (error) {
  console.error("Bandpass design failed:", error.message);
}
