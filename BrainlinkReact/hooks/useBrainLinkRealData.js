/**
 * React Hook for BrainLink Real-time EEG Data
 * Provides live EEG data from BrainLink device using TGAM protocol
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import BluetoothService from '../services/BluetoothService';
import { TGAMParser } from '../utils/TGAMParser';

/**
 * Custom hook for real-time BrainLink EEG data
 * @returns {Object} Live EEG data and connection state
 */
export const useBrainLinkRealData = () => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // EEG data state
  const [eegData, setEegData] = useState({
    attention: 0,
    meditation: 0,
    delta: 0,
    theta: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
    rawEEG: 0,
    heartRate: 0,
    poorSignal: 100, // Start with poor signal
    timestamp: null,
  });

  // Data quality metrics
  const [dataQuality, setDataQuality] = useState({
    signalStrength: 0, // 0-100, where 100 is best
    framesPerSecond: 0,
    lastUpdateTime: null,
    totalFrames: 0,
    frameErrors: 0,
  });

  // Internal refs
  const tgamParser = useRef(new TGAMParser());
  const dataSubscription = useRef(null);
  const connectionSubscription = useRef(null);
  const fpsCounter = useRef({ frames: 0, lastReset: Date.now() });

  /**
   * Handle parsed TGAM frame data
   */
  const handleTGAMFrame = useCallback((frameData) => {
    const convertedData = TGAMParser.convertToEEGFormat(frameData);
    
    // Update EEG data state
    setEegData(prevData => ({
      ...prevData,
      attention: convertedData.attention,
      meditation: convertedData.meditation,
      rawEEG: convertedData.rawEEG,
      heartRate: convertedData.heartRate,
      poorSignal: convertedData.poorSignal,
      timestamp: convertedData.timestamp,
      // Update band powers if available
      ...(convertedData.bandPowers && {
        delta: convertedData.bandPowers.delta,
        theta: convertedData.bandPowers.theta,
        alpha: convertedData.bandPowers.alpha,
        beta: convertedData.bandPowers.beta,
        gamma: convertedData.bandPowers.gamma,
      }),
    }));

    // Update data quality metrics
    const now = Date.now();
    fpsCounter.current.frames++;
    
    // Calculate FPS every second
    if (now - fpsCounter.current.lastReset >= 1000) {
      const fps = fpsCounter.current.frames;
      fpsCounter.current.frames = 0;
      fpsCounter.current.lastReset = now;
      
      setDataQuality(prevQuality => ({
        ...prevQuality,
        framesPerSecond: fps,
        lastUpdateTime: now,
        totalFrames: prevQuality.totalFrames + fps,
        signalStrength: Math.max(0, 100 - (convertedData.poorSignal || 100)),
      }));
    }

    console.log('🧠 Real-time EEG data:', {
      attention: convertedData.attention,
      meditation: convertedData.meditation,
      rawEEG: convertedData.rawEEG,
      signalQuality: 100 - (convertedData.poorSignal || 100),
    });
  }, []);

  /**
   * Handle connection status changes
   */
  const handleConnectionChange = useCallback((connected, device) => {
    setIsConnected(connected);
    setIsConnecting(false);
    setDeviceName(connected ? device?.name : null);
    
    if (!connected) {
      // Reset data when disconnected
      setEegData({
        attention: 0,
        meditation: 0,
        delta: 0,
        theta: 0,
        alpha: 0,
        beta: 0,
        gamma: 0,
        rawEEG: 0,
        heartRate: 0,
        poorSignal: 100,
        timestamp: null,
      });
      
      setDataQuality({
        signalStrength: 0,
        framesPerSecond: 0,
        lastUpdateTime: null,
        totalFrames: 0,
        frameErrors: 0,
      });
      
      // Reset parser
      tgamParser.current.reset();
      fpsCounter.current = { frames: 0, lastReset: Date.now() };
    }
  }, []);

  /**
   * Connect to BrainLink device and start real data streaming
   */
  const connect = useCallback(async (deviceId = null) => {
    if (isConnecting || isConnected) {
      console.warn('⚠️ Already connecting or connected');
      return false;
    }

    try {
      setIsConnecting(true);
      setConnectionError(null);

      console.log('🔗 Connecting to BrainLink device...');
      if (deviceId) {
        console.log('🔗 Target device ID:', deviceId);
      }
      
      // Initialize Bluetooth service
      console.log('🔧 Initializing Bluetooth service...');
      const initialized = await BluetoothService.initialize();
      if (!initialized) {
        throw new Error('Bluetooth service initialization failed');
      }
      console.log('✅ Bluetooth service initialized');

      // Connect to device
      console.log('🔌 Connecting to device...');
      const connected = await BluetoothService.connectToDevice(deviceId);
      if (!connected) {
        throw new Error('Failed to connect to device');
      }
      console.log('✅ Device connected successfully');

      console.log('🚫 Exiting demo mode and starting real data...');
      
      try {
        // Critical: Exit demo mode to get real data
        await BluetoothService.exitDemoMode();
        console.log('✅ Demo mode exit completed');
      } catch (demoError) {
        console.warn('⚠️ Demo mode exit failed:', demoError.message);
        // Continue anyway - might not be in demo mode
      }
      
      try {
        // Start real data streaming
        await BluetoothService.startRealDataStreaming();
        console.log('✅ Real data streaming started');
      } catch (streamError) {
        console.warn('⚠️ Real data streaming failed:', streamError.message);
        // Continue anyway - basic connection might still work
      }

      console.log('🎉 Connection process completed successfully');
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        deviceId: deviceId,
      });
      setConnectionError(error.message);
      setIsConnecting(false);
      return false;
    }
  }, [isConnecting, isConnected]);

  /**
   * Disconnect from device
   */
  const disconnect = useCallback(async () => {
    try {
      console.log('🔌 Disconnecting from device...');
      await BluetoothService.disconnect();
      return true;
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
      return false;
    }
  }, []);

  /**
   * Start EEG data recording/streaming
   */
  const startRecording = useCallback(async () => {
    try {
      console.log('🎬 Starting EEG recording...');
      await BluetoothService.startStreaming();
      return true;
    } catch (error) {
      console.error('❌ Start recording failed:', error);
      throw error;
    }
  }, []);

  /**
   * Stop EEG data recording/streaming
   */
  const stopRecording = useCallback(async () => {
    try {
      console.log('⏹️ Stopping EEG recording...');
      await BluetoothService.stopStreaming();
      return true;
    } catch (error) {
      console.error('❌ Stop recording failed:', error);
      throw error;
    }
  }, []);

  /**
   * Reconnect to the last connected device
   */
  const reconnect = useCallback(async () => {
    try {
      console.log('🔄 Reconnecting to device...');
      await BluetoothService.connectToDevice();
      return true;
    } catch (error) {
      console.error('❌ Reconnect failed:', error);
      return false;
    }
  }, []);

  /**
   * Scan for available BrainLink devices
   */
  const scanForDevices = useCallback(async () => {
    try {
      console.log('🔍 Scanning for BrainLink devices...');
      const devices = await BluetoothService.scanForDevices();
      return devices;
    } catch (error) {
      console.error('❌ Scan failed:', error);
      return [];
    }
  }, []);

  // Setup effect
  useEffect(() => {
    // Subscribe to TGAM frames
    const unsubscribeTGAM = tgamParser.current.onFrame(handleTGAMFrame);

    // Subscribe to Bluetooth data (raw bytes)
    dataSubscription.current = BluetoothService.onDataReceived((data) => {
      // Feed raw data to TGAM parser
      tgamParser.current.addData(data);
    });

    // Subscribe to connection status
    connectionSubscription.current = BluetoothService.onConnectionChanged(handleConnectionChange);

    // Cleanup function
    return () => {
      if (unsubscribeTGAM) unsubscribeTGAM();
      if (dataSubscription.current) dataSubscription.current();
      if (connectionSubscription.current) connectionSubscription.current();
      
      // Disconnect on unmount
      BluetoothService.disconnect().catch(console.error);
    };
  }, [handleTGAMFrame, handleConnectionChange]);

  // Return hook interface
  return {
    // Connection state
    isConnected,
    isConnecting,
    deviceName,
    connectionError,
    
    // EEG data object
    eegData,
    dataQuality,
    
    // EEG data - individual properties
    attention: eegData.attention,
    meditation: eegData.meditation,
    delta: eegData.delta,
    theta: eegData.theta,
    alpha: eegData.alpha,
    beta: eegData.beta,
    gamma: eegData.gamma,
    rawEEG: eegData.rawEEG,
    heartRate: eegData.heartRate,
    poorSignal: eegData.poorSignal,
    
    // Data quality
    signalStrength: dataQuality.signalStrength,
    framesPerSecond: dataQuality.framesPerSecond,
    lastUpdateTime: dataQuality.lastUpdateTime,
    
    // Control methods
    connect,
    disconnect,
    reconnect,
    scanForDevices,
    startRecording,
    stopRecording,
    
    // Recording state
    isRecording: isConnected, // For now, assume recording when connected
    
    // Parser stats (for debugging)
    getParserStats: () => tgamParser.current.getStats(),
  };
};
