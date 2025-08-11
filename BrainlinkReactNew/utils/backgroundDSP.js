/**
 * Background DSP Manager - Off-thread EEG Processing
 * 
 * This module manages background processing of EEG data to prevent UI blocking.
 * Uses requestAnimationFrame and Web Workers concepts for React Native.
 * 
 * Strategy: Batch process data in the background, only send results to UI periodically
 */

import streamingDSP from './streamingDSP';
// Feature extraction & upload (TypeScript modules are supported by Metro)
let EEGFeatureExtractor = null;
let FeatureUploader = null;
let featureConfig = null;
try {
  const fmod = require('./features');
  EEGFeatureExtractor = fmod?.EEGFeatureExtractor || null;
} catch {}
try {
  const umod = require('./featuresUploader');
  FeatureUploader = (umod && (umod.FeatureUploader || umod.default)) || null;
} catch {}
try {
  featureConfig = require('./featureConfig')?.featureConfig ?? null;
} catch {}

class BackgroundDSPManager {
  constructor() {
    this.isRunning = false;
    this.processInterval = null;
    this.uiCallback = null;
    
  // Processing timing - tighter cadence to keep ~1s lag while staying smooth
  this.processIntervalMs = 250; // Process every 250ms (4Hz)
  // At 512Hz: 250ms = ~128 samples per processing cycle
    
    // Adaptive processing - aligned with natural data flow
    this.idleCycles = 0;
  this.maxIdleCycles = 12; // Be patient before pausing (about 3s at 250ms)
    this.isPaused = false;

  // Micro-streaming for smooth UI updates
  // We buffer filtered samples and emit small slices at ~60fps so the plot flows
  this.pendingFilteredQueue = [];
  this.microTimer = null;
  this.desiredFPS = 60; // target UI update rate
  this.microIntervalMs = Math.max(10, Math.round(1000 / this.desiredFPS)); // ~16ms
  this.currentSamplingRate = 512; // default; will adopt from results
  // Fractional accumulator to match output rate precisely over time
  this._rateCarry = 0;
  this.minChunkSize = 4;   // safety lower bound per frame
  this.maxChunkSize = 32;  // safety upper bound per frame
  // Fixed display delay target (~1s behind raw)
  this.targetDelayMs = 1000;
  this.minBacklogSamples = Math.round(this.currentSamplingRate * (this.targetDelayMs / 1000));
  // Safety cap to avoid unbounded growth (keep ~3s backlog max)
  this.maxQueueSamples = Math.round(this.currentSamplingRate * 3);
    
    // Performance monitoring
    this.stats = {
      processingCycles: 0,
      totalProcessingTime: 0,
      uiUpdates: 0,
      skippedUpdates: 0,
      pausedCycles: 0
    };
    
    console.log('🔧 BackgroundDSPManager initialized with', this.processIntervalMs, 'ms interval');

  // Feature pipeline state
  this.featureEnabled = false;
  this.featureExtractor = null;
  this.featureUploader = null;
  this.featureFs = this.currentSamplingRate;
  }

  /**
   * Start background processing
   * @param {Function} uiUpdateCallback - Called when filtered data is ready for UI
   */
  start(uiUpdateCallback) {
    if (this.isRunning) {
      console.log('⚠️ Background DSP already running');
      return;
    }
    
    this.uiCallback = uiUpdateCallback;
    this.isRunning = true;
    
    // Start processing loop
    this.processInterval = setInterval(() => {
      this.processingLoop();
    }, this.processIntervalMs);
    
    console.log('✅ Background DSP processing started');

    // Auto-enable feature pipeline if configured
    try {
      if (featureConfig?.enabled && EEGFeatureExtractor && FeatureUploader) {
        this.enableFeaturePipeline({
          endpoint: featureConfig.endpoint,
          sessionId: featureConfig.sessionId,
          authToken: featureConfig.authToken,
          maxBatchSize: featureConfig.maxBatchSize,
          maxIntervalMs: featureConfig.maxIntervalMs,
          queueCap: featureConfig.queueCap,
          debug: !!featureConfig.DEBUG_EEG,
        });
      }
    } catch (e) {
      console.warn('⚠️ Feature pipeline auto-enable failed:', e);
    }
  }

