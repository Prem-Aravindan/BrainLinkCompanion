/**
 * BrainLink Native SDK Service
 * Bridge between React Native and MacrotellectLink Android SDK
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { BrainLinkModule } = NativeModules;
const brainLinkEvents = BrainLinkModule ? new NativeEventEmitter(BrainLinkModule) : null;

class BrainLinkNativeService {
  constructor() {
    this.isInitialized = false;
    this.isConnected = false;
    this.isScanning = false;
    this.currentDevice = null;
    this.dataListeners = [];
    this.connectionListeners = [];
    this.eventSubscription = null;
    
    // Setup event listener
    this.setupEventListener();
  }

  /**
   * Check if the native module is available
   */
  isAvailable() {
    return Platform.OS === 'android' && BrainLinkModule !== null;
  }

  /**
   * Initialize the BrainLink SDK
   */
  async initialize() {
    if (!this.isAvailable()) {
      throw new Error('BrainLink Native SDK is only available on Android');
    }

    if (this.isInitialized) {
      console.log('✅ BrainLink SDK already initialized');
      return true;
    }

    try {
      console.log('🔧 Initializing BrainLink Native SDK...');
      await BrainLinkModule.initializeSDK();
      this.isInitialized = true;
      console.log('✅ BrainLink SDK initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize BrainLink SDK:', error);
      throw error;
    }
  }

  /**
   * Start scanning for BrainLink devices
   */
  async startScan() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔍 Starting BrainLink device scan...');
      await BrainLinkModule.startScan();
      this.isScanning = true;
      console.log('✅ Device scan started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start scan:', error);
      throw error;
    }
  }

  /**
   * Stop scanning for devices
   */
  async stopScan() {
    try {
      console.log('⏹️ Stopping device scan...');
      await BrainLinkModule.stopScan();
      this.isScanning = false;
      console.log('✅ Device scan stopped');
      return true;
    } catch (error) {
      console.error('❌ Failed to stop scan:', error);
      throw error;
    }
  }

  /**
   * Connect to a specific BrainLink device
   */
  async connectToDevice(deviceMac) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🔗 Connecting to BrainLink device: ${deviceMac}`);
      await BrainLinkModule.connectToDevice(deviceMac);
      this.currentDevice = deviceMac;
      this.isConnected = true;
      
      // Notify connection listeners
      this.notifyConnectionListeners(true, { mac: deviceMac });
      
      console.log('✅ Connected to BrainLink device');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to device:', error);
      this.isConnected = false;
      this.currentDevice = null;
      throw error;
    }
  }

  /**
   * Disconnect from current device
   */
  async disconnect() {
    try {
      console.log('🔌 Disconnecting from BrainLink device...');
      await BrainLinkModule.disconnectDevice();
      this.isConnected = false;
      this.currentDevice = null;
      
      // Notify connection listeners
      this.notifyConnectionListeners(false, null);
      
      console.log('✅ Disconnected from BrainLink device');
      return true;
    } catch (error) {
      console.error('❌ Failed to disconnect device:', error);
      throw error;
    }
  }

  /**
   * Setup event listener for native SDK events
   */
  setupEventListener() {
    if (!brainLinkEvents) {
      console.warn('⚠️ BrainLink events not available - native module not found');
      return;
    }

    // Listen for EEG data events
    this.eventSubscription = brainLinkEvents.addListener('BrainLinkData', (data) => {
      console.log('📊 Received BrainLink data:', data.type, data);
      this.notifyDataListeners(data);
    });

    // Listen for connection events  
    this.connectionSubscription = brainLinkEvents.addListener('BrainLinkConnection', (connectionData) => {
      console.log('🔗 Connection status:', connectionData.status, connectionData);
      
      // Update internal state based on connection events
      switch (connectionData.status) {
        case 'connected':
          this.isConnected = true;
          this.currentDevice = {
            name: connectionData.deviceName,
            mac: connectionData.deviceMac,
            isBLE: connectionData.isBLE,
            connectionType: connectionData.connectionType
          };
          this.notifyConnectionListeners(true, this.currentDevice);
          break;
          
        case 'connecting':
          this.isConnecting = true;
          this.notifyConnectionListeners(false, {
            name: connectionData.deviceName,
            mac: connectionData.deviceMac,
            connecting: true
          });
          break;
          
        case 'disconnected':
        case 'failed':
        case 'error':
          this.isConnected = false;
          this.isConnecting = false;
          this.currentDevice = null;
          this.notifyConnectionListeners(false, null, connectionData.error || connectionData.reason);
          break;
      }
    });

    console.log('✅ Event listeners setup complete');
  }

  /**
   * Handle incoming data from native SDK
   */
  handleNativeData(data) {
    try {
      console.log(`📊 BrainLink Native Data [${data.type}]:`, data);
      
      // Convert native data to our standard format
      const standardData = this.convertNativeDataToStandard(data);
      
      // Notify data listeners
      this.notifyDataListeners(standardData);
      
    } catch (error) {
      console.error('❌ Error processing native data:', error);
    }
  }

  /**
   * Convert native SDK data format to our standard EEG data format
   */
  convertNativeDataToStandard(nativeData) {
    const standardData = {
      timestamp: nativeData.timestamp || Date.now(),
      type: nativeData.type,
    };

    switch (nativeData.type) {
      case 'brainwave':
        return {
          ...standardData,
          // Basic EEG metrics
          signal: nativeData.signal || 0,
          attention: nativeData.attention || 0,
          meditation: nativeData.meditation || 0,
          
          // Band power frequencies
          delta: nativeData.delta || 0,
          theta: nativeData.theta || 0,
          lowAlpha: nativeData.lowAlpha || 0,
          highAlpha: nativeData.highAlpha || 0,
          lowBeta: nativeData.lowBeta || 0,
          highBeta: nativeData.highBeta || 0,
          lowGamma: nativeData.lowGamma || 0,
          middleGamma: nativeData.middleGamma || 0,
          
          // Additional metrics
          ap: nativeData.ap || 0,
          grind: nativeData.grind || 0,
          heartRate: nativeData.heartRate || 0,
          temperature: nativeData.temperature || 0,
          
          // Battery and hardware info
          batteryLevel: nativeData.batteryLevel || 0,
          hardwareVersion: nativeData.hardwareVersion || null,
          
          // HRV data if available
          hrv: nativeData.hrv || [],
          
          // Combined band powers for compatibility
          bandPowers: {
            delta: nativeData.delta || 0,
            theta: nativeData.theta || 0,
            alpha: (nativeData.lowAlpha || 0) + (nativeData.highAlpha || 0),
            beta: (nativeData.lowBeta || 0) + (nativeData.highBeta || 0),
            gamma: (nativeData.lowGamma || 0) + (nativeData.middleGamma || 0),
          },
        };

      case 'raw':
        return {
          ...standardData,
          rawEEG: nativeData.rawValue || 0,
        };
        
      case 'battery':
        return {
          ...standardData,
          batteryLevel: nativeData.batteryLevel || 0,
          isCharging: nativeData.isCharging || false,
        };

      case 'rr_interval':
        return {
          ...standardData,
          rrIntervals: nativeData.rrIntervals || [],
          signalQuality: nativeData.signalQuality || 0,
        };

      case 'gravity':
        return {
          ...standardData,
          gravityInfo: nativeData.gravityInfo || '',
        };

      case 'signal':
        return {
          ...standardData,
          poorSignal: 100 - (nativeData.signalQuality || 0), // Convert to poor signal format
          signalQuality: nativeData.signalQuality || 0,
        };

      case 'heartrate':
        return {
          ...standardData,
          heartRate: nativeData.heartRate || 0,
        };

      case 'eegpower':
        return {
          ...standardData,
          bandPowers: {
            delta: nativeData.delta || 0,
            theta: nativeData.theta || 0,
            alpha: nativeData.alpha || 0,
            beta: nativeData.beta || 0,
            gamma: nativeData.gamma || 0,
          },
        };

      default:
        console.warn('⚠️ Unknown native data type:', nativeData.type);
        return standardData;
    }
  }

  /**
   * Subscribe to EEG data events
   */
  onDataReceived(callback) {
    this.dataListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.dataListeners.indexOf(callback);
      if (index > -1) {
        this.dataListeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to connection events
   */
  onConnectionChanged(callback) {
    this.connectionListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.connectionListeners.indexOf(callback);
      if (index > -1) {
        this.connectionListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify data listeners
   */
  notifyDataListeners(data) {
    this.dataListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('❌ Error in data listener:', error);
      }
    });
  }

  /**
   * Notify connection listeners
   */
  notifyConnectionListeners(connected, device) {
    this.connectionListeners.forEach(listener => {
      try {
        listener({ connected, device });
      } catch (error) {
        console.error('❌ Error in connection listener:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      device: this.currentDevice,
      isScanning: this.isScanning,
    };
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy() {
    if (this.eventSubscription) {
      this.eventSubscription.remove();
      this.eventSubscription = null;
    }
    
    this.dataListeners = [];
    this.connectionListeners = [];
    this.isInitialized = false;
    this.isConnected = false;
    this.isScanning = false;
    this.currentDevice = null;
  }
}

// Create singleton instance
const brainLinkNativeService = new BrainLinkNativeService();

export default brainLinkNativeService;
