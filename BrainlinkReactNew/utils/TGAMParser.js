/**
 * TGAM (ThinkGear Application Module) Frame Parser
 * Handles BrainLink/NeuroSky TGAM protocol frames for real EEG data
 */

import { BLUETOOTH_CONFIG } from '../constants';
import { Buffer } from 'buffer';

export class TGAMParser {
  constructor() {
    this.buffer = [];
    this.frameCallbacks = [];
    this.stats = {
      totalBytes: 0,
      validFrames: 0,
      invalidFrames: 0,
      checksumErrors: 0,
      lastFrameTime: null,
    };
  }

  /**
   * Add data bytes to the parser buffer
   */
  addData(data) {
    // Convert base64 to buffer if needed
    let buffer;
    if (typeof data === 'string') {
      buffer = Buffer.from(data, 'base64');
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      return;
    }

    // Debug: Show raw data occasionally
    if (this.stats.totalBytes % 100 === 0 && buffer.length > 0) {
      console.log(`📊 TGAM Parser: Received ${buffer.length} bytes: [${buffer.slice(0, Math.min(10, buffer.length)).join(', ')}]`);
      console.log(`📊 TGAM Parser: Hex: ${buffer.slice(0, Math.min(10, buffer.length)).toString('hex').toUpperCase()}`);
    }

    // Add bytes to internal buffer
    for (let i = 0; i < buffer.length; i++) {
      this.buffer.push(buffer[i]);
    }
    
    this.stats.totalBytes += buffer.length;
    
    // Process any complete frames
    this.processBuffer();
  }

  /**
   * Process the internal buffer to extract complete TGAM frames
   */
  processBuffer() {
    while (this.buffer.length >= BLUETOOTH_CONFIG.TGAM.MIN_PACKET_LENGTH) {
      // Look for sync bytes (0xAA 0xAA)
      const syncIndex = this.findSyncBytes();
      
      if (syncIndex === -1) {
        // No sync bytes found, clear buffer
        this.buffer = [];
        break;
      }
      
      if (syncIndex > 0) {
        // Remove bytes before sync
        this.buffer.splice(0, syncIndex);
        continue;
      }
      
      // We have sync bytes at the start
      if (this.buffer.length < 4) {
        // Not enough data for header + length + checksum
        break;
      }
      
      const packetLength = this.buffer[2];
      
      // Validate packet length
      if (packetLength > BLUETOOTH_CONFIG.TGAM.MAX_PACKET_LENGTH) {
        this.buffer.splice(0, 2); // Remove sync bytes and try again
        this.stats.invalidFrames++;
        continue;
      }
      
      const totalFrameLength = 4 + packetLength; // [0xAA, 0xAA, length, ...payload..., checksum]
      
      if (this.buffer.length < totalFrameLength) {
        // Wait for more data
        break;
      }
      
      // Extract the complete frame
      const frame = this.buffer.splice(0, totalFrameLength);
      
      // Validate checksum
      if (this.validateChecksum(frame)) {
        const parsedFrame = this.parseFrame(frame);
        if (parsedFrame) {
          this.stats.validFrames++;
          this.stats.lastFrameTime = Date.now();
          
          // Debug: Show parsed frame occasionally
          if (this.stats.validFrames % 10 === 0) {
            console.log(`✅ TGAM Frame #${this.stats.validFrames}:`, {
              attention: parsedFrame.data.attention,
              meditation: parsedFrame.data.meditation,
              rawEEG: parsedFrame.data.rawEEG,
              poorSignal: parsedFrame.data.poorSignal,
            });
          }
          
          this.notifyFrameCallbacks(parsedFrame);
        }
      } else {
        this.stats.checksumErrors++;
      }
    }
  }

  /**
   * Find sync bytes (0xAA 0xAA) in the buffer
   */
  findSyncBytes() {
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === 0xAA && this.buffer[i + 1] === 0xAA) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Validate TGAM frame checksum
   */
  validateChecksum(frame) {
    if (frame.length < 4) return false;
    
    const payload = frame.slice(3, -1); // Exclude header and checksum
    const receivedChecksum = frame[frame.length - 1];
    
    // Calculate checksum: sum of payload bytes, then invert and mask to 8 bits
    let sum = 0;
    for (const byte of payload) {
      sum += byte;
    }
    const calculatedChecksum = (~sum) & 0xFF;
    
    return calculatedChecksum === receivedChecksum;
  }

