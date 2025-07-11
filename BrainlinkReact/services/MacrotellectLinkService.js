/**
 * BrainLink Native Service - Updated for MacrotellectLink SDK V1.4.3
 * This service follows the official MacrotellectLink SDK documentation
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { BrainLinkModule } = NativeModules;

class BrainLinkNativeService {
  constructor() {
    this.eventEmitter = null;
    this.listeners = [];
    this.isInitialized = false;
    
    // Check if native module is available
    this.setupEventEmitter();
  }

  setupEventEmitter() {
    try {
      if (Platform.OS === 'android' && BrainLinkModule) {
        this.eventEmitter = new NativeEventEmitter(BrainLinkModule);
        console.log('✅ BrainLink native module available');
      } else {
        console.warn('⚠️ BrainLink native module not available - Platform:', Platform.OS);
      }
    } catch (error) {
      console.warn('⚠️ Failed to setup BrainLink native module:', error.message);
    }
  }

  /**
   * Check if the native module is available
   */
  isAvailable() {
    return Platform.OS === 'android' && BrainLinkModule !== null;
  }

  /**
   * Initialize the BrainLink SDK with MacrotellectLink settings
   */
  async initialize() {
    if (!this.isAvailable()) {
      throw new Error('BrainLink MacrotellectLink SDK is only available on Android');
    }

    if (this.isInitialized) {
      console.log('✅ BrainLink SDK already initialized');
      return true;
    }

    try {
      console.log('🔧 Initializing MacrotellectLink SDK...');
      const result = await BrainLinkModule.initialize();
      this.isInitialized = true;
      console.log('✅ MacrotellectLink SDK initialized:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to initialize MacrotellectLink SDK:', error);
      throw error;
    }
  }

  /**
   * Start scanning and auto-connecting to BrainLink devices
   * This follows the MacrotellectLink SDK pattern of auto-connection
   */
  async startScan() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔍 Starting BrainLink device scan and auto-connect...');
      const result = await BrainLinkModule.startScan();
      console.log('✅ Device scan started:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to start scan:', error);
      throw error;
    }
  }

  /**
   * Stop scanning (note: MacrotellectLink SDK auto-manages this)
   */
  async stopScan() {
    try {
      console.log('⏹️ Stopping device scan...');
      const result = await BrainLinkModule.stopScan();
      console.log('✅ Device scan stopped:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to stop scan:', error);
      throw error;
    }
  }

  /**
   * Request connection to devices (MacrotellectLink uses auto-connection via scan)
   */
  async connectToDevice(deviceId = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔗 Requesting device connection...');
      const result = await BrainLinkModule.connectToDevice(deviceId || 'auto');
      console.log('✅ Connection request sent:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to connect to device:', error);
      throw error;
    }
  }

  /**
   * Disconnect from devices
   */
  async disconnect() {
    try {
      console.log('🔌 Disconnecting from devices...');
      const result = await BrainLinkModule.disconnect();
      console.log('✅ Disconnection requested:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      throw error;
    }
  }

  /**
   * Get connected device count
   */
  async getConnectedDevices() {
    try {
      const result = await BrainLinkModule.getConnectedDevices();
      return result;
    } catch (error) {
      console.error('❌ Failed to get connected devices:', error);
      throw error;
    }
  }

  // Event Listeners for MacrotellectLink SDK

  /**
   * Listen for connection state changes
   * Events: connecting, connected, disconnected, failed
   */
  onConnectionChange(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available');
      return null;
    }
    
    const subscription = this.eventEmitter.addListener('BrainLinkConnectionChange', (data) => {
      console.log('🔄 Connection change:', data);
      callback(data);
    });
    
    this.listeners.push(subscription);
    return subscription;
  }

  /**
   * Listen for comprehensive EEG brainwave data
   * Data includes: signal, attention, meditation, delta, theta, alpha, beta, gamma, etc.
   */
  onEEGData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available');
      return null;
    }
    
    const subscription = this.eventEmitter.addListener('BrainLinkEEGData', (data) => {
      console.log('🧠 EEG Data:', {
        signal: data.signal,
        attention: data.attention,
        meditation: data.meditation,
        bands: {
          delta: data.delta,
          theta: data.theta,
          lowAlpha: data.lowAlpha,
          highAlpha: data.highAlpha,
          lowBeta: data.lowBeta,
          highBeta: data.highBeta,
          lowGamma: data.lowGamma,
          middleGamma: data.middleGamma
        }
      });
      callback(data);
    });
    
    this.listeners.push(subscription);
    return subscription;
  }

  /**
   * Listen for raw EEG data
   */
  onRawData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available');
      return null;
    }
    
    const subscription = this.eventEmitter.addListener('BrainLinkRawData', (data) => {
      console.log('📊 Raw EEG:', data.rawData);
      callback(data);
    });
    
    this.listeners.push(subscription);
    return subscription;
  }

  /**
   * Listen for gravity/accelerometer data (BrainLink Pro only)
   */
  onGravityData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available');
      return null;
    }
    
    const subscription = this.eventEmitter.addListener('BrainLinkGravityData', (data) => {
      console.log('🎯 Gravity Data:', { x: data.x, y: data.y, z: data.z });
      callback(data);
    });
    
    this.listeners.push(subscription);
    return subscription;
  }

  /**
   * Listen for heart rate and blood oxygen data
   */
  onRRData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available');
      return null;
    }
    
    const subscription = this.eventEmitter.addListener('BrainLinkRRData', (data) => {
      console.log('❤️ RR Data:', { 
        rrIntervals: data.rrIntervals?.length || 0, 
        oxygen: data.oxygenPercentage 
      });
      callback(data);
    });
    
    this.listeners.push(subscription);
    return subscription;
  }

  /**
   * Listen for SDK errors
   */
  onError(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available');
      return null;
    }
    
    const subscription = this.eventEmitter.addListener('BrainLinkError', (data) => {
      console.error('💥 BrainLink Error:', data);
      callback(data);
    });
    
    this.listeners.push(subscription);
    return subscription;
  }

  /**
   * Remove a specific listener
   */
  removeListener(subscription) {
    if (subscription && subscription.remove) {
      subscription.remove();
      const index = this.listeners.indexOf(subscription);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    console.log('🧹 Removing all BrainLink event listeners...');
    this.listeners.forEach(listener => {
      if (listener && listener.remove) {
        listener.remove();
      }
    });
    this.listeners = [];
  }

  /**
   * Get current SDK status
   */
  getStatus() {
    return {
      isAvailable: this.isAvailable(),
      isInitialized: this.isInitialized,
      platform: Platform.OS,
      hasEventEmitter: !!this.eventEmitter,
      activeListeners: this.listeners.length
    };
  }
}

// Export singleton instance
export const MacrotellectLinkService = new BrainLinkNativeService();
export default MacrotellectLinkService;
