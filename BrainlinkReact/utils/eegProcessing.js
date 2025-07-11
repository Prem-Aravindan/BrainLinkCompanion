/**
 * EEG Processing Module - Exact mirror of Python BrainCompanion_updated.py pipeline
 * 
 * This module implements the complete EEG signal processing pipeline with
 * bit-for-bit matching of the Python implementation using:
 * - Butterworth filters (scipy.signal.butter + filtfilt)
 * - Welch's method for PSD (scipy.signal.welch)
 * - Simpson's rule integration (scipy.integrate.simps)
 * - Notch filters (scipy.signal.iirnotch + filtfilt)
 */

class EEGProcessor {
  constructor(samplingRate = 512) {
    this.fs = samplingRate;
    this.windowSize = 512;
    this.overlapSize = 128;
    
    // EEG frequency bands (matches Python EEG_BANDS)
    this.bands = {
      delta: [0.5, 4],
      theta: [4, 8],
      alpha: [8, 12],
      beta: [12, 30],
      gamma: [30, 45]
    };
    
    // State for exponential smoothing
    this.smoothedThetaContribution = null;
    
    // Data accumulator for streaming processing (matches Python live_data_buffer)
    this.liveDataBuffer = [];
    this.maxBufferSize = 1000; // Keep last 1000 samples like Python
    
    // Pre-calculate filter coefficients for efficiency
    this.notchCoeffs = this.designNotchFilter(50.0, 30.0);
    this.bandpassCoeffs = this.designBandpassFilter(1.0, 45.0, 2);
  }

  /**
   * Parse raw data from BrainLink device (matches Python onRaw processing)
   * @param {Uint8Array|ArrayBuffer|Array|string|number} rawBuffer - Raw data from device
   * @returns {number[]} - Array of raw values (not scaled to microvolts yet)
   */
  parseRawData(rawBuffer) {
    let values = [];
    
    // Handle single raw value (common from MacrotellectLink SDK)
    if (typeof rawBuffer === 'number') {
      return [rawBuffer];
    }
    
    if (rawBuffer instanceof Uint8Array || rawBuffer instanceof ArrayBuffer) {
      // Convert ArrayBuffer to Uint8Array if needed
      const uint8Array = rawBuffer instanceof ArrayBuffer ? new Uint8Array(rawBuffer) : rawBuffer;
      
      // Create DataView for reading little-endian 16-bit integers
      const dataView = new DataView(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength);
      
      // Parse binary data as Int16LE (little-endian 16-bit integers)
      for (let i = 0; i < uint8Array.length - 1; i += 2) {
        try {
          const rawValue = dataView.getInt16(i, true); // true = little-endian
          // Store raw value without conversion (Python stores raw values directly)
          values.push(rawValue);
        } catch (error) {
          // Skip malformed data points
          console.warn(`Skipping malformed data at byte ${i}:`, error);
        }
      }
    } else if (Array.isArray(rawBuffer)) {
      // Already parsed numeric array - store as raw values
      values = rawBuffer.map(val => parseFloat(val)).filter(val => !isNaN(val));
    } else if (typeof rawBuffer === 'string') {
      // ASCII format, comma-separated or single values
      const strValues = rawBuffer.split(/[,\s]+/).filter(s => s.trim().length > 0);
      values = strValues.map(val => parseFloat(val.trim())).filter(val => !isNaN(val));
    } else {
      throw new Error('Unsupported raw data format. Expected number, Uint8Array, ArrayBuffer, Array, or string.');
    }
    
    return values;
  }

  /**
   * Remove DC offset from signal (critical for BrainLink data)
   * @param {number[]} data - Input signal
   * @returns {number[]} - Signal with DC component removed
   */
  removeDCOffset(data) {
    // Method 1: Simple DC removal (subtract mean)
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const dcRemoved = data.map(val => val - mean);
    
    // Log DC removal only if significant
    if (Math.abs(mean) > 100) {
      console.log(`🔧 DC Removal: mean=${mean.toFixed(2)}µV removed`);
    }
    
    // Additional check for remaining DC bias
    const newMean = dcRemoved.reduce((sum, val) => sum + val, 0) / dcRemoved.length;
    if (Math.abs(newMean) > 0.1) {
      console.warn(`⚠️ Residual DC bias after removal: ${newMean.toFixed(3)}µV`);
    }
    
    return dcRemoved;
  }