  /**
   * Stop background processing
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  // Stop micro streamer and clear queue
  this.stopMicroStreamer();
  this.pendingFilteredQueue = [];

  // Stop feature pipeline
  this.disableFeaturePipeline();
    
    console.log('🛑 Background DSP processing stopped');
  }

  /**
   * Main processing loop - runs in background
   * This is where the magic happens without blocking the UI
   */
  processingLoop() {
    if (!this.isRunning) return;
    
    // SMART PROCESSING: Only run when there's data to process
    const bufferState = streamingDSP.getBufferState();
    
    // DEBUG: Log buffer state occasionally (less frequent for real-time)
    // Log buffer state infrequently to avoid clogging the JS thread
    if (this.stats.processingCycles % 200 === 0) { // roughly every ~50s at 250ms interval
      console.log('🔍 DSP Buffer State:', {
        samplesInBuffer: bufferState.samplesInBuffer,
        bufferUtilization: bufferState.bufferUtilization.toFixed(1) + '%',
        isRunning: this.isRunning,
        isPaused: this.isPaused
      });
    }
    
    if (bufferState.samplesInBuffer === 0) {
      // No data to process
      this.idleCycles++;
      this.stats.skippedUpdates++;
      
      // ADAPTIVE PAUSING: More patient for real-time processing
      if (this.idleCycles >= this.maxIdleCycles && !this.isPaused) {
        this.isPaused = true;
        console.log('⏸️ Background DSP paused - no data for', this.idleCycles * this.processIntervalMs, 'ms');
        
        // Switch to slower polling when no data (aligned with buffer timing)
        clearInterval(this.processInterval);
        this.processInterval = setInterval(() => {
          this.resumeCheck();
        }, 1000); // Check every 1 second when paused (2x the processing interval)
      }
      
      return;
    }
    
    // Data available - resume normal processing if paused
    if (this.isPaused) {
      this.resumeProcessing();
    }
    
    // Reset idle counter when we have data
    this.idleCycles = 0;
    
    const startTime = performance.now();
    
    try {
      // Process available data through DSP pipeline
      const result = streamingDSP.processAvailableData();
      
      // Update performance stats
      const processingTime = performance.now() - startTime;
      this.stats.processingCycles++;
      this.stats.totalProcessingTime += processingTime;
      
      // If we have new filtered data, send to UI (throttled)
      if (result && this.uiCallback) {
  this.stats.uiUpdates++;
  // Reduced per-batch logging; keep performance logs elsewhere
        
        // Use setImmediate for next-tick scheduling (faster than setTimeout)
        this.scheduleUIUpdate(result);
  // Update feature Fs if available
  if (result?.samplingRate) this._maybeUpdateFeatureFs(result.samplingRate);
      } else {
        this.stats.skippedUpdates++;
  // no-op
      }
      
      // Log performance occasionally (every 20 cycles = 10 seconds at 500ms intervals)
    if (this.stats.processingCycles % 200 === 0 && this.stats.processingCycles > 0) { // ~50s intervals
      this.logPerformanceStats();
    }
      
    } catch (error) {
      console.error('❌ Background DSP processing error:', error);
    }
  }

  /**
   * Check if we should resume processing (called when paused)
   */
  resumeCheck() {
    if (!this.isRunning) return;
    
    const bufferState = streamingDSP.getBufferState();
    if (bufferState.samplesInBuffer > 0) {
      this.resumeProcessing();
    } else {
      this.stats.pausedCycles++;
    }
  }

  /**
   * Resume normal processing frequency
   */
  resumeProcessing() {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    this.idleCycles = 0;
    console.log('▶️ Background DSP resumed - data detected');
    
    // Restore normal processing interval
    clearInterval(this.processInterval);
    this.processInterval = setInterval(() => {
      this.processingLoop();
    }, this.processIntervalMs);
  }

