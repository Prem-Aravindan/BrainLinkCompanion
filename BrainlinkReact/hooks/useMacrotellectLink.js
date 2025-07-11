/**
 * React Hook for MacrotellectLink BrainLink Integration
 * Updated to work with the official MacrotellectLink SDK V1.4.3
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import MacrotellectLinkService from '../services/MacrotellectLinkService';

export const useMacrotellectLink = () => {
  // Connection state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // EEG data state
  const [eegData, setEegData] = useState({
    timestamp: null,
    signal: 0,
    attention: 0,
    meditation: 0,
    delta: 0,
    theta: 0,
    lowAlpha: 0,
    highAlpha: 0,
    lowBeta: 0,
    highBeta: 0,
    lowGamma: 0,
    middleGamma: 0,
    appreciation: 0,
    batteryCapacity: 0,
    heartRate: 0,
    temperature: 0
  });

  // Additional data states
  const [rawData, setRawData] = useState(null);
  const [gravityData, setGravityData] = useState({ x: 0, y: 0, z: 0 });
  const [rrData, setRRData] = useState({ rrIntervals: [], oxygenPercentage: 0 });

  // Error handling
  const [lastError, setLastError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for subscriptions
  const subscriptionsRef = useRef([]);

  // Calculate band powers and derived metrics
  const bandPowers = useCallback(() => {
    const { delta, theta, lowAlpha, highAlpha, lowBeta, highBeta, lowGamma, middleGamma } = eegData;
    
    const alpha = lowAlpha + highAlpha;
    const beta = lowBeta + highBeta;
    const gamma = lowGamma + middleGamma;
    const total = delta + theta + alpha + beta + gamma;
    
    return {
      delta,
      theta,
      alpha,
      beta,
      gamma,
      total,
      // Percentages
      deltaPercent: total > 0 ? (delta / total) * 100 : 0,
      thetaPercent: total > 0 ? (theta / total) * 100 : 0,
      alphaPercent: total > 0 ? (alpha / total) * 100 : 0,
      betaPercent: total > 0 ? (beta / total) * 100 : 0,
      gammaPercent: total > 0 ? (gamma / total) * 100 : 0,
    };
  }, [eegData]);

  // Signal quality assessment
  const signalQuality = useCallback(() => {
    const { signal } = eegData;
    
    if (signal === 0) return { level: 'excellent', percentage: 100, description: 'Perfect contact' };
    if (signal < 50) return { level: 'good', percentage: 80, description: 'Good contact' };
    if (signal < 100) return { level: 'fair', percentage: 60, description: 'Fair contact' };
    if (signal < 150) return { level: 'poor', percentage: 40, description: 'Poor contact' };
    if (signal < 200) return { level: 'very_poor', percentage: 20, description: 'Very poor contact' };
    return { level: 'no_contact', percentage: 0, description: 'No contact detected' };
  }, [eegData.signal]);

  // Mental states derived from EEG data
  const mentalStates = useCallback(() => {
    const { attention, meditation } = eegData;
    const bands = bandPowers();
    
    return {
      attention: attention,
      meditation: meditation,
      focus: attention > 60 ? 'high' : attention > 40 ? 'medium' : 'low',
      relaxation: meditation > 60 ? 'high' : meditation > 40 ? 'medium' : 'low',
      alertness: bands.betaPercent > 30 ? 'high' : bands.betaPercent > 20 ? 'medium' : 'low',
      drowsiness: bands.deltaPercent > 40 ? 'high' : bands.deltaPercent > 25 ? 'medium' : 'low'
    };
  }, [eegData.attention, eegData.meditation, bandPowers]);

  // Initialize the SDK
  const initialize = useCallback(async () => {
    if (isInitialized) return true;

    setIsLoading(true);
    setLastError(null);

    try {
      await MacrotellectLinkService.initialize();
      setIsInitialized(true);
      console.log('✅ MacrotellectLink SDK initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize SDK:', error);
      setLastError(error.message);
      Alert.alert('Initialization Error', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Start scanning for devices
  const startScan = useCallback(async () => {
    if (!isInitialized) {
      const initialized = await initialize();
      if (!initialized) return false;
    }

    setIsLoading(true);
    setLastError(null);

    try {
      await MacrotellectLinkService.startScan();
      setIsScanning(true);
      console.log('✅ Device scan started');
      return true;
    } catch (error) {
      console.error('❌ Failed to start scan:', error);
      setLastError(error.message);
      Alert.alert('Scan Error', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, initialize]);

  // Stop scanning
  const stopScan = useCallback(async () => {
    setIsLoading(true);

    try {
      await MacrotellectLinkService.stopScan();
      setIsScanning(false);
      console.log('✅ Device scan stopped');
      return true;
    } catch (error) {
      console.error('❌ Failed to stop scan:', error);
      setLastError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect to device (MacrotellectLink auto-connects via scan)
  const connect = useCallback(async (deviceId = null) => {
    if (!isInitialized) {
      const initialized = await initialize();
      if (!initialized) return false;
    }

    setIsLoading(true);
    setLastError(null);

    try {
      await MacrotellectLinkService.connectToDevice(deviceId);
      console.log('✅ Connection request sent');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      setLastError(error.message);
      Alert.alert('Connection Error', error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, initialize]);

  // Disconnect from device
  const disconnect = useCallback(async () => {
    setIsLoading(true);

    try {
      await MacrotellectLinkService.disconnect();
      console.log('✅ Disconnection requested');
      return true;
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      setLastError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    const setupListeners = () => {
      console.log('🔧 Setting up MacrotellectLink event listeners...');

      // Connection state changes
      const connectionSub = MacrotellectLinkService.onConnectionChange((data) => {
        console.log('🔄 Connection change:', data);
        setConnectionStatus(data.status);
        
        switch (data.status) {
          case 'connected':
            setIsConnected(true);
            setIsScanning(false);
            setConnectedDevice({
              id: data.deviceId,
              name: data.deviceName || 'BrainLink Device',
              isBLE: data.isBLE || false
            });
            break;
          case 'disconnected':
          case 'failed':
            setIsConnected(false);
            setConnectedDevice(null);
            setIsScanning(false);
            break;
          case 'connecting':
            setIsConnected(false);
            setIsScanning(false);
            break;
        }
      });

      // EEG data
      const eegSub = MacrotellectLinkService.onEEGData((data) => {
        setEegData({
          timestamp: data.timestamp,
          signal: data.signal || 0,
          attention: data.attention || 0,
          meditation: data.meditation || 0,
          delta: data.delta || 0,
          theta: data.theta || 0,
          lowAlpha: data.lowAlpha || 0,
          highAlpha: data.highAlpha || 0,
          lowBeta: data.lowBeta || 0,
          highBeta: data.highBeta || 0,
          lowGamma: data.lowGamma || 0,
          middleGamma: data.middleGamma || 0,
          appreciation: data.appreciation || 0,
          batteryCapacity: data.batteryCapacity || 0,
          heartRate: data.heartRate || 0,
          temperature: data.temperature || 0
        });
      });

      // Raw data
      const rawSub = MacrotellectLinkService.onRawData((data) => {
        setRawData(data.rawData);
      });

      // Gravity data (BrainLink Pro only)
      const gravitySub = MacrotellectLinkService.onGravityData((data) => {
        setGravityData({
          x: data.x || 0,
          y: data.y || 0,
          z: data.z || 0
        });
      });

      // Heart rate and blood oxygen
      const rrSub = MacrotellectLinkService.onRRData((data) => {
        setRRData({
          rrIntervals: data.rrIntervals || [],
          oxygenPercentage: data.oxygenPercentage || 0
        });
      });

      // Error handling
      const errorSub = MacrotellectLinkService.onError((data) => {
        console.error('💥 MacrotellectLink Error:', data);
        setLastError(data.error);
        Alert.alert('BrainLink Error', data.error);
      });

      // Store subscriptions
      subscriptionsRef.current = [
        connectionSub,
        eegSub,
        rawSub,
        gravitySub,
        rrSub,
        errorSub
      ];
    };

    if (MacrotellectLinkService.isAvailable()) {
      setupListeners();
    } else {
      console.warn('⚠️ MacrotellectLink service not available');
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up MacrotellectLink listeners');
      subscriptionsRef.current.forEach(sub => {
        if (sub) MacrotellectLinkService.removeListener(sub);
      });
      subscriptionsRef.current = [];
    };
  }, []);

  // Auto-initialize when hook is first used
  useEffect(() => {
    if (MacrotellectLinkService.isAvailable() && !isInitialized && !isLoading) {
      initialize();
    }
  }, [initialize, isInitialized, isLoading]);

  return {
    // Connection state
    isInitialized,
    isScanning,
    isConnected,
    connectedDevice,
    connectionStatus,
    
    // Data
    eegData,
    rawData,
    gravityData,
    rrData,
    
    // Derived metrics
    bandPowers: bandPowers(),
    signalQuality: signalQuality(),
    mentalStates: mentalStates(),
    
    // Actions
    initialize,
    startScan,
    stopScan,
    connect,
    disconnect,
    
    // Status
    isLoading,
    lastError,
    isAvailable: MacrotellectLinkService.isAvailable(),
    
    // Utils
    clearError: () => setLastError(null)
  };
};
