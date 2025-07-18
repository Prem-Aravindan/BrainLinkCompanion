/**
 * Reactimport React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import MacrotellectLinkService from '../services/MacrotellectLinkService';
import { createEEGProcessor } from '../utils/eegProcessing';ok for MacrotellectLink SDK Integration
 * 
 * This hook provides a complete interface to the MacrotellectLink SDK
 * based on the official documentation. It handles:
 * 
 * - SDK initialization with proper whitelist configuration
 * - Automatic device scanning and connection
 * - Real-time EEG data processing (exits demo mode)
 * - Connection state management
 * - Error handling and logging
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import MacrotellectLinkService from '../services/MacrotellectLinkService';
import { createEEGProcessor } from '../utils/eegProcessing';

export const useMacrotellectLink = () => {
  // Connection state
  const [isInitialized, setIsInitialized] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // EEG data state - processed results using Python-matching pipeline
  const [eegData, setEegData] = useState({
    // Basic brainwave data (from MacrotellectLink)
    signal: 0,           // Signal quality (0 = good contact, 200 = no contact)
    attention: 0,        // att (Attention)
    meditation: 0,       // med (Relaxation)
    
    // Processed band powers (from our Python-matching processor)
    delta: 0,            // Delta power (0.5-4 Hz)
    theta: 0,            // Theta power (4-8 Hz)
    alpha: 0,            // Alpha power (8-12 Hz)
    beta: 0,             // Beta power (12-30 Hz)
    gamma: 0,            // Gamma power (30-45 Hz)
    
    // Advanced theta metrics (matches Python output)
    thetaContribution: 0, // Theta as % of total brain activity
    thetaRelative: 0,     // Theta relative (0-1 range)
    smoothedTheta: 0,     // Exponentially smoothed theta
    
    // Metadata
    timestamp: null,
    deviceMac: null
  });

  // Additional data states
  const [rawData, setRawData] = useState(null);
  const [gravityData, setGravityData] = useState({ x: 0, y: 0, z: 0 }); // BrainLink Pro only
  const [rrData, setRRData] = useState({ rrIntervals: [], oxygenPercentage: 0 }); // Heart rate data

  // Error and status
  const [lastError, setLastError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for cleanup and processing
  const subscriptionsRef = useRef([]);
  const eegProcessorRef = useRef(null);

  // Initialize EEG processor (matches Python implementation)
  useEffect(() => {
    eegProcessorRef.current = createEEGProcessor(512); // 512 Hz sampling rate
    console.log('🧠 EEG processor initialized with Python-matching pipeline');
  }, []);

  /**
   * Initialize MacrotellectLink SDK
   */
  const initializeSDK = useCallback(async () => {
    if (!MacrotellectLinkService.isAvailable()) {
      throw new Error('MacrotellectLink SDK is only available on Android');
    }

    setIsLoading(true);
    setLastError(null);

    try {
      console.log('🔧 Initializing MacrotellectLink SDK...');
      await MacrotellectLinkService.initialize();
      setIsInitialized(true);
      console.log('✅ MacrotellectLink SDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize MacrotellectLink SDK:', error);
      setLastError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Start scanning for BrainLink devices
   * This will automatically connect to whitelisted devices
   */
  const startScan = useCallback(async () => {
    if (!isInitialized) {
      await initializeSDK();
    }

    setIsLoading(true);
    setLastError(null);

    try {
      console.log('🔍 Starting device scan...');
      setIsScanning(true);
      await MacrotellectLinkService.startScan();
      console.log('✅ Device scan started - will auto-connect to BrainLink devices');
    } catch (error) {
      console.error('❌ Failed to start scan:', error);
      setLastError(error.message);
      setIsScanning(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, initializeSDK]);

  /**
   * Stop scanning
   */
  const stopScan = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await MacrotellectLinkService.stopScan();
      setIsScanning(false);
      console.log('⏹️ Device scan stopped');
    } catch (error) {
      console.error('❌ Failed to stop scan:', error);
      setLastError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Disconnect from devices
   */
  const disconnect = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await MacrotellectLinkService.disconnect();
      setIsConnected(false);
      setConnectedDevice(null);
      setConnectionStatus('disconnected');
      console.log('🔌 Disconnected from devices');
    } catch (error) {
      console.error('❌ Failed to disconnect:', error);
      setLastError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get connected devices
   */
  const getConnectedDevices = useCallback(async () => {
    try {
      const devices = await MacrotellectLinkService.getConnectedDevices();
      return devices;
    } catch (error) {
      console.error('❌ Failed to get connected devices:', error);
      return [];
    }
  }, []);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!MacrotellectLinkService.isAvailable()) {
      console.warn('⚠️ MacrotellectLink SDK not available on this platform');
      return;
    }

    console.log('🔧 Setting up MacrotellectLink event listeners...');

    // Poor contact quality listener
    const poorContactSub = MacrotellectLinkService.setupPoorContactListener((contactData) => {
      console.warn('📡 Poor contact detected:', contactData);
      setLastError(`Poor contact quality: ${contactData.contactQuality}% - Please adjust device positioning`);
      
      // Optionally show user notification
      if (contactData.contactQuality < 30) {
        Alert.alert(
          'Poor Contact Quality',
          `Contact quality is only ${contactData.contactQuality}%. Please adjust the device on your head for better signal quality.`,
          [{ text: 'OK' }]
        );
      }
    });

    // Connection status listener
    const connectionSub = MacrotellectLinkService.onConnectionChange((status, device) => {
      console.log(`📱 Connection status: ${status}`, device ? device.name : '');
      
      setConnectionStatus(status);
      
      switch (status) {
        case 'connected':
          setIsConnected(true);
          setConnectedDevice(device);
          setIsScanning(false);
          Alert.alert(
            'Device Connected', 
            `Successfully connected to ${device.name}\nMAC: ${device.mac}\n\nReal EEG data streaming will now begin.`,
            [{ text: 'OK' }]
          );
          break;
          
        case 'connecting':
          setIsConnected(false);
          setConnectedDevice(device);
          break;
          
        case 'disconnected':
          setIsConnected(false);
          setConnectedDevice(null);
          // Reset EEG data when disconnected
          setEegData(prev => ({
            ...prev,
            signal: 200, // No contact
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
            timestamp: Date.now()
          }));
          break;
      }
    });

    // EEG data listener - processes real MacrotellectLink BrainWave data
    const eegSub = MacrotellectLinkService.onEEGData((data) => {
      console.log('🧠 Real EEG data received from MacrotellectLink SDK');
      
      // Map basic MacrotellectLink BrainWave data to our state
      setEegData(prevData => ({
        ...prevData,
        // Core measurements
        signal: data.brainWave?.signal ?? 200,
        attention: data.brainWave?.att ?? 0,
        meditation: data.brainWave?.med ?? 0,
        
        // Metadata
        timestamp: Date.now(),
        deviceMac: data.mac
      }));
    });

    // Raw EEG data listener - processes with our Python-matching pipeline
    const rawSub = MacrotellectLinkService.onRawData((data) => {
      setRawData({
        value: data.raw,
        mac: data.mac,
        timestamp: Date.now()
      });
      
      // Process raw data with our corrected EEG processor
      if (eegProcessorRef.current && data.raw !== undefined) {
        try {
          // Add raw data to processor buffer (matches Python onRaw function)
          eegProcessorRef.current.addRawData(data.raw);
          
          // Process accumulated data (matches Python update_live_plot)
          const result = eegProcessorRef.current.processLiveData();
          
          if (result && result.thetaMetrics) {
            // Update EEG data with processed results (matches Python payload)
            setEegData(prevData => ({
              ...prevData,
              
              // Processed band powers (scaled to reasonable ranges like Python)
              delta: result.bandPowers.delta,
              theta: result.bandPowers.theta,
              alpha: result.bandPowers.alpha,
              beta: result.bandPowers.beta,
              gamma: result.bandPowers.gamma,
              
              // Main theta metrics (matches Python output)
              thetaContribution: result.thetaMetrics.thetaContribution,  // % of total brain activity
              thetaRelative: result.thetaMetrics.thetaRelative,          // 0-1 range
              smoothedTheta: result.thetaMetrics.smoothedTheta,          // Exponentially smoothed
              
              // Keep existing signal quality and timestamps
              timestamp: Date.now()
            }));
            
            // Log processed values (matches Python logging)
            if (Math.random() < 0.05) { // Log 5% of the time to reduce noise
              console.log(`🧠 Processed EEG - Delta: ${result.bandPowers.delta.toFixed(1)}, ` +
                         `Theta: ${result.bandPowers.theta.toFixed(1)}, ` +
                         `Theta contribution: ${result.thetaMetrics.thetaContribution.toFixed(1)}%`);
            }
          }
        } catch (error) {
          console.error('❌ EEG processing error:', error);
        }
      }
    });

    // Gravity data listener (BrainLink Pro only)
    const gravitySub = MacrotellectLinkService.onGravityData((data) => {
      if (data.gravity) {
        setGravityData({
          x: data.gravity.x ?? 0,  // Pitch angle
          y: data.gravity.y ?? 0,  // Yaw angle  
          z: data.gravity.z ?? 0,  // Roll angle
          mac: data.mac,
          timestamp: Date.now()
        });
      }
    });

    // RR interval and blood oxygen listener
    const rrSub = MacrotellectLinkService.onRRData((data) => {
      setRRData({
        rrIntervals: data.rr ?? [],
        oxygenPercentage: data.oxygen ?? 0,
        mac: data.mac,
        timestamp: Date.now()
      });
    });

    // Error listener
    const errorSub = MacrotellectLinkService.onError((error) => {
      console.error('💥 MacrotellectLink Error:', error);
      setLastError(error.message || 'Unknown MacrotellectLink error');
    });

    // Store subscriptions for cleanup
    subscriptionsRef.current = [
      poorContactSub,
      connectionSub,
      eegSub,
      rawSub,
      gravitySub,
      rrSub,
      errorSub
    ];

    // Auto-initialize if available
    if (MacrotellectLinkService.isAvailable()) {
      initializeSDK().catch(error => {
        console.error('Failed to auto-initialize MacrotellectLink SDK:', error);
      });
    }

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up MacrotellectLink subscriptions...');
      subscriptionsRef.current.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      subscriptionsRef.current = [];
    };
  }, [initializeSDK]);

  // Calculate derived metrics
  const signalQuality = eegData.signal === 0 ? 'Good' : 
                       eegData.signal < 100 ? 'Fair' : 'Poor';
  
  const isReceivingData = eegData.timestamp && 
                         (Date.now() - eegData.timestamp) < 5000; // Data within last 5 seconds

  return {
    // Connection state
    isInitialized,
    isScanning,
    isConnected,
    connectedDevice,
    connectionStatus,
    signalQuality,
    isReceivingData,
    
    // Data
    eegData,
    rawData,
    gravityData,
    rrData,
    
    // Status
    isLoading,
    lastError,
    
    // Actions
    initializeSDK,
    startScan,
    stopScan,
    disconnect,
    getConnectedDevices,
    
    // Utilities
    clearError: () => setLastError(null)
  };
};
