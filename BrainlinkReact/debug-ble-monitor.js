/**
 * Live BLE Data Monitor
 * 
 * This patch adds comprehensive logging to the BluetoothService to monitor:
 * 1. Raw BLE data packets
 * 2. Parsed EEG values
 * 3. Statistical analysis of incoming data
 * 4. Detection of constant/dummy data
 */

// Enhanced packet parsing with detailed logging
function parseBrainLinkPacketWithLogging(packet) {
  try {
    // Log raw packet data
    const bytes = Buffer.from(packet, 'latin1');
    console.log(`📦 Raw packet: [${bytes.join(', ')}] (${bytes.length} bytes)`);
    
    if (packet.length < 3) {
      console.log('⚠️ Packet too short, skipping');
      return null;
    }
    
    let eegValue = null;
    let parsePosition = -1;
    
    // Try different positions in the packet for EEG data
    for (let i = 0; i < bytes.length - 1; i++) {
      const rawValue = (bytes[i + 1] << 8) | bytes[i]; // Little-endian 16-bit
      
      // BrainLink EEG values are typically in range 0-16383 (14-bit)
      if (rawValue >= 0 && rawValue <= 16383) {
        // Convert to microvolts (typical BrainLink conversion)
        eegValue = (rawValue - 8192) * 0.5; // Center around 0, scale to microvolts
        parsePosition = i;
        console.log(`✅ Found EEG data at position ${i}: raw=${rawValue}, scaled=${eegValue.toFixed(2)}µV`);
        break;
      } else {
        console.log(`❌ Invalid value at position ${i}: ${rawValue} (outside 0-16383 range)`);
      }
    }
    
    if (eegValue === null) {
      console.log('❌ No valid EEG data found in packet');
      return null;
    }
    
    return eegValue;
  } catch (error) {
    console.error('❌ Error parsing BrainLink packet:', error);
    return null;
  }
}

// Data statistics tracker
class EEGDataTracker {
  constructor() {
    this.values = [];
    this.maxSamples = 100; // Keep last 100 samples for analysis
    this.constantThreshold = 0.1; // Threshold for detecting constant data
  }
  
  addValue(value) {
    this.values.push(value);
    if (this.values.length > this.maxSamples) {
      this.values.shift(); // Remove oldest value
    }
    
    // Analyze every 10 samples
    if (this.values.length % 10 === 0) {
      this.analyzeData();
    }
  }
  
  analyzeData() {
    if (this.values.length < 5) return;
    
    const recent = this.values.slice(-10); // Last 10 values
    const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const stdDev = Math.sqrt(recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    
    console.log(`📊 Data Analysis (last ${recent.length} samples):`);
    console.log(`   Range: ${min.toFixed(2)} to ${max.toFixed(2)} µV`);
    console.log(`   Average: ${avg.toFixed(2)} µV`);
    console.log(`   Std Dev: ${stdDev.toFixed(2)} µV`);
    
    // Check for constant data
    if (stdDev < this.constantThreshold) {
      console.log('⚠️  WARNING: Data appears constant (very low variance)');
      console.log('   This suggests device may be sending dummy/test data');
    }
    
    // Check for unrealistic values
    if (Math.abs(avg) > 5000) {
      console.log('⚠️  WARNING: Average value very high - possible parsing issue');
    }
    
    // Check for DC offset
    if (Math.abs(avg) > 100) {
      console.log(`⚠️  WARNING: Possible DC offset detected (avg = ${avg.toFixed(2)} µV)`);
    }
  }
  
  getStats() {
    if (this.values.length === 0) return null;
    
    const avg = this.values.reduce((sum, val) => sum + val, 0) / this.values.length;
    const stdDev = Math.sqrt(this.values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.values.length);
    const min = Math.min(...this.values);
    const max = Math.max(...this.values);
    
    return { avg, stdDev, min, max, count: this.values.length };
  }
}

// Export the enhanced functions for patching
module.exports = {
  parseBrainLinkPacketWithLogging,
  EEGDataTracker
};
