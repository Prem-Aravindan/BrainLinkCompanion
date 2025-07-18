/**
 * Direct BLE Scanner for BrainLink devices
 * This bypasses MacrotellectLink SDK scanning issues and uses react-native-ble-plx directly
 */

import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';
import { createEEGProcessor } from '../utils/eegProcessing';
import DirectBLEServiceManager from './DirectBLEServiceManager';
import DirectBLEConnectionManager from './DirectBLEConnectionManager';
import BLESupervisionTimeoutManager from './BLESupervisionTimeoutManager';

// Simple EventEmitter implementation for React Native
class SimpleEventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  removeListener(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    }
  }

  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}

class DirectBLEScanner extends SimpleEventEmitter {
  constructor() {
    super();
    try {
      this.bleManager = new BleManager();
      this.isScanning = false;
      this.foundDevices = new Map();
      this.scanSubscription = null;
      this.connectedDevice = null;
      this.connectedDeviceId = null;
      this.monitoringSubscription = null; // Track the monitoring subscription
      this.isStreaming = false;
      this.connectionCheckInterval = null; // Periodic connection check
      
      // Add minimal EEG processing setup
      this.rawDataBuffer = [];
      this.maxBufferSize = 1000;
      this.minSamplesForBandPowers = 10; // Minimum samples for any calculation (very low threshold)
      this.eegProcessor = null; // Initialize later to avoid startup issues
      this.tgamParser = null; // Initialize later for battery/version parsing
      
      // Time-based band power calculation (like Python implementation)
      this.bandPowerTimer = null;
      this.bandPowerInterval = 1000; // Calculate band powers every 1000ms (1 second)
      this.lastBandPowerTime = 0;
      
      // Auto-reconnection settings
      this.autoReconnect = true;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 3;
      this.reconnectDelay = 3000; // 3 seconds
      
      // Authorized BrainLink HWIDs (last 5 digits)
      this.authorizedHWIDs = [
        '69:38', // From your current BrainLink_Pro: CC:36:16:34:69:38
        // Add more authorized HWIDs here as needed
      ];
      
      // Initialize foreground service manager
      this.serviceManager = new DirectBLEServiceManager();
      
      // Initialize enhanced connection manager
      this.connectionManager = new DirectBLEConnectionManager(this);
      
      // Initialize BLE supervision timeout manager (primary solution)
      this.supervisionTimeoutManager = new BLESupervisionTimeoutManager();
      
      // Add persistent band powers to prevent flickering
      this.lastCalculatedBandPowers = null; // Store last valid band powers
      
      // Battery and device info tracking
      this.batteryLevel = null;
      this.deviceVersion = null;
      this.isDemoMode = false; // Determined by battery level
      
      console.log('📡 DirectBLEScanner initialized successfully');
      console.log('🔐 Authorized HWIDs:', this.authorizedHWIDs);
      console.log('🔍 Debug mode enabled - enhanced device detection');
    } catch (error) {
      console.error('❌ Failed to initialize DirectBLEScanner:', error);
      this.bleManager = null;
    }
  }

  /**
   * Ensure BleManager is available
   */
  ensureBleManager() {
    if (!this.bleManager) {
      throw new Error('BLE Manager not available. Bluetooth may not be supported on this device.');
    }
  }

  /**
   * Check if BLE is available and enabled
   */
  async checkBLEState() {
    try {
      this.ensureBleManager();
      console.log('📡 Checking BLE state...');
      const state = await this.bleManager.state();
      console.log('📡 BLE State:', state);
      
      if (state === 'PoweredOn') {
        return true;
      } else if (state === 'PoweredOff') {
        throw new Error('Bluetooth is turned off. Please enable Bluetooth in your device settings.');
      } else if (state === 'Unauthorized') {
        throw new Error('Bluetooth permissions not granted. Please grant Bluetooth permissions.');
      } else {
        console.warn('⚠️ BLE in transitional state:', state);
        return false;
      }
    } catch (error) {
      console.error('❌ BLE state check failed:', error);
      if (error.message.includes('BluetoothAdapter') || error.message.includes('null object reference')) {
        throw new Error('Bluetooth hardware not available or Android Bluetooth service not ready. Please restart the app and ensure Bluetooth is enabled.');
      }
      throw error;
    }
  }

  /**
   * Request necessary permissions for BLE scanning
   */
  async requestPermissions() {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const permissions = [];
      
      if (Platform.Version >= 31) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      }
      
      permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      const allGranted = Object.values(results).every(
        result => result === PermissionsAndroid.RESULTS.GRANTED
      );

      console.log('🔐 Direct BLE permissions:', results);
      return allGranted;
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      return false;
    }
  }

  /**
   * Start scanning for BrainLink devices
   */
  async startScan(onDeviceFound, onScanFinished) {
    try {
      this.ensureBleManager();
      console.log('🔍 Starting direct BLE scan for BrainLink devices...');

      // Start foreground service to prevent 15-second disconnection
      try {
        console.log('🚀 Attempting to start BLE foreground service...');
        const serviceStarted = await this.serviceManager.startForegroundService();
        if (serviceStarted) {
          console.log('✅ BLE foreground service started successfully');
        } else {
          console.warn('⚠️ Foreground service failed to start - using fallback approach');
        }
      } catch (serviceError) {
        console.error('❌ Foreground service error:', serviceError.message);
        console.log('🔄 Continuing with enhanced BLE scanning options...');
      }

      // Check permissions
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        throw new Error('BLE permissions required');
      }

      // Check BLE state
      const bleReady = await this.checkBLEState();
      if (!bleReady) {
        throw new Error('Bluetooth is not enabled');
      }

      this.isScanning = true;
      this.foundDevices.clear();

      // Start scanning with enhanced options to prevent 15-second timeout
      const scanOptions = {
        allowDuplicates: true,  // Allow duplicate device reports
        scanMode: 'lowLatency', // Use low latency for better connection stability
        callbackType: 'all'     // Report all devices found
      };
      
      console.log('🔍 Using enhanced scan options:', scanOptions);
      
      this.scanSubscription = this.bleManager.startDeviceScan(
        null, // Service UUIDs - null to scan all devices
        scanOptions, // Enhanced scan options
        (error, device) => {
          if (error) {
            console.error('❌ Device discovery error:', error);
            if (error.message.includes('BluetoothAdapter') || error.message.includes('null object reference')) {
              if (onScanFinished) {
                onScanFinished(new Error('Bluetooth hardware error: ' + error.message), []);
              }
            }
            return;
          }

          // Filter for BrainLink devices
          if (device && this.isBrainLinkDevice(device)) {
            console.log('🧠 BrainLink device found:', {
              id: device.id,
              name: device.name,
              rssi: device.rssi
            });

            // Store device to prevent duplicates
            if (!this.foundDevices.has(device.id)) {
              this.foundDevices.set(device.id, device);
            
              // Notify callback only for new devices
              if (onDeviceFound && typeof onDeviceFound === 'function') {
                onDeviceFound({
                  id: device.id,
                  name: device.name || 'Unknown BrainLink',
                  address: device.id,
                  rssi: device.rssi || -100
                });
              }
            }
          } else if (device) {
            // Debug: Log all discovered devices to help troubleshoot
            console.log('📱 Non-BrainLink device found:', {
              id: device.id,
              name: device.name || 'Unknown',
              rssi: device.rssi
            });
          }
        }
      );

      console.log('✅ Direct BLE scan started');

      // Stop scan after 30 seconds
      setTimeout(() => {
        this.stopScan();
        if (onScanFinished && typeof onScanFinished === 'function') {
          onScanFinished(null, Array.from(this.foundDevices.values()));
        }
      }, 30000);

      return true;
    } catch (error) {
      this.isScanning = false;
      console.error('❌ Direct BLE scan failed:', error);
      throw error;
    }
  }

  /**
   * Stop BLE scanning
   */
  async stopScan() {
    try {
      if (this.isScanning && this.bleManager) {
        console.log('⏹️ Stopping direct BLE scan...');
        
        try {
          await this.bleManager.stopDeviceScan();
        } catch (stopError) {
          console.log('⚠️ Error stopping device scan:', stopError.message);
        }
        
        if (this.scanSubscription && typeof this.scanSubscription.remove === 'function') {
          try {
            this.scanSubscription.remove();
          } catch (removeError) {
            console.log('⚠️ Error removing scan subscription:', removeError.message);
          }
        }
        
        this.scanSubscription = null;
        this.isScanning = false;
        
        // Stop foreground service when scan ends
        await this.serviceManager.stopForegroundService();
        
        console.log('✅ Direct BLE scan stopped');
      }
    } catch (error) {
      console.error('❌ Stop scan error:', error);
      // Reset state even if stop failed
      this.isScanning = false;
      this.scanSubscription = null;
    }
  }

  /**
   * Start connection heartbeat to maintain stable connection
   * Enhanced version to prevent 15-second timeout disconnections
   */
  startConnectionHeartbeat() {
    // Clear any existing heartbeat
    this.stopConnectionHeartbeat();
    
    this.connectionCheckInterval = setInterval(async () => {
      if (this.connectedDevice && this.connectedDeviceId) {
        try {
          const isConnected = await this.connectedDevice.isConnected();
          if (!isConnected) {
            console.log('💔 Connection lost during heartbeat check');
            this.handleDisconnection();
          } else {
            console.log('💓 Connection heartbeat OK');
            
            // Perform keep-alive activity to prevent Android from killing the connection
            try {
              // Try to read a characteristic to keep the connection active
              const services = await this.connectedDevice.services();
              if (services && services.length > 0) {
                // Just accessing services helps keep the connection alive
                console.log('🔄 Keep-alive: Services active');
              }
            } catch (keepAliveError) {
              console.log('⚠️ Keep-alive activity failed:', keepAliveError.message);
            }
          }
        } catch (error) {
          console.log('💔 Heartbeat check failed:', error.message);
          this.handleDisconnection();
        }
      }
    }, 10000); // Check every 10 seconds (well before 15-second timeout)
  }

  /**
   * Stop connection heartbeat
   */
  stopConnectionHeartbeat() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  /**
   * Handle disconnection events with auto-reconnection
   */
  handleDisconnection() {
    console.log('🔌 Handling disconnection cleanup...');
    
    // Stop heartbeat
    this.stopConnectionHeartbeat();
    
    // Stop monitoring subscription
    if (this.monitoringSubscription) {
      try {
        this.monitoringSubscription.remove();
      } catch (error) {
        console.log('⚠️ Error removing monitoring subscription:', error.message);
      }
      this.monitoringSubscription = null;
    }
    
    // Stop enhanced connection management
    this.connectionManager.stopEnhancedConnectionManagement();
    
    // Stop BLE supervision timeout prevention
    this.supervisionTimeoutManager.stopSupervisionTimeoutPrevention();
    
    const deviceId = this.connectedDeviceId;
    
    // Reset state but don't destroy BLE manager
    this.connectedDevice = null;
    this.connectedDeviceId = null;
    this.isStreaming = false;
    
    // Emit disconnection event
    this.emit('disconnected');
    
    // Attempt auto-reconnection if enabled and device was previously connected
    if (this.autoReconnect && deviceId && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Auto-reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay/1000}s...`);
      
      setTimeout(async () => {
        try {
          console.log(`🔄 Attempting to reconnect to ${deviceId}...`);
          
          // Reinitialize BLE manager if destroyed
          if (!this.bleManager || this.bleManager.state() === 'Destroyed') {
            console.log('🔧 Reinitializing BLE manager for reconnection...');
            this.bleManager = new BleManager();
          }
          
          await this.connectToDevice(deviceId);
          console.log('✅ Auto-reconnection successful!');
          this.reconnectAttempts = 0; // Reset counter on success
        } catch (error) {
          console.error(`❌ Auto-reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('🚫 Max reconnection attempts reached. Auto-reconnection disabled.');
            this.autoReconnect = false;
          }
        }
      }, this.reconnectDelay);
    }
  }
  isBrainLinkDevice(device) {
    if (!device) return false;

    const name = device.name || '';
    const id = device.id || '';

    // Common BrainLink device patterns (name-based)
    const brainlinkNamePatterns = [
      /brainlink/i,
      /brain.?link/i,
      /macrotellect/i,
      /BL-/i,
      /BrainLink_Pro/i,
      /BrainLink_Lite/i
    ];

    // BrainLink device MAC address patterns (ID-based)
    const brainlinkIdPatterns = [
      /^CC:36:16:34:69:38$/i,  // Your specific BrainLink device
      /^CC:36:16:/i,           // Common BrainLink MAC prefix
      /^[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:[0-9A-F]{2}:69:38$/i  // Pattern for your device family
    ];

    // Check name patterns first
    const isBrainLinkByName = brainlinkNamePatterns.some(pattern => 
      pattern.test(name) || pattern.test(id)
    );

    // Check ID patterns (for devices without proper names)
    const isBrainLinkById = brainlinkIdPatterns.some(pattern => 
      pattern.test(id)
    );

    // Check if it's in authorized HWIDs (additional verification)
    const isAuthorized = this.isAuthorizedHWID(id);

    const isBrainLink = isBrainLinkByName || isBrainLinkById || isAuthorized;

    if (!isBrainLink) {
      // Debug: Log details for devices that don't match patterns
      if (name || id) {
        console.log(`🔍 Device doesn't match BrainLink patterns: ${name} (${id})`);
      }
      return false;
    }

    // Log recognition method
    if (isBrainLinkByName) {
      console.log('✅ BrainLink device recognized by name pattern:', { id, name });
    } else if (isBrainLinkById) {
      console.log('✅ BrainLink device recognized by ID pattern:', { id, name });
    } else if (isAuthorized) {
      console.log('✅ BrainLink device recognized by authorized HWID:', { id, name });
    }

    if (isAuthorized) {
      console.log('🔐 Device is in authorized HWID list');
    } else {
      console.log('⚠️ Device not in authorized HWID list');
      // TEMPORARILY ALLOW UNAUTHORIZED DEVICES FOR DEBUGGING
      console.log('🔧 Debug mode: Allowing unauthorized device for testing');
    }

    // Return true for any BrainLink device (authorized or not) for debugging
    return isBrainLink;
  }

  /**
   * Check if device HWID is authorized (last 5 digits)
   */
  isAuthorizedHWID(deviceId) {
    if (!deviceId) return false;
    
    const last5Digits = deviceId.slice(-5); // Get last 5 characters (XX:XX)
    const isAuthorized = this.authorizedHWIDs.includes(last5Digits);
    
    console.log(`🔐 HWID Check: ${deviceId} -> ${last5Digits} -> ${isAuthorized ? 'AUTHORIZED' : 'UNAUTHORIZED'}`);
    
    return isAuthorized;
  }

  /**
   * Connect to a BrainLink device and start EEG streaming
   */
  async connectToDevice(deviceId) {
    try {
      console.log('🔗 Connecting to BrainLink device:', deviceId);
      
      // Stop scanning first to avoid conflicts
      await this.stopScan();
      
      // Enhanced connection parameters to prevent BLE supervision timeout
      // Remove 15-second timeout that was causing disconnections
      const device = await this.bleManager.connectToDevice(
        deviceId,
        { 
          requestMTU: 512,
          connectionPriority: 1,      // High priority for stable connection
          refreshCache: true,
          autoConnect: true,          // Enable auto-connect for stability
          // No timeout specified - let it use default longer timeout
          // This prevents the exact 15-second supervision timeout issue
        }
      );
      
      console.log('🔗 Device connected, discovering services...');
      
      // Discover services with retry
      let services;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await device.discoverAllServicesAndCharacteristics();
          services = await device.services();
          console.log('📋 Available services:', services.map(s => s.uuid));
          break;
        } catch (error) {
          console.log(`⚠️ Service discovery attempt ${attempt} failed:`, error.message);
          if (attempt === 3) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        }
      }
      
      this.connectedDevice = device;
      this.connectedDeviceId = deviceId;
      
      console.log('✅ Connected to BrainLink device and discovered services');
      
      // Set up disconnection listener with improved handling
      device.onDisconnected((error, device) => {
        console.log('🔌 Device disconnected:', device?.id, error?.message);
        this.handleDisconnection();
      });
      
      // Emit connection event
      this.emit('connected', device);
      
      // Start BLE supervision timeout prevention (PRIMARY SOLUTION)
      console.log('🛡️ Starting BLE supervision timeout prevention...');
      const supervisionProtected = await this.supervisionTimeoutManager.startSupervisionTimeoutPrevention(device);
      
      if (supervisionProtected) {
        console.log('✅ BLE supervision timeout protection active');
      } else {
        console.log('⚠️ Supervision timeout protection failed - using fallback strategies');
        // Start enhanced connection management as fallback
        this.connectionManager.startEnhancedConnectionManagement(device);
      }
      
      // Start EEG streaming with delay to ensure stability
      setTimeout(async () => {
        try {
          await this.startEEGStreaming(device);
        } catch (error) {
          console.error('❌ Failed to start EEG streaming:', error);
        }
      }, 2000); // 2 second delay
      
      return device;
    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.connectedDevice = null;
      this.connectedDeviceId = null;
      throw error;
    }
  }

  /**
   * Start EEG data streaming from connected BrainLink device
   */
  async startEEGStreaming(device) {
    try {
      console.log('🧠 Starting EEG data streaming...');
      
      if (!device || !device.isConnected) {
        throw new Error('Device not connected or disconnected during setup');
      }
      
      // Get available services first
      const services = await device.services();
      console.log('📋 Available services for streaming:', services.map(s => s.uuid));
      
      // Try multiple possible BrainLink service UUIDs
      const possibleServiceUUIDs = [
        '0000fff0-0000-1000-8000-00805f9b34fb', // Standard BrainLink
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
        '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service (sometimes used)
        '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
      ];
      
      const possibleCharacteristicUUIDs = [
        '0000fff1-0000-1000-8000-00805f9b34fb',
        '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART RX
        '0000fff4-0000-1000-8000-00805f9b34fb',
      ];
      
      let streamingStarted = false;
      
      // Try to find working service/characteristic combination
      for (const serviceUUID of possibleServiceUUIDs) {
        const foundService = services.find(s => s.uuid.toLowerCase() === serviceUUID.toLowerCase());
        if (!foundService) continue;
        
        console.log('📡 Found service:', serviceUUID);
        
        try {
          const characteristics = await foundService.characteristics();
          console.log('📋 Available characteristics:', characteristics.map(c => c.uuid));
          
          for (const charUUID of possibleCharacteristicUUIDs) {
            const foundChar = characteristics.find(c => c.uuid.toLowerCase() === charUUID.toLowerCase());
            if (!foundChar) continue;
            
            console.log('📡 Trying characteristic:', charUUID);
            
            try {
              // Subscribe to EEG data notifications with improved error handling
              const subscription = device.monitorCharacteristicForService(
                serviceUUID,
                charUUID,
                (error, characteristic) => {
                  if (error) {
                    console.error('❌ EEG streaming error:', error);
                    // Handle specific error types
                    if (error.message.includes('cancelled') || error.message.includes('disconnected')) {
                      console.log('🔌 Device disconnected during streaming');
                      this.handleDisconnection();
                    }
                    return;
                  }
                  
                  if (characteristic && characteristic.value) {
                    this.processEEGData(characteristic.value);
                  }
                }
              );
              
              // Store the subscription for cleanup
              this.monitoringSubscription = subscription;
              this.isStreaming = true;
              
              // Start connection heartbeat
              this.startConnectionHeartbeat();
              
              console.log('✅ EEG streaming started on service:', serviceUUID, 'characteristic:', charUUID);
              streamingStarted = true;
              return subscription;
              
            } catch (charError) {
              console.log('⚠️ Failed to monitor characteristic', charUUID, ':', charError.message);
              continue;
            }
          }
        } catch (serviceError) {
          console.log('⚠️ Failed to get characteristics for service', serviceUUID, ':', serviceError.message);
          continue;
        }
      }
      
      if (!streamingStarted) {
        console.log('⚠️ Could not start EEG streaming with known UUIDs, listing all available characteristics...');
        
        // Fallback: Try to find any notifiable characteristic
        for (const service of services) {
          try {
            const characteristics = await service.characteristics();
            for (const char of characteristics) {
              if (char.isNotifiable) {
                console.log('📡 Trying notifiable characteristic:', char.uuid, 'on service:', service.uuid);
                try {
                  const subscription = device.monitorCharacteristicForService(
                    service.uuid,
                    char.uuid,
                    (error, characteristic) => {
                      if (error) {
                        console.error('❌ EEG streaming error:', error);
                        // Handle specific error types
                        if (error.message.includes('cancelled') || error.message.includes('disconnected')) {
                          console.log('🔌 Device disconnected during streaming');
                          this.handleDisconnection();
                        }
                        return;
                      }
                      
                      if (characteristic && characteristic.value) {
                        this.processEEGData(characteristic.value);
                      }
                    }
                  );
                  
                  // Store the subscription for cleanup
                  this.monitoringSubscription = subscription;
                  this.isStreaming = true;
                  
                  // Start connection heartbeat
                  this.startConnectionHeartbeat();
                  
                  console.log('✅ EEG streaming started on fallback characteristic:', char.uuid);
                  return subscription;
                  
                } catch (error) {
                  console.log('⚠️ Fallback characteristic failed:', char.uuid, error.message);
                }
              }
            }
          } catch (error) {
            console.log('⚠️ Failed to examine service:', service.uuid);
          }
        }
        
        throw new Error('No suitable characteristics found for EEG streaming');
      }
      
    } catch (error) {
      console.error('❌ Failed to start EEG streaming:', error);
      throw error;
    }
  }

  /**
   * Process raw EEG data from BrainLink device
   */
  processEEGData(rawData) {
    try {
      // Decode base64 data
      const buffer = Buffer.from(rawData, 'base64');
      
      
        // Parse BrainLink data format
        // Process the raw binary data directly for scientific processing
        if (buffer.length >= 4) {
          const timestamp = Date.now();
          
          // For BrainLink TGAM data, we should parse the entire packet structure
          // The raw buffer contains: [SYNC, SYNC, LENGTH, PAYLOAD..., CHECKSUM]
          // Let's use both the EEG processor's TGAM parser and the dedicated TGAMParser
          try {
            if (!this.eegProcessor) {
              const { createEEGProcessor } = require('../utils/eegProcessing');
              this.eegProcessor = createEEGProcessor(512);
            }
            
            // Initialize TGAM parser if not already done
            if (!this.tgamParser) {
              const { TGAMParser } = require('../utils/TGAMParser');
              this.tgamParser = new TGAMParser();
              
              // Set up TGAM parser callback for structured data
              this.tgamParser.frameCallbacks.push((frameData) => {
                if (frameData.data.battery !== undefined) {
                  const batteryValue = frameData.data.battery;
                  if (batteryValue >= 0 && batteryValue <= 100) {
                    const previousBattery = this.batteryLevel;
                    this.batteryLevel = batteryValue;
                    
                    // Determine demo mode based on battery level
                    this.isDemoMode = (batteryValue === 0 || batteryValue === 100);
                    
                    // Only log and emit if battery level changed or first time
                    if (previousBattery === null || Math.abs(previousBattery - batteryValue) > 0) {
                      console.log(`🔋 TGAM Battery: ${batteryValue}% ${this.isDemoMode ? '(Demo Mode)' : '(Real Device)'}`);
                      
                      this.emit('batteryData', {
                        battery: batteryValue,
                        isDemoMode: this.isDemoMode,
                        timestamp,
                        deviceId: this.connectedDeviceId
                      });
                    }
                  }
                }
                
                if (frameData.data.version !== undefined) {
                  const versionValue = frameData.data.version;
                  if (this.deviceVersion !== versionValue) {
                    this.deviceVersion = versionValue;
                    console.log(`📱 TGAM Version: ${versionValue}`);
                    this.emit('versionData', {
                      version: versionValue,
                      timestamp,
                      deviceId: this.connectedDeviceId
                    });
                  }
                }
              });
            }
            
            // Process with TGAM parser for battery/version data
            this.tgamParser.addData(rawData);
            
            // Parse the entire buffer for raw EEG data
            const parsedData = this.eegProcessor.parseRawData(buffer);
            
            // Handle both old array format and new object format
            const rawValues = parsedData.rawValues || (Array.isArray(parsedData) ? parsedData : []);
            
            if (rawValues.length > 0) {
              console.log(`📊 TGAM Parser found ${rawValues.length} EEG samples:`, {
                range: `${Math.min(...rawValues)} to ${Math.max(...rawValues)}`,
                timestamp
              });
              
              // Add all parsed values to buffer
              for (const rawValue of rawValues) {
                this.rawDataBuffer.push(rawValue);
              }
            }
            if (parsedData.battery !== null && parsedData.battery !== undefined) {
              // Validate battery level (0-100%)
              if (parsedData.battery >= 0 && parsedData.battery <= 100) {
                const previousBattery = this.batteryLevel;
                this.batteryLevel = parsedData.battery;
                
                // Determine demo mode based on battery level
                // Demo mode typically shows as 0% or 100% battery
                this.isDemoMode = (parsedData.battery === 0 || parsedData.battery === 100);
                
                // Only log and emit if battery level changed significantly or first time
                if (previousBattery === null || Math.abs(previousBattery - parsedData.battery) > 0) {
                  console.log(`🔋 Battery level: ${parsedData.battery}% ${this.isDemoMode ? '(Demo Mode)' : '(Real Device)'}`);
                  
                  this.emit('batteryData', {
                    battery: parsedData.battery,
                    isDemoMode: this.isDemoMode,
                    timestamp,
                    deviceId: this.connectedDeviceId
                  });
                }
              } else {
                console.warn(`⚠️ Invalid battery level received: ${parsedData.battery}% (ignoring)`);
              }
            } else {
              // No raw EEG values found in this packet
              console.log('📊 No EEG samples found in this packet');
            }
          } catch (parseError) {
            console.error('❌ TGAM parsing failed:', parseError.message);
            // Continue without processing this packet
          }
        // Manage buffer size
        if (this.rawDataBuffer.length > this.maxBufferSize) {
          this.rawDataBuffer = this.rawDataBuffer.slice(-this.maxBufferSize);
        }
        
        // Calculate band powers every 1-2 seconds for meaningful EEG analysis
        console.log(`📊 Buffer status: ${this.rawDataBuffer.length} samples`);
        
        // Calculate band powers every 1 second using sliding window (like Python implementation)
        const samplesPerSecond = 512;
        const calculationInterval = 1000; // 1 second in milliseconds
        const timeSinceLastCalc = timestamp - this.lastBandPowerTime;
        
        // Calculate band powers every 1 second if we have enough samples (minimum 512 for meaningful FFT)
        if (this.rawDataBuffer.length >= samplesPerSecond && timeSinceLastCalc >= calculationInterval) {
          
          this.lastBandPowerTime = timestamp;
          
          try {
            // Initialize processor on first use to avoid startup issues
            if (!this.eegProcessor) {
              console.log('🧠 Initializing EEG processor...');
              const { createEEGProcessor } = require('../utils/eegProcessing');
              this.eegProcessor = createEEGProcessor(512);
              console.log('🧠 EEG processor initialized for band power calculation');
            }
            
            // Use the last 512 samples (1 second) for calculation
            const dataSlice = this.rawDataBuffer.slice(-samplesPerSecond);
            console.log(`� Processing ${dataSlice.length} samples for band powers (sliding window)...`);
            
            const result = this.eegProcessor.process(dataSlice);
            console.log('🧮 Processing result:', result ? 'success' : 'failed');
            
            if (result && result.bandPowers) {
              // Store the original numeric band powers
              const freshBandPowers = {
                delta: result.bandPowers.delta,
                theta: result.bandPowers.theta,
                alpha: result.bandPowers.alpha,
                beta: result.bandPowers.beta,
                gamma: result.bandPowers.gamma
              };
              
              // Update persistent band powers
              this.lastCalculatedBandPowers = freshBandPowers;
              
              // Log formatted values for debugging
              console.log('📊 Band Powers calculated (1-second window):', {
                delta: freshBandPowers.delta.toFixed(3),
                theta: freshBandPowers.theta.toFixed(3),
                alpha: freshBandPowers.alpha.toFixed(3),
                beta: freshBandPowers.beta.toFixed(3),
                gamma: freshBandPowers.gamma.toFixed(3),
                windowSize: dataSlice.length,
                samplesPerSecond: samplesPerSecond
              });
            } else {
              console.warn('⚠️ Band power calculation returned null/invalid result');
            }
          } catch (processingError) {
            console.error('❌ Band power calculation failed:', processingError.message);
          }
        } else {
          // Show progress for next calculation (time-based)
          const samplesNeeded = Math.max(0, samplesPerSecond - this.rawDataBuffer.length);
          const timeUntilNext = Math.max(0, calculationInterval - timeSinceLastCalc);
          if (this.rawDataBuffer.length % 50 === 0) {
            console.log(`⏳ Next calculation in: ${samplesNeeded > 0 ? samplesNeeded + ' samples (minimum), ' : ''}${(timeUntilNext/1000).toFixed(1)}s`);
          }
        }
        
        // Calculate time since last calculation for logging
        const timeSinceLastCalculation = timestamp - this.lastBandPowerTime;
        const freshlyCalculated = timeSinceLastCalculation < 1100; // Within 1.1 seconds means fresh calculation
        
        // Emit data event with the latest raw values (use last value from buffer)
        if (this.rawDataBuffer.length > 0) {
          const latestRawValue = this.rawDataBuffer[this.rawDataBuffer.length - 1];
          const eegData = {
            timestamp,
            rawValue: latestRawValue,
            raw: latestRawValue, // Use raw values for scientific processing
            deviceId: this.connectedDeviceId,
            connectionType: 'DirectBLE',
            contactQuality: 85 // DirectBLE assumes good contact when connected
          };
        
          // Always include band powers when available (they update every 1 second)
          if (this.lastCalculatedBandPowers) {
            eegData.delta = Number(this.lastCalculatedBandPowers.delta) || 0;
            eegData.theta = Number(this.lastCalculatedBandPowers.theta) || 0;
            eegData.alpha = Number(this.lastCalculatedBandPowers.alpha) || 0;
            eegData.beta = Number(this.lastCalculatedBandPowers.beta) || 0;
            eegData.gamma = Number(this.lastCalculatedBandPowers.gamma) || 0;
            
            if (freshlyCalculated) {
              console.log('✅ Emitting EEG data WITH fresh band powers (just calculated)');
            } else {
              console.log('📡 Emitting EEG data WITH band powers (from 1-second window)');
            }
          } else {
            console.log('📡 Emitting EEG data without band powers (no calculations yet)');
          }
          
          this.emit('eegData', eegData);
        }
      }
      
    } catch (error) {
      console.error('❌ EEG data processing error:', error);
    }
  }

  /**
   * Get list of found devices
   */
  getFoundDevices() {
    return Array.from(this.foundDevices.values());
  }

  /**
   * Get current connection status and device info
   */
  getConnectionStatus() {
    return {
      isConnected: !!this.connectedDevice,
      deviceId: this.connectedDeviceId,
      isStreaming: this.isStreaming,
      device: this.connectedDevice,
      batteryLevel: this.batteryLevel,
      deviceVersion: this.deviceVersion,
      isDemoMode: this.isDemoMode
    };
  }

  /**
   * Get battery and device information
   */
  getBatteryInfo() {
    return {
      batteryLevel: this.batteryLevel,
      deviceVersion: this.deviceVersion,
      isDemoMode: this.isDemoMode
    };
  }

  /**
   * Disconnect from the current device
   */
  async disconnect() {
    try {
      console.log('🔌 Disconnecting from BrainLink device');
      
      // Stop scanning first
      await this.stopScan();
      
      // Stop heartbeat and monitoring
      this.stopConnectionHeartbeat();
      
      if (this.monitoringSubscription) {
        try {
          this.monitoringSubscription.remove();
        } catch (error) {
          console.log('⚠️ Error removing monitoring subscription:', error.message);
        }
        this.monitoringSubscription = null;
      }
      
      if (this.connectedDevice && this.connectedDeviceId) {
        try {
          // Check if device is still connected before trying to disconnect
          const isConnected = await this.connectedDevice.isConnected();
          if (isConnected) {
            await this.bleManager.cancelDeviceConnection(this.connectedDeviceId);
          }
        } catch (disconnectError) {
          console.log('⚠️ Device already disconnected or error during disconnect:', disconnectError.message);
        }
      }
      
      // Always reset state
      this.connectedDevice = null;
      this.connectedDeviceId = null;
      this.isStreaming = false;
      
      console.log('✅ Disconnected successfully');
    } catch (error) {
      console.error('❌ Disconnect error:', error);
      // Reset state even if disconnect failed
      this.connectedDevice = null;
      this.connectedDeviceId = null;
      this.isStreaming = false;
    }
  }

  /**
   * Cleanup resources safely
   */
  destroy() {
    this.disconnect();
    this.stopScan();
    
    // Don't destroy BLE manager during normal operation to prevent reconnection failures
    // Only destroy on explicit shutdown
    if (this.bleManager && typeof this.bleManager.destroy === 'function') {
      try {
        console.log('🧹 Cleaning up BLE manager...');
        this.bleManager.destroy();
        this.bleManager = null;
      } catch (error) {
        console.log('⚠️ Error destroying BLE manager:', error.message);
      }
    }
  }

  /**
   * Enable or disable auto-reconnection
   */
  setAutoReconnect(enabled) {
    this.autoReconnect = enabled;
    if (enabled) {
      this.reconnectAttempts = 0; // Reset attempts when re-enabling
      console.log('🔄 Auto-reconnection enabled');
    } else {
      console.log('🚫 Auto-reconnection disabled');
    }
  }

  /**
   * Get current auto-reconnection status
   */
  getAutoReconnectStatus() {
    return {
      enabled: this.autoReconnect,
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    };
  }
}

export default DirectBLEScanner;
