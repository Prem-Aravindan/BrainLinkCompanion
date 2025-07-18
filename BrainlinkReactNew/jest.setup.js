// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// Mock react-native-svg
jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  G: 'G',
  Path: 'Path',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}));

// Mock react-native-ble-plx
jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn(),
  Device: jest.fn(),
  BleError: jest.fn(),
  State: jest.fn(),
}));

// Mock buffer
global.Buffer = require('buffer').Buffer;

// Mock NativeModules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  RN.NativeModules.BrainLinkModule = {
    initializeMacrotellectLink: jest.fn(() => Promise.resolve()),
    connectToDevice: jest.fn(() => Promise.resolve()),
    disconnectDevice: jest.fn(() => Promise.resolve()),
    startDataCollection: jest.fn(() => Promise.resolve()),
    stopDataCollection: jest.fn(() => Promise.resolve()),
    getConnectionStatus: jest.fn(() => Promise.resolve('disconnected')),
  };
  
  RN.NativeEventEmitter = jest.fn(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  }));
  
  return RN;
});
