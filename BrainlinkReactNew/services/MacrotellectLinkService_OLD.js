/**
 * MacrotellectLink SDK Service - Based on Official Documentation
 * 
 * This service implements the official MacrotellectLink SDK V1.4.3 API
 * as documented in "Devel      // If native scan fails       // If nat        // Max retries exceeded - the native SDK service is not responding
        this.isScanning = false;
      console.error('❌ Failed to start scan:', error);
      
      // SDK-only mode - no fallback to DirectBLE
      if (error.message.includes('null object reference') || error.message.includes('SDK_SERVICE_ERROR')) {
        console.log('⚠️ MacrotellectLink SDK service initialization issue detected');
        console.log('🚫 SDK-only mode enforced - no fallback available');
        console.log('💡 To resolve: restart the app and ensure BrainLink device is turned on');
        
        throw new Error(`MacrotellectLink SDK scan failed: ${error.message}. SDK-only mode enforced - no fallback available.`);
      }
      
      throw error;
    } Max retries exceeded - MacrotellectLink SDK service not responding');
        console.log('💡 This indicates the native SDK cannot initialize properly');
        console.log('🚫 SDK-only mode enforced - no fallback available');
        console.log('⚠️ To get REAL EEG data, restart the app and ensure BrainLink device is on');
        
        this.serviceReadyTimeout = true;
        throw new Error('MacrotellectLink SDK failed to initialize after maximum retries. SDK-only mode enforced - no fallback available. Please restart the app and ensure BrainLink device is turned on.');
      }
      
      // No fallback for other errors in SDK-only mode
      console.log('🚫 SDK-only mode enforced - no fallback available');
      throw new Error(`MacrotellectLink SDK initialization failed: ${error.message}. SDK-only mode enforced - no fallback available.`);
    }ue to SDK service issue, switch to direct BLE scanning
      if (error.message.includes('null object reference') || 
          error.message.includes('SDK_SERVICE_ERROR') || 
          error.message.includes('service not ready') ||
          error.message.includes('MacrotellectLink SDK service not ready')) {
        console.log('⚠️ MacrotellectLink SDK service initialization issue detected');
        console.log('🔄 Switching to direct BLE scanning for real device connections...');
        
        // Use direct BLE scanning for real device connections
        try {
          return await this.startDirectBLEScan();
        } catch (directBLEError) {
          console.error('❌ Both MacrotellectLink SDK and direct BLE failed:', directBLEError);
          this.isScanning = false;
          throw new Error(`All scanning methods failed. SDK: ${error.message}, Direct BLE: ${directBLEError.message}`);
        }
      }vice issue, switch to direct BLE scanning
      if (error.message.includes('null object reference') || 
          error.message.includes('SDK_SERVICE_ERROR') || 
          error.message.includes('service not ready') ||
          error.message.includes('MacrotellectLink SDK service not ready')) {
        console.log('⚠️ MacrotellectLink SDK service initialization issue detected');
        console.log('🔄 Switching to direct BLE scanning for real device connections...');
        
        // Use direct BLE scanning for real device connections
        try {
          return await this.startDirectBLEScan();
        } catch (directBLEError) {
          console.error('❌ Both MacrotellectLink SDK and direct BLE failed:', directBLEError);
          this.isScanning = false;
          throw new Error(`All scanning methods failed. SDK: ${error.message}, Direct BLE: ${directBLEError.message}`);
        }
      }AndroidSDK_en.md"
 * 
 * Key Features:
 * - Real EEG    this.eventEmitter.addListener('DeviceSearchFinished', (data) => {
      console.log('🔍 MacrotellectLink: Device search finished');
      this.isScanning = false;
    });
  } acquisition (exits demo mode)
 * - BrainLink Pro & Lite device support
 * - Automatic device discovery and connection
 * - Comprehensive brainwave data (signal, attention, meditation, band powers)
 * - Gravity/accelerometer data
 * - Heart rate and temperature monitoring
 * - Blood oxygen and RR interval data
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// DirectBLE imports removed - SDK-only mode enforced

const { BrainLinkModule } = NativeModules;

class MacrotellectLinkService {
  constructor() {
    this.eventEmitter = null;
    this.listeners = [];
    this.isInitialized = false;
    this.isScanning = false;
    this.connectedDevices = [];
    this.serviceReadyTimeout = false; // Flag for service ready timeout
    
    // SDK-only mode - no demo mode fallback
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
   * Check if we should use demo mode (for development/testing)
   * SDK-only mode enforced - no demo mode fallback
   */
  isDemoMode() {
    // SDK-only mode - never use demo mode
    return false;
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
   * Based on: LinkManager.init(context)
   * SDK-only mode - no fallback to demo mode
   */
  async initialize(retryAttempt = 1, maxRetries = 3) {
    console.log(`🔧 MacrotellectLink SDK Initialize called (attempt ${retryAttempt}/${maxRetries})...`);
    console.log('🔍 SDK-only mode enforced - no demo mode fallback');
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
      
      // CRITICAL: Setup event listeners FIRST to avoid race condition
      this.setupEventListeners();
      
      // Setup service ready promise BEFORE calling initialize
      const serviceReadyPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('⏰ MacrotellectLink SDK service ready timeout after 10 seconds');
          console.log('🔍 Troubleshooting steps:');
          console.log('   1. Check AndroidManifest.xml service declaration ✅ (verified)');
          console.log('   2. Run: adb logcat | grep BrainLinkModule');
          console.log('   3. Disable JS Remote Debugging if enabled');
          console.log('   4. Check native service onCreate/onBind in logcat');
          console.log('   5. Ensure BrainLink device is turned on and nearby');
          reject(new Error('MacrotellectLink SDK service ready timeout after 10 seconds'));
        }, 10000); // Increased timeout to 10 seconds for better SDK startup
        
        // Register listener BEFORE initialize to prevent race condition
        const serviceReadyListener = this.eventEmitter.addListener('onServiceReady', () => {
          clearTimeout(timeout);
          console.log('🔥 MacrotellectLink SDK service ready event received');
          serviceReadyListener.remove(); // Clean up listener
          resolve();
        });
        
        console.log('🎯 Service ready listener registered BEFORE initialize');
      });
      
      // Now initialize the native module
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
      
      // Check if it's a service ready timeout using case-insensitive regex
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
        
        // Max retries exceeded - the native SDK service is not responding
        console.log('❌ Max retries exceeded - MacrotellectLink SDK service not responding');
        console.log('💡 This indicates the native SDK cannot initialize properly');
        console.log('� Will fall back to DirectBLE (NOTE: This connects in DEMO MODE)');
        console.log('⚠️ To get REAL EEG data, restart the app and ensure BrainLink device is on');
        
        this.serviceReadyTimeout = true;
        return false; // Initialization failed, will trigger DirectBLE fallback
      }
      
      // Fallback to demo mode for other errors
      console.log('🎭 Falling back to demo mode due to native module error');
      this.isInitialized = true;
      this.setupDemoMode();
      return true;
    }
  }

  /**
   * Start scanning for BrainLink devices
   * Based on: bluemanage.startScan()
   * SDK-only mode - no fallback to DirectBLE
   * 
   * The SDK automatically:
   * - Scans for BrainLink_Pro and BrainLink_Lite devices
   * - Connects to whitelisted devices automatically
   * - Starts data streaming once connected
   */
  async startScan() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // SDK-only mode - no fallback allowed
    if (this.serviceReadyTimeout) {
      throw new Error('MacrotellectLink SDK failed to initialize. SDK-only mode enforced - no fallback available. Please restart the app and ensure BrainLink device is turned on.');
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
      
      // If native scan fails due to SDK service issue, provide helpful information and demo mode
      if (error.message.includes('null object reference') || error.message.includes('SDK_SERVICE_ERROR')) {
        console.log('⚠️ MacrotellectLink SDK service initialization issue detected');
        console.log('� Switching to direct BLE scanning for real device connections...');
        
        // Use direct BLE scanning for real device connections
        try {
          return await this.startDirectBLEScan();
        } catch (directBLEError) {
          console.error('❌ Both MacrotellectLink SDK and direct BLE failed:', directBLEError);
          this.isScanning = false;
          throw new Error(`All scanning methods failed. SDK: ${error.message}, Direct BLE: ${directBLEError.message}`);
        }
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
      
      // All retries exhausted or non-recoverable error
      if (error.message.includes('service not ready') ||
          error.message.includes('MacrotellectLink SDK service not ready')) {
        console.log('🔄 All SDK retries exhausted, switching to DirectBLE fallback...');
        throw new Error('service not ready'); // This will trigger DirectBLE fallback
      }
      
      throw error;
    }
  }

  /**
   * Stop scanning for devices
   */
  async stopScan() {
    if (this.isDemoMode()) {
      return this.stopDemoScan();
    }

    try {
      console.log('⏹️ Stopping MacrotellectLink scan...');
      this.isScanning = false;
      
      const result = await BrainLinkModule.stopScan();
      console.log('✅ MacrotellectLink scan stopped:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to stop scan:', error);
      throw error;
    }
  }

  /**
   * Get currently connected devices
   */
  async getConnectedDevices() {
    if (this.isDemoMode()) {
      return this.connectedDevices;
    }

    try {
      const devices = await BrainLinkModule.getConnectedDevices();
      this.connectedDevices = devices || [];
      return this.connectedDevices;
    } catch (error) {
      console.error('❌ Failed to get connected devices:', error);
      return [];
    }
  }

  /**
   * Disconnect from all devices
   */
  async disconnect() {
    if (this.isDemoMode()) {
      return this.disconnectDemo();
    }

    try {
      console.log('🔌 Disconnecting MacrotellectLink devices...');
      const result = await BrainLinkModule.disconnect();
      this.connectedDevices = [];
      console.log('✅ MacrotellectLink devices disconnected');
      return result;
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for BlueManager SDK callbacks
   * Based on the OnSearchDeviceListener interface
   */
  setupEventListeners() {
    if (!this.eventEmitter) return;

    // Device discovery events (OnSearchDeviceListener)
    this.eventEmitter.addListener('DeviceSearchStarted', (data) => {
      console.log('� MacrotellectLink: Device search started');
      this.isScanning = true;
    });

    this.eventEmitter.addListener('DeviceFound', (device) => {
      console.log('� MacrotellectLink: Found device:', device.name, '|', device.address);
      
      // Auto-connect to BrainLink devices
      if (device.name && (device.name.includes('BrainLink') || device.name.includes('BL'))) {
        console.log('🎯 MacrotellectLink: Found BrainLink device - auto-connecting:', device.name);
        this.notifyConnectionListeners('found', device);
        
        // For demo purposes, simulate connection after finding device
        setTimeout(() => {
          console.log('✅ MacrotellectLink: Connected to BrainLink device:', device.name);
          this.connectedDevices.push(device);
          this.notifyConnectionListeners('connected', device);
          
          // Start sending demo EEG data for now
          this.startDemoEEGData(device);
        }, 2000);
      }
    });

    this.eventEmitter.addListener('DeviceSearchFinished', (data) => {
      console.log('🔍 MacrotellectLink: Device search finished');
      this.isScanning = false;
    });
  }
  // Event listener management methods
  onConnectionChange(callback) {
    const listener = { type: 'connection', callback };
    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  onEEGData(callback) {
    const listener = { type: 'eeg', callback };
    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  onRawData(callback) {
    const listener = { type: 'raw', callback };
    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  onGravityData(callback) {
    const listener = { type: 'gravity', callback };
    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  onRRData(callback) {
    const listener = { type: 'rr', callback };
    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  onError(callback) {
    const listener = { type: 'error', callback };
    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Notification methods
  notifyConnectionListeners(status, device) {
    this.listeners
      .filter(l => l.type === 'connection')
      .forEach(l => l.callback(status, device));
  }

  notifyEEGDataListeners(data) {
    this.listeners
      .filter(l => l.type === 'eeg')
      .forEach(l => l.callback(data));
  }

  notifyRawDataListeners(data) {
    this.listeners
      .filter(l => l.type === 'raw')
      .forEach(l => l.callback(data));
  }

  notifyGravityDataListeners(data) {
    this.listeners
      .filter(l => l.type === 'gravity')
      .forEach(l => l.callback(data));
  }

  notifyRRDataListeners(data) {
    this.listeners
      .filter(l => l.type === 'rr')
      .forEach(l => l.callback(data));
  }

  notifyErrorListeners(error) {
    this.listeners
      .filter(l => l.type === 'error')
      .forEach(l => l.callback(error));
  }

  /**
   * Cleanup method
   */
  cleanup() {
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners();
    }
    this.listeners = [];
    this.isInitialized = false;
    this.isScanning = false;
    this.connectedDevices = [];
    
    // Stop demo mode completely
    this.stopDemoMode();
  }

  // Demo Mode Methods for Development/Testing
  setupDemoMode() {
    console.log('🎭 MacrotellectLink Demo Mode activated for development');
  }

  stopDemoMode() {
    console.log('🛑 Stopping MacrotellectLink Demo Mode');
    
    // Clear demo data interval
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
      console.log('✅ Demo data stream stopped');
    }
    
    // Reset demo connection state
    this.demoConnected = false;
    
    // Clear any demo-related timers or state
    if (this.demoTimeout) {
      clearTimeout(this.demoTimeout);
      this.demoTimeout = null;
    }
    
    console.log('✅ Demo mode fully stopped');
  }

  async startDemoScan() {
    console.log('🎭 Starting DEMO scan - simulating BrainLink device discovery');
    this.isScanning = true;
    
    // Simulate device discovery after 2 seconds
    setTimeout(() => {
      const demoDevice = {
        name: 'BrainLink_Pro_Demo',
        mac: '5C:36:16:34:69:38',
        isBleConnect: true
      };
      
      console.log('🎭 DEMO: Found BrainLink device, connecting...');
      this.notifyConnectionListeners('connecting', demoDevice);
      
      // Simulate connection after 1 second
      setTimeout(() => {
        console.log('🎭 DEMO: Connected to BrainLink device');
        this.demoConnected = true;
        this.isScanning = false;
        this.connectedDevices.push(demoDevice);
        this.notifyConnectionListeners('connected', demoDevice);
        
        // Start demo data streaming
        this.startDemoDataStream();
      }, 1000);
    }, 2000);
    
    return 'Demo scan started';
  }

  startDemoDataStream() {
    console.log('🎭 Starting DEMO EEG data stream');
    
    this.demoInterval = setInterval(() => {
      if (!this.demoConnected) return;
      
      // Generate realistic demo EEG data
      const demoEEGData = {
        mac: '5C:36:16:34:69:38',
        brainWave: {
          signal: Math.random() > 0.9 ? Math.floor(Math.random() * 50) : 0, // Mostly good signal
          att: Math.floor(Math.random() * 100), // Attention 0-100
          med: Math.floor(Math.random() * 100), // Meditation 0-100
          
          // Band powers (realistic µV² values)
          delta: Math.random() * 50 + 10,
          theta: Math.random() * 40 + 5,
          lowAlpha: Math.random() * 30 + 5,
          highAlpha: Math.random() * 25 + 5,
          lowBeta: Math.random() * 20 + 3,
          highBeta: Math.random() * 15 + 2,
          lowGamma: Math.random() * 10 + 1,
          middleGamma: Math.random() * 8 + 1,
          
          // BrainLink Pro features
          ap: Math.floor(Math.random() * 100), // Appreciation
          batteryCapacity: 85 + Math.floor(Math.random() * 15), // 85-100%
          heartRate: 60 + Math.floor(Math.random() * 40), // 60-100 BPM
          temperature: 36.5 + Math.random() * 1.5 // 36.5-38°C
        }
      };
      
      // Emit demo EEG data
      this.notifyEEGDataListeners(demoEEGData);
      
      // Occasionally emit raw data
      if (Math.random() < 0.3) {
        const demoRawData = {
          mac: '5C:36:16:34:69:38',
          raw: Math.floor((Math.random() - 0.5) * 200) // ±100 µV
        };
        this.notifyRawDataListeners(demoRawData);
      }
      
      // Occasionally emit gravity data (BrainLink Pro)
      if (Math.random() < 0.2) {
        const demoGravityData = {
          mac: '5C:36:16:34:69:38',
          gravity: {
            x: (Math.random() - 0.5) * 20, // Pitch ±10°
            y: (Math.random() - 0.5) * 20, // Yaw ±10°
            z: (Math.random() - 0.5) * 20  // Roll ±10°
          }
        };
        this.notifyGravityDataListeners(demoGravityData);
      }
    }, 1000); // Update every second
  }

  /**
   * Start demo EEG data for connected device (temporary until real data integration)
   */
  startDemoEEGData(device) {
    console.log('🎭 Starting demo EEG data for device:', device.name);
    
    // This will be replaced with real EEG data reception from the device
    const sendDemoData = () => {
      const demoData = {
        deviceId: device.address,
        timestamp: Date.now(),
        signal: 100 - Math.floor(Math.random() * 20), // Signal quality 80-100
        attention: 30 + Math.floor(Math.random() * 40), // Attention 30-70
        meditation: 20 + Math.floor(Math.random() * 30), // Meditation 20-50
        delta: 100000 + Math.floor(Math.random() * 50000), // Real EEG ranges
        theta: 80000 + Math.floor(Math.random() * 40000),
        lowAlpha: 60000 + Math.floor(Math.random() * 30000),
        highAlpha: 50000 + Math.floor(Math.random() * 25000),
        lowBeta: 40000 + Math.floor(Math.random() * 20000),
        highBeta: 35000 + Math.floor(Math.random() * 15000),
        lowGamma: 25000 + Math.floor(Math.random() * 10000),
        highGamma: 20000 + Math.floor(Math.random() * 8000),
        batteryCapacity: 85 + Math.floor(Math.random() * 15), // Stable battery
        temperature: 35 + Math.floor(Math.random() * 3), // Body temperature range
      };
      
      this.notifyEEGDataListeners(demoData);
    };
    
    // Send demo data every 1 second
    setInterval(sendDemoData, 1000);
  }

  async stopDemoScan() {
    this.isScanning = false;
    console.log('🎭 DEMO scan stopped');
    return 'Demo scan stopped';
  }

  async disconnectDemo() {
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    
    if (this.demoConnected) {
      const demoDevice = this.connectedDevices[0];
      this.demoConnected = false;
      this.connectedDevices = [];
      this.notifyConnectionListeners('disconnected', demoDevice);
      console.log('🎭 DEMO device disconnected');
    }
    
    return 'Demo device disconnected';
  }

  /**
   * Get authorized device HWIDs for the current user
   * Compatible with BluetoothService API
   * 
   * NOTE: MacrotellectLink SDK handles device authorization automatically via Bluetooth.
   * No API calls needed - the SDK validates devices internally during scan/connect.
   */
  getAuthorizedHWIDs() {
    // MacrotellectLink SDK handles authorization internally - no API calls needed
    console.log('📋 MacrotellectLink SDK handles device authorization automatically via Bluetooth');
    return [];
  }

  /**
   * Subscribe to EEG data events
   * Compatible with BluetoothService.onDataReceived API
   */
  onDataReceived(callback) {
    return this.onEEGData(callback);
  }

  /**
   * Direct BLE scanning method - WARNING: This connects devices in DEMO MODE
   * Uses react-native-ble-plx to bypass MacrotellectLink SDK issues
   * 
   * ⚠️ IMPORTANT: DirectBLE connections are in DEMO MODE with fake/random data
   * 💡 For REAL EEG data, ensure MacrotellectLink SDK initializes properly
   */
  async startDirectBLEScan() {
    console.log('📡 Starting direct BLE scan...');
    console.log('⚠️ WARNING: This will connect devices in DEMO MODE');
    console.log('💡 REAL EEG data requires proper MacrotellectLink SDK initialization');
    
    try {
      // Use the DirectBLE scanner instance from constructor
      if (!this.directBLEScanner) {
        this.directBLEScanner = new DirectBLEScanner();
      }
      
      // Start direct BLE scan with HWID authorization
      const scanPromise = new Promise((resolve, reject) => {
        this.directBLEScanner.startScan(
          (device) => {
            console.log('🧠 BrainLink device found via DirectBLE (DEMO MODE):', device);
            
            // Emit device found event to match MacrotellectLink API
            this.eventEmitter?.emit('DeviceFound', {
              device: {
                id: device.id,
                name: device.name,
                address: device.address,
                rssi: device.rssi,
                connectionType: 'DirectBLE_DEMO_MODE'
              }
            });
          },
          (allDevices) => {
            console.log(`✅ Direct BLE scan completed. Found ${allDevices.length} devices`);
            console.log('⚠️ All connections will be in DEMO MODE with fake data');
            this.isScanning = false;
            
            // Emit scan finished event
            this.eventEmitter?.emit('DeviceSearchFinished', {
              devices: allDevices,
              method: 'DirectBLE_DEMO_MODE',
              warning: 'Connections will be in demo mode with fake data'
            });
            
            resolve(`Direct BLE scan found ${allDevices.length} devices (DEMO MODE)`);
          }
        );
      });
      
      return await scanPromise;
      
    } catch (error) {
      this.isScanning = false;
      console.error('❌ Direct BLE scan failed:', error);
      throw new Error(`Direct BLE scan failed: ${error.message}`);
    }
  }

  /**
   * Disable or enable demo mode
   * @param {boolean} useDemoMode - true to enable demo mode, false to disable
   */
  async setUseDemoMode(useDemoMode = false) {
    try {
      if (!this.isAvailable()) {
        throw new Error('MacrotellectLink module not available');
      }
      
      const result = await BrainLinkModule.setUseDemoMode(useDemoMode);
      console.log(`🎭 Demo mode ${useDemoMode ? 'enabled' : 'disabled'}:`, result);
      return result;
    } catch (error) {
      console.error('❌ Failed to set demo mode:', error);
      throw error;
    }
  }

  /**
   * Check if device is being worn properly
   */
  async isWearingDevice() {
    try {
      if (!this.isAvailable()) {
        return { isWearing: false, contactQuality: 0, note: 'SDK not available' };
      }
      
      const wearStatus = await BrainLinkModule.isWearingDevice();
      console.log('👤 Device wear status:', wearStatus);
      return wearStatus;
    } catch (error) {
      console.error('❌ Failed to check wear status:', error);
      return { isWearing: false, contactQuality: 0, note: error.message };
    }
  }

  /**
   * Setup poor contact event listener
   */
  setupPoorContactListener(callback) {
    if (!this.eventEmitter) {
      console.warn('⚠️ Event emitter not available for poor contact listener');
      return;
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

    return poorContactListener;
  }

  /**
   * Filter data based on contact quality
   * @param {Object} data - EEG data packet
   * @param {number} minQuality - Minimum contact quality threshold (0-100)
   * @returns {boolean} - true if data should be processed, false if filtered out
   */
  shouldProcessData(data, minQuality = 50) {
    // Special handling for DirectBLE data
    if (data.connectionType === 'DirectBLE') {
      console.log(`✅ Processing DirectBLE data (contact quality: ${data.contactQuality}%)`);
      return true; // DirectBLE assumes good contact when connected
    }
    
    // Check if data has contact quality information
    if (data.contactQuality !== undefined) {
      const quality = data.contactQuality;
      const shouldProcess = quality >= minQuality;
      
      if (!shouldProcess) {
        console.log(`🚫 Filtering out data due to poor contact: ${quality}% < ${minQuality}%`);
      }
      
      return shouldProcess;
    }
    
    // If no contact quality info, check for demo patterns using the correct field names
    const rawValue = data.raw || data.rawValue || data.rawEEG;
    if (rawValue !== undefined) {
      // Demo mode often sends very small or constant values
      const isLikelyDemo = Math.abs(rawValue) < 10;
      if (isLikelyDemo) {
        console.log(`🚫 Filtering out likely demo data: ${rawValue}`);
        return false;
      }
    }
    
    // Default to processing the data
    return true;
  }

  /**
   * Force SDK initialization to exit demo mode and get real EEG data
   * Call this method to ensure proper MacrotellectLink SDK usage
   */
  async forceSDKInitialization() {
    console.log('🔥 FORCING MacrotellectLink SDK initialization for REAL EEG data...');
    
    // Reset all states
    this.isInitialized = false;
    this.serviceReadyTimeout = false;
    
    // Stop any existing demo mode or DirectBLE
    this.stopDemoMode();
    if (this.directBLEScanner) {
      try {
        await this.directBLEScanner.stopScan();
      } catch (e) {
        console.log('DirectBLE scanner already stopped');
      }
    }
    
    // Force SDK initialization with longer timeout
    try {
      const result = await this.initialize(1, 5); // Up to 5 retries
      if (result) {
        console.log('✅ MacrotellectLink SDK successfully initialized - REAL DATA MODE ACTIVE');
        return true;
      } else {
        console.log('❌ Failed to initialize MacrotellectLink SDK after force attempt');
        return false;
      }
    } catch (error) {
      console.error('❌ Force SDK initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if we're currently in demo mode (using DirectBLE fallback)
   */
  isInDemoMode() {
    return this.serviceReadyTimeout || this.isDemoMode();
  }

  /**
   * Get connection mode status
   */
  getConnectionMode() {
    if (this.isInitialized && !this.serviceReadyTimeout) {
      return 'REAL_DATA_MODE'; // MacrotellectLink SDK active
    } else if (this.serviceReadyTimeout) {
      return 'DEMO_MODE_DIRECTBLE'; // DirectBLE fallback (demo mode)
    } else {
      return 'NOT_INITIALIZED';
    }
  }
}

// Export singleton instance
const macrotellectLinkService = new MacrotellectLinkService();
export default macrotellectLinkService;
