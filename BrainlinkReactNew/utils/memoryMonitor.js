/**
 * High-Performance Memory Monitor for EEG Processing
 * Enhanced monitoring for demanding real-time applications
 */

class MemoryMonitor {
  constructor() {
    this.lastMemoryCheck = Date.now();
    this.bufferSizes = {};
    this.performanceMetrics = {
      processingTime: [],
      memoryPressure: 0,
      gcEvents: 0,
      bufferOverflows: 0
    };
    
    // Performance tracking
    this.highWaterMark = 0;
    this.processingStartTime = null;
    this.enabled = __DEV__;
  }

  // Start performance measurement
  startMeasurement() {
    this.processingStartTime = performance.now();
  }

  // End performance measurement and log
  endMeasurement(operation = 'processing') {
    if (this.processingStartTime) {
      const duration = performance.now() - this.processingStartTime;
      this.performanceMetrics.processingTime.push(duration);
      
      // Keep only last 100 measurements
      if (this.performanceMetrics.processingTime.length > 100) {
        this.performanceMetrics.processingTime.shift();
      }
      
      // Log if processing is getting slow
      if (duration > 50) { // More than 50ms is concerning for real-time
        console.warn(`⚠️ Slow ${operation}: ${duration.toFixed(2)}ms`);
      }
      
      this.processingStartTime = null;
      return duration;
    }
    return 0;
  }

  // Get average processing time
  getAverageProcessingTime() {
    if (this.performanceMetrics.processingTime.length === 0) return 0;
    const sum = this.performanceMetrics.processingTime.reduce((a, b) => a + b, 0);
    return sum / this.performanceMetrics.processingTime.length;
  }

  checkMemory() {
    if (!this.enabled) return;
    
    const now = Date.now();
    if (now - this.lastMemoryCheck < 2000) return; // Check every 2 seconds for high-performance
    
    this.lastMemoryCheck = now;
    
    try {
      // Enhanced memory info
      if (performance && performance.memory) {
        const memory = performance.memory;
        const used = memory.usedJSHeapSize / 1024 / 1024;
        const total = memory.totalJSHeapSize / 1024 / 1024;
        const limit = memory.jsHeapSizeLimit / 1024 / 1024;
        
        // Track high water mark
        if (used > this.highWaterMark) {
          this.highWaterMark = used;
        }
        
        // Calculate memory pressure (0-1 scale)
        this.performanceMetrics.memoryPressure = used / limit;
        
        // Log detailed info periodically
        if (Math.random() < 0.1) { // 10% chance to log
          console.log(`💾 Performance Memory: ${used.toFixed(1)}MB / ${total.toFixed(1)}MB (${(this.performanceMetrics.memoryPressure * 100).toFixed(1)}% pressure)`);
          console.log(`⚡ Avg Processing: ${this.getAverageProcessingTime().toFixed(2)}ms, High Water: ${this.highWaterMark.toFixed(1)}MB`);
        }
        
        // Warn if memory pressure is high
        if (this.performanceMetrics.memoryPressure > 0.8) {
          console.warn(`🚨 High memory pressure: ${(this.performanceMetrics.memoryPressure * 100).toFixed(1)}%`);
        }
      }
    } catch (error) {
      // Silent fail for monitoring
    }
  }

  trackBuffers(buffers) {
    if (!this.enabled) return;
    
    this.bufferSizes = { ...buffers };
    
    // Enhanced buffer monitoring
    const totalBufferSize = Object.values(buffers).reduce((sum, size) => sum + (size || 0), 0);
    
    // Detect buffer overflows
    for (const [name, size] of Object.entries(buffers)) {
      if (size > 2000) {
        this.performanceMetrics.bufferOverflows++;
        console.warn(`⚠️ Buffer overflow detected: ${name} = ${size} samples`);
      }
    }
    
    // Log buffer status occasionally for high-performance monitoring
    if (Math.random() < 0.05) { // 5% chance
      console.log(`📊 Buffer Status: Total ${totalBufferSize} samples -`, 
        Object.entries(buffers).map(([k, v]) => `${k}:${v}`).join(', '));
    }
  }

  // Force garbage collection if available (for performance testing)
  forceGC() {
    if (window.gc && typeof window.gc === 'function') {
      try {
        window.gc();
        this.performanceMetrics.gcEvents++;
        console.log('🗑️ Forced garbage collection');
      } catch (error) {
        // Silent fail
      }
    }
  }

  // Get performance report
  getPerformanceReport() {
    return {
      averageProcessingTime: this.getAverageProcessingTime(),
      memoryPressure: this.performanceMetrics.memoryPressure,
      highWaterMark: this.highWaterMark,
      bufferOverflows: this.performanceMetrics.bufferOverflows,
      gcEvents: this.performanceMetrics.gcEvents,
      bufferSizes: { ...this.bufferSizes }
    };
  }
}

// Export singleton
const memoryMonitor = new MemoryMonitor();
export default memoryMonitor;
