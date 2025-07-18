import { EEG_CONFIG } from '../constants';

class EEGProcessor {
  /**
   * Process raw EEG data from BrainLink device
   */
  static processRawData(rawData) {
    try {
      // Parse the raw data string
      // BrainLink typically sends comma-separated values
      const values = rawData.split(',').map(val => parseFloat(val.trim()));
      
      // Filter out invalid values
      const validValues = values.filter(val => !isNaN(val) && isFinite(val));
      
      if (validValues.length === 0) {
        return [];
      }

      // Apply basic filtering and normalization
      return validValues.map(value => this.normalizeValue(value));
    } catch (error) {
      console.error('Error processing raw EEG data:', error);
      return [];
    }
  }

  /**
   * Normalize EEG value to reasonable range
   */
  static normalizeValue(value) {
    // BrainLink values are typically in microvolts
    // Normalize to a range suitable for visualization (-1 to 1)
    const minVal = -100;
    const maxVal = 100;
    
    return Math.max(-1, Math.min(1, (value - minVal) / (maxVal - minVal) * 2 - 1));
  }

  /**
   * Apply simple low-pass filter to reduce noise
   */
  static lowPassFilter(data, cutoffFreq = 50) {
    if (data.length < 3) return data;

    const samplingRate = EEG_CONFIG.SAMPLING_RATE;
    const rc = 1.0 / (cutoffFreq * 2 * Math.PI);
    const dt = 1.0 / samplingRate;
    const alpha = dt / (rc + dt);

    const filtered = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (data[i] - filtered[i - 1]);
    }