  /**
   * Parse a validated TGAM frame into structured data
   */
  parseFrame(frame) {
    const payload = frame.slice(3, -1); // Remove header and checksum
    const parsedData = {
      timestamp: Date.now(),
      rawFrame: frame,
      data: {},
    };

    let i = 0;
    while (i < payload.length) {
      const dataType = payload[i];
      i++;

      switch (dataType) {
        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.POOR_SIGNAL:
          if (i < payload.length) {
            parsedData.data.poorSignal = payload[i];
            i++;
          }
          break;

        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.ATTENTION:
          if (i < payload.length) {
            parsedData.data.attention = payload[i];
            i++;
          }
          break;

        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.MEDITATION:
          if (i < payload.length) {
            parsedData.data.meditation = payload[i];
            i++;
          }
          break;

        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.HEART_RATE:
          if (i < payload.length) {
            parsedData.data.heartRate = payload[i];
            i++;
          }
          break;

        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.BATTERY:
          if (i < payload.length) {
            parsedData.data.battery = payload[i];
            i++;
          }
          break;

        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.VERSION:
          if (i < payload.length) {
            parsedData.data.version = payload[i];
            i++;
          }
          break;

        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.RAW_EEG:
          // Raw EEG is 2 bytes (big-endian 16-bit signed)
          if (i + 1 < payload.length) {
            const rawValue = (payload[i] << 8) | payload[i + 1];
            // Convert to signed 16-bit (proper range: -32768 to +32767)
            let signedValue = rawValue > 32767 ? rawValue - 65536 : rawValue;
            
            // TGAM raw EEG values are in a specific range
            // According to NeuroSky documentation, typical range is ±8192 before scaling
            // Scale to microvolts: common range is ±100µV for clean EEG
            const scaledValue = (signedValue / 32768.0) * 100.0; // Normalize to ±100µV range
            
            parsedData.data.rawEEG = scaledValue;
            
            if (Math.abs(scaledValue) > 1000) {
              console.warn(`⚠️ Unusual EEG value: bytes=[${payload[i]}, ${payload[i+1]}] -> raw=${rawValue} -> signed=${signedValue} -> scaled=${scaledValue.toFixed(3)}µV`);
            }
            
            i += 2;
          }
          break;

        case BLUETOOTH_CONFIG.TGAM.DATA_TYPES.EEG_POWER:
          // EEG Power bands - 24 bytes total (8 bands × 3 bytes each)
          if (i + 23 < payload.length) {
            const powerBands = {};
            const bandNames = ['delta', 'theta', 'lowAlpha', 'highAlpha', 'lowBeta', 'highBeta', 'lowGamma', 'midGamma'];
            
            for (let band = 0; band < 8; band++) {
              const bandIndex = i + (band * 3);
              // Each band is 3 bytes (24-bit big-endian)
              const power = (payload[bandIndex] << 16) | (payload[bandIndex + 1] << 8) | payload[bandIndex + 2];
              powerBands[bandNames[band]] = power;
            }
            
            parsedData.data.eegPower = powerBands;
            i += 24;
          }
          break;

        default:
          // Unknown data type, try to skip it
          // Try to find next known data type or end of payload
          let skipCount = 1;
          while (i + skipCount < payload.length) {
            const nextByte = payload[i + skipCount];
            if (Object.values(BLUETOOTH_CONFIG.TGAM.DATA_TYPES).includes(nextByte)) {
              break;
            }
            skipCount++;
          }
          i += skipCount;
          break;
      }
    }

    return parsedData;
  }

  /**
   * Subscribe to parsed frame events
   */
  onFrame(callback) {
    this.frameCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.frameCallbacks.indexOf(callback);
      if (index > -1) {
        this.frameCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all frame callbacks
   */
  notifyFrameCallbacks(frame) {
    this.frameCallbacks.forEach(callback => {
      try {
        callback(frame);
      } catch (error) {
        console.error('❌ TGAMParser callback error:', error);
      }
    });
  }

  /**
   * Get parser statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset parser state
   */
  reset() {
    this.buffer = [];
    this.stats = {
      totalBytes: 0,
      validFrames: 0,
      invalidFrames: 0,
      checksumErrors: 0,
      lastFrameTime: null,
    };
  }

  /**
   * Convert parsed TGAM data to unified EEG format
   */
  static convertToEEGFormat(tgamData) {
    const eegData = {
      timestamp: tgamData.timestamp,
      attention: tgamData.data.attention || 0,
      meditation: tgamData.data.meditation || 0,
      poorSignal: tgamData.data.poorSignal || 0,
      heartRate: tgamData.data.heartRate || 0,
      rawEEG: tgamData.data.rawEEG || 0,
    };

    // Convert power bands to standard format
    if (tgamData.data.eegPower) {
      const power = tgamData.data.eegPower;
      eegData.bandPowers = {
        delta: power.delta || 0,
        theta: power.theta || 0,
        alpha: (power.lowAlpha || 0) + (power.highAlpha || 0), // Combine alpha bands
        beta: (power.lowBeta || 0) + (power.highBeta || 0), // Combine beta bands
        gamma: (power.lowGamma || 0) + (power.midGamma || 0), // Combine gamma bands
      };
    }

    return eegData;
  }
}

export default TGAMParser;
