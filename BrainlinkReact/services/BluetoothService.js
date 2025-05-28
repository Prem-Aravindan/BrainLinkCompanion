import { BleManager, Device, BleError, State } from 'react-native-ble-plx';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';
import { BLUETOOTH_CONFIG } from '../constants';
import ApiService from './ApiService';

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
    this.dataCharacteristic = null;
    this.authorizedHWIDs = [];
  }

  /**
   * Initialize Bluetooth service
   */
  async initialize() {
    if (this.isInitialized && this.manager) return true;

    try {
      // Create BLE manager
      this.manager = new BleManager();
      
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
    if (!this.isInitialized || !this.manager) {
      throw new Error('Bluetooth not initialized');
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
          // Check if device is a BrainLink device and authorized
          if (this.isBrainLinkDevice(device) && this.isDeviceAuthorized(device)) {
            const existingIndex = devices.findIndex(d => d.id === device.id);
            if (existingIndex >= 0) {
              devices[existingIndex] = device;
            } else {
              // Add HWID to device info for display
              const hwid = this.extractHWIDFromManufacturerData(device.manufacturerData);
              devices.push({
                ...device,
                hwid: hwid || 'Unknown'
              });
              console.log('Found authorized BrainLink device:', device.name, 'HWID:', hwid);
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
    if (!device.name) return false;
    
    return BLUETOOTH_CONFIG.DEVICE_NAMES.some(name => 
      device.name.toLowerCase().includes(name.toLowerCase())
    );
  }
  /**
   * Connect to a specific device
   */
  async connectToDevice(deviceId = null) {
    try {
      if (!this.manager) {
        throw new Error('Bluetooth manager not initialized');
      }

      let targetDevice = null;

      if (deviceId) {
        // Connect to specific device by ID
        const devices = await this.scanForDevices();
        targetDevice = devices.find(device => device.id === deviceId);
      } else {
        // Auto-connect to first available authorized BrainLink device
        const authorizedDevices = await this.scanForDevices();
        if (authorizedDevices.length === 0) {
          throw new Error('No authorized BrainLink devices found');
        }
        targetDevice = authorizedDevices[0];
      }

      if (!targetDevice) {
        throw new Error('Device not found or not authorized');
      }

      console.log('Connecting to device:', targetDevice.name, 'HWID:', targetDevice.hwid);

      // Connect to device
      const connectedDevice = await this.manager.connectToDevice(targetDevice.id);
      
      // Discover services and characteristics
      await connectedDevice.discoverAllServicesAndCharacteristics();
      
      // Find the data characteristic for BrainLink
      await this.setupDataCharacteristic(connectedDevice);

      this.isConnected = true;
      this.connectedDevice = connectedDevice;

      // Notify connection listeners
      this.notifyConnectionListeners(true, connectedDevice);

      return true;
    } catch (error) {
      console.error('Connection failed:', error);
      this.isConnected = false;
      this.connectedDevice = null;
      throw error;
    }
  }
  /**
   * Disconnect from current device
   */
  async disconnect() {
    try {
      if (this.connectedDevice && this.manager) {
        await this.manager.cancelDeviceConnection(this.connectedDevice.id);
      }
      
      this.isConnected = false;
      this.connectedDevice = null;
      this.dataBuffer = '';
      this.dataCharacteristic = null;

      // Notify connection listeners
      this.notifyConnectionListeners(false, null);

      return true;
    } catch (error) {
      console.error('Disconnect failed:', error);
      return false;
    }
  }

  /**
   * Handle incoming data from device
   */
  handleIncomingData(data) {
    try {
      // Convert base64 data to string (BLE data comes as base64)
      const decodedData = Buffer.from(data, 'base64').toString('utf-8');
      this.dataBuffer += decodedData;

      // Process complete packets (assuming newline-delimited data)
      const packets = this.dataBuffer.split('\n');
      this.dataBuffer = packets.pop() || ''; // Keep incomplete packet in buffer

      packets.forEach(packet => {
        if (packet.trim()) {
          this.notifyDataListeners(packet.trim());
        }
      });
    } catch (error) {
      console.error('Data processing failed:', error);
    }
  }

  /**
   * Send command to connected device
   */
  async sendCommand(command) {
    if (!this.isConnected || !this.dataCharacteristic) {
      throw new Error('No device connected or no data characteristic found');
    }

    try {
      // Convert command to base64 for BLE transmission
      const commandData = Buffer.from(command + '\n').toString('base64');
      await this.dataCharacteristic.writeWithResponse(commandData);
      return true;
    } catch (error) {
      console.error('Failed to send command:', error);
      throw error;
    }
  }

  /**
   * Start EEG data streaming
   */
  async startStreaming() {
    return await this.sendCommand(BLUETOOTH_CONFIG.COMMANDS.START_STREAM);
  }

  /**
   * Stop EEG data streaming
   */
  async stopStreaming() {
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
   * Notify data listeners
   */
  notifyDataListeners(data) {
    this.dataListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Data listener error:', error);
      }
    });
  }

  /**
   * Notify connection listeners
   */
  notifyConnectionListeners(connected, device) {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected, device);
      } catch (error) {
        console.error('Connection listener error:', error);
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
   * Check if Bluetooth is available
   */
  async isBluetoothAvailable() {
    try {
      if (!this.manager) {
        await this.initialize();
      }
      if (this.manager) {
        const state = await this.manager.state();
        return state === State.PoweredOn;
      }
      return false;
    } catch (error) {
      return false;
    }
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
        console.log('No user token, skipping device authorization check');
        return false;
      }

      const result = await ApiService.getUserDevices();
      if (result.success) {
        this.authorizedHWIDs = result.devices.map(device => device.hwid);
        console.log('Authorized HWIDs:', this.authorizedHWIDs);
        return true;
      } else {
        console.error('Failed to fetch authorized devices:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error fetching authorized devices:', error);
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
        // If no authorization list, allow any BrainLink device for testing
        return this.isBrainLinkDevice(device);
      }

      // Extract HWID from manufacturer data
      const hwid = this.extractHWIDFromManufacturerData(device.manufacturerData);
      if (!hwid) return false;

      // Check if HWID is in authorized list
      return this.authorizedHWIDs.includes(hwid);
    } catch (error) {
      console.error('Error checking device authorization:', error);
      return false;
    }
  }

  /**
   * Setup data characteristic for BrainLink device
   */
  async setupDataCharacteristic(connectedDevice) {
    try {
      const services = await connectedDevice.services();
      
      // BrainLink specific service UUIDs (these may need adjustment)
      const BRAINLINK_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
      const BRAINLINK_DATA_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
      
      // First try to find the known BrainLink service
      let targetService = services.find(service => 
        service.uuid.toLowerCase() === BRAINLINK_SERVICE_UUID.toLowerCase()
      );
      
      // If not found, look for any service with notifiable characteristics
      if (!targetService) {
        for (const service of services) {
          const characteristics = await service.characteristics();
          const notifiableChar = characteristics.find(char => 
            char.isNotifiable || char.isIndicatable
          );
          if (notifiableChar) {
            targetService = service;
            this.dataCharacteristic = notifiableChar;
            break;
          }
        }
      } else {
        // Found BrainLink service, get the data characteristic
        const characteristics = await targetService.characteristics();
        this.dataCharacteristic = characteristics.find(char => 
          char.uuid.toLowerCase() === BRAINLINK_DATA_CHAR_UUID.toLowerCase() ||
          char.isNotifiable || char.isIndicatable
        );
      }

      if (this.dataCharacteristic) {
        console.log('Setting up data monitoring on characteristic:', this.dataCharacteristic.uuid);
        
        // Start monitoring data
        this.dataCharacteristic.monitor((error, characteristic) => {
          if (error) {
            console.error('Data monitoring error:', error);
            return;
          }
          
          if (characteristic && characteristic.value) {
            this.handleIncomingData(characteristic.value);
          }
        });
        
        return true;
      } else {
        console.warn('No suitable data characteristic found');
        return false;
      }
    } catch (error) {
      console.error('Error setting up data characteristic:', error);
      return false;
    }
  }
}

// Create singleton instance
const bluetoothService = new BluetoothService();

export default bluetoothService;