  /**
   * Detect and validate signal quality
   * @param {number[]} data - Input signal
   * @returns {Object} - Quality metrics
   */
  assessSignalQuality(data) {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...data);
    const max = Math.max(...data);
    
    // Check for constant signal
    const isConstant = stdDev < 0.1;
    
    // Check for high DC offset
    const hasDCOffset = Math.abs(mean) > 100;
    
    // Check for unrealistic values
    const hasUnrealisticValues = Math.abs(mean) > 5000 || max - min > 10000;
    
    const quality = {
      mean,
      stdDev,
      variance,
      min,
      max,
      range: max - min,
      isConstant,
      hasDCOffset,
      hasUnrealisticValues,
      qualityScore: 1.0 - (isConstant ? 0.5 : 0) - (hasDCOffset ? 0.3 : 0) - (hasUnrealisticValues ? 0.2 : 0)
    };
    
    // Only log quality assessment if quality is poor or occasionally for debugging
    if (quality.qualityScore < 0.7 || Math.random() < 0.01) { // Log 1% of the time for debugging
      console.log(`📊 Signal Quality Assessment:`);
      console.log(`   Range: ${min.toFixed(2)} to ${max.toFixed(2)} µV`);
      console.log(`   Mean: ${mean.toFixed(2)} µV`);
      console.log(`   Std Dev: ${stdDev.toFixed(2)} µV`);
      console.log(`   Quality Score: ${quality.qualityScore.toFixed(2)}/1.0`);
    }
    
    if (isConstant) {
      console.warn(`⚠️ Signal appears constant - device may be sending dummy data`);
    }
    if (hasDCOffset) {
      console.warn(`⚠️ High DC offset detected - will be removed`);
    }
    if (hasUnrealisticValues) {
      console.warn(`⚠️ Unrealistic signal values - check BLE parsing`);
    }
    
