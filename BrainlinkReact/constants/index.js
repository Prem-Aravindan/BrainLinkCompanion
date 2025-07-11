// API Configuration
export const API_CONFIG = {
  ENDPOINTS: {
    EN_PROD: 'https://en.mindspeller.com/api/cas',
    NL_PROD: 'https://stg-nl.mindspell.be/api/cas',
    LOCAL: 'http://10.0.0.117:5000/api/cas',
  },
  DATA_URLS: {
    EN_PROD: 'https://en.mindspeller.com/api/cas/brainlink_data',
    NL_PROD: 'https://stg-nl.mindspell.be/api/cas/brainlink_data',
    LOCAL: 'http://10.0.0.117:5000/api/cas/brainlink_data',
  },
  LOGIN_URLS: {
    EN_PROD: 'https://en.mindspeller.com/api/cas/token/login',
    NL_PROD: 'https://stg-nl.mindspell.be/api/cas/token/login',
    LOCAL: 'http://10.0.0.117:5000/api/cas/token/login',
  },
};

// EEG Processing Constants (matches Python BrainCompanion_updated.py)
export const EEG_CONFIG = {
  SAMPLING_RATE: 512,  // FS = 512 in Python
  WINDOW_SIZE: 512,    // WINDOW_SIZE = 512 in Python
  OVERLAP_SIZE: 128,   // OVERLAP_SIZE = 128 in Python
  BANDS: {
    delta: [0.5, 4],   // Matches Python EEG_BANDS
    theta: [4, 8],
    alpha: [8, 12],
    beta: [12, 30],
    gamma: [30, 45],
  },
  FREQUENCY_BANDS: {
    DELTA: { min: 0.5, max: 4 },
    THETA: { min: 4, max: 8 },
    ALPHA: { min: 8, max: 12 },
    BETA: { min: 12, max: 30 },
    GAMMA: { min: 30, max: 45 },
  },
};

// UI Constants
export const COLORS = {
  primary: '#7878e9',
  secondary: '#0A00FF',
  background: '#7878e9',
  white: '#ffffff',
  text: '#333333',
  disabled: '#a0a0a0',
  success: '#4CAF50',
  error: '#f44336',
  warning: '#FF9800',
  chart: '#00ff00',
  lightGray: '#f5f5f5',
};

// Bluetooth Constants
export const BLUETOOTH_CONFIG = {
  SCAN_TIMEOUT: 10000, // 10 seconds
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  DEVICE_NAMES: ['brainlink', 'neurosky', 'ftdi', 'silabs', 'ch340'],
  DEFAULT_HWID: '5C3616346838',
  
  // BLE Service and Characteristics UUIDs for BrainLink/NeuroSky TGAM
  SERVICE_UUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
  DATA_CHARACTERISTIC_UUID: '0000ffe1-0000-1000-8000-00805f9b34fb',
  CONTROL_CHARACTERISTIC_UUID: '0000ffe1-0000-1000-8000-00805f9b34fb', // Same for BrainLink
  
  // TGAM Protocol Commands (as base64 strings for React Native compatibility)
  COMMANDS: {
    // Demo mode exit commands (critical for getting real data)
    EXIT_DEMO: 'qqqCAD4=', // [0xAA, 0xAA, 0x02, 0xC0, 0x00, 0x3E]
    DISABLE_DEMO: 'qqqDwAEAPQ==', // [0xAA, 0xAA, 0x03, 0xC0, 0x01, 0x00, 0x3D]
    STOP_DEMO_DATA: 'qqqCwQA9', // [0xAA, 0xAA, 0x02, 0xC1, 0x00, 0x3D]
    
    // Real data streaming commands
    START_STREAM: 'qqqCwgA8', // [0xAA, 0xAA, 0x02, 0xC2, 0x00, 0x3C]
    ENABLE_RAW: 'qqqCwwA7', // [0xAA, 0xAA, 0x02, 0xC3, 0x00, 0x3B]
    NORMAL_MODE: 'qqqCxAA6', // [0xAA, 0xAA, 0x02, 0xC4, 0x00, 0x3A]
    
    // Legacy text commands (fallback)
    STOP_STREAM: 'STOP',
    GET_INFO: 'INFO',
    START_EEG: 'START_EEG', 
    STREAM_ON: 'STREAM_ON',
    RAW_MODE: 'RAW_MODE',
  },
  
  // TGAM Frame Structure
  TGAM: {
    SYNC_BYTE: 0xAA,
    HEADER: [0xAA, 0xAA],
    
    // Data types in TGAM packets
    DATA_TYPES: {
      POOR_SIGNAL: 0x02,
      ATTENTION: 0x04,
      MEDITATION: 0x05,
      RAW_EEG: 0x80,
      EEG_POWER: 0x83,
      HEART_RATE: 0x03,
      
      // EEG Power bands (sub-types of EEG_POWER)
      DELTA: 0x01,
      THETA: 0x02, 
      LOW_ALPHA: 0x03,
      HIGH_ALPHA: 0x04,
      LOW_BETA: 0x05,
      HIGH_BETA: 0x06,
      LOW_GAMMA: 0x07,
      MID_GAMMA: 0x08,
    },
    
    MIN_PACKET_LENGTH: 4, // Minimum: [0xAA, 0xAA, length, checksum]
    MAX_PACKET_LENGTH: 170, // Maximum valid packet length
  },
};
