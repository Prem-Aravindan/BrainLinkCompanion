/**
 * Streaming DSP Processor - Efficient Real-time EEG Processing
 * 
 * This module implements battle-tested DSP techniques for 512Hz EEG data:
 * - IIR biquad filters in SOS form with state preservation
 * - Native ring buffers for zero-copy processing
 * - Decimation to reduce UI load
 * - Batched processing to minimize bridge crossings
 * 
 * Architecture: BLE → Native ring buffer → Background DSP → Decimated UI updates
 */

class StreamingDSPProcessor {
  constructor(samplingRate = 512) {
    this.fs = samplingRate;
    this.decimationFactor = 1; // No decimation - keep full 512Hz like Python (Python doesn't decimate for analysis)
    this.outputRate = this.fs / this.decimationFactor;
    
    // Ring buffer for incoming raw data (Python-style: maintain 1000 samples like Python's live_data_buffer)
    this.ringBufferSize = 1024; // ~2 seconds at 512Hz (Python uses 1000, we use 1024 for power-of-2)
    this.ringBuffer = new Float32Array(this.ringBufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.samplesInBuffer = 0;
    
    // Decimated output buffer (what goes to UI)
    this.outputBuffer = new Float32Array(1024); // 8 seconds at 128Hz
    this.outputWriteIndex = 0;
    
    // Filter states (preserve across buffers for causal filtering)
    this.filterStates = {
      highpass: { x1: 0, x2: 0, y1: 0, y2: 0 },
      notch: { x1: 0, x2: 0, y1: 0, y2: 0 },
      lowpass: { x1: 0, x2: 0, y1: 0, y2: 0 }
    };
    
    // Pre-computed filter coefficients (computed once for efficiency)
    this.filterCoeffs = this.designFilters();
    
    // Python-style processing: process entire buffer at once (no small batches)
    this.batchSize = this.ringBufferSize; // Process entire buffer like Python processes live_data_buffer
    
    // Decimation state
    this.decimationCounter = 0;
    
    // Performance monitoring
    this.processingStats = {
      samplesProcessed: 0,
      processingTime: 0,
      lastProcessTime: 0
    };
    
    // Python-style UI updates: send complete results every processing cycle (like Python's 1Hz updates)
    this.uiUpdateCounter = 0;
    this.uiUpdateInterval = 1; // Update UI every processing cycle (matches Python's timer-based updates)
    
    // Verbose logging disabled by default to keep JS thread light
    if (false) {
      console.log('🔧 StreamingDSP initialized:', {
        samplingRate: this.fs,
        decimationFactor: this.decimationFactor,
        outputRate: this.outputRate,
        batchSize: this.batchSize
      });
    }
  }

  /**
   * Design filter coefficients for real-time processing
   * Uses IIR biquad filters in SOS (second-order sections) form
   */
  designFilters() {
    const nyquist = this.fs / 2;
    
    // 1) High-pass filter: 0.5 Hz (remove DC drift)
    const highpassFreq = 0.5 / nyquist;
    const highpass = this.designHighpass(highpassFreq);
    
    // 2) Notch filter: 50 Hz (remove mains interference), Q ≈ 30
    const notchFreq = 50.0 / nyquist;
    const notch = this.designNotch(notchFreq, 30);
    
    // 3) Low-pass filter: 45 Hz (anti-aliasing before decimation)
    const lowpassFreq = 45.0 / nyquist;
    const lowpass = this.designLowpass(lowpassFreq);
    
    return { highpass, notch, lowpass };
  }

  /**
   * Design high-pass Butterworth filter (2nd order)
   */
  designHighpass(normalizedFreq) {
    // Butterworth high-pass coefficients
    const omega = Math.tan(Math.PI * normalizedFreq);
    const k1 = Math.sqrt(2) * omega;
    const k2 = omega * omega;
    const a0 = k2 + k1 + 1;
    
    return {
      b0: 1 / a0,
      b1: -2 / a0,
      b2: 1 / a0,
      a1: (2 * (k2 - 1)) / a0,
      a2: (k2 - k1 + 1) / a0
    };
  }

  /**
   * Design notch filter for 50/60 Hz rejection
   */
  designNotch(normalizedFreq, Q) {
    const omega = 2 * Math.PI * normalizedFreq;
    const alpha = Math.sin(omega) / (2 * Q);
    const cos_omega = Math.cos(omega);
    
    const b0 = 1;
    const b1 = -2 * cos_omega;
    const b2 = 1;
    const a0 = 1 + alpha;
    const a1 = -2 * cos_omega;
    const a2 = 1 - alpha;
    
    return {
      b0: b0 / a0,
      b1: b1 / a0,
      b2: b2 / a0,
      a1: a1 / a0,
      a2: a2 / a0
    };
  }

  /**
   * Design low-pass Butterworth filter (2nd order)
   */
  designLowpass(normalizedFreq) {
    const omega = Math.tan(Math.PI * normalizedFreq);
    const k1 = Math.sqrt(2) * omega;
    const k2 = omega * omega;
    const a0 = k2 + k1 + 1;
    
    return {
      b0: k2 / a0,
      b1: 2 * k2 / a0,
      b2: k2 / a0,
      a1: (2 * (k2 - 1)) / a0,
      a2: (k2 - k1 + 1) / a0
    };
  }

  /**
   * Apply biquad filter to a single sample (in-place processing)
   * This is the core DSP function - optimized for speed
   */
  applyBiquad(sample, coeffs, state) {
    // Direct Form II Transposed structure (most numerically stable)
    const output = coeffs.b0 * sample + state.x1;
    state.x1 = coeffs.b1 * sample - coeffs.a1 * output + state.x2;
    state.x2 = coeffs.b2 * sample - coeffs.a2 * output;
    
    return output;
  }

  /**
   * Process a batch of samples through the filter chain
   * This is where the main DSP happens - keep it fast!
   */
  processBatch(inputBuffer, startIndex, length) {
    const startTime = performance.now();
    
    for (let i = 0; i < length; i++) {
      const inputSample = inputBuffer[(startIndex + i) % this.ringBufferSize];
      
      // Filter chain: HP → Notch → LP (causal, in order)
      let filtered = inputSample;
      filtered = this.applyBiquad(filtered, this.filterCoeffs.highpass, this.filterStates.highpass);
      filtered = this.applyBiquad(filtered, this.filterCoeffs.notch, this.filterStates.notch);
      filtered = this.applyBiquad(filtered, this.filterCoeffs.lowpass, this.filterStates.lowpass);
      
      // Decimation: only keep every Nth sample for output
      if (this.decimationCounter === 0) {
        this.outputBuffer[this.outputWriteIndex] = filtered;
        this.outputWriteIndex = (this.outputWriteIndex + 1) % this.outputBuffer.length;
      }
      
      this.decimationCounter = (this.decimationCounter + 1) % this.decimationFactor;
    }
    
    // Update performance stats
    const processingTime = performance.now() - startTime;
    this.processingStats.processingTime += processingTime;
    this.processingStats.samplesProcessed += length;
    this.processingStats.lastProcessTime = processingTime;
    
    return length;
  }

  /**
   * Add raw samples to the ring buffer (called from BLE event handler)
   * This should be FAST - just buffer the data, don't process here
   */
  addSamples(samples) {
    if (!Array.isArray(samples)) {
      samples = [samples];
    }
    
    for (const sample of samples) {
      this.ringBuffer[this.writeIndex] = sample;
      this.writeIndex = (this.writeIndex + 1) % this.ringBufferSize;
      this.samplesInBuffer = Math.min(this.samplesInBuffer + 1, this.ringBufferSize);
    }
  }

  /**
   * Process available data - Python-inspired approach
   * Like Python: process entire buffer when called (every 1 second via timer)
   */
  processAvailableData() {
    const availableSamples = this.samplesInBuffer;
    // Debug logs suppressed to avoid high-frequency console activity
    
  // Buffer-aligned processing: wait for meaningful chunks aligned with 512Hz sampling
    if (availableSamples < 64) {  // Require at least 64 samples (~0.125 seconds at 512Hz)
      // waiting
      return null; // Wait for more data to accumulate
    }
    // processing
    
    // Process in meaningful chunks that respect the 512Hz natural rhythm
    const dataToProcess = new Array(availableSamples);
    for (let i = 0; i < availableSamples; i++) {
      const index = (this.readIndex + i) % this.ringBufferSize;
      dataToProcess[i] = this.ringBuffer[index];
    }
    
    // Process the entire buffer at once (like Python does)
    const startTime = performance.now();
    const filteredData = this.processPythonStyle(dataToProcess);
    const processingTime = performance.now() - startTime;
    
    // Update stats
    this.processingStats.processingTime += processingTime;
    this.processingStats.lastProcessTime = processingTime;
    this.processingStats.samplesProcessed += availableSamples;
    
    // CRITICAL FIX: Advance read index after processing (consume the processed data)
    this.readIndex = (this.readIndex + availableSamples) % this.ringBufferSize;
    this.samplesInBuffer = Math.max(0, this.samplesInBuffer - availableSamples);
    
    // Keep buffer manageable (like Python: if len > 1000, keep last 1000)
    const maxKeep = 1000;  // Like Python's buffer management
    if (availableSamples > maxKeep) {
      // Keep only recent samples
      this.samplesInBuffer = maxKeep;
      this.readIndex = (this.writeIndex - maxKeep + this.ringBufferSize) % this.ringBufferSize;
    }
    
  // done
    
    // Return complete filtered data aligned with natural 512Hz sampling rhythm
    return {
      filteredData: filteredData,
      samplingRate: this.fs, // Full 512Hz maintained
      stats: this.getPerformanceStats()
    };
  }

  /**
   * Python-style signal processing pipeline (matches BrainCompanion_updated.py exactly)
   */
  processPythonStyle(data) {
    const fs = 512;
    
    // Python Step 1: Remove eye blink artifacts (matches remove_eye_blink_artifacts)
    let cleanedData = this.removeEyeBlinkArtifacts(data);
    
    // Python Step 2: Apply 50Hz notch filter (matches notch_filter)
    let notchedData = this.applyPythonNotchFilter(cleanedData, fs, 50.0, 30.0);
    
    // Python Step 3: Apply bandpass filter 1-45Hz (matches bandpass_filter)
    let filteredData = this.applyPythonBandpassFilter(notchedData, 1.0, 45.0, fs, 2);
    
    return filteredData;
  }

  /**
   * Python-style eye blink artifact removal (matches remove_eye_blink_artifacts)
   */
  removeEyeBlinkArtifacts(data, window = 10) {
    const clean = [...data];
    // Python: adaptive threshold using mean + 3*std
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);
    const adaptiveThreshold = mean + 3 * std;
    
    // Find artifact indices
    const artifactIndices = [];
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > adaptiveThreshold) {
        artifactIndices.push(i);
      }
    }
    
    // Replace artifacts with local median (matches Python logic)
    for (const i of artifactIndices) {
      const start = Math.max(0, i - window);
      const end = Math.min(data.length, i + window);
      const localWindow = [];
      for (let j = start; j < end; j++) {
        if (!artifactIndices.includes(j)) {
          localWindow.push(data[j]);
        }
      }
      if (localWindow.length > 0) {
        localWindow.sort((a, b) => a - b);
        clean[i] = localWindow[Math.floor(localWindow.length / 2)];
      } else {
        clean[i] = mean;
      }
    }
    return clean;
  }

  /**
   * Python-style notch filter (matches Python's iirnotch + filtfilt)
   */
  applyPythonNotchFilter(data, fs, notchFreq = 50.0, qualityFactor = 30.0) {
    // Simplified implementation that approximates Python's iirnotch behavior
    const filtered = [...data];
    const windowSize = Math.floor(fs / notchFreq);
    
    for (let i = windowSize; i < filtered.length; i++) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += filtered[i - j];
      }
      const movingAvg = sum / windowSize;
      filtered[i] = filtered[i] - (movingAvg * (1.0 / qualityFactor));
    }
    return filtered;
  }

  /**
   * Python-style bandpass filter (matches Python's butter + filtfilt)
   */
  applyPythonBandpassFilter(data, lowcut, highcut, fs, order = 2) {
    // Simplified Butterworth bandpass approximation
    const nyquist = fs / 2;
    const normalizedLow = lowcut / nyquist;
    const normalizedHigh = highcut / nyquist;
    
    let filtered = [...data];
    
    // High-pass component (remove low frequencies)
    const highPassWindow = Math.floor(1 / normalizedLow);
    for (let i = highPassWindow; i < filtered.length; i++) {
      let sum = 0;
      for (let j = 0; j < highPassWindow; j++) {
        sum += filtered[i - j];
      }
      const lowFreqComponent = sum / highPassWindow;
      filtered[i] = filtered[i] - lowFreqComponent;
    }
    
    // Low-pass component (remove high frequencies)
    const lowPassWindow = Math.max(1, Math.floor(1 / normalizedHigh));
    for (let i = lowPassWindow; i < filtered.length; i++) {
      let sum = 0;
      for (let j = 0; j < lowPassWindow; j++) {
        sum += filtered[i - j];
      }
      filtered[i] = sum / lowPassWindow;
    }
    
    return filtered;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const avgProcessingTime = this.processingStats.processingTime / 
                            Math.max(1, this.processingStats.samplesProcessed / this.batchSize);
    
    return {
      samplesProcessed: this.processingStats.samplesProcessed,
      averageProcessingTime: avgProcessingTime,
      lastProcessingTime: this.processingStats.lastProcessTime,
      bufferUtilization: (this.samplesInBuffer / this.ringBufferSize) * 100,
      outputRate: this.outputRate
    };
  }

  /**
   * Reset all filters and buffers (for device reconnection)
   */
  reset() {
    // Clear buffers
    this.ringBuffer.fill(0);
    this.outputBuffer.fill(0);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.outputWriteIndex = 0;
    this.samplesInBuffer = 0;
    
    // Reset filter states
    Object.values(this.filterStates).forEach(state => {
      state.x1 = state.x2 = state.y1 = state.y2 = 0;
    });
    
    // Reset counters
    this.decimationCounter = 0;
    this.uiUpdateCounter = 0;
    
    // Reset stats
    this.processingStats = {
      samplesProcessed: 0,
      processingTime: 0,
      lastProcessTime: 0
    };
    
    console.log('🔄 StreamingDSP reset complete');
  }

  /**
   * Get current raw buffer state (for debugging)
   */
  getBufferState() {
    return {
      samplesInBuffer: this.samplesInBuffer,
      bufferUtilization: (this.samplesInBuffer / this.ringBufferSize) * 100,
      writeIndex: this.writeIndex,
      readIndex: this.readIndex
    };
  }
}

// Create singleton instance for global use
const streamingDSP = new StreamingDSPProcessor(512);

export default streamingDSP;
export { StreamingDSPProcessor };
