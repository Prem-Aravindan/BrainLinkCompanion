import { useState, useEffect, useCallback } from 'react';
import BrainLinkNativeService from '../services/BrainLinkNativeService';

/**
 * React Hook for BrainLink Native SDK Integration
 * 
 * This hook provides a clean interface to the MacrotellectLink SDK
 * through the native module bridge. It handles:
 * - SDK initialization
 * - Device scanning and connection
 * - Real-time EEG data streaming
 * - Connection state management
 * - Error handling
 */
export const useBrainLinkNative = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Device state
  const [availableDevices, setAvailableDevices] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);
  
  // EEG Data state
  const [eegData, setEegData] = useState({
    attention: 0,
    meditation: 0,
    rawEEG: 0,
    signalQuality: 0,
    heartRate: 0,
    bandPowers: {
      delta: 0,
      theta: 0,
      alpha: 0,
      beta: 0,
      gamma: 0
    },
    timestamp: Date.now()
  });

  const [dataQuality, setDataQuality] = useState(0);
  const [isReceivingData, setIsReceivingData] = useState(false);

  // Initialize SDK on mount
  useEffect(() => {
    initializeSDK();
    return () => {
      cleanup();
    };
  }, []);

  const initializeSDK = async () => {
    try {
      console.log('🔧 Initializing BrainLink Native SDK...');
      
      if (!BrainLinkNativeService.isAvailable()) {
        setConnectionError('BrainLink SDK is only available on Android');
        return;
      }

      await BrainLinkNativeService.initialize();
      
      // Setup data listener
      BrainLinkNativeService.addDataListener(handleEEGData);
      
      // Setup connection listener
      BrainLinkNativeService.addConnectionListener(handleConnectionState);

      console.log('✅ BrainLink SDK initialized successfully');
      setConnectionError(null);
      
    } catch (error) {
      console.error('❌ Failed to initialize BrainLink SDK:', error);
      setConnectionError(error.message);
    }
  };

  const handleEEGData = useCallback((data) => {
    console.log('📊 Received EEG data:', data);
    
    setIsReceivingData(true);
    
    // Update EEG data based on data type from the actual MacrotellectLink SDK
    switch (data.type) {
      case 'brainwave':
        // Full brainwave data from the BrainWave object
        setEegData(prev => ({
          ...prev,
          attention: data.attention || 0,
          meditation: data.meditation || 0,
          signalQuality: data.signal || 0,
          heartRate: data.heartRate || 0,
          temperature: data.temperature || 0,
          batteryCapacity: data.batteryCapacity || 0,
          appreciation: data.appreciation || 0,
          bandPowers: {
            delta: data.delta || 0,
            theta: data.theta || 0,
            lowAlpha: data.lowAlpha || 0,
            highAlpha: data.highAlpha || 0,
            lowBeta: data.lowBeta || 0,
            highBeta: data.highBeta || 0,
            lowGamma: data.lowGamma || 0,
            middleGamma: data.middleGamma || 0
          },
          timestamp: data.timestamp,
          deviceMac: data.deviceMac
        }));
        
        // Update data quality based on signal strength
        setDataQuality(data.signal || 0);
        break;
        
      case 'raw':
        setEegData(prev => ({
          ...prev,
          rawEEG: data.rawEEG,
          timestamp: data.timestamp,
          deviceMac: data.deviceMac
        }));
        break;
        
      case 'gravity':
        // Gravity data (3-axis accelerometer)
        setEegData(prev => ({
          ...prev,
          gravity: {
            x: data.x, // Pitching angle
            y: data.y, // Yaw angle
            z: data.z  // Roll angle
          },
          timestamp: data.timestamp,
          deviceMac: data.deviceMac
        }));
        break;
        
      case 'rr_oxygen':
        // RR intervals and blood oxygen data
        setEegData(prev => ({
          ...prev,
          rrIntervals: data.rrIntervals,
          oxygenPercentage: data.oxygenPercentage,
          timestamp: data.timestamp,
          deviceMac: data.deviceMac
        }));
        break;
        
      default:
        console.log('🔍 Unknown data type:', data.type, data);
    }
  }, []);

  const handleConnectionState = useCallback((connectionState) => {
    console.log('🔗 Connection state changed:', connectionState);
    
    setIsConnected(connectionState.isConnected);
    setIsConnecting(connectionState.isConnecting);
    setConnectedDevice(connectionState.device);
    
    if (connectionState.error) {
      setConnectionError(connectionState.error);
    } else {
      setConnectionError(null);
    }

    // Reset data receiving state if disconnected
    if (!connectionState.isConnected) {
      setIsReceivingData(false);
    }
  }, []);

  const startScan = async () => {
    try {
      console.log('🔍 Starting device scan...');
      setIsScanning(true);
      setConnectionError(null);
      
      const devices = await BrainLinkNativeService.startScan();
      setAvailableDevices(devices || []);
      
    } catch (error) {
      console.error('❌ Failed to start scan:', error);
      setConnectionError(error.message);
      setIsScanning(false);
    }
  };

  const stopScan = async () => {
    try {
      console.log('⏹️ Stopping device scan...');
      await BrainLinkNativeService.stopScan();
      setIsScanning(false);
      
    } catch (error) {
      console.error('❌ Failed to stop scan:', error);
      setConnectionError(error.message);
    }
  };

  const connectToDevice = async (deviceMac) => {
    try {
      console.log(`🔗 Connecting to device: ${deviceMac}`);
      setIsConnecting(true);
      setConnectionError(null);
      
      await BrainLinkNativeService.connectToDevice(deviceMac);
      
    } catch (error) {
      console.error('❌ Failed to connect to device:', error);
      setConnectionError(error.message);
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      console.log('🔌 Disconnecting from device...');
      setIsConnecting(false);
      
      await BrainLinkNativeService.disconnect();
      
      // Reset state
      setConnectedDevice(null);
      setIsReceivingData(false);
      
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      setConnectionError(error.message);
    }
  };

  const cleanup = async () => {
    try {
      if (isConnected) {
        await disconnect();
      }
      if (isScanning) {
        await stopScan();
      }
      
      BrainLinkNativeService.removeAllListeners();
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  };

  return {
    // Connection state
    isConnected,
    isConnecting,
    isScanning,
    connectionError,
    
    // Device state
    availableDevices,
    connectedDevice,
    
    // EEG data
    eegData,
    dataQuality,
    isReceivingData,
    
    // Actions
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    
    // Utility
    isSDKAvailable: BrainLinkNativeService.isAvailable()
  };
};