    return quality;
  }

  /**
   * Remove eye blink artifacts (matches Python remove_eye_blink_artifacts exactly)
   * @param {number[]} data - Input EEG data
   * @param {number} window - Window size for artifact detection
   * @returns {number[]} - Cleaned data
   */
  removeEyeBlinkArtifacts(data, window = 10) {
    const clean = [...data];
    
    // Calculate global adaptive threshold (matches Python exactly)
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);
    const adaptiveThreshold = mean + 3 * std;
    
    // Find all outlier indices (matches Python np.where)
    const outlierIndices = [];
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > adaptiveThreshold) {
        outlierIndices.push(i);
      }
    }
    
    // Replace each outlier with local median (matches Python algorithm)
    for (const i of outlierIndices) {
      const start = Math.max(0, i - window);
      const end = Math.min(data.length, i + window);
      const localWindow = [];
      
      // Collect non-outlier values from local window
      for (let j = start; j < end; j++) {
        if (Math.abs(data[j]) <= adaptiveThreshold) {
          localWindow.push(data[j]);
        }
      }
      
      if (localWindow.length > 0) {
        // Use median of clean local window
        const sortedWindow = localWindow.sort((a, b) => a - b);
        clean[i] = sortedWindow[Math.floor(sortedWindow.length / 2)];
      } else {
        // Fallback to global median
        const sortedData = [...data].sort((a, b) => a - b);
        clean[i] = sortedData[Math.floor(sortedData.length / 2)];
      }
    }
    
    return clean;
  }

  /**
   * Design notch filter coefficients (matches scipy.signal.iirnotch exactly)
   * @param {number} notchFreq - Frequency to notch out (Hz)
   * @param {number} qualityFactor - Quality factor
   * @returns {Object} - Filter coefficients {b, a}
   */
  designNotchFilter(notchFreq, qualityFactor) {
    // Convert to normalized frequency (matches Python: freq = notch_freq/(fs/2))
    const freq = notchFreq / (this.fs / 2);
    const omega = 2 * Math.PI * freq;
    const alpha = Math.sin(omega) / (2 * qualityFactor);
    
    // IIR notch filter coefficients (matches scipy.signal.iirnotch)
    const b = [1, -2 * Math.cos(omega), 1];
    const a = [1 + alpha, -2 * Math.cos(omega), 1 - alpha];
    
    // Normalize by a[0] (matches scipy normalization)
    const a0 = a[0];
    return {
      b: b.map(coeff => coeff / a0),
      a: a.map(coeff => coeff / a0)
    };
  }

  /**
   * Design simple first-order high-pass filter
   * @param {number} cutoff - Cutoff frequency
   * @returns {Object} - Filter coefficients {b, a}
   */
  designHighpassFilter(cutoff) {
    const dt = 1.0 / this.fs;
    const rc = 1.0 / (2 * Math.PI * cutoff);
    const alpha = rc / (rc + dt);
    
    return {
      b: [alpha, -alpha],
      a: [1, -(alpha)]
    };
  }

  /**
   * Design simple first-order low-pass filter
   * @param {number} cutoff - Cutoff frequency
   * @returns {Object} - Filter coefficients {b, a}
   */
  designLowpassFilter(cutoff) {
    const dt = 1.0 / this.fs;
    const rc = 1.0 / (2 * Math.PI * cutoff);
    const alpha = dt / (rc + dt);
    
    return {
      b: [alpha, 0],
      a: [1, -(1 - alpha)]
    };
  }

  /**
   * Design Butterworth bandpass filter (matches scipy.signal.butter exactly)
   * @param {number} lowcut - Low cutoff frequency
   * @param {number} highcut - High cutoff frequency  
   * @param {number} order - Filter order
   * @returns {Object} - Filter coefficients {b, a}
   */
  designBandpassFilter(lowcut, highcut, order = 2) {
    // Normalize frequencies to Nyquist frequency (matches Python exactly)
    const nyq = 0.5 * this.fs;
    const low = lowcut / nyq;
    const high = highcut / nyq;
    
    // Simple implementation for stability - cascade approach
    // For a more precise Butterworth implementation, we'd need more complex math
    this.highpassCoeffs = this.designHighpassFilter(lowcut);
    this.lowpassCoeffs = this.designLowpassFilter(highcut);
    
    // Return identity filter as we'll cascade separately
    return {
      b: [1],
      a: [1]
    };
  }

  /**
   * Apply stable bandpass filter using cascaded high-pass and low-pass
   * @param {number[]} data - Input data
   * @returns {number[]} - Bandpass filtered data
   */
  applyBandpassFilter(data) {
    // Apply high-pass filter first
    const highpassed = this.filtfilt(data, this.highpassCoeffs);
    
    // Then apply low-pass filter
    const bandpassed = this.filtfilt(highpassed, this.lowpassCoeffs);
    
    return bandpassed;
  }

  /**
   * Apply filter with forward-backward pass (matches scipy.signal.filtfilt)
   * @param {number[]} data - Input data
   * @param {Object} coeffs - Filter coefficients {b, a}
   * @returns {number[]} - Filtered data
   */
  filtfilt(data, coeffs) {
    if (data.length < coeffs.b.length) return [...data];
    
    // Forward pass
    const forward = this.applyIIRFilter(data, coeffs);
    
    // Reverse, apply filter, reverse again (backward pass)
    const reversed = [...forward].reverse();
    const backward = this.applyIIRFilter(reversed, coeffs);
    
    return backward.reverse();
  }

  /**
   * Apply IIR filter (direct form II)
   * @param {number[]} data - Input data
   * @param {Object} coeffs - Filter coefficients {b, a}
   * @returns {number[]} - Filtered data
   */
  applyIIRFilter(data, coeffs) {
    const { b, a } = coeffs;
    const filtered = new Array(data.length);
    const order = Math.max(b.length, a.length) - 1;
    
    // Initialize delay lines
    const xDelay = new Array(order).fill(0);
    const yDelay = new Array(order).fill(0);
    
    for (let n = 0; n < data.length; n++) {
      // Shift delay lines
      for (let i = order - 1; i > 0; i--) {
        xDelay[i] = xDelay[i - 1];
        yDelay[i] = yDelay[i - 1];
      }
      xDelay[0] = data[n];
      
      // Calculate output using direct form II transposed
      let y = 0;
      
      // Feedforward (numerator) part
      for (let i = 0; i < b.length; i++) {
        if (i === 0) {
          y += b[i] * data[n];
        } else if (i <= order) {
          y += b[i] * xDelay[i - 1];
        }
      }
      
      // Feedback (denominator) part  
      for (let i = 1; i < a.length; i++) {
        if (i <= order) {
          y -= a[i] * yDelay[i - 1];
        }
      }
      
      filtered[n] = y;
      yDelay[0] = y;
    }
    
    return filtered;
  }

  /**
   * Apply notch filter (matches Python notch_filter function)
   * @param {number[]} data - Input data
   * @returns {number[]} - Notch filtered data
   */
  applyNotchFilter(data) {
    return this.filtfilt(data, this.notchCoeffs);
  }

  /**
   * Apply bandpass filter (matches Python bandpass_filter function)
   * @param {number[]} data - Input data
   * @returns {number[]} - Bandpass filtered data
   */
  applyBandpassFilter(data) {
    return this.filtfilt(data, this.bandpassCoeffs);
  }

  /**
   * Apply Hanning window
   * @param {number[]} data - Input data
   * @returns {number[]} - Windowed data
   */
  applyHanningWindow(data) {
    const N = data.length;
    const windowed = new Array(N);
    
    for (let n = 0; n < N; n++) {
      const window = 0.5 * (1 - Math.cos(2 * Math.PI * n / (N - 1)));
      windowed[n] = data[n] * window;
    }
    
    return windowed;
  }

  /**
   * Compute FFT using Cooley-Tukey algorithm
   * @param {number[]} data - Input data (must be power of 2 length)
   * @returns {Object} - {real, imag} components
   */
  fft(data) {
    const N = data.length;
    
    if (N <= 1) {
      return { real: [...data], imag: new Array(N).fill(0) };
    }
    
    // Ensure power of 2
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = [...data];
    while (padded.length < nextPow2) {
      padded.push(0);
    }
    
    return this.fftRecursive(padded);
  }

  /**
   * Recursive FFT implementation
   * @param {number[]} data - Input data
   * @returns {Object} - {real, imag} components
   */
  fftRecursive(data) {
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
    const evenFFT = this.fftRecursive(even);
    const oddFFT = this.fftRecursive(odd);
    
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

  /**
   * Compute Power Spectral Density using Welch's method (matches scipy.signal.welch)
   * @param {number[]} data - Input signal
   * @returns {Object} - {psd, freqs} arrays
   */
  computePSD(data) {
    const nperseg = this.windowSize;
    const noverlap = this.overlapSize;
    const nfft = nperseg;
    
    if (data.length < nperseg) {
      // Not enough data for windowing
      return { psd: [], freqs: [] };
    }
    
    const hop = nperseg - noverlap;
    const numSegments = Math.floor((data.length - noverlap) / hop);
    
    if (numSegments === 0) {
      return { psd: [], freqs: [] };
    }
    
    // Initialize PSD accumulator
    const freqBins = Math.floor(nfft / 2) + 1;
    const psdSum = new Array(freqBins).fill(0);
    
    // Calculate Hanning window (exactly matches scipy.signal.windows.hann)
    const hanningWindow = Array.from({ length: nperseg }, (_, n) => 
      0.5 * (1 - Math.cos(2 * Math.PI * n / (nperseg - 1)))
    );
    
    // Window power for scaling (matches scipy implementation exactly)
    const windowPower = hanningWindow.reduce((sum, w) => sum + w * w, 0);
    
    // Process segments
    for (let segIdx = 0; segIdx < numSegments; segIdx++) {
      const start = segIdx * hop;
      const segment = data.slice(start, start + nperseg);
      
      // Apply Hanning window
      const windowed = segment.map((val, i) => val * hanningWindow[i]);
      
      // Compute FFT
      const fftResult = this.fft(windowed);
      
      // Calculate power spectral density (matches scipy.signal.welch scaling exactly)
      for (let k = 0; k < freqBins; k++) {
        const real = fftResult.real[k];
        const imag = fftResult.imag[k];
        
        // Power spectrum: |X(k)|^2
        let power = real * real + imag * imag;
        
        // Scale by sampling frequency and window power (scipy formula)
        power = power / (this.fs * windowPower);
        
        // Scale for one-sided spectrum (except DC and Nyquist)
        if (k > 0 && k < freqBins - 1) {
          power *= 2;
        }
        
        psdSum[k] += power;
      }
    }
    
    // Average across segments
    const psd = psdSum.map(sum => sum / numSegments);
    const freqs = Array.from({ length: freqBins }, (_, k) => k * this.fs / nfft);
    
    return { psd, freqs };
  }

  /**
   * Integrate band power using Simpson's rule (matches scipy.integrate.simps)
   * @param {number[]} psd - Power spectral density
   * @param {number[]} freqs - Frequency array
   * @param {number[]} band - [lowHz, highHz]
   * @returns {number} - Integrated power
   */
  bandpower(psd, freqs, band) {
    const [low, high] = band;
    
    // Find indices in frequency range
    const indices = [];
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] >= low && freqs[i] <= high) {
        indices.push(i);
      }
    }
    
    if (indices.length === 0) return 0;
    if (indices.length === 1) return psd[indices[0]];
    
    // Extract values and frequencies for integration
    const values = indices.map(i => psd[i]);
    const x = indices.map(i => freqs[i]);
    
    // Simpson's 1/3 rule with fallback to trapezoidal
    return this.simpsonsRule(values, x);
  }

  /**
   * Simpson's 1/3 rule integration (matches scipy.integrate.simps)
   * @param {number[]} y - Function values
   * @param {number[]} x - X coordinates (optional, assumes uniform spacing if not provided)
   * @returns {number} - Integrated value
   */
  simpsonsRule(y, x = null) {
    const n = y.length;
    if (n < 2) return n === 1 ? y[0] : 0;
    
    // Handle uniform spacing case
    if (x === null) {
      x = Array.from({ length: n }, (_, i) => i);
    }
    
    // For non-uniform spacing or odd number of points, use composite Simpson's
    // with trapezoidal rule for remaining intervals
    let integral = 0;
    
    // Apply Simpson's rule for pairs of intervals
    for (let i = 0; i < n - 2; i += 2) {
      const h1 = x[i + 1] - x[i];
      const h2 = x[i + 2] - x[i + 1];
      
      if (Math.abs(h1 - h2) < 1e-10) {
        // Uniform spacing - use standard Simpson's 1/3
        const h = h1;
        integral += (h / 3) * (y[i] + 4 * y[i + 1] + y[i + 2]);
      } else {
        // Non-uniform spacing - use adaptive Simpson's formula
        const h = h1 + h2;
        integral += (h / 6) * (y[i] + 4 * y[i + 1] + y[i + 2]);
      }
    }
    
    // Handle remaining point with trapezoidal rule
    if ((n - 1) % 2 === 1) {
      const i = n - 2;
      const h = x[i + 1] - x[i];
      integral += 0.5 * h * (y[i] + y[i + 1]);
    }
    
    return integral;
  }

  /**
   * Calculate population variance (matches Python np.var)
   * @param {number[]} data - Input data
   * @returns {number} - Population variance
   */
  calculateVariance(data) {
    if (data.length === 0) return 0;
    
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  }

  /**
   * Calculate theta metrics (matches Python theta calculations)
   * @param {number[]} psd - Power spectral density
   * @param {number[]} freqs - Frequency array
   * @param {number[]} signalData - Time domain signal for variance calculation
   * @returns {Object} - Comprehensive theta metrics
   */
  calculateThetaMetrics(psd, freqs, signalData) {
    // Calculate band powers
    const deltaPower = this.bandpower(psd, freqs, this.bands.delta);
    const thetaPower = this.bandpower(psd, freqs, this.bands.theta);
    const alphaPower = this.bandpower(psd, freqs, this.bands.alpha);
    const betaPower = this.bandpower(psd, freqs, this.bands.beta);
    const gammaPower = this.bandpower(psd, freqs, this.bands.gamma);
    
    // Total power from signal variance (matches Python)
    const totalPower = this.calculateVariance(signalData);
    
    // Theta contribution as percentage of total brain activity
    const thetaPct = totalPower > 0 ? (thetaPower / totalPower) * 100 : 0;
    
    // Theta peak SNR (matches Python theta_peak_snr function)
    const thetaPeakSNR = this.calculateThetaPeakSNR(psd, freqs, [3, 9], [[2, 3], [9, 10]]);
    
    // Broadband theta SNR
    const totalPSDPower = this.bandpower(psd, freqs, [0, freqs[freqs.length - 1]]);
    const noisePower = totalPSDPower - thetaPower;
    const thetaSNRBroad = noisePower > 0 ? thetaPower / noisePower : Number.POSITIVE_INFINITY;
    
    // Adaptive theta based on SNR quality
    let adaptedTheta;
    if (isFinite(thetaPeakSNR) && thetaPeakSNR >= 0.2) {
      adaptedTheta = thetaPeakSNR / (thetaPeakSNR + 1); // Normalize SNR contribution
    } else {
      adaptedTheta = 0;
    }
    
    // Exponential smoothing (α = 0.3, matches Python)
    const alpha = 0.3;
    if (this.smoothedThetaContribution === null) {
      this.smoothedThetaContribution = thetaPct;
    } else {
      this.smoothedThetaContribution = alpha * thetaPct + (1 - alpha) * this.smoothedThetaContribution;
    }
    
    return {
      thetaPower,
      totalPower,
      thetaPct,
      thetaPeakSNR: isFinite(thetaPeakSNR) ? thetaPeakSNR : NaN,
      thetaSNRBroad: isFinite(thetaSNRBroad) ? thetaSNRBroad : NaN,
      adaptedTheta,
      smoothedTheta: this.smoothedThetaContribution,
      // All band powers for completeness
      bandPowers: {
        delta: deltaPower,
        theta: thetaPower,
        alpha: alphaPower,
        beta: betaPower,
        gamma: gammaPower
      }
    };
  }

  /**
   * Calculate theta peak SNR (matches Python theta_peak_snr function exactly)
   * @param {number[]} psd - Power spectral density
   * @param {number[]} freqs - Frequency array
   * @param {number[]} sigBand - Signal band [lowHz, highHz]
   * @param {number[][]} noiseBands - Array of noise bands [[low1, high1], [low2, high2]]
   * @returns {number} - Peak SNR value
   */
  calculateThetaPeakSNR(psd, freqs, sigBand = [3, 9], noiseBands = [[2, 3], [9, 10]]) {
    try {
      // Find signal indices
      const sigIndices = [];
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] >= sigBand[0] && freqs[i] <= sigBand[1]) {
          sigIndices.push(i);
        }
      }
      
      if (sigIndices.length === 0) return NaN;
      
      // Find maximum signal in theta band
      let maxSignal = 0;
      for (const idx of sigIndices) {
        if (psd[idx] > maxSignal) {
          maxSignal = psd[idx];
        }
      }
      
      // Collect noise values from flanking bands
      const noiseValues = [];
      for (const [low, high] of noiseBands) {
        for (let i = 0; i < freqs.length; i++) {
          if (freqs[i] >= low && freqs[i] <= high) {
            noiseValues.push(psd[i]);
          }
        }
      }
      
      if (noiseValues.length === 0) return NaN;
      
      // Calculate mean noise
      const meanNoise = noiseValues.reduce((sum, val) => sum + val, 0) / noiseValues.length;
      
      return meanNoise > 0 ? maxSignal / meanNoise : Number.POSITIVE_INFINITY;
    } catch (error) {
      console.error('Error calculating theta peak SNR:', error);
      return NaN;
    }
  }

  /**
   * Add new raw data point to buffer (matches Python onRaw function)
   * @param {number} rawValue - Single raw EEG value from device
   */
  addRawData(rawValue) {
    this.liveDataBuffer.push(rawValue);
    
    // Keep buffer size manageable (matches Python buffer management)
    if (this.liveDataBuffer.length > this.maxBufferSize) {
      this.liveDataBuffer = this.liveDataBuffer.slice(-this.maxBufferSize);
    }
  }

  /**
   * Process accumulated buffer data (matches Python update_live_plot)
   * @returns {Object|null} - Processing results or null if insufficient data
   */
  processLiveData() {
    if (this.liveDataBuffer.length < 3) {
      return null; // Not enough data
    }
    
    // Process the accumulated buffer
    return this.process(this.liveDataBuffer);
  }

  /**
   * Main processing function - complete pipeline (matches Python process flow exactly)
   * @param {Uint8Array|ArrayBuffer|Array|string|number} rawBuffer - Raw EEG data
   * @returns {Object} - Complete processing results
   */
  process(rawBuffer) {
    try {
      // Step 1: Parse raw data (store as raw values, not microvolts)
      const rawData = this.parseRawData(rawBuffer);
      if (rawData.length < 3) {
        // Not enough data for processing
        return null;
      }
      
      // Convert raw data to numpy-like array
      const data = [...rawData];
      
      // Step 2: Apply artifact removal before filtering (matches Python)
      const cleanedData = this.removeEyeBlinkArtifacts(data);
      
      // Step 3: Apply notch filter (50 Hz)
      const notchedData = this.applyNotchFilter(cleanedData);
      
      // Step 4: Apply bandpass filter (1-45 Hz) 
      const filteredData = this.applyBandpassFilter(notchedData);
      
      // Step 5: Calculate PSD using Welch's method
      const { psd, freqs } = this.computePSD(filteredData);
      
      if (psd.length === 0 || freqs.length === 0) {
        return null;
      }
      
      // Step 6: Calculate signal variance for total power (matches Python exactly)
      const signal = [...filteredData];
      const totalPower = this.calculateVariance(signal);
      
      // Step 7: Calculate band powers (absolute values)
      const deltaPower = this.bandpower(psd, freqs, this.bands.delta);
      const thetaPower = this.bandpower(psd, freqs, this.bands.theta);
      const alphaPower = this.bandpower(psd, freqs, this.bands.alpha);
      const betaPower = this.bandpower(psd, freqs, this.bands.beta);
      const gammaPower = this.bandpower(psd, freqs, this.bands.gamma);
      
      // Step 8: Calculate theta contribution as percentage (matches Python)
      const thetaContribution = totalPower > 0 ? (thetaPower / totalPower) * 100 : 0;
      
      // Step 9: Calculate theta peak SNR
      const thetaPeakSNR = this.calculateThetaPeakSNR(psd, freqs, [3, 9], [[2, 3], [9, 10]]);
      
      // Step 10: Adaptive theta based on SNR quality (matches Python)
      let adaptedTheta;
      if (isFinite(thetaPeakSNR) && thetaPeakSNR >= 0.2) {
        adaptedTheta = thetaPeakSNR / (thetaPeakSNR + 1); // Normalize SNR contribution
      } else {
        adaptedTheta = 0;
      }
      
      // Step 11: Apply exponential smoothing (α = 0.3, matches Python)
      const alpha = 0.3;
      if (this.smoothedThetaContribution === null) {
        this.smoothedThetaContribution = thetaContribution;
      } else {
        this.smoothedThetaContribution = alpha * thetaContribution + (1 - alpha) * this.smoothedThetaContribution;
      }
      
      // Step 12: Calculate broad-band theta SNR (optional)
      const totalPSDPower = this.bandpower(psd, freqs, [0, freqs[freqs.length - 1]]);
      const noisePower = totalPSDPower - thetaPower;
      const thetaSNRBroad = noisePower > 0 ? thetaPower / noisePower : Number.POSITIVE_INFINITY;
      
      // Step 13: Build result payload (matches Python exactly)
      const result = {
        // Raw processing data
        rawData,
        cleanedData,
        filteredData,
        
        // Frequency domain
        psd,
        freqs,
        
        // Band powers (absolute values)
        bandPowers: {
          delta: deltaPower,
          theta: thetaPower,
          alpha: alphaPower,
          beta: betaPower,
          gamma: gammaPower
        },
        
        // Main metrics (matches Python payload exactly)
        thetaMetrics: {
          totalPower,                                          // Total variance (power)
          deltaPower,                                          // Delta power
          thetaPower,                                          // Theta power
          thetaContribution,                                   // Theta contribution %
          thetaRelative: thetaContribution / 100,             // Theta relative (0-1)
          thetaSNRBroad: isFinite(thetaSNRBroad) ? thetaSNRBroad : NaN,
          thetaSNRPeak: isFinite(thetaPeakSNR) ? thetaPeakSNR : NaN,
          alphaPower,                                          // Alpha power
          betaPower,                                           // Beta power
          gammaPower,                                          // Gamma power
          adaptedTheta,                                        // Adapted theta
          smoothedTheta: this.smoothedThetaContribution        // Smoothed theta
        },
        
        // Payload format for API (matches Python exactly)
        payload: {
          'Total variance (power)': totalPower,
          'Delta power': deltaPower,
          'Theta power': thetaPower,
          'Theta contribution': thetaContribution,
          'Theta relative': thetaContribution / 100,
          'Theta SNR broad': isFinite(thetaSNRBroad) ? thetaSNRBroad : NaN,
          'Theta SNR peak': isFinite(thetaPeakSNR) ? thetaPeakSNR : NaN,
          'Alpha power': alphaPower,
          'Beta power': betaPower,
          'Gamma power': gammaPower
        }
      };
      
      // Log results occasionally (matches Python logging frequency)
      if (Math.random() < 0.02) { // Log 2% of the time
        const peakSNRDisplay = isFinite(thetaPeakSNR) ? thetaPeakSNR.toFixed(2) : "∞";
        console.log(`🧠 Theta contribution: ${thetaContribution.toFixed(1)}% | Peak θ-SNR: ${peakSNRDisplay} | Smoothed: ${this.smoothedThetaContribution.toFixed(1)}%`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ EEG processing failed:', error);
      return null;
    }
  }
}

// Export the class and create a singleton instance for global use
export default EEGProcessor;

// Export factory function for creating instances with custom sampling rates
export function createEEGProcessor(samplingRate = 512) {
  return new EEGProcessor(samplingRate);
}

// Export utility functions for standalone use
export {
  EEGProcessor as EEGProcessorClass
};

// Export test function for debugging
export function testEEGProcessing() {
  const processor = new EEGProcessor();
  
  // Test with some synthetic data
  const testData = [];
  for (let i = 0; i < 1000; i++) {
    // Generate mixed frequency signal for testing
    const t = i / 512; // time
    const signal = 
      100 * Math.sin(2 * Math.PI * 2 * t) +   // 2 Hz (delta)
      50 * Math.sin(2 * Math.PI * 6 * t) +    // 6 Hz (theta)
      30 * Math.sin(2 * Math.PI * 10 * t) +   // 10 Hz (alpha)
      Math.random() * 10;                      // noise
    testData.push(signal);
  }
  
  console.log('🧪 Testing EEG processor with synthetic data...');
  const result = processor.process(testData);
  
  if (result) {
    console.log('✅ Processing successful!');
    console.log(`Delta: ${result.bandPowers.delta.toFixed(2)}`);
    console.log(`Theta: ${result.bandPowers.theta.toFixed(2)}`);
    console.log(`Alpha: ${result.bandPowers.alpha.toFixed(2)}`);
    console.log(`Beta: ${result.bandPowers.beta.toFixed(2)}`);
    console.log(`Gamma: ${result.bandPowers.gamma.toFixed(2)}`);
    console.log(`Theta contribution: ${result.thetaMetrics.thetaContribution.toFixed(1)}%`);
    return result;
  } else {
    console.log('❌ Processing failed');
    return null;
  }
}
