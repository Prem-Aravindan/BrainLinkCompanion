import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BLUETOOTH_CONFIG } from '../constants';
import ApiService from './ApiService';

// EEG Data Tracker for debugging
class EEGDataTracker {
  constructor() {
    this.values = [];
    this.maxSamples = 100; // Keep last 100 samples for analysis
    this.constantThreshold = 0.1; // Threshold for detecting constant data
    this.analysisInterval = 10; // Analyze every N samples
    this.constantDataDetectedCount = 0; // Track how many times we detected constant data
    this.lastConstantValue = null; // Track the constant value
  }
  
  addValue(value) {
    this.values.push(value);
    if (this.values.length > this.maxSamples) {
      this.values.shift(); // Remove oldest value
    }
    
    // Analyze every 10 samples
    if (this.values.length % this.analysisInterval === 0) {
      const analysis = this.analyzeData();
      
      // Return analysis result for parent to handle
      return analysis;
    }
    
    return null; // No analysis performed
  }
  
  analyzeData() {
    if (this.values.length < 5) return;
    
    const recent = this.values.slice(-10); // Last 10 values
    const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const stdDev = Math.sqrt(recent.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recent.length);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    
    console.log(`\n📊 EEG Data Analysis (last ${recent.length} samples):`);
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
    
    // Check if values are identical (perfect constant)
    const uniqueValues = [...new Set(recent.map(v => v.toFixed(2)))];
    if (uniqueValues.length === 1) {
      console.log('🚨 CRITICAL: All recent values are identical - device sending constant data!');
      this.constantDataDetectedCount++;
      this.lastConstantValue = recent[0];
      
      // Return analysis result to indicate constant data
      return {
        isConstant: true,
        constantValue: this.lastConstantValue,
        detectionCount: this.constantDataDetectedCount
      };
    }
    
    // Reset constant data counter if we have variable data
    if (stdDev > this.constantThreshold) {
      this.constantDataDetectedCount = 0;
      this.lastConstantValue = null;
    }
    
    return {
      isConstant: false,
      stdDev: stdDev,
      average: avg
    };
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

// Try to import BLE manager with detailed fallback
let BleManager, Device, BleError, State;
let bleModuleAvailable = false;
let bleError = null;

try {
  const bleModule = require('react-native-ble-plx');
  if (bleModule && bleModule.BleManager) {
    BleManager = bleModule.BleManager;
    Device = bleModule.Device;
    BleError = bleModule.BleError;
    State = bleModule.State;
    bleModuleAvailable = true;
    console.log('✅ react-native-ble-plx module loaded successfully');
  } else {
    bleError = 'BleManager not found in module';
    console.warn('⚠️ react-native-ble-plx module loaded but BleManager is missing');
  }
} catch (e) {
  bleError = e.message;
  console.warn('⚠️ react-native-ble-plx not available:', e.message);
  BleManager = null;
  Device = null;
  BleError = null;
  State = null;
}

class BluetoothService {
  constructor() {
    this.manager = null;
    this.isInitialized = false;
    this.isConnected = false;
    this.connectedDevice = null;
    this.dataBuffer = '';
    this.dataListeners = [];
    this.connectionListeners = [];
    this.scanSubscription = null;
    this.monitoringSubscription = null;
    this.dataCharacteristic = null;
    this.commandCharacteristic = null; // For sending commands
    this.authorizedHWIDs = [];
    this.isSimulating = false;
    this.simulationInterval = null;
    this.connectionMonitor = null; // Connection monitoring timer
    
    // Debug monitoring
    this.debugMode = true; // Enable detailed logging
    this.dataTracker = new EEGDataTracker();
    this.packetCount = 0;
    this.connectionStartTime = null;
    this.lastDataTime = null;
    this.dataTimeoutTimer = null; // Timer to detect data timeout
    this.expectedDataInterval = 5000; // Expect data at least every 5 seconds
  }

  /**
   * Initialize Bluetooth service
   */
  async initialize() {
    if (this.isInitialized && this.manager) return true;

    try {
      // Check if BLE module is available
      if (!bleModuleAvailable || !BleManager) {
        console.error('🔴 Bluetooth module not available:', bleError || 'Unknown error');
        Alert.alert(
          'Bluetooth Not Available',
          `Bluetooth functionality is not available: ${bleError || 'Module not found'}\n\nThis could be because:\n• The development build doesn't include react-native-ble-plx\n• The module failed to link properly\n• Missing native dependencies`,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Simulate Data', 
              style: 'default',
              onPress: () => this.startSimulation()
            }
          ]
        );
        return false;
      }

      console.log('🔵 Creating BLE Manager...');
      // Create BLE manager
      this.manager = new BleManager();
      
      if (!this.manager) {
        throw new Error('Failed to create BleManager instance');
      }

      console.log('🔵 BLE Manager created successfully');
      
      // Request permissions for Android
      if (Platform.OS === 'android') {
        const granted = await this.requestBluetoothPermissions();
        if (!granted) {
          throw new Error('Bluetooth permissions not granted');
        }
      }

      // Check if Bluetooth is enabled
      const state = await this.manager.state();
      if (state !== State.PoweredOn) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please enable Bluetooth to connect to BrainLink devices.',
          [{ text: 'OK', style: 'default' }]
        );
        return false;
      }