    return filtered;
  }

  /**
   * Apply simple high-pass filter to remove DC offset
   */
  static highPassFilter(data, cutoffFreq = 0.5) {
    if (data.length < 3) return data;

    const samplingRate = EEG_CONFIG.SAMPLING_RATE;
    const rc = 1.0 / (cutoffFreq * 2 * Math.PI);
    const dt = 1.0 / samplingRate;
    const alpha = rc / (rc + dt);

    const filtered = [0];
    
    for (let i = 1; i < data.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + data[i] - data[i - 1]);
    }

    return filtered;
  }

  /**
   * Calculate power spectral density using FFT approximation
   */
  static calculatePSD(data) {
    const N = data.length;
    if (N < 4) return [];

    // Simple approximation of FFT for power calculation
    // This is a simplified version - in production, use a proper FFT library
    const psd = [];
    const nyquist = EEG_CONFIG.SAMPLING_RATE / 2;

    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += data[n] * Math.cos(angle);
        imag += data[n] * Math.sin(angle);
      }
      
      const power = (real * real + imag * imag) / N;
      const frequency = k * nyquist / (N / 2);
      
      psd.push({ frequency, power });
    }

    return psd;
  }

  /**
   * Calculate band powers for different frequency ranges
   */
  static calculateBandPowers(data) {
    if (data.length < EEG_CONFIG.WINDOW_SIZE) {
      return {
        delta: 0,
        theta: 0,
        alpha: 0,
        beta: 0,
        gamma: 0,
      };
    }

    // Apply filtering
    const filtered = this.lowPassFilter(this.highPassFilter(data));
    
    // Calculate PSD
    const psd = this.calculatePSD(filtered);
    
    // Calculate total power
    const totalPower = psd.reduce((sum, bin) => sum + bin.power, 0);
    
    if (totalPower === 0) {
      return {
        delta: 0,
        theta: 0,
        alpha: 0,
        beta: 0,
        gamma: 0,
      };
    }

    // Calculate power in each frequency band
    const bands = {
      delta: this.getBandPower(psd, EEG_CONFIG.FREQUENCY_BANDS.DELTA),
      theta: this.getBandPower(psd, EEG_CONFIG.FREQUENCY_BANDS.THETA),
      alpha: this.getBandPower(psd, EEG_CONFIG.FREQUENCY_BANDS.ALPHA),
      beta: this.getBandPower(psd, EEG_CONFIG.FREQUENCY_BANDS.BETA),
      gamma: this.getBandPower(psd, EEG_CONFIG.FREQUENCY_BANDS.GAMMA),
    };

    // Normalize to relative power (0-1)
    return {
      delta: bands.delta / totalPower,
      theta: bands.theta / totalPower,
      alpha: bands.alpha / totalPower,
      beta: bands.beta / totalPower,
      gamma: bands.gamma / totalPower,
    };
  }

  /**
   * Get power in a specific frequency band
   */
  static getBandPower(psd, band) {
    return psd
      .filter(bin => bin.frequency >= band.min && bin.frequency <= band.max)
      .reduce((sum, bin) => sum + bin.power, 0);
  }

  /**
   * Calculate attention and meditation indices (simplified)
   */
  static calculateIndices(bandPowers) {
    // Simplified attention index (beta / (alpha + theta))
    const attention = bandPowers.beta / (bandPowers.alpha + bandPowers.theta + 0.001);
    
    // Simplified meditation index (alpha / (beta + gamma))
    const meditation = bandPowers.alpha / (bandPowers.beta + bandPowers.gamma + 0.001);
    
    // Normalize to 0-1 range
    return {
      attention: Math.min(1, Math.max(0, attention / 2)),
      meditation: Math.min(1, Math.max(0, meditation / 2)),
    };
  }

  /**
   * Detect artifacts in EEG data
   */
  static detectArtifacts(data, threshold = 3) {
    if (data.length < 10) return false;

    // Calculate standard deviation
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    // Check for values beyond threshold * standard deviation
    const artifacts = data.filter(val => Math.abs(val - mean) > threshold * stdDev);
    
    return artifacts.length > data.length * 0.1; // More than 10% artifacts
  }

  /**
   * Apply notch filter to remove 50Hz/60Hz power line interference
   */
  static notchFilter(data, notchFreq = 50) {
    // Simplified notch filter implementation
    // In production, use a proper notch filter library
    if (data.length < 5) return data;

    const samplingRate = EEG_CONFIG.SAMPLING_RATE;
    const normalizedFreq = notchFreq / (samplingRate / 2);
    
    // Simple moving average to approximate notch filtering
    const windowSize = Math.max(3, Math.floor(samplingRate / notchFreq));
    const filtered = [];

    for (let i = 0; i < data.length; i++) {
      let sum = 0;
      let count = 0;
      
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length - 1, i + Math.floor(windowSize / 2));
      
      for (let j = start; j <= end; j++) {
        sum += data[j];
        count++;
      }
      
      filtered[i] = sum / count;
    }

    return filtered;
  }

  /**
   * Calculate signal quality metric
   */
  static calculateSignalQuality(data) {
    if (data.length < 10) return 0;

    // Check for artifacts
    const hasArtifacts = this.detectArtifacts(data);
    if (hasArtifacts) return 0.3;

    // Calculate signal-to-noise ratio approximation
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    
    // Good signal should have reasonable variance but not too much noise
    const idealVariance = 0.1;
    const qualityScore = Math.exp(-Math.abs(variance - idealVariance) / idealVariance);
    
    return Math.min(1, Math.max(0, qualityScore));
  }

  /**
   * Create session summary from EEG data
   */
  static createSessionSummary(allData, duration) {
    if (!allData || allData.length === 0) {
      return {
        duration: 0,
        avgSignalQuality: 0,
        avgBandPowers: {
          delta: 0,
          theta: 0,
          alpha: 0,
          beta: 0,
          gamma: 0,
        },
        avgIndices: {
          attention: 0,
          meditation: 0,
        },
        totalSamples: 0,
      };
    }

    // Calculate average band powers
    const avgBandPowers = {
      delta: 0,
      theta: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
    };

    let signalQualitySum = 0;
    let attentionSum = 0;
    let meditationSum = 0;
    let validWindows = 0;

    // Process data in windows
    for (let i = 0; i < allData.length - EEG_CONFIG.WINDOW_SIZE; i += EEG_CONFIG.WINDOW_SIZE) {
      const window = allData.slice(i, i + EEG_CONFIG.WINDOW_SIZE);
      
      const bandPowers = this.calculateBandPowers(window);
      const indices = this.calculateIndices(bandPowers);
      const quality = this.calculateSignalQuality(window);

      avgBandPowers.delta += bandPowers.delta;
      avgBandPowers.theta += bandPowers.theta;
      avgBandPowers.alpha += bandPowers.alpha;
      avgBandPowers.beta += bandPowers.beta;
      avgBandPowers.gamma += bandPowers.gamma;

      signalQualitySum += quality;
      attentionSum += indices.attention;
      meditationSum += indices.meditation;
      validWindows++;
    }

    if (validWindows > 0) {
      avgBandPowers.delta /= validWindows;
      avgBandPowers.theta /= validWindows;
      avgBandPowers.alpha /= validWindows;
      avgBandPowers.beta /= validWindows;
      avgBandPowers.gamma /= validWindows;
    }

    return {
      duration: duration,
      avgSignalQuality: validWindows > 0 ? signalQualitySum / validWindows : 0,
      avgBandPowers,
      avgIndices: {
        attention: validWindows > 0 ? attentionSum / validWindows : 0,
        meditation: validWindows > 0 ? meditationSum / validWindows : 0,
      },
      totalSamples: allData.length,
    };
  }
}

export default EEGProcessor;
