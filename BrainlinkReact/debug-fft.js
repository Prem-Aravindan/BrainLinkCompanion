/**
 * Debug FFT implementation to find the source of astronomical values
 */

// Simple test signal: pure 10Hz sine wave
const fs = 512;
const duration = 1.0;
const freq = 10;
const amplitude = 20;

// Generate test signal
const numSamples = fs * duration;
const data = [];
for (let i = 0; i < numSamples; i++) {
  const t = i / fs;
  data[i] = amplitude * Math.sin(2 * Math.PI * freq * t);
}

console.log("Test Signal:");
console.log(`Samples: ${data.length}`);
console.log(`Mean: ${data.reduce((sum, v) => sum + v, 0) / data.length}`);
console.log(`Max: ${Math.max(...data)}`);
console.log(`Min: ${Math.min(...data)}`);
console.log(`First 5: [${data.slice(0, 5).map(v => v.toFixed(2)).join(', ')}]`);

// Simple FFT test
function simpleFFT(data) {
  const N = data.length;
  if (N <= 1) {
    return { real: [...data], imag: new Array(N).fill(0) };
  }
  
  // For simplicity, use only power-of-2 sizes
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
  const padded = [...data];
  while (padded.length < nextPow2) {
    padded.push(0);
  }
  
  return fftRecursive(padded);
}

function fftRecursive(data) {
  const N = data.length;
  
  if (N <= 1) {
    return { real: [...data], imag: new Array(N).fill(0) };
  }
  
  // Divide
  const even = [];
  const odd = [];
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      even.push(data[i]);
    } else {
      odd.push(data[i]);
    }
  }
  
  // Conquer
  const evenFFT = fftRecursive(even);
  const oddFFT = fftRecursive(odd);
  
  // Combine
  const real = new Array(N);
  const imag = new Array(N);
  
  for (let k = 0; k < N / 2; k++) {
    const t_real = Math.cos(-2 * Math.PI * k / N) * oddFFT.real[k] - 
                   Math.sin(-2 * Math.PI * k / N) * oddFFT.imag[k];
    const t_imag = Math.sin(-2 * Math.PI * k / N) * oddFFT.real[k] + 
                   Math.cos(-2 * Math.PI * k / N) * oddFFT.imag[k];
    
    real[k] = evenFFT.real[k] + t_real;
    imag[k] = evenFFT.imag[k] + t_imag;
    real[k + N / 2] = evenFFT.real[k] - t_real;
    imag[k + N / 2] = evenFFT.imag[k] - t_imag;
  }
  
  return { real, imag };
}

// Test window
const windowSize = 512;
const window = Array.from({ length: windowSize }, (_, n) => 
  0.5 * (1 - Math.cos(2 * Math.PI * n / (windowSize - 1)))
);

console.log("\nWindow:");
console.log(`Sum: ${window.reduce((sum, w) => sum + w, 0)}`);
console.log(`Sum of squares: ${window.reduce((sum, w) => sum + w * w, 0)}`);
console.log(`Normalization factor: ${window.reduce((sum, w) => sum + w * w, 0) / windowSize}`);

// Apply window
const windowed = data.slice(0, windowSize).map((val, i) => val * window[i]);
console.log("\nWindowed Signal:");
console.log(`Max: ${Math.max(...windowed)}`);
console.log(`Min: ${Math.min(...windowed)}`);
console.log(`RMS: ${Math.sqrt(windowed.reduce((sum, v) => sum + v * v, 0) / windowed.length)}`);

// Compute FFT
const fftResult = simpleFFT(windowed);

console.log("\nFFT Result:");
console.log(`Length: ${fftResult.real.length}`);
console.log(`Max real: ${Math.max(...fftResult.real)}`);
console.log(`Min real: ${Math.min(...fftResult.real)}`);
console.log(`Max imag: ${Math.max(...fftResult.imag)}`);
console.log(`Min imag: ${Math.min(...fftResult.imag)}`);

// Check power spectrum
const freqBins = Math.floor(fftResult.real.length / 2) + 1;
const powers = [];
for (let k = 0; k < freqBins; k++) {
  const real = fftResult.real[k];
  const imag = fftResult.imag[k];
  let power = real * real + imag * imag;
  powers.push(power);
}

console.log("\nPower Spectrum (before scaling):");
console.log(`Length: ${powers.length}`);
console.log(`Max power: ${Math.max(...powers)}`);
console.log(`Total power: ${powers.reduce((sum, p) => sum + p, 0)}`);

// Find peak frequency
const maxPowerIdx = powers.indexOf(Math.max(...powers));
const peakFreq = maxPowerIdx * fs / fftResult.real.length;
console.log(`Peak at bin ${maxPowerIdx}, frequency ${peakFreq.toFixed(1)} Hz`);

// Expected peak should be around 10 Hz
console.log(`Expected peak bin: ${Math.round(10 * fftResult.real.length / fs)}`);
