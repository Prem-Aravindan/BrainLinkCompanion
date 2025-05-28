// API Configuration
export const API_CONFIG = {
  ENDPOINTS: {
    EN_PROD: 'https://en.mindspeller.com/api/cas',
    NL_PROD: 'https://nl.mindspeller.com/api/cas',
    LOCAL: 'http://10.0.0.117:5000/api/cas',
  },
  DATA_URLS: {
    EN_PROD: 'https://en.mindspeller.com/api/cas/brainlink_data',
    NL_PROD: 'https://nl.mindspeller.com/api/cas/brainlink_data',
    LOCAL: 'http://10.0.0.117:5000/api/cas/brainlink_data',
  },
  LOGIN_URLS: {
    EN_PROD: 'https://en.mindspeller.com/api/cas/token/login',
    NL_PROD: 'https://nl.mindspeller.com/api/cas/token/login',
    LOCAL: 'http://10.0.0.117:5000/api/cas/token/login',
  },
};

// EEG Processing Constants
export const EEG_CONFIG = {
  SAMPLING_RATE: 256,
  WINDOW_SIZE: 256,
  OVERLAP_SIZE: 128,
  BANDS: {
    delta: [0.5, 4],
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
  chart: '#00ff00',
};

// Bluetooth Constants
export const BLUETOOTH_CONFIG = {
  SCAN_TIMEOUT: 10000, // 10 seconds
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  DEVICE_NAMES: ['brainlink', 'neurosky', 'ftdi', 'silabs', 'ch340'],
  DEFAULT_HWID: '5C3616346838',
  COMMANDS: {
    START_STREAM: 'START',
    STOP_STREAM: 'STOP',
    GET_INFO: 'INFO',
  },
};