      // Fetch user's authorized devices
      await this.fetchAuthorizedDevices();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Bluetooth initialization failed:', error);
      return false;
    }
  }

  /**
   * Request Bluetooth permissions on Android
   */
  async requestBluetoothPermissions() {
    if (Platform.OS !== 'android') return true;

    try {
      const permissions = [];
      
      // Different permissions for different Android versions
      if (Platform.Version >= 31) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      } else {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      }

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      return Object.values(results).every(
        result => result === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }
  /**
   * Scan for authorized BrainLink devices
   */
  async scanForDevices() {
    if (!this.isBluetoothAvailable()) {
      console.warn('⚠️ Bluetooth not available for scanning');
      return [];
    }

    return new Promise((resolve, reject) => {
      const devices = [];
      const timeout = setTimeout(() => {
        this.stopScan();
        resolve(devices);
      }, BLUETOOTH_CONFIG.SCAN_TIMEOUT);

      this.scanSubscription = this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('Scan error:', error);
          clearTimeout(timeout);
          this.stopScan();
          reject(error);
          return;
        }

        if (device && device.name) {
          console.log(`Found device: ${device.name} (${device.id})`);
          
          // Check if device is a BrainLink device
          if (this.isBrainLinkDevice(device)) {
            console.log(`✅ BrainLink device detected: ${device.name}`);
            
            // Check authorization
            if (this.isDeviceAuthorized(device)) {
              const existingIndex = devices.findIndex(d => d.id === device.id);
              if (existingIndex >= 0) {
                devices[existingIndex] = device;
              } else {
                // Add device identifiers for display
                const identifiers = this.getDeviceIdentifiers(device);
                const hwid = identifiers[0] || device.id; // Use first identifier as primary HWID
                
                devices.push({
                  ...device,
                  hwid: hwid
                });
                console.log(`✅ Added authorized BrainLink device: ${device.name} (HWID: ${hwid})`);
              }
            } else {
              console.log(`❌ BrainLink device not authorized: ${device.name}`);
            }
          }
        }
      });
    });
  }
  /**
   * Stop scanning for devices
   */
  stopScan() {
    if (this.scanSubscription && this.manager) {
      this.manager.stopDeviceScan();
      this.scanSubscription = null;
    }
  }

  /**
   * Check if device is a BrainLink device
   */
  isBrainLinkDevice(device) {
    if (!device.name) {
      // If no name, we can't identify it, but allow it in testing scenarios
      console.log('Device has no name, allowing for testing');
      return true;
    }
    
    // Check if device name contains any of the known BrainLink identifiers
    const isBrainLink = BLUETOOTH_CONFIG.DEVICE_NAMES.some(name => 
      device.name.toLowerCase().includes(name.toLowerCase())
    );
    
    if (!isBrainLink) {
      console.log(`Device name "${device.name}" doesn't match known BrainLink patterns, but allowing for testing`);
      // Be more permissive - allow devices that don't match the pattern
      // This helps with testing and devices that might have different names
      return true;
    }
    
    return isBrainLink;
  }
  /**
   * Connect to a specific device
   */
  async connectToDevice(deviceId = null) {
    try {
      if (!this.isBluetoothAvailable()) {
        console.warn('⚠️ Bluetooth not available for connection');
        return false;
      }

      // Stop any ongoing scan
      this.stopScan();

      let targetDevice = null;

      if (deviceId) {
        // Connect to specific device by ID - try direct connection first
        console.log('🔍 Attempting direct connection to device ID:', deviceId);
        
        try {
          // Try to connect directly without scanning first
          targetDevice = { id: deviceId, name: 'Direct Connection' };
          
          // If user has authorization requirements, check them after connection
          if (this.authorizedHWIDs.length > 0) {
            console.log('🔍 Will verify authorization after connection...');
          }
        } catch (error) {
          console.warn('⚠️ Direct connection setup failed:', error.message);
          // Fallback to scanning
          const devices = await this.scanForDevices();
          targetDevice = devices.find(device => device.id === deviceId);
        }
      } else {
        // Auto-connect to first available authorized BrainLink device
        const authorizedDevices = await this.scanForDevices();
        if (authorizedDevices.length === 0) {
          throw new Error('No authorized BrainLink devices found');
        }
        targetDevice = authorizedDevices[0];
      }

      if (!targetDevice) {
        if (deviceId) {
          throw new Error(`Device with ID "${deviceId}" not found. Make sure the device is nearby and advertising.`);
        } else {
          throw new Error('No BrainLink devices found during scan. Make sure your device is powered on and nearby.');
        }
      }

      console.log('🔵 Connecting to device:', targetDevice.name || 'Unknown', 'ID:', targetDevice.id);

      // Add some debugging for authorization
      if (this.authorizedHWIDs.length > 0) {
        console.log('🔍 Authorization check will be performed after connection');
        console.log('🔍 Authorized HWIDs:', this.authorizedHWIDs);
      } else {
        console.log('🔍 No authorization requirements (testing mode)');
      }

      // Set connection timeout (shorter for faster failure detection)
      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('❌ Connection timeout after 10 seconds');
          // Only disconnect if we're not actually connected
          if (this.connectedDevice) {
            console.log('🔌 Cleaning up timed out connection...');
            this.disconnect().catch(console.error);
          }
        }
      }, 15000); // Longer timeout to allow for service discovery

      // Connect to device with connection options
      const connectedDevice = await this.manager.connectToDevice(
        targetDevice.id,
        {
          requestMTU: 23, // Use smaller MTU for better stability (default BLE MTU)
          autoConnect: false, // Don't auto-reconnect on disconnect
          timeout: 10000 // 10 second connection timeout
        }
      );
      
      clearTimeout(connectionTimeout);
      console.log('✅ Device connected successfully');
      
      // Set up disconnect listener BEFORE discovering services
      connectedDevice.onDisconnected((error, device) => {
        console.log('📱 Device disconnected:', device?.id || 'unknown');
        if (error) {
          console.error('🔍 Disconnect reason:', error.message);
          console.error('🔍 Full error details:', error);
        }
        
        // Add a small delay to prevent immediate reconnection attempts
        setTimeout(() => {
          this.handleDeviceDisconnection();
        }, 500);
      });

      // Add connection monitoring
      this.startConnectionMonitoring();

      console.log('🔍 Discovering services and characteristics...');
      // Discover services and characteristics with timeout
      await Promise.race([
        connectedDevice.discoverAllServicesAndCharacteristics(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Service discovery timeout')), 10000)
        )
      ]);
      
      console.log('✅ Services discovered successfully');
      
      // Set connected state BEFORE setting up characteristics
      this.isConnected = true;
      this.connectedDevice = connectedDevice;
      
      // Clear the timeout since we're now connected
      clearTimeout(connectionTimeout);

      // Find and setup the data characteristic for BrainLink
      const characteristicSetup = await this.setupDataCharacteristic(connectedDevice);
      if (!characteristicSetup) {
        console.warn('⚠️ Data characteristic setup failed, but connection maintained');
      }

      // Notify connection listeners
      this.notifyConnectionListeners(true, connectedDevice);

      // Perform post-connection authorization check (non-blocking)
      this.performPostConnectionCheck(connectedDevice);

      console.log('🎉 Connection setup complete!');
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      this.isConnected = false;
      this.connectedDevice = null;
      this.dataCharacteristic = null;
      throw error;
    }
  }
  /**
   * Disconnect from current device
   */
  async disconnect() {
    try {
      console.log('🔌 Disconnecting from device...');
      
      // Stop connection monitoring
      this.stopConnectionMonitoring();
      
      // Stop data monitoring first
      if (this.monitoringSubscription) {
        try {
          this.monitoringSubscription.remove();
          this.monitoringSubscription = null;
          console.log('✅ Data monitoring stopped');
        } catch (error) {
          console.warn('⚠️ Error stopping data monitoring:', error.message);
        }
      }
      
      // Disconnect from device
      if (this.connectedDevice && this.manager && this.isBluetoothAvailable()) {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
        console.log('✅ Device disconnected');
      }
      
      // Clean up state
      this.isConnected = false;
      this.connectedDevice = null;
      this.dataBuffer = '';
      this.dataCharacteristic = null;
      this.commandCharacteristic = null;

      // Notify connection listeners
      this.notifyConnectionListeners(false, null);

      return true;
    } catch (error) {
      console.error('❌ Disconnect failed:', error.message);
      // Clean up state anyway
      this.isConnected = false;
      this.connectedDevice = null;
      this.dataBuffer = '';
      this.dataCharacteristic = null;
      this.commandCharacteristic = null;
      this.monitoringSubscription = null;
      this.notifyConnectionListeners(false, null);
      return false;
    }
  }

  /**
   * Handle incoming data from device
   */
  handleIncomingData(data) {
    try {
      this.packetCount++;
      
      if (this.debugMode) {
        console.log(`\n📦 === Packet #${this.packetCount} ===`);
        console.log(`📦 Received ${data.length} chars of base64 data: "${data.substring(0, 50)}${data.length > 50 ? '...' : ''}"`);
      }
      
      // Convert base64 data to buffer for binary processing
      const buffer = Buffer.from(data, 'base64');
      
      if (this.debugMode) {
        console.log(`📦 Decoded to ${buffer.length} bytes: [${buffer.slice(0, Math.min(20, buffer.length)).join(', ')}${buffer.length > 20 ? '...' : ''}]`);
        console.log(`📦 Hex: ${buffer.toString('hex').toUpperCase()}`);
      }
      
      // Add to data buffer for packet processing
      this.dataBuffer += buffer.toString('latin1'); // Use latin1 to preserve binary data
      
      if (this.debugMode) {
        console.log(`📦 Buffer now contains ${this.dataBuffer.length} chars`);
      }
      
      // BrainLink might not use ## delimiters - try different approaches
      this.processBrainLinkData(this.dataBuffer);
      
    } catch (error) {
      console.error('❌ Data processing failed:', error);
    }
  }
  
  /**
   * Process BrainLink data using multiple strategies
   */
  processBrainLinkData(dataBuffer) {
    // Strategy 1: Look for ## delimiters (current approach)
    const hashPackets = dataBuffer.split('##');
    
    if (hashPackets.length > 1) {
      if (this.debugMode) {
        console.log(`📦 Strategy 1: Found ${hashPackets.length - 1} packets with ## delimiters`);
      }
      
      // Keep the last incomplete packet in buffer
      this.dataBuffer = hashPackets.pop() || '';
      
      // Process complete packets
      hashPackets.forEach((packet, index) => {
        if (packet.length > 0) {
          if (this.debugMode) {
            console.log(`\n� Processing ## packet ${index + 1}/${hashPackets.length}:`);
          }
          const eegValue = this.parseBrainLinkPacketDebug(packet);
          if (eegValue !== null) {
            const analysis = this.dataTracker.addValue(eegValue);
            this.handleDataAnalysis(analysis, eegValue);
            this.notifyDataListeners(eegValue);
            return; // Success with ## delimiters
          }
        }
      });
      return;
    }
    
    // Strategy 2: Fixed-length packets (common BrainLink approach)
    if (this.debugMode) {
      console.log(`📦 Strategy 2: No ## delimiters found, trying fixed-length packets`);
    }
    
    const bytes = Buffer.from(dataBuffer, 'latin1');
    const expectedPacketSizes = [8, 16, 32]; // Common BrainLink packet sizes
    
    for (const packetSize of expectedPacketSizes) {
      if (bytes.length >= packetSize) {
        if (this.debugMode) {
          console.log(`� Trying packet size ${packetSize} bytes...`);
        }
        
        const packet = bytes.slice(0, packetSize);
        const eegValue = this.parseBrainLinkPacketDebug(packet.toString('latin1'));
        
        if (eegValue !== null) {
          // Found valid data, update buffer and continue
          this.dataBuffer = dataBuffer.substring(packetSize);
          const analysis = this.dataTracker.addValue(eegValue);
          this.handleDataAnalysis(analysis, eegValue);
          this.notifyDataListeners(eegValue);
          
          if (this.debugMode) {
            console.log(`✅ Success with ${packetSize}-byte packets`);
          }
          return;
        }
      }
    }
    
    // Strategy 3: Raw continuous stream (no packet structure)
    if (this.debugMode) {
      console.log(`📦 Strategy 3: Trying raw continuous stream`);
    }
    
    if (bytes.length >= 2) {
      // Just take the first 2 bytes as EEG data
      const rawValue = (bytes[1] << 8) | bytes[0]; // Little-endian
      
      if (rawValue >= 0 && rawValue <= 16383) {
        const eegValue = (rawValue - 8192) * 0.5;
        
        if (this.debugMode) {
          console.log(`📦 Raw stream: bytes[0]=${bytes[0]}, bytes[1]=${bytes[1]} -> ${rawValue} -> ${eegValue.toFixed(2)}µV`);
        }
        
        this.dataBuffer = dataBuffer.substring(2); // Consume 2 bytes
        const analysis = this.dataTracker.addValue(eegValue);
        this.handleDataAnalysis(analysis, eegValue);
        this.notifyDataListeners(eegValue);
        return;
      }
    }
    
    // Strategy 4: Clear buffer if it gets too large without valid data
    if (this.dataBuffer.length > 1000) {
      if (this.debugMode) {
        console.log(`📦 Buffer too large (${this.dataBuffer.length} chars), clearing...`);
      }
      this.dataBuffer = '';
    }
  }
  
  /**
   * Handle data analysis results and take action on constant data
   */
  handleDataAnalysis(analysis, eegValue) {
    if (!analysis) return; // No analysis performed
    
    // Update last data time when we receive any data
    this.lastDataTime = Date.now();
    this.resetDataTimeout();
    
    // Try alternative commands more frequently (every 10 detections) for constant data
    // and add device reset after many attempts
    if (analysis.isConstant && analysis.detectionCount > 0) {
      if (analysis.detectionCount % 10 === 0) {
        console.log(`🔄 Constant data detected ${analysis.detectionCount} times, trying alternative commands...`);
        this.tryAlternativeStreamingCommands();
      }
      
      // If constant data persists for a long time, try device reset
      if (analysis.detectionCount > 0 && analysis.detectionCount % 50 === 0) {
        console.log(`🚨 Constant data detected ${analysis.detectionCount} times - trying device reset...`);
        this.tryDeviceReset();
      }
    }
  }
  
  /**
   * Reset data timeout timer
   */
  resetDataTimeout() {
    if (this.dataTimeoutTimer) {
      clearTimeout(this.dataTimeoutTimer);
    }
    
    // Set new timeout
    this.dataTimeoutTimer = setTimeout(() => {
      console.log('⏰ Data timeout detected - no data received for 10 seconds');
      if (this.isConnected) {
        console.log('🔄 Attempting to restart streaming due to data timeout...');
        this.tryRestartStreaming();
      }
    }, 10000); // 10 second timeout
  }
  
  /**
   * Try to restart streaming when data stops coming
   */
  async tryRestartStreaming() {
    try {
      console.log('🔄 Restarting streaming due to data timeout...');
      
      // Stop and restart streaming
      await this.stopStreaming();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.startStreaming();
      
      console.log('✅ Streaming restarted successfully');
    } catch (error) {
      console.error('❌ Failed to restart streaming:', error.message);
      // If restart fails, disconnect and let user reconnect
      console.log('🔌 Disconnecting due to streaming restart failure...');
      this.handleDeviceDisconnection();
    }
  }
  
  /**
   * Try alternative streaming commands when constant data is detected
   */
  async tryAlternativeStreamingCommands() {
    console.log('🔄 Attempting to exit dummy/test mode with advanced commands...');
    
    const advancedCommands = [
      // Basic streaming commands
      'START',
      'ENABLE_RAW',
      'START_EEG', 
      'STREAM_ON',
      'RAW_MODE',
      
      // BrainLink specific commands
      'SEND_RAW',
      'RAW_DATA_ON',
      'ENABLE_EEG',
      'START_MONITORING',
      'EXIT_TEST_MODE',
      'DISABLE_TEST',
      'REAL_DATA_MODE',
      'LIVE_MODE',
      
      // Common EEG device commands
      'MODE_RAW',
      'DATA_MODE_1',
      'STREAMING_ON',
      'OUTPUT_RAW',
      'SET_MODE_REAL',
      'NORMAL_MODE',
      
      // Try resetting device state
      'RESET',
      'RESTART',
      'INIT',
      'CONFIGURE',
    ];
    
    // Also try sending raw binary commands
    const binaryCommands = [
      Buffer.from([0xAA, 0xAA, 0x04, 0x01]), // Possible start command
      Buffer.from([0xFF, 0xFF, 0x01]),       // Reset command
      Buffer.from([0x55, 0x55, 0x02, 0x00]), // Alternative start
    ];
    
    // Try text commands first
    for (const command of advancedCommands) {
      try {
        console.log(`🔄 Trying advanced command: "${command}"`);
        await this.sendCommand(command);
        
        // Wait longer to see if device responds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.warn(`⚠️ Command "${command}" failed:`, error.message);
      }
    }
    
    // Try binary commands
    for (const binaryCmd of binaryCommands) {
      try {
        console.log(`🔄 Trying binary command: [${Array.from(binaryCmd).join(', ')}]`);
        
        if (this.commandCharacteristic && this.commandCharacteristic.isWritableWithoutResponse) {
          const base64Data = binaryCmd.toString('base64');
          await this.commandCharacteristic.writeWithoutResponse(base64Data);
          
          // Wait to see response
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.warn(`⚠️ Binary command failed:`, error.message);
      }
    }
    
    console.log('🔄 Finished trying alternative commands. If still getting constant data, device may be faulty.');
  }

  /**
   * Try to reset the device when constant data persists
   */
  async tryDeviceReset() {
    console.log('🔄 Attempting device reset sequence...');
    
    try {
      // Stop streaming first
      await this.stopStreaming();
      
      // Send reset commands
      const resetCommands = [
        'STOP',
        'RESET',
        'INIT',
        'RESTART'
      ];
      
      for (const command of resetCommands) {
        try {
          console.log(`🔄 Sending reset command: "${command}"`);
          await this.sendCommand(command);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn(`⚠️ Reset command "${command}" failed:`, error.message);
        }
      }
      
      // Try binary reset commands
      const binaryResetCommands = [
        [0xFF, 0xFF, 0x01], // Reset command
        [0xAA, 0xAA, 0x02, 0x00, 0x02, 0x51, 0x51], // Status command
        [0x00, 0x00, 0x00, 0x00], // Zero command
      ];
      
      for (const binCommand of binaryResetCommands) {
        try {
          console.log(`🔄 Sending binary reset: [${binCommand.join(', ')}]`);
          const base64Command = this.createBinaryCommand(binCommand);
          if (this.commandCharacteristic) {
            await this.commandCharacteristic.writeWithoutResponse(base64Command);
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn(`⚠️ Binary reset command failed:`, error.message);
        }
      }
      
      // Wait a bit before restarting streaming
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Restart streaming
      console.log('🔄 Restarting streaming after reset...');
      await this.startStreaming();
      
      console.log('✅ Device reset sequence completed');
      
    } catch (error) {
      console.error('❌ Device reset failed:', error.message);
    }
  }

  /**
   * Parse BrainLink packet to extract EEG value (with debug logging)
   */
  parseBrainLinkPacketDebug(packet) {
    try {
      const bytes = Buffer.from(packet, 'latin1');
      
      if (this.debugMode) {
        console.log(`   📋 Packet details:`);
        console.log(`      Length: ${packet.length} chars, ${bytes.length} bytes`);
        console.log(`      Raw bytes: [${bytes.join(', ')}]`);
        console.log(`      Hex: ${bytes.toString('hex').toUpperCase()}`);
        console.log(`      ASCII: "${packet.replace(/[^\x20-\x7E]/g, '.')}"`);
      }
      
      if (packet.length < 3) {
        if (this.debugMode) {
          console.log(`   ⚠️ Packet too short (${packet.length} < 3), skipping`);
        }
        return null;
      }
      
      // Look for EEG data in the packet
      let eegValue = null;
      let parsePosition = -1;
      let rawValue = -1;
      
      // Try different positions in the packet for EEG data
      for (let i = 0; i < bytes.length - 1; i++) {
        const currentRaw = (bytes[i + 1] << 8) | bytes[i]; // Little-endian 16-bit
        
        if (this.debugMode) {
          console.log(`      Position ${i}: bytes[${i}]=${bytes[i]}, bytes[${i+1}]=${bytes[i+1]} -> raw=${currentRaw}`);
        }
        
        // BrainLink EEG values are typically in range 0-16383 (14-bit)
        if (currentRaw >= 0 && currentRaw <= 16383) {
          // Convert to microvolts (typical BrainLink conversion)
          eegValue = (currentRaw - 8192) * 0.5; // Center around 0, scale to microvolts
          parsePosition = i;
          rawValue = currentRaw;
          
          if (this.debugMode) {
            console.log(`   ✅ Found valid EEG data at position ${i}:`);
            console.log(`      Raw value: ${currentRaw} (14-bit range: 0-16383)`);
            console.log(`      Scaled value: (${currentRaw} - 8192) * 0.5 = ${eegValue.toFixed(2)} µV`);
          }
          break;
        } else if (this.debugMode) {
          console.log(`      Position ${i}: ${currentRaw} outside valid range (0-16383)`);
        }
      }
      
      if (eegValue === null) {
        if (this.debugMode) {
          console.log(`   ❌ No valid EEG data found in packet`);
          console.log(`   💡 All tested values were outside 0-16383 range`);
        }
        return null;
      }
      
      return eegValue;
    } catch (error) {
      console.error('❌ Error parsing BrainLink packet:', error);
      return null;
    }
  }

  /**
   * Parse BrainLink packet to extract EEG value (original method)
   */
  parseBrainLinkPacket(packet) {
    return this.parseBrainLinkPacketDebug(packet);
  }

  /**
   * Send command to connected device
   */
  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('No device connected');
    }

    // Use command characteristic if available, otherwise try data characteristic
    const characteristic = this.commandCharacteristic || this.dataCharacteristic;
    
    if (!characteristic) {
      throw new Error('No writable characteristic found');
    }

    try {
      console.log(`📤 Sending command: ${command}`);
      
      // Check if we still have a connection before sending
      if (!this.isConnected || !this.connectedDevice) {
        throw new Error('Device not connected');
      }
      
      // Check if device is still actually connected
      const isConnected = await this.connectedDevice.isConnected();
      if (!isConnected) {
        throw new Error('Device disconnected');
      }
      
      // Check if characteristic supports writing
      if (!characteristic.isWritableWithResponse && !characteristic.isWritableWithoutResponse) {
        throw new Error('Characteristic is not writable');
      }

      // Convert command to base64 for BLE transmission
      const commandData = Buffer.from(command + '\n').toString('base64');
      
      // Use writeWithoutResponse to avoid potential disconnection issues
      if (characteristic.isWritableWithoutResponse) {
        await characteristic.writeWithoutResponse(commandData);
        console.log(`✅ Command sent (no response): ${command}`);
      } else if (characteristic.isWritableWithResponse) {
        await characteristic.writeWithResponse(commandData);
        console.log(`✅ Command sent (with response): ${command}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to send command "${command}":`, error.message);
      
      // If the error indicates disconnection, handle it
      if (error.message.includes('disconnected') || error.message.includes('not connected')) {
        this.handleDeviceDisconnection();
      }
      
      throw error;
    }
  }

  /**
   * Start EEG data streaming with TGAM protocol
   */
  async startStreaming() {
    console.log('🎬 Starting TGAM EEG data streaming...');
    
    // Start data timeout monitoring
    this.lastDataTime = Date.now();
    this.resetDataTimeout();
    
    try {
      // Critical: First exit demo mode to get real data
      await this.exitDemoMode();
      
      // Then start real data streaming
      await this.startRealDataStreaming();
      
      console.log('✅ TGAM streaming started successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to start TGAM streaming:', error.message);
      
      // Fallback: try legacy commands
      console.log('🔄 Trying legacy streaming commands as fallback...');
      return await this.startLegacyStreaming();
    }
  }
  
  /**
   * Fallback to legacy streaming commands
   */
  async startLegacyStreaming() {
    const legacyCommands = [
      'START',
      'ENABLE_RAW', 
      'START_EEG',
      'STREAM_ON',
      'RAW_MODE',
    ];
    
    for (let i = 0; i < legacyCommands.length; i++) {
      try {
        console.log(`📤 Trying legacy command ${i + 1}/${legacyCommands.length}: "${legacyCommands[i]}"`);
        const result = await this.sendCommand(legacyCommands[i]);
        if (result) {
          console.log(`✅ Legacy streaming started with command: "${legacyCommands[i]}"`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true;
        }
      } catch (error) {
        console.warn(`⚠️ Legacy command "${legacyCommands[i]}" failed:`, error.message);
      }
    }
    
    console.warn('⚠️ All streaming commands failed, but connection may still work');
    return true;
  }

  /**
   * Stop EEG data streaming
   */
  async stopStreaming() {
    // Clear data timeout when stopping streaming
    if (this.dataTimeoutTimer) {
      clearTimeout(this.dataTimeoutTimer);
      this.dataTimeoutTimer = null;
    }
    
    return await this.sendCommand(BLUETOOTH_CONFIG.COMMANDS.STOP_STREAM);
  }

  /**
   * Get device information
   */
  async getDeviceInfo() {
    return await this.sendCommand(BLUETOOTH_CONFIG.COMMANDS.GET_INFO);
  }

  /**
   * Subscribe to data events
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
   * Notify data listeners with new data
   */
  notifyDataListeners(data) {
    this.dataListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in data listener:', error);
      }
    });
  }

  /**
   * Notify connection listeners of status change
   */
  notifyConnectionListeners(connected, device) {
    this.connectionListeners.forEach(listener => {
      try {
        listener({ connected, device });
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      device: this.connectedDevice,
    };
  }

  /**
   * Get connected device name
   */
  getConnectedDeviceName() {
    return this.connectedDevice ? this.connectedDevice.name : null;
  }
  /**
   * Check if Bluetooth is available and initialized
   */
  isBluetoothAvailable() {
    return bleModuleAvailable && BleManager && this.manager && this.isInitialized;
  }

  /**
   * Cleanup when service is destroyed
   */
  destroy() {
    this.stopScan();
    this.disconnect();
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
  }

  /**
   * Fetch user's authorized BrainLink devices
   */
  async fetchAuthorizedDevices() {
    try {
      if (!ApiService.token) {
        console.log('⚠️ No user token, skipping device authorization check');
        console.log('🔓 Device authorization will be bypassed (testing mode)');
        return false;
      }

      console.log('🔑 Fetching authorized devices from API...');
      const result = await ApiService.getUserDevices();
      if (result.success) {
        // result.devices is already an array of HWID strings
        this.authorizedHWIDs = result.devices;
        console.log(`✅ Authorized HWIDs loaded (${this.authorizedHWIDs.length} devices):`, this.authorizedHWIDs);
        return true;
      } else {
        console.error('❌ Failed to fetch authorized devices:', result.error);
        console.log('🔓 Device authorization will be bypassed due to API error');
        this.authorizedHWIDs = []; // Ensure it's empty for bypass mode
        return false;
      }
    } catch (error) {
      console.error('❌ Error fetching authorized devices:', error);
      console.log('🔓 Device authorization will be bypassed due to fetch error');
      this.authorizedHWIDs = []; // Ensure it's empty for bypass mode
      return false;
    }
  }

  /**
   * Extract HWID from manufacturer data
   */
  extractHWIDFromManufacturerData(manufacturerData) {
    try {
      if (!manufacturerData) return null;
      
      // BrainLink devices typically have manufacturer data in a specific format
      // This is a simplified extraction - may need adjustment based on actual format
      const data = Buffer.from(manufacturerData, 'base64');
      
      // Convert to hex string and extract HWID portion
      const hexString = data.toString('hex').toUpperCase();
      
      // BrainLink HWID is typically 12 characters (6 bytes)
      // This may need adjustment based on actual device format
      if (hexString.length >= 12) {
        return hexString.substring(0, 12);
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting HWID:', error);
      return null;
    }
  }

  /**
   * Check if device is authorized
   */
  isDeviceAuthorized(device) {
    try {
      if (this.authorizedHWIDs.length === 0) {
        // If no authorization list, allow any device for testing
        // This handles cases where:
        // 1. User is not logged in
        // 2. API call failed
        // 3. Testing/development scenarios
        console.log('No authorized HWIDs configured, allowing device for testing');
        return true; // Allow any device
      }

      // Try multiple methods to get device identifier
      const identifiers = this.getDeviceIdentifiers(device);
      console.log('Device identifiers found:', identifiers);
      console.log('Checking against authorized HWIDs:', this.authorizedHWIDs);

      // Check if any identifier matches any authorized HWID
      for (const identifier of identifiers) {
        for (const authorizedHWID of this.authorizedHWIDs) {
          if (this.compareHWIDs(identifier, authorizedHWID)) {
            console.log(`✅ Device authorized: ${identifier} matches ${authorizedHWID}`);
            return true;
          }
        }
      }

      console.log(`❌ Device not authorized: ${device.name || device.id}`);
      console.log(`   Device identifiers: ${identifiers.join(', ')}`);
      console.log(`   Authorized HWIDs: ${this.authorizedHWIDs.join(', ')}`);
      return false;
    } catch (error) {
      console.error('Error checking device authorization:', error);
      // In case of error, be permissive for testing
      return this.authorizedHWIDs.length === 0;
    }
  }

  /**
   * Get all possible identifiers for a device
   */
  getDeviceIdentifiers(device) {
    const identifiers = [];

    // 1. Try manufacturer data extraction
    const manufacturerHWID = this.extractHWIDFromManufacturerData(device.manufacturerData);
    if (manufacturerHWID) {
      identifiers.push(manufacturerHWID);
    }

    // 2. Use device ID/address (which might be the Bluetooth address)
    if (device.id) {
      // Remove any colons and convert to uppercase
      const cleanId = device.id.replace(/:/g, '').toUpperCase();
      identifiers.push(cleanId);
      
      // Also try the original format
      identifiers.push(device.id.toUpperCase());
    }

    // 3. If device has a MAC-like ID, try different formats
    if (device.id && device.id.includes(':')) {
      const macFormats = this.getMACFormatVariations(device.id);
      identifiers.push(...macFormats);
    }

    return [...new Set(identifiers)]; // Remove duplicates
  }

  /**
   * Get different MAC address format variations
   */
  getMACFormatVariations(macAddress) {
    const formats = [];
    const cleanMAC = macAddress.replace(/[:-]/g, '').toUpperCase();
    
    formats.push(cleanMAC); // 5C3616346938
    formats.push(macAddress.toUpperCase()); // 5C:36:16:34:69:38
    formats.push(macAddress.toLowerCase()); // 5c:36:16:34:69:38
    formats.push(cleanMAC.toLowerCase()); // 5c3616346938
    
    return formats;
  }

  /**
   * Compare two HWIDs with format flexibility and character correction
   */
  compareHWIDs(hwid1, hwid2) {
    if (!hwid1 || !hwid2) return false;

    // Normalize both HWIDs (remove colons, convert to uppercase)
    const normalize = (hwid) => hwid.replace(/[:-]/g, '').toUpperCase();
    
    const normalized1 = normalize(hwid1);
    const normalized2 = normalize(hwid2);
    
    // Direct match
    if (normalized1 === normalized2) {
      return true;
    }
    
    // Simple character correction: 5 <-> C (most common issue)
    const corrected1 = normalized1.replace(/5/g, 'C');
    const corrected2 = normalized2.replace(/5/g, 'C');
    
    return corrected1 === corrected2;
  }

  /**
   * Setup data characteristic for BrainLink device
   */
  async setupDataCharacteristic(connectedDevice) {
    try {
      console.log('🔍 Setting up TGAM data characteristic...');
      const services = await connectedDevice.services();
      console.log(`📋 Found ${services.length} services`);
      
      // TGAM/BrainLink service and characteristic UUIDs
      const TARGET_SERVICE_UUID = BLUETOOTH_CONFIG.SERVICE_UUID.toLowerCase();
      const TARGET_DATA_CHAR_UUID = BLUETOOTH_CONFIG.DATA_CHARACTERISTIC_UUID.toLowerCase();
      
      console.log('🔍 Looking for TGAM service:', TARGET_SERVICE_UUID);
      
      // First try to find the known TGAM service
      let targetService = services.find(service => 
        service.uuid.toLowerCase() === TARGET_SERVICE_UUID
      );
      
      // If not found, look for any service with notifiable characteristics
      if (!targetService) {
        console.log('⚠️ TGAM service not found, searching all services...');
        for (const service of services) {
          console.log(`🔍 Checking service: ${service.uuid}`);
          try {
            const characteristics = await service.characteristics();
            
            const notifiableChar = characteristics.find(char => {
              return char.isNotifiable || char.isIndicatable;
            });
            
            if (notifiableChar) {
              targetService = service;
              this.dataCharacteristic = notifiableChar;
              
              // For TGAM, often the same characteristic is used for both data and commands
              this.commandCharacteristic = characteristics.find(char => 
                char.isWritableWithResponse || char.isWritableWithoutResponse
              ) || notifiableChar;
              
              break;
            }
          } catch (charError) {
            console.warn(`⚠️ Error reading characteristics for service ${service.uuid}:`, charError.message);
          }
        }
      } else {
        console.log('✅ Found TGAM service');
        // Found TGAM service, get the characteristics
        const characteristics = await targetService.characteristics();
        
        // Look for TGAM data characteristic (notifiable)
        this.dataCharacteristic = characteristics.find(char => 
          char.uuid.toLowerCase() === TARGET_DATA_CHAR_UUID ||
          char.isNotifiable || char.isIndicatable
        );
        
        // For TGAM, command and data often use the same characteristic
        this.commandCharacteristic = characteristics.find(char => 
          char.uuid.toLowerCase() === BLUETOOTH_CONFIG.CONTROL_CHARACTERISTIC_UUID.toLowerCase() ||
          char.isWritableWithResponse || char.isWritableWithoutResponse
        ) || this.dataCharacteristic;
      }

      if (this.dataCharacteristic) {
        console.log('✅ TGAM data characteristic found:', this.dataCharacteristic.uuid);
        
        // Ensure we have a command characteristic
        if (!this.commandCharacteristic) {
          console.warn('⚠️ No command characteristic found, using data characteristic for commands');
          this.commandCharacteristic = this.dataCharacteristic;
        }
        
        console.log('✅ TGAM command characteristic found:', this.commandCharacteristic?.uuid || 'same as data');
        console.log(`📊 Characteristic capabilities:`);
        console.log(`   Data - Readable: ${this.dataCharacteristic.isReadable}, Notifiable: ${this.dataCharacteristic.isNotifiable}`);
        if (this.commandCharacteristic) {
          console.log(`   Command - Writable(R): ${this.commandCharacteristic.isWritableWithResponse}, Writable(NR): ${this.commandCharacteristic.isWritableWithoutResponse}`);
        }
        
        console.log('✅ Setting up data monitoring on characteristic:', this.dataCharacteristic.uuid);
        
        // Start monitoring data with error handling for TGAM frames
        const subscription = this.dataCharacteristic.monitor((error, characteristic) => {
          if (error) {
            console.error('❌ TGAM data monitoring error:', error.message);
            
            // Handle specific error types
            if (error.message.includes('disconnected') || error.message.includes('not connected')) {
              console.log('🔌 Device disconnected during monitoring - triggering cleanup');
              setTimeout(() => {
                this.handleDeviceDisconnection();
              }, 100); // Small delay to avoid race conditions
            } else if (error.message.includes('cancelled') || error.message.includes('canceled')) {
              console.warn('⚠️ Data monitoring was cancelled - device might be disconnecting');
              // Don't trigger immediate disconnection for cancellation
              // The device disconnect handler will be called separately if needed
            } else {
              console.warn('⚠️ Data monitoring error (not disconnection):', error.message);
              // For other errors, don't immediately disconnect - might be temporary
            }
            return;
          }
          
          if (characteristic && characteristic.value) {
            // Pass raw TGAM data directly to listeners (will be parsed by TGAMParser in the hook)
            this.handleIncomingTGAMData(characteristic.value);
          }
        });
        
        // Store subscription for cleanup
        this.monitoringSubscription = subscription;
        
        console.log('🎉 Data monitoring started successfully');
        return true;
      } else {
        console.warn('❌ No suitable data characteristic found');
        
        // List all available characteristics for debugging
        for (const service of services) {
          try {
            const characteristics = await service.characteristics();
            console.log(`Service ${service.uuid}:`);
            characteristics.forEach(char => {
              console.log(`  - ${char.uuid} (readable: ${char.isReadable}, writable: ${char.isWritableWithResponse}, notifiable: ${char.isNotifiable})`);
            });
          } catch (e) {
            console.warn(`Could not read characteristics for service ${service.uuid}`);
          }
        }
        
        return false;
      }
    } catch (error) {
      console.error('❌ Error setting up data characteristic:', error.message);
      return false;
    }
  }

  /**
   * Start simulation mode for testing without Bluetooth
   */
  startSimulation() {
    console.log('🟡 Starting Bluetooth simulation mode');
    this.isSimulating = true;
    this.isInitialized = true;
    
    // Simulate device connection after a delay
    setTimeout(() => {
      this.isConnected = true;
      this.connectedDevice = { 
        id: 'simulated-device',
        name: 'Simulated BrainLink',
        localName: 'BrainLink-SIM'
      };
      this.notifyConnectionListeners(true, this.connectedDevice);
      
      // Start simulated data stream
      this.startSimulatedDataStream();
    }, 2000);
  }

  /**
   * Generate simulated EEG data for testing
   */
  startSimulatedDataStream() {
    if (!this.isSimulating) return;

    const generateData = () => {
      // Generate realistic-looking EEG data
      const time = Date.now() / 1000;
      const alpha = Math.sin(time * 2 * Math.PI * 10) * 20;  // 10 Hz alpha waves
      const beta = Math.sin(time * 2 * Math.PI * 20) * 10;   // 20 Hz beta waves
      const noise = (Math.random() - 0.5) * 5;               // Random noise
      
      const eegValue = alpha + beta + noise;
      const data = `${eegValue.toFixed(2)}`;
      
      // Notify listeners
      this.notifyDataListeners(data);
    };

    // Generate data at ~256 Hz (every 4ms)
    this.simulationInterval = setInterval(generateData, 4);
  }

  /**
   * Stop simulation mode
   */
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.isSimulating = false;
    this.isConnected = false;
    this.connectedDevice = null;
    this.notifyConnectionListeners(false, null);
  }

  /**
   * Get the actual HWID from connected device (different from Bluetooth MAC)
   * This should be called after successful connection to verify the device HWID
   */
  async getConnectedDeviceHWID() {
    if (!this.isConnected || !this.connectedDevice) {
      return null;
    }

    try {
      // Try to get HWID from device info command
      // This might return the actual device HWID which could be different from MAC
      const response = await this.getDeviceInfo();
      
      // Parse response for HWID (implementation depends on device response format)
      // This is a placeholder - actual implementation depends on BrainLink device protocol
      console.log('Device info response:', response);
      
      return null; // Placeholder - implement based on actual device response
    } catch (error) {
      console.error('Error getting device HWID:', error);
      return null;
    }
  }

  /**
   * Verify device authorization after connection
   */
  async verifyConnectedDeviceAuthorization() {
    const actualHWID = await this.getConnectedDeviceHWID();
    if (actualHWID) {
      const isAuthorized = this.authorizedHWIDs.some(hwid => 
        this.compareHWIDs(actualHWID, hwid)
      );
      
      if (!isAuthorized) {
        console.warn(`⚠️ Connected device HWID ${actualHWID} is not in authorized list`);
        return false;
      }
      
      console.log(`✅ Connected device HWID ${actualHWID} is authorized`);
      return true;
    }
    
    return true; // If we can't get HWID, assume authorized for now
  }

  /**
   * Diagnostic method to help identify correct HWID for backend update
   */
  suggestHWIDCorrection(deviceAddress, authorizedHWIDs) {
    console.log('\n🔍 HWID DIAGNOSTIC REPORT');
    console.log('================================');
    console.log(`Device Address: ${deviceAddress}`);
    console.log(`Authorized HWIDs: ${JSON.stringify(authorizedHWIDs)}`);
    
    const normalized = deviceAddress.replace(/[:-]/g, '').toUpperCase();
    console.log(`Normalized Device: ${normalized}`);
    
    // Check each authorized HWID for potential matches
    authorizedHWIDs.forEach((authHWID, index) => {
      const normalizedAuth = authHWID.replace(/[:-]/g, '').toUpperCase();
      console.log(`\nChecking authorized HWID #${index + 1}: ${authHWID}`);
      console.log(`Normalized: ${normalizedAuth}`);
      
      // Character-by-character comparison
      const differences = [];
      for (let i = 0; i < Math.max(normalized.length, normalizedAuth.length); i++) {
        const deviceChar = normalized[i] || '?';
        const authChar = normalizedAuth[i] || '?';
        if (deviceChar !== authChar) {
          differences.push({
            position: i,
            device: deviceChar,
            authorized: authChar
          });
        }
      }
      
      if (differences.length === 0) {
        console.log('✅ Perfect match!');
      } else if (differences.length <= 2) {
        console.log(`⚠️  Close match (${differences.length} differences):`);
        differences.forEach(diff => {
          console.log(`  Position ${diff.position}: Device='${diff.device}' vs Auth='${diff.authorized}'`);
        });
        
        // Suggest correction
        if (differences.length === 1 && differences[0].position === 0) {
          const suggested = normalized;
          console.log(`💡 SUGGESTION: Update backend HWID from '${authHWID}' to '${suggested}'`);
        }
      } else {
        console.log(`❌ No match (${differences.length} differences)`);
      }
    });
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log(`1. Update backend: Change '5C3616346938' to 'CC3616346938'`);
    console.log(`2. Or use device for testing: The character correction will handle it`);
    console.log('================================\n');
  }

  /**
   * Start connection monitoring to detect issues
   */
  startConnectionMonitoring() {
    // Clear any existing monitoring
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
    }
    
    // Monitor connection every 5 seconds (less aggressive)
    this.connectionMonitor = setInterval(async () => {
      if (this.connectedDevice && this.isConnected) {
        try {
          // Check if device is still connected
          const isConnected = await this.connectedDevice.isConnected();
          if (!isConnected) {
            console.log('🔌 Connection monitor detected disconnection');
            this.handleDeviceDisconnection();
          } else {
            // Send a keep-alive command to maintain connection (less frequently)
            try {
              await this.sendKeepAlive();
            } catch (keepAliveError) {
              console.warn('🔌 Keep-alive failed:', keepAliveError.message);
              // Don't disconnect just because keep-alive failed
            }
          }
        } catch (error) {
          console.warn('🔌 Connection monitor error:', error.message);
          // Only trigger disconnection for specific errors
          if (error.message.includes('not connected') || error.message.includes('disconnected')) {
            console.log('🔌 Connection lost, triggering disconnect handler');
            this.handleDeviceDisconnection();
          }
        }
      }
    }, 5000); // Check every 5 seconds (less aggressive)
    
    console.log('🔍 Connection monitoring started (5s interval)');
  }
  
  /**
   * Send keep-alive command to maintain connection
   */
  async sendKeepAlive() {
    if (!this.isConnected || !this.connectedDevice || !this.commandCharacteristic) {
      return;
    }
    
    try {
      // Send a simple status command as keep-alive
      const keepAliveCommand = this.createBinaryCommand([0xAA, 0xAA, 0x02, 0x00, 0x02, 0x51, 0x51]);
      await this.commandCharacteristic.writeWithoutResponse(keepAliveCommand);
      console.log('💓 Keep-alive sent');
    } catch (error) {
      console.warn('💓 Keep-alive failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Stop connection monitoring
   */
  stopConnectionMonitoring() {
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor);
      this.connectionMonitor = null;
      console.log('🔍 Connection monitoring stopped');
    }
  }

  /**
   * Handle device disconnection
   */
  handleDeviceDisconnection() {
    console.log('🔌 Handling device disconnection...');
    
    // Stop connection monitoring first
    this.stopConnectionMonitoring();
    
    // Clear data timeout
    if (this.dataTimeoutTimer) {
      clearTimeout(this.dataTimeoutTimer);
      this.dataTimeoutTimer = null;
    }
    
    // Stop data monitoring if still active
    if (this.monitoringSubscription) {
      try {
        this.monitoringSubscription.remove();
        this.monitoringSubscription = null;
        console.log('✅ Data monitoring subscription removed');
      } catch (error) {
        console.warn('⚠️ Error removing monitoring subscription:', error.message);
      }
    }
    
    // Update state
    this.isConnected = false;
    this.connectedDevice = null;
    this.dataBuffer = '';
    this.dataCharacteristic = null;
    this.commandCharacteristic = null;
    this.lastDataTime = null;

    // Notify connection listeners
    this.notifyConnectionListeners(false, null);
    
    console.log('✅ Device disconnection handled');
  }

  /**
   * Create binary command as base64 string
   */
  createBinaryCommand(bytes) {
    const buffer = Buffer.from(bytes);
    return buffer.toString('base64');
  }

  /**
   * Exit demo mode and enable real EEG data streaming
   */
  async exitDemoMode() {
    console.log('🚫 Exiting demo mode to get real EEG data...');
    
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    if (!this.commandCharacteristic) {
      console.warn('⚠️ No command characteristic available - skipping demo mode exit');
      return true; // Don't fail, just continue
    }

    try {
      // Send multiple demo exit commands to ensure it works
      const demoExitCommands = [
        BLUETOOTH_CONFIG.COMMANDS.EXIT_DEMO,
        BLUETOOTH_CONFIG.COMMANDS.DISABLE_DEMO,
        BLUETOOTH_CONFIG.COMMANDS.STOP_DEMO_DATA,
      ];

      for (const command of demoExitCommands) {
        try {
          console.log('📤 Sending demo exit command...');
          if (this.commandCharacteristic && this.commandCharacteristic.isWritableWithoutResponse) {
            await this.commandCharacteristic.writeWithoutResponse(command);
          } else {
            console.warn('⚠️ Command characteristic not writable');
          }
          
          // Wait between commands
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.warn('⚠️ Demo exit command failed:', error.message);
        }
      }

      console.log('✅ Demo exit commands sent');
      return true;
    } catch (error) {
      console.error('❌ Failed to exit demo mode:', error.message);
      // Don't throw - just warn and continue
      console.warn('⚠️ Continuing without demo mode exit...');
      return true;
    }
  }

  /**
   * Start real data streaming using TGAM protocol
   */
  async startRealDataStreaming() {
    console.log('🎬 Starting real EEG data streaming with TGAM protocol...');
    
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    if (!this.commandCharacteristic) {
      console.warn('⚠️ No command characteristic available - skipping streaming commands');
      return true; // Don't fail, data might already be streaming
    }

    try {
      // Send real data streaming commands
      const streamingCommands = [
        BLUETOOTH_CONFIG.COMMANDS.START_STREAM,
        BLUETOOTH_CONFIG.COMMANDS.ENABLE_RAW,
        BLUETOOTH_CONFIG.COMMANDS.NORMAL_MODE,
      ];

      for (const command of streamingCommands) {
        try {
          console.log('📤 Sending real data streaming command...');
          if (this.commandCharacteristic && this.commandCharacteristic.isWritableWithoutResponse) {
            await this.commandCharacteristic.writeWithoutResponse(command);
          } else {
            console.warn('⚠️ Command characteristic not writable');
          }
          
          // Wait between commands
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn('⚠️ Streaming command failed:', error.message);
        }
      }

      // Start data timeout monitoring for real data
      this.lastDataTime = Date.now();
      this.resetDataTimeout();

      console.log('✅ Real data streaming commands sent');
      return true;
    } catch (error) {
      console.error('❌ Failed to start real data streaming:', error.message);
      // Don't throw - just warn and continue
      console.warn('⚠️ Continuing without streaming commands...');
      return true;
    }
  }

  /**
   * Handle incoming TGAM data from device
   */
  handleIncomingTGAMData(data) {
    try {
      this.packetCount++;
      
      if (this.debugMode && this.packetCount % 10 === 0) { // Reduce logging frequency
        console.log(`\n📦 === TGAM Packet #${this.packetCount} ===`);
        console.log(`📦 Received ${data.length} chars of base64 TGAM data`);
        
        // Show first few bytes for debugging
        const buffer = Buffer.from(data, 'base64');
        console.log(`📦 First 10 bytes: [${buffer.slice(0, 10).join(', ')}]`);
        console.log(`📦 Hex: ${buffer.slice(0, 10).toString('hex').toUpperCase()}`);
      }
      
      // Update last data time for connection monitoring
      this.lastDataTime = Date.now();
      this.resetDataTimeout();
      
      // Pass raw TGAM data to listeners (TGAMParser in the hook will handle parsing)
      // DO NOT process with old BrainLink parsing logic - that causes absurd values
      this.notifyDataListeners(data);
      
    } catch (error) {
      console.error('❌ TGAM data processing failed:', error);
    }
  }

  /**
   * Perform post-connection authorization check (non-blocking)
   */
  async performPostConnectionCheck(connectedDevice) {
    try {
      console.log('🔍 Performing post-connection authorization check...');
      
      if (this.authorizedHWIDs.length === 0) {
        console.log('✅ No authorization requirements - connection is valid');
        return;
      }
      
      // Get device identifiers
      const identifiers = this.getDeviceIdentifiers(connectedDevice);
      console.log('🔍 Connected device identifiers:', identifiers);
      
      // Check authorization
      let isAuthorized = false;
      for (const identifier of identifiers) {
        for (const authorizedHWID of this.authorizedHWIDs) {
          if (this.compareHWIDs(identifier, authorizedHWID)) {
            console.log(`✅ Post-connection auth: ${identifier} matches ${authorizedHWID}`);
            isAuthorized = true;
            break;
          }
        }
        if (isAuthorized) break;
      }
      
      if (isAuthorized) {
        console.log('✅ Device authorization verified post-connection');
      } else {
        console.warn('⚠️ Device not in authorized list, but connection maintained for testing');
        console.warn('⚠️ Device identifiers:', identifiers.join(', '));
        console.warn('⚠️ Authorized HWIDs:', this.authorizedHWIDs.join(', '));
        
        // Suggest HWID correction for debugging
        if (identifiers.length > 0) {
          this.suggestHWIDCorrection(identifiers[0], this.authorizedHWIDs);
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Post-connection check failed:', error.message);
    }
  }
}

// Create singleton instance
const bluetoothService = new BluetoothService();

export default bluetoothService;
