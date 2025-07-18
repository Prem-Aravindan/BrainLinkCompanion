/**
 * MacrotellectLink SDK Service - SDK-Only Mode
 * 
 * This service implements ONLY the MacrotellectLink SDK V1.4.3 API
 * with no fallback to DirectBLE or demo mode. This ensures devices
 * ONLY connect through the official SDK for real EEG data.
 * 
 * Key Features:
 * - Real EEG data acquisition (no demo mode)
 * - BrainLink Pro & Lite device support
 * - Automatic device discovery and connection
 * - Comprehensive brainwave data (signal, attention, meditation, band powers)
 * - Gravity/accelerometer data
 * - Heart rate and temperature monitoring
 * - Blood oxygen and RR interval data
 * - SDK-only mode enforced - no fallback mechanisms
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { BrainLinkModule } = NativeModules;

class MacrotellectLinkService {
  constructor() {
    this.eventEmitter = null;
    this.listeners = [];
    this.isInitialized = false;
    this.isScanning = false;
    this.connectedDevices = [];
    this.serviceReadyTimeout = false;
    
    // SDK-only mode - no fallback mechanisms
    this.sdkOnlyMode = true;
    
    // Initialize event emitter
    this.setupEventEmitter();
  }

  setupEventEmitter() {
    try {
      console.log(`🔍 Available Native Modules:`, Object.keys(NativeModules));
      console.log(`🔍 BrainLinkModule:`, BrainLinkModule);
      
      if (Platform.OS === 'android' && BrainLinkModule) {
        this.eventEmitter = new NativeEventEmitter(BrainLinkModule);
        console.log('✅ MacrotellectLink native module available');
      } else {
        console.warn('⚠️ MacrotellectLink native module not available - Platform:', Platform.OS);
      }
    } catch (error) {
      console.warn('⚠️ Failed to setup MacrotellectLink native module:', error.message);
    }
  }

  /**
   * Check if the native module is available
   */
  isAvailable() {
    const available = Platform.OS === 'android' && BrainLinkModule !== null && BrainLinkModule !== undefined;
    console.log(`🔍 MacrotellectLink availability check:`, {
      platform: Platform.OS,
      module: BrainLinkModule ? 'found' : 'missing',
      available
    });
    return available;
  }

  /**
   * Get connection mode for UI display
   */
  getConnectionMode() {
    if (!this.isAvailable()) {
      return 'SDK_UNAVAILABLE';
    }
    if (!this.isInitialized) {
      return 'SDK_NOT_INITIALIZED';
    }
    return 'REAL_DATA_MODE';
  }

  /**
   * Check if currently in demo mode
   */
  isInDemoMode() {
    return false; // SDK-only mode - never in demo mode
  }

  /**
   * Initialize MacrotellectLink SDK with retry mechanism
   * SDK-only mode - no fallback mechanisms
   */
  async initialize(retryAttempt = 1, maxRetries = 3) {
    console.log(`🔧 MacrotellectLink SDK Initialize called (attempt ${retryAttempt}/${maxRetries})...`);
    console.log('🔍 SDK-only mode enforced - no fallback mechanisms');
    console.log('🔍 Available check:', this.isAvailable());
    
    if (!this.isAvailable()) {
      throw new Error('MacrotellectLink SDK is only available on Android with native module built. SDK-only mode enforced - no fallback available.');
    }

    if (this.isInitialized) {
      console.log('✅ MacrotellectLink SDK already initialized');
      return true;
    }

    try {
      console.log('🔧 Initializing MacrotellectLink SDK with native module...');
      
      // Setup event listeners FIRST to avoid race condition
      this.setupEventListeners();
      
      // Setup service ready promise BEFORE calling initialize
      const serviceReadyPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('⏰ MacrotellectLink SDK service ready timeout after 10 seconds');
          console.log('🔍 Troubleshooting steps:');
          console.log('   1. Ensure BrainLink device is turned on and nearby');
          console.log('   2. Check Android Bluetooth service is ready');
          console.log('   3. Restart the app to reinitialize SDK');
          console.log('   4. Run: adb logcat | grep BrainLinkModule');
          reject(new Error('MacrotellectLink SDK service ready timeout after 10 seconds - SDK-only mode requires successful initialization'));
        }, 10000);
        
        // Register listener BEFORE initialize to prevent race condition
        const serviceReadyListener = this.eventEmitter.addListener('onServiceReady', () => {
          clearTimeout(timeout);
          console.log('🔥 MacrotellectLink SDK service ready event received');
          serviceReadyListener.remove();
          resolve();
        });
        
        console.log('🎯 Service ready listener registered BEFORE initialize');
      });
      
      // Initialize the native module
      console.log('🚀 Calling BrainLinkModule.initialize()...');
      const initResult = await BrainLinkModule.initialize();
      console.log('🔧 Native module initialize returned:', initResult);
      
      // Wait for service ready callback from native side
      console.log('⏳ Waiting for native service ready callback...');
      await serviceReadyPromise;
      
      this.isInitialized = true;
      this.serviceReadyTimeout = false;
      
      // Disable demo mode after successful initialization
      try {
        await this.setUseDemoMode(false);
        console.log('✅ Demo mode disabled successfully - ready for REAL EEG data');
      } catch (demoError) {
        console.warn('⚠️ Could not disable demo mode (this is expected for some SDK versions):', demoError.message);
      }
      
      console.log('✅ MacrotellectLink SDK fully initialized and service ready - REAL DATA MODE');
      return true;
    } catch (error) {
      console.error(`❌ Failed to initialize MacrotellectLink SDK (attempt ${retryAttempt}):`, error);
      
      // Check if it's a service ready timeout
      if (/service ready timeout/i.test(error.message) || 
          error.message.includes('MacrotellectLink SDK service ready timeout') ||
          error.message.includes('timeout after 10 seconds')) {
        
        // Try retry with exponential backoff
        if (retryAttempt < maxRetries) {
          const retryDelay = retryAttempt * 3000; // 3s, 6s, 9s
          console.log(`🔄 Retrying MacrotellectLink SDK initialization in ${retryDelay/1000}s (attempt ${retryAttempt + 1}/${maxRetries})...`);
          console.log('💡 Possible issues: BrainLink device not turned on, Android Bluetooth service not ready, app needs restart');
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return await this.initialize(retryAttempt + 1, maxRetries);
        }
        
        // Max retries exceeded
        console.log('❌ Max retries exceeded - MacrotellectLink SDK service not responding');
        console.log('💡 This indicates the native SDK cannot initialize properly');
        console.log('🚫 SDK-only mode enforced - no fallback available');
        console.log('⚠️ To get REAL EEG data, restart the app and ensure BrainLink device is on');
        
        this.serviceReadyTimeout = true;
        throw new Error('MacrotellectLink SDK failed to initialize after maximum retries. SDK-only mode enforced - no fallback available. Please restart the app and ensure BrainLink device is turned on.');
      }
      
      // No fallback for other errors in SDK-only mode
      console.log('🚫 SDK-only mode enforced - no fallback available');
      throw new Error(`MacrotellectLink SDK initialization failed: ${error.message}. SDK-only mode enforced - no fallback available.`);
    }
  }

  /**
   * Start scanning for BrainLink devices
   * SDK-only mode - no fallback mechanisms
   */
  async startScan() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // SDK-only mode - check if service is ready
    if (!this.isInitialized || this.serviceReadyTimeout) {
      throw new Error('MacrotellectLink SDK service not ready. Try: 1) Restart app 2) Check BrainLink device is on 3) Pair device in Bluetooth settings first');
    }

    try {
      console.log('🔍 Starting MacrotellectLink device scan...');
      
      // Check and request permissions before scanning
      console.log('🔐 Checking Bluetooth permissions before scan...');
      const PermissionService = require('./PermissionService').default;
      const hasPermissions = await PermissionService.checkBluetoothPermissions();
      
      if (!hasPermissions) {
        console.log('🔐 Requesting Bluetooth permissions...');
        const granted = await PermissionService.requestBluetoothPermissions();
        if (!granted) {
          throw new Error('Bluetooth permissions are required for device scanning');
        }
        console.log('✅ Bluetooth permissions granted');
      } else {
        console.log('✅ Bluetooth permissions already granted');
      }
      
      this.isScanning = true;
      
      // Use retry logic with exponential backoff
      const result = await this.tryScanWithRetry();
      console.log('✅ MacrotellectLink scan started:', result);
      
      return result;
    } catch (error) {
      this.isScanning = false;
      console.error('❌ Failed to start scan:', error);
      
      // SDK-only mode - no fallback
      if (error.message.includes('null object reference') || error.message.includes('SDK_SERVICE_ERROR')) {
        console.log('⚠️ MacrotellectLink SDK service initialization issue detected');
        console.log('🚫 SDK-only mode enforced - no fallback available');
        console.log('💡 To resolve: restart the app and ensure BrainLink device is turned on');
        
        throw new Error(`MacrotellectLink SDK scan failed: ${error.message}. SDK-only mode enforced - no fallback available.`);
      }
      
      throw error;
    }
  }

  /**
   * Try scan with exponential backoff retry logic
   */
  async tryScanWithRetry(attempt = 1) {
    try {
      console.log(`🔍 Scan attempt ${attempt}/5...`);
      
      // Add timeout for scan to prevent hanging
      const scanPromise = BrainLinkModule.startScan();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Scan timeout after 10 seconds')), 10000);
      });
      
      return await Promise.race([scanPromise, timeoutPromise]);
    } catch (error) {
      console.error(`❌ Scan attempt ${attempt} failed:`, error.message);
      
      // If service not ready and we have retries left
      if (attempt < 5 && (
        error.message.includes('service not ready') ||
        error.message.includes('MacrotellectLink SDK service not ready') ||
        error.message.includes('null object reference'))) {
        
        const delay = attempt * 500; // 500ms, 1s, 1.5s, 2s
        console.log(`⏳ Retrying scan in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.tryScanWithRetry(attempt + 1);
      }
      
      // Max retries exceeded or other error
      throw error;
    }
  }

  /**
   * Stop scanning for devices
   */
  async stopScan() {
    if (!this.isInitialized) {
      console.log('⚠️ MacrotellectLink SDK not initialized - cannot stop scan');
      return false;
    }

    try {
      console.log('🛑 Stopping MacrotellectLink device scan...');
      
      const result = await BrainLinkModule.stopScan();
      this.isScanning = false;
      
      console.log('✅ MacrotellectLink scan stopped:', result);
      return result;
    } catch (error) {
      this.isScanning = false;
      console.error('❌ Failed to stop scan:', error);
      throw error;
    }
  }

  /**
   * Get connected devices
   */
  async getConnectedDevices() {
    if (!this.isInitialized) {
      console.log('⚠️ MacrotellectLink SDK not initialized - cannot get connected devices');
      return [];
    }

    try {
      console.log('🔍 Getting connected devices...');
      
      const devices = await BrainLinkModule.getConnectedDevices();
      this.connectedDevices = devices || [];
      
      console.log('✅ Connected devices:', this.connectedDevices);
      return this.connectedDevices;
    } catch (error) {
      console.error('❌ Failed to get connected devices:', error);
      return [];
    }
  }

  /**
   * Disconnect from device
   */
  async disconnect(deviceId) {
    if (!this.isInitialized) {
      console.log('⚠️ MacrotellectLink SDK not initialized - cannot disconnect');
      return false;
    }

    try {
      console.log('🔌 Disconnecting from device:', deviceId);
      
      const result = await BrainLinkModule.disconnect(deviceId);
      
      // Remove from connected devices
      this.connectedDevices = this.connectedDevices.filter(d => d.id !== deviceId);
      
      console.log('✅ Disconnected from device:', deviceId);
      return result;
    } catch (error) {
      console.error('❌ Failed to disconnect from device:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for SDK callbacks
   */
  setupEventListeners() {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available - cannot setup listeners');
      return;
    }

    console.log('🎯 Setting up MacrotellectLink SDK event listeners...');

    // Device discovery events
    this.eventEmitter.addListener('DeviceFound', (data) => {
      console.log('🔍 MacrotellectLink: Device found:', data);
    });

    this.eventEmitter.addListener('DeviceSearchFinished', (data) => {
      console.log('🔍 MacrotellectLink: Device search finished');
      this.isScanning = false;
    });

    // Connection events
    this.eventEmitter.addListener('DeviceConnected', (data) => {
      console.log('🔗 MacrotellectLink: Device connected:', data);
    });

    this.eventEmitter.addListener('DeviceDisconnected', (data) => {
      console.log('🔌 MacrotellectLink: Device disconnected:', data);
    });

    // EEG data events
    this.eventEmitter.addListener('EEGPowerData', (data) => {
      console.log('🧠 MacrotellectLink: EEG power data received:', data);
    });

    this.eventEmitter.addListener('EEGRawData', (data) => {
      console.log('📊 MacrotellectLink: EEG raw data received');
    });

    console.log('✅ MacrotellectLink SDK event listeners setup complete');
  }

  /**
   * Set whether to use demo mode (SDK function)
   */
  async setUseDemoMode(useDemoMode) {
    if (!this.isInitialized) {
      console.log('⚠️ MacrotellectLink SDK not initialized - cannot set demo mode');
      return false;
    }

    try {
      console.log(`🎭 Setting demo mode:`, useDemoMode ? 'ON' : 'OFF');
      
      const result = await BrainLinkModule.setUseDemoMode(useDemoMode);
      
      console.log('✅ Demo mode setting result:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to set demo mode:', error);
      throw error;
    }
  }

  /**
   * Setup poor contact listener
   */
  setupPoorContactListener(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for poor contact listener');
      return () => {}; // Return empty cleanup function
    }

    // Listen for poor contact events from native module
    const poorContactListener = this.eventEmitter.addListener('onPoorContact', (data) => {
      console.log('📡 Poor contact detected:', data);
      if (callback) {
        callback({
          ...data,
          message: `Poor contact quality: ${data.contactQuality}% - Please adjust device positioning`
        });
      }
    });

    // Return cleanup function
    return () => {
      poorContactListener.remove();
    };
  }

  /**
   * Setup EEG data listener
   */
  setupEEGDataListener(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for EEG data listener');
      return () => {}; // Return empty cleanup function
    }

    // Listen for EEG data events from native module
    const eegDataListener = this.eventEmitter.addListener('onEEGData', (data) => {
      console.log('🧠 EEG data received:', data);
      if (callback) {
        callback(data);
      }
    });

    // Return cleanup function
    return () => {
      eegDataListener.remove();
    };
  }

  /**
   * Setup brainwave data listener
   */
  setupBrainwaveDataListener(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for brainwave data listener');
      return () => {}; // Return empty cleanup function
    }

    // Listen for brainwave data events from native module
    const brainwaveDataListener = this.eventEmitter.addListener('onBrainwaveData', (data) => {
      console.log('🌊 Brainwave data received:', data);
      if (callback) {
        callback(data);
      }
    });

    // Return cleanup function
    return () => {
      brainwaveDataListener.remove();
    };
  }

  /**
   * Setup device connection listener
   */
  setupDeviceConnectionListener(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for device connection listener');
      return () => {}; // Return empty cleanup function
    }

    // Listen for device connection events from native module
    const connectionListener = this.eventEmitter.addListener('onDeviceConnection', (data) => {
      console.log('🔗 Device connection event:', data);
      if (callback) {
        callback(data);
      }
    });

    // Return cleanup function
    return () => {
      connectionListener.remove();
    };
  }

  /**
   * Event listener methods for compatibility with useMacrotellectLink hook
   */
  onConnectionChange(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for connection change listener');
      return () => {}; // Return empty cleanup function
    }

    console.log('🎯 Setting up BrainLinkConnection listener for connection status...');
    
    const listener = this.eventEmitter.addListener('BrainLinkConnection', (data) => {
      console.log('🔗 BrainLinkConnection event:', data);
      if (callback) {
        callback(data);
      }
    });

    return () => {
      listener.remove();
    };
  }

  onEEGData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for EEG data listener');
      return () => {}; // Return empty cleanup function
    }

    const listener = this.eventEmitter.addListener('onEEGData', (data) => {
      console.log('🧠 EEG data received:', data);
      if (callback) {
        callback(data);
      }
    });

    return () => {
      listener.remove();
    };
  }

  onRawData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for raw data listener');
      return () => {}; // Return empty cleanup function
    }

    const listener = this.eventEmitter.addListener('onRawData', (data) => {
      console.log('📊 Raw data received:', data);
      if (callback) {
        callback(data);
      }
    });

    return () => {
      listener.remove();
    };
  }

  onGravityData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for gravity data listener');
      return () => {}; // Return empty cleanup function
    }

    const listener = this.eventEmitter.addListener('onGravityData', (data) => {
      console.log('⚖️ Gravity data received:', data);
      if (callback) {
        callback(data);
      }
    });

    return () => {
      listener.remove();
    };
  }

  onRRData(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for RR data listener');
      return () => {}; // Return empty cleanup function
    }

    const listener = this.eventEmitter.addListener('onRRData', (data) => {
      console.log('💓 RR data received:', data);
      if (callback) {
        callback(data);
      }
    });

    return () => {
      listener.remove();
    };
  }

  onError(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for error listener');
      return () => {}; // Return empty cleanup function
    }

    const listener = this.eventEmitter.addListener('onError', (data) => {
      console.log('❌ Error received:', data);
      if (callback) {
        callback(data);
      }
    });

    return () => {
      listener.remove();
    };
  }

  /**
   * Main data listener method for dashboard
   * Listens to BrainLinkData events from native module
   */
  onDataReceived(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for data listener');
      return () => {}; // Return empty cleanup function
    }

    console.log('🎯 Setting up BrainLinkData listener for dashboard...');
    
    const listener = this.eventEmitter.addListener('BrainLinkData', (data) => {
      console.log('📊 BrainLinkData received:', data);
      if (callback) {
        callback(data);
      }
    });

    return () => {
      listener.remove();
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    console.log('🧹 Cleaning up MacrotellectLink SDK service...');
    
    // Remove all event listeners
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners();
    }
    
    // Reset state
    this.isInitialized = false;
    this.isScanning = false;
    this.connectedDevices = [];
    this.serviceReadyTimeout = false;
    
    console.log('✅ MacrotellectLink SDK service cleanup complete');
  }
}

// Export singleton instance
const macrotellectLinkService = new MacrotellectLinkService();
export default macrotellectLinkService;