  /**
   * Schedule UI update on next frame (smooth animation)
   */
  scheduleUIUpdate(result) {
    // Enqueue filtered samples and start micro streaming to UI for smooth flow
    try {
      if (result?.samplingRate) this.currentSamplingRate = result.samplingRate;
      // Recompute backlog threshold if SR changed
      this.minBacklogSamples = Math.round(this.currentSamplingRate * (this.targetDelayMs / 1000));
  this.maxQueueSamples = Math.round(this.currentSamplingRate * 3);
      const batch = Array.isArray(result?.filteredData) ? result.filteredData : [];
  if (batch.length > 0) {
        // Append to queue
        // Note: push(...batch) can be large; chunk the push to avoid arg limits
        const CHUNK_PUSH = 1024;
        for (let i = 0; i < batch.length; i += CHUNK_PUSH) {
          const slice = batch.slice(i, i + CHUNK_PUSH);
          Array.prototype.push.apply(this.pendingFilteredQueue, slice);
        }
        // Kick off micro streamer if not running and we have at least ~1s backlog
  if (!this.microTimer) {
          const backlog = this.pendingFilteredQueue.length;
          if (backlog >= this.minBacklogSamples) {
            this.startMicroStreamer(result.stats || null);
          } else {
            // Not enough backlog yet; wait for next processing cycle to accumulate
            const needed = this.minBacklogSamples - backlog;
            if (this.stats.processingCycles % 4 === 0) {
              console.log(`⏳ Waiting to reach ~${this.targetDelayMs}ms backlog for smooth 1s delay. Need +${needed} samples.`);
            }
          }
        }
        // Enforce an upper cap on backlog; drop oldest if necessary
        const overflow = this.pendingFilteredQueue.length - this.maxQueueSamples;
        if (overflow > 0) {
          this.pendingFilteredQueue.splice(0, overflow);
        }

        // Feed features extractor directly with the new batch if micro streamer isn't started yet
        if (this.featureEnabled && this.featureExtractor && Array.isArray(batch) && batch.length) {
          try { this.featureExtractor.pushChunk(batch, Date.now()); } catch (e) { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('❌ scheduleUIUpdate enqueue error:', error);
      // Fallback: send the whole batch once if micro streaming fails
      setImmediate(() => {
        if (this.uiCallback && this.isRunning) {
          try { this.uiCallback(result); } catch (e) { console.error('❌ UI callback error (fallback):', e); }
        }
      });
    }
  }

  /**
   * Start micro-streaming loop to emit small slices each frame for smooth plotting
   */
  startMicroStreamer(pendingStats = null) {
    if (this.microTimer || !this.uiCallback || !this.isRunning) return;
    this._pendingStatsForLastChunk = pendingStats; // attach stats when queue nearly empty
    this.microTimer = setInterval(() => {
      try {
        if (!this.isRunning) { this.stopMicroStreamer(); return; }
        const qlen = this.pendingFilteredQueue.length;
        if (qlen === 0) { this.stopMicroStreamer(); return; }

        // Compute chunk size to roughly match real-time pace
        // Pace near real-time with fractional accumulator to avoid drift
        const samplesPerInterval = this.currentSamplingRate * (this.microIntervalMs / 1000);
        const desiredWithCarry = samplesPerInterval + this._rateCarry;
        let chunkSize = Math.round(desiredWithCarry);
        // Clamp chunk size
        chunkSize = Math.min(
          Math.max(this.minChunkSize, chunkSize),
          this.maxChunkSize,
          qlen
        );
        // Update carry based on what we actually emitted
        this._rateCarry = desiredWithCarry - chunkSize;

        const chunk = this.pendingFilteredQueue.splice(0, chunkSize);
        const isQueueDrained = this.pendingFilteredQueue.length === 0;
        const stats = isQueueDrained ? (this._pendingStatsForLastChunk || null) : null;
        if (isQueueDrained) this._pendingStatsForLastChunk = null;

        // Emit small slice to UI
        this.uiCallback({
          filteredData: chunk,
          samplingRate: this.currentSamplingRate,
          stats
        });
        // Feed feature extractor
        if (this.featureEnabled && this.featureExtractor && chunk.length) {
          try { this.featureExtractor.pushChunk(chunk, Date.now()); } catch (e) { /* ignore */ }
        }
        this.stats.uiUpdates++;
      } catch (err) {
        console.error('❌ Micro-streamer error:', err);
        this.stopMicroStreamer();
      }
    }, this.microIntervalMs);
  }

  /** Stop micro streaming loop */
  stopMicroStreamer() {
    if (this.microTimer) {
      clearInterval(this.microTimer);
      this.microTimer = null;
    }
  }

  /**
   * Add raw sample to processing pipeline (called from BLE event handler)
   * This should be FAST - just add to buffer and return immediately
   */
  addSample(rawValue) {
    if (!this.isRunning) return;
    
    try {
      // Add to ring buffer for background processing
      streamingDSP.addSamples([rawValue]);
    } catch (error) {
      console.error('❌ Error adding sample to DSP:', error);
    }
  }

  /**
   * Add multiple samples at once (for batch processing)
   */
  addSamples(samples) {
    if (!this.isRunning) return;
    
    try {
      streamingDSP.addSamples(samples);
    } catch (error) {
      console.error('❌ Error adding samples to DSP:', error);
    }
  }

  /**
   * Reset processing pipeline (for device reconnection)
   */
  reset() {
    console.log('🔄 Resetting background DSP manager...');
    
    // Reset DSP processor
    streamingDSP.reset();
    
    // Reset adaptive processing state
    this.idleCycles = 0;
    this.isPaused = false;
  // Reset micro streamer state
  this.stopMicroStreamer();
  this.pendingFilteredQueue = [];

    // Reset feature pipeline windows
    if (this.featureExtractor) {
      // Recreate extractor to clear internal buffer
      const cfg = this._lastFeatureCfg || null;
      this.disableFeaturePipeline();
      if (cfg) this.enableFeaturePipeline(cfg);
    }
    
    // If paused, resume normal processing
    if (this.isRunning && this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = setInterval(() => {
        this.processingLoop();
      }, this.processIntervalMs);
    }
    
    // Reset stats
    this.stats = {
      processingCycles: 0,
      totalProcessingTime: 0,
      uiUpdates: 0,
      skippedUpdates: 0,
      pausedCycles: 0
    };
    
    console.log('✅ Background DSP reset complete');
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    const avgCycleTime = this.stats.totalProcessingTime / Math.max(1, this.stats.processingCycles);
    const uiUpdateRate = this.stats.uiUpdates / Math.max(1, this.stats.processingCycles) * 100;
    
    return {
      // Background processing stats
      processingCycles: this.stats.processingCycles,
      averageCycleTime: avgCycleTime,
      totalProcessingTime: this.stats.totalProcessingTime,
      
      // UI update stats
      uiUpdates: this.stats.uiUpdates,
      skippedUpdates: this.stats.skippedUpdates,
      uiUpdateRate: uiUpdateRate,
      
      // DSP stats
      dspStats: streamingDSP.getPerformanceStats(),
      bufferState: streamingDSP.getBufferState()
    };
  }

  /**
   * Log performance statistics (for monitoring)
   */
  logPerformanceStats() {
    const stats = this.getPerformanceStats();
    
    console.log('📊 Buffer-Aligned DSP Performance:', {
      cycles: stats.processingCycles,
      avgCycleTime: `${stats.averageCycleTime.toFixed(2)}ms`,
      uiUpdateRate: `${stats.uiUpdateRate.toFixed(1)}%`,
      bufferUtilization: `${stats.bufferState.bufferUtilization.toFixed(1)}%`,
      samplesProcessed: stats.dspStats.samplesProcessed,
      bufferSeconds: `${(stats.dspStats.samplesProcessed / 512).toFixed(1)}s`,
      isPaused: this.isPaused,
      pausedCycles: this.stats.pausedCycles
    });
  }

  /**
   * Check if background processing is healthy
   */
  isHealthy() {
    const stats = this.getPerformanceStats();
    
    return {
      isRunning: this.isRunning,
      isProcessing: stats.processingCycles > 0,
      averageCycleTime: stats.averageCycleTime,
      bufferHealthy: stats.bufferState.bufferUtilization < 90, // Buffer not overflowing
      cpuHealthy: stats.averageCycleTime < this.processIntervalMs * 0.8 // Not taking too much time
    };
  }

  /** Feature pipeline controls */
  enableFeaturePipeline(cfg) {
    try {
      if (this.featureEnabled) return;
      if (!EEGFeatureExtractor || !FeatureUploader) throw new Error('Feature modules unavailable');
      this.featureFs = this.currentSamplingRate || 512;
      this.featureExtractor = new EEGFeatureExtractor({
        fs: this.featureFs,
        windowSec: 2.0,
        onWindow: (rec) => {
          try {
            if (!this.featureUploader) return;
            this.featureUploader.enqueue(rec);
            if (featureConfig?.DEBUG_EEG) console.log('[Features] window', new Date(rec.t0).toISOString(), '→', new Date(rec.t1).toISOString());
            // Also emit to UI (lightweight; once every 2s)
            this._emitFeatures(rec);
          } catch (e) { /* ignore */ }
        },
        debug: !!featureConfig?.DEBUG_EEG,
      });
  this.featureUploader = new FeatureUploader({
        endpoint: cfg.endpoint,
        sessionId: cfg.sessionId,
        authToken: cfg.authToken,
        sampleRate: this.featureFs,
        maxBatchSize: cfg.maxBatchSize,
        maxIntervalMs: cfg.maxIntervalMs,
        queueCap: cfg.queueCap,
        debug: !!cfg.debug,
      });
      this._lastFeatureCfg = cfg;
      this.featureEnabled = true;
      console.log('🧮 Feature pipeline enabled');
    } catch (e) {
      console.warn('⚠️ Failed to enable feature pipeline', e);
    }
  }

  disableFeaturePipeline() {
  this.featureEnabled = false;
  this.featureExtractor = null;
  this.featureUploader = null;
  }

  _maybeUpdateFeatureFs(newFs) {
  if (!this.featureEnabled) return;
  if (!EEGFeatureExtractor) return;
    if (!newFs || newFs === this.featureFs) return;
    this.featureFs = newFs;
    // Recreate extractor with new fs to align window length and FFT
    try {
      const prevCfg = this._lastFeatureCfg || {};
      this.featureExtractor = new EEGFeatureExtractor({
        fs: this.featureFs,
        windowSec: 2.0,
        onWindow: (rec) => {
          try {
            this.featureUploader && this.featureUploader.enqueue(rec);
            this._emitFeatures(rec);
          } catch { }
        },
        debug: !!featureConfig?.DEBUG_EEG,
      });
      // Update uploader's sample rate baseline used in payload
      if (this.featureUploader) {
        // no direct setter; payload uses rec.fs, which is set by extractor
      }
      console.log('♻️ Feature extractor recreated for fs=', this.featureFs);
    } catch (e) {
      console.warn('⚠️ Failed to update feature extractor fs', e);
    }
  }

  /** Emit latest feature record to UI consumer without disturbing streaming cadence */
  _emitFeatures(rec) {
    try {
      if (this.uiCallback && this.isRunning) {
        setImmediate(() => {
          try { this.uiCallback({ features: rec }); } catch {}
        });
      }
    } catch {}
  }
}

// Create singleton instance
const backgroundDSPManager = new BackgroundDSPManager();

export default backgroundDSPManager;
export { BackgroundDSPManager };
