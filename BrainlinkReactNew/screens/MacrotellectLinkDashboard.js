/**
 * MacrotellectLink Dashboard Screen - SDK-Only Mode
 * 
 * This screen uses ONLY the official MacrotellectLink SDK to:
 * - Receive real EEG data through SDK only
 * - Display comprehensive brainwave metrics
 * - Show device connection status
 * - Provide user-friendly controls
 * - No fallback to DirectBLE or demo mode
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  DeviceEventEmitter
} from 'react-native';
import { useMacrotellectLink } from '../hooks/useMacrotellectLink';
import { BandPowerDisplay } from '../components/BandPowerDisplay';
import EEGChart from '../components/EEGChart';
import MacrotellectLinkService from '../services/MacrotellectLinkService';
import MacrotellectLinkSDKTest from './MacrotellectLinkSDKTest';

export const MacrotellectLinkDashboard = ({ user, onLogout }) => {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard' or 'sdk-test'

  // Helper function to safely convert values to numbers
  const getSafeNumericValue = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return (isNaN(parsed) || !isFinite(parsed)) ? 0 : parsed;
    }
    if (typeof value === 'number') {
      return (isNaN(value) || !isFinite(value)) ? 0 : value;
    }
    return 0;
  };

  // SDK state
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const [sdkError, setSdkError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [eegData, setEegData] = useState({});
  const [lastDataTime, setLastDataTime] = useState(null);
  
  // Detailed EEG data state for direct native events
  const [detailedEEGData, setDetailedEEGData] = useState({
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
    ap: 0,
    grind: 0,
    heartRate: 0,
    temperature: 0,
    batteryLevel: 0,
    hardwareVersion: null,
    rawValue: 0,
    lastUpdateTime: null,
  });
  
  // Real-time EEG data array for charts
  const [realTimeEegData, setRealTimeEegData] = useState([]);
  
  // Band powers for display
  const [realTimeBandPowers, setRealTimeBandPowers] = useState({
    delta: 0,
    theta: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
  });

  // MacrotellectLink hook
  const {
    isConnected,
    isScanning,
    scanningStatus,
    devices,
    connectedDevice,
    eegData: hookEegData,
    connectionStatusText,
    connectionColor,
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    forceRealDataMode,
    isServiceReady,
    initializationError,
    rawEEGData,
    bandPowers,
    attentionMeditation,
    signal,
    initializationProgress,
    lastUpdateTime,
    initialize,
    isInitialized,
    isInDemoMode,
    connectionMode,
    getRealTimeData,
    getScanStatus,
    getDeviceInfo,
    getSystemInfo,
    validateSDKAccess,
    reinitializeSDK,
    testSDKMethods,
    getSDKStatus,
    clearAllStates,
    getEEGQuality,
    getConnectionQuality,
    getDeviceStatus,
    getUsageStatistics,
    getSessionData,
    exportSessionData,
    hardReset,
    softReset,
    emergencyStop,
    getDebugInfo,
    validateConfiguration,
    performHealthCheck,
    getComprehensiveReport,
    monitorPerformance,
    optimizePerformance,
    backupConfiguration,
    restoreConfiguration,
    validateIntegrity,
    syncConfiguration,
    enableAdvancedMode,
    disableAdvancedMode,
    getAdvancedMetrics,
    calibrateDevice,
    testConnection,
    validateData,
    measureLatency,
    benchmarkPerformance,
    stressTest,
    enduranceTest,
    accuracyTest,
    stabilityTest,
    performanceProfile,
    systemDiagnostics,
    generateReport,
    exportDiagnostics,
    importConfiguration,
    customizeSettings,
    optimizeSettings,
    validateSettings,
    resetSettings,
    backupSettings,
    restoreSettings,
    compareSettings,
    auditSettings,
    monitorSettings,
    alertSettings,
    presetSettings,
    dynamicSettings,
    adaptiveSettings
  } = useMacrotellectLink();

  // Generate title with SDK status
  const getTitle = () => {
    return `BrainLink SDK Dashboard Direct`;
  };

  // Get connection status color
  const getConnectionColor = () => {
    if (sdkError) return '#F44336'; // Red for errors
    if (!sdkInitialized) return '#FF9800'; // Orange for not initialized
    if (connectionStatus === 'connected') return '#4CAF50'; // Green for connected
    return '#2196F3'; // Blue for ready
  };

  // Get connection status text
  const getConnectionStatusText = () => {
    if (sdkError) return 'SDK ERROR';
    if (!sdkInitialized) return 'SDK INITIALIZING';
    
    switch (connectionStatus) {
      case 'connected':
        return 'REAL EEG DATA';
      case 'connecting':
        return 'CONNECTING';
      case 'scanning':
        return 'SCANNING';
      case 'ready':
        return 'SDK READY';
      default:
        return 'DISCONNECTED';
    }
  };

  // Get connection mode color
  const getConnectionModeColor = () => {
    switch (connectionMode) {
      case 'REAL_DATA_MODE':
        return '#4CAF50'; // Green for real data
      case 'SDK_NOT_INITIALIZED':
        return '#FF9800'; // Orange for not initialized
      case 'SDK_UNAVAILABLE':
        return '#F44336'; // Red for unavailable
      default:
        return '#9E9E9E'; // Gray for unknown
    }
  };

  // Handle EEG data from direct native events
  const handleEEGData = (rawData) => {
    try {
      console.log('📊 MacrotellectLinkDashboard processing EEG data:', rawData);
      console.log('📊 Data type:', rawData.type);
      console.log('📊 Raw data keys:', Object.keys(rawData));
      
      // Update detailed EEG data if it's brainwave data
      if (rawData.type === 'brainwave') {
        console.log('🧠 Processing brainwave data...');
        console.log('🧠 Signal:', rawData.signal);
        console.log('🧠 Attention:', rawData.attention);
        console.log('🧠 Meditation:', rawData.meditation);
        console.log('🧠 Band powers - Delta:', rawData.delta, 'Theta:', rawData.theta);
        
        setDetailedEEGData(prev => ({
          ...prev,
          signal: rawData.signal || 0,
          attention: rawData.attention || 0,
          meditation: rawData.meditation || 0,
          delta: rawData.delta || 0,
          theta: rawData.theta || 0,
          lowAlpha: rawData.lowAlpha || 0,
          highAlpha: rawData.highAlpha || 0,
          lowBeta: rawData.lowBeta || 0,
          highBeta: rawData.highBeta || 0,
          lowGamma: rawData.lowGamma || 0,
          middleGamma: rawData.middleGamma || 0,
          ap: rawData.ap || 0,
          grind: rawData.grind || 0,
          heartRate: rawData.heartRate || 0,
          temperature: rawData.temperature || 0,
          batteryLevel: rawData.batteryLevel || 0,
          hardwareVersion: rawData.hardwareVersion || null,
          lastUpdateTime: new Date().toLocaleTimeString(),
        }));
        
        // Update band powers for chart display
        setRealTimeBandPowers({
          delta: rawData.delta || 0,
          theta: rawData.theta || 0,
          alpha: (rawData.lowAlpha || 0) + (rawData.highAlpha || 0),
          beta: (rawData.lowBeta || 0) + (rawData.highBeta || 0),
          gamma: (rawData.lowGamma || 0) + (rawData.middleGamma || 0),
        });
      }
      
      // Handle data without specific type (might be direct brainwave data)
      if (!rawData.type && (rawData.signal !== undefined || rawData.attention !== undefined || rawData.meditation !== undefined)) {
        console.log('📊 Processing untyped brainwave data...');
        console.log('📊 Signal:', rawData.signal);
        console.log('📊 Attention:', rawData.attention);
        console.log('📊 Meditation:', rawData.meditation);
        
        const newData = {
          signal: rawData.signal !== undefined ? rawData.signal : undefined,
          attention: rawData.attention !== undefined ? rawData.attention : undefined,
          meditation: rawData.meditation !== undefined ? rawData.meditation : undefined,
          delta: rawData.delta !== undefined ? rawData.delta : undefined,
          theta: rawData.theta !== undefined ? rawData.theta : undefined,
          lowAlpha: rawData.lowAlpha !== undefined ? rawData.lowAlpha : undefined,
          highAlpha: rawData.highAlpha !== undefined ? rawData.highAlpha : undefined,
          lowBeta: rawData.lowBeta !== undefined ? rawData.lowBeta : undefined,
          highBeta: rawData.highBeta !== undefined ? rawData.highBeta : undefined,
          lowGamma: rawData.lowGamma !== undefined ? rawData.lowGamma : undefined,
          middleGamma: rawData.middleGamma !== undefined ? rawData.middleGamma : undefined,
          batteryLevel: rawData.batteryLevel !== undefined ? rawData.batteryLevel : undefined,
          hardwareVersion: rawData.hardwareVersion !== undefined ? rawData.hardwareVersion : undefined,
          lastUpdateTime: new Date().toLocaleTimeString(),
        };
        
        console.log('📊 New data to set:', newData);
        
        setDetailedEEGData(prev => {
          const updated = { ...prev };
          Object.keys(newData).forEach(key => {
            if (newData[key] !== undefined) {
              updated[key] = newData[key];
            }
          });
          return updated;
        });
        
        // Update band powers if available
        if (rawData.delta !== undefined || rawData.theta !== undefined) {
          setRealTimeBandPowers({
            delta: rawData.delta || 0,
            theta: rawData.theta || 0,
            alpha: (rawData.lowAlpha || 0) + (rawData.highAlpha || 0),
            beta: (rawData.lowBeta || 0) + (rawData.highBeta || 0),
            gamma: (rawData.lowGamma || 0) + (rawData.middleGamma || 0),
          });
        }
      }
      
      // Handle ALL data types - try to extract any useful information
      if (rawData.signal !== undefined || rawData.attention !== undefined || rawData.meditation !== undefined || 
          rawData.delta !== undefined || rawData.theta !== undefined || rawData.lowAlpha !== undefined) {
        console.log('📊 Processing ANY EEG data...');
        console.log('📊 All values - Signal:', rawData.signal, 'Attention:', rawData.attention, 'Meditation:', rawData.meditation);
        
        setDetailedEEGData(prev => ({
          ...prev,
          signal: rawData.signal !== undefined ? rawData.signal : prev.signal,
          attention: rawData.attention !== undefined ? rawData.attention : prev.attention,
          meditation: rawData.meditation !== undefined ? rawData.meditation : prev.meditation,
          delta: rawData.delta !== undefined ? rawData.delta : prev.delta,
          theta: rawData.theta !== undefined ? rawData.theta : prev.theta,
          lowAlpha: rawData.lowAlpha !== undefined ? rawData.lowAlpha : prev.lowAlpha,
          highAlpha: rawData.highAlpha !== undefined ? rawData.highAlpha : prev.highAlpha,
          lowBeta: rawData.lowBeta !== undefined ? rawData.lowBeta : prev.lowBeta,
          highBeta: rawData.highBeta !== undefined ? rawData.highBeta : prev.highBeta,
          lowGamma: rawData.lowGamma !== undefined ? rawData.lowGamma : prev.lowGamma,
          middleGamma: rawData.middleGamma !== undefined ? rawData.middleGamma : prev.middleGamma,
          batteryLevel: rawData.batteryLevel !== undefined ? rawData.batteryLevel : prev.batteryLevel,
          hardwareVersion: rawData.hardwareVersion !== undefined ? rawData.hardwareVersion : prev.hardwareVersion,
          lastUpdateTime: new Date().toLocaleTimeString(),
        }));
        
        // Update band powers
        setRealTimeBandPowers(prev => ({
          delta: rawData.delta !== undefined ? rawData.delta : prev.delta,
          theta: rawData.theta !== undefined ? rawData.theta : prev.theta,
          alpha: rawData.lowAlpha !== undefined || rawData.highAlpha !== undefined ? 
                 (rawData.lowAlpha || 0) + (rawData.highAlpha || 0) : prev.alpha,
          beta: rawData.lowBeta !== undefined || rawData.highBeta !== undefined ? 
                (rawData.lowBeta || 0) + (rawData.highBeta || 0) : prev.beta,
          gamma: rawData.lowGamma !== undefined || rawData.middleGamma !== undefined ? 
                 (rawData.lowGamma || 0) + (rawData.middleGamma || 0) : prev.gamma,
        }));
      }
      
      // Update battery level if it's battery data
      if (rawData.type === 'battery') {
        console.log('🔋 Processing battery data...');
        setDetailedEEGData(prev => ({
          ...prev,
          batteryLevel: rawData.batteryLevel || 0,
        }));
      }
      
      // Handle raw EEG data points
      if (rawData.type === 'raw' || rawData.rawValue !== undefined) {
        console.log('🔢 Processing raw EEG data point:', rawData.rawValue);
        
        const rawValue = rawData.rawValue || rawData.value || rawData.raw || 0;
        
        // Update raw data display
        setDetailedEEGData(prev => ({
          ...prev,
          rawValue: rawValue,
          lastUpdateTime: new Date().toLocaleTimeString(),
        }));
        
        // Add raw data to chart
        if (rawValue !== undefined) {
          setRealTimeEegData(prevData => {
            const newData = [...prevData, rawValue];
            return newData.slice(-256); // Keep last 256 samples for 1 second window
          });
        }
      }
      
      // Handle any numeric data that might be raw EEG
      if (typeof rawData === 'number') {
        console.log('🔢 Processing numeric EEG data:', rawData);
        
        setDetailedEEGData(prev => ({
          ...prev,
          rawValue: rawData,
          lastUpdateTime: new Date().toLocaleTimeString(),
        }));
        
        setRealTimeEegData(prevData => {
          const newData = [...prevData, rawData];
          return newData.slice(-256); // Keep last 256 samples
        });
      }
      
      // Handle R-R interval data
      if (rawData.type === 'rr') {
        console.log('💓 Processing R-R interval data...');
        setDetailedEEGData(prev => ({
          ...prev,
          heartRate: rawData.heartRate || 0,
          lastUpdateTime: new Date().toLocaleTimeString(),
        }));
      }
      
      // Handle gravity data
      if (rawData.type === 'gravity') {
        console.log('🌍 Processing gravity data...');
        // Gravity data can be logged but doesn't need UI display
      }
      
      // Update the last data time
      setLastDataTime(new Date());
      
    } catch (error) {
      console.error('Error processing EEG data:', error);
    }
  };

  // Initialize SDK on component mount
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        console.log('🔧 Initializing MacrotellectLink SDK...');
        setSdkInitialized(false);
        setSdkError(null);
        
        await MacrotellectLinkService.initialize();
        
        setSdkInitialized(true);
        setConnectionStatus('ready');
        console.log('✅ MacrotellectLink SDK initialized successfully');
        
        // Add direct event listeners for native module events
        console.log('📡 Setting up direct event listeners...');
        
        // Listen for EEG data from native module
        const dataListener = DeviceEventEmitter.addListener('BrainLinkData', (data) => {
          console.log('📊 Received BrainLinkData event:', data);
          handleEEGData(data);
        });
        
        // Listen for connection status from native module
        const connectionListener = DeviceEventEmitter.addListener('BrainLinkConnection', (status) => {
          console.log('🔗 Received BrainLinkConnection event:', status);
          
          if (status.isConnected) {
            setConnectionStatus('connected');
            console.log('✅ Device connected via direct event!');
          } else {
            setConnectionStatus('disconnected');
            console.log('❌ Device disconnected via direct event!');
          }
        });
        
        // Store listeners for cleanup
        window.eegDataListener = dataListener;
        window.connectionListener = connectionListener;
        
        console.log('✅ Direct event listeners setup complete');
        
      } catch (error) {
        console.error('❌ Failed to initialize MacrotellectLink SDK:', error);
        setSdkError(error.message);
        setSdkInitialized(false);
      }
    };

    initializeSDK();
    
    // Cleanup function to remove event listeners
    return () => {
      console.log('🧹 Cleaning up event listeners...');
      
      if (window.eegDataListener) {
        window.eegDataListener.remove();
        window.eegDataListener = null;
      }
      
      if (window.connectionListener) {
        window.connectionListener.remove();
        window.connectionListener = null;
      }
      
      console.log('✅ Event listeners cleaned up');
    };
  }, []);

  // Update EEG data when hook data changes
  useEffect(() => {
    if (hookEegData) {
      setEegData(hookEegData);
      setLastDataTime(new Date());
    }
  }, [hookEegData]);

  // Update connection status based on hook state
  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected');
    } else if (isScanning) {
      setConnectionStatus('scanning');
    } else if (sdkInitialized) {
      setConnectionStatus('ready');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected, isScanning, sdkInitialized]);

  // Force Real Data Mode function
  const handleForceRealDataMode = async () => {
    try {
      console.log('🔧 Forcing real data mode...');
      await forceRealDataMode();
      console.log('✅ Real data mode forced successfully');
    } catch (error) {
      console.error('❌ Failed to force real data mode:', error);
      Alert.alert('Error', `Failed to force real data mode: ${error.message}`);
    }
  };

  // Reinitialize SDK function
  const handleReinitializeSDK = async () => {
    try {
      console.log('🔄 Reinitializing MacrotellectLink SDK...');
      setSdkInitialized(false);
      setSdkError(null);
      setConnectionStatus('disconnected');
      
      await MacrotellectLinkService.initialize();
      
      setSdkInitialized(true);
      setConnectionStatus('ready');
      console.log('✅ MacrotellectLink SDK reinitialized successfully');
    } catch (error) {
      console.error('❌ Failed to reinitialize MacrotellectLink SDK:', error);
      setSdkError(error.message);
      setSdkInitialized(false);
    }
  };

  // SDK Test Screen Component
  if (currentScreen === 'sdk-test') {
    return (
      <View style={styles.container}>
        <MacrotellectLinkSDKTest 
          onBack={() => setCurrentScreen('dashboard')}
        />
      </View>
    );
  }

  // Main Dashboard
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* SDK Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>MacrotellectLink SDK Status</Text>
            <View style={[styles.statusIndicator, { backgroundColor: getConnectionColor() }]}>
              <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
            </View>
          </View>

          {/* Connection Mode Indicator */}
          <View style={styles.connectionModeContainer}>
            <Text style={styles.connectionModeLabel}>Connection Mode:</Text>
            <View style={[styles.connectionModeIndicator, { backgroundColor: getConnectionModeColor() }]}>
              <Text style={styles.connectionModeText}>
                {connectionMode === 'REAL_DATA_MODE' ? 'REAL EEG DATA' : 
                 connectionMode === 'SDK_NOT_INITIALIZED' ? 'SDK NOT INITIALIZED' :
                 connectionMode === 'SDK_UNAVAILABLE' ? 'SDK UNAVAILABLE' : 'UNKNOWN'}
              </Text>
            </View>
          </View>

          {/* Error Display */}
          {sdkError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {sdkError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleReinitializeSDK}>
                <Text style={styles.retryButtonText}>Retry SDK Initialization</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Last Data Time */}
          {lastDataTime && (
            <Text style={styles.lastDataTime}>
              Last Data: {lastDataTime.toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: isScanning ? '#F44336' : '#4CAF50' }]}
            onPress={isScanning ? stopScan : startScan}
            disabled={!sdkInitialized}
          >
            <Text style={styles.controlButtonText}>
              {isScanning ? 'Stop Scan' : 'Start Scan'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: '#2196F3' }]}
            onPress={handleForceRealDataMode}
            disabled={!sdkInitialized}
          >
            <Text style={styles.controlButtonText}>Force Real Data Mode</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.controlButton, { backgroundColor: '#FF9800' }]}
            onPress={() => setCurrentScreen('sdk-test')}
          >
            <Text style={styles.controlButtonText}>SDK Test</Text>
          </TouchableOpacity>
        </View>

        {/* Device Information */}
        {connectedDevice && (
          <View style={styles.deviceCard}>
            <Text style={styles.deviceTitle}>Connected Device</Text>
            <Text style={styles.deviceInfo}>Name: {connectedDevice.name}</Text>
            <Text style={styles.deviceInfo}>ID: {connectedDevice.id}</Text>
            <Text style={styles.deviceInfo}>Type: MacrotellectLink SDK</Text>
          </View>
        )}

        {/* EEG Data Display */}
        {(detailedEEGData.lastUpdateTime || (eegData && Object.keys(eegData).length > 0)) && (
          <View style={styles.eegDataContainer}>
            <Text style={styles.eegDataTitle}>EEG Data (Real-time)</Text>
            
            {/* Signal Quality */}
            {(detailedEEGData.signal !== 0 || detailedEEGData.signal !== undefined || eegData.signal !== undefined) && (
              <View style={styles.signalContainer}>
                <Text style={styles.signalLabel}>Signal Quality:</Text>
                <Text style={[styles.signalValue, { color: (detailedEEGData.signal || eegData.signal) > 100 ? '#F44336' : '#4CAF50' }]}>
                  {detailedEEGData.signal || eegData.signal || 0}
                </Text>
              </View>
            )}

            {/* Attention & Meditation */}
            {(detailedEEGData.attention !== 0 || detailedEEGData.meditation !== 0 || eegData.attention !== undefined || eegData.meditation !== undefined) && (
              <View style={styles.attentionMeditation}>
                <View style={styles.attentionMeditationItem}>
                  <Text style={styles.attentionMeditationLabel}>Attention:</Text>
                  <Text style={styles.attentionMeditationValue}>
                    {getSafeNumericValue(detailedEEGData.attention || eegData.attention)}%
                  </Text>
                </View>
                <View style={styles.attentionMeditationItem}>
                  <Text style={styles.attentionMeditationLabel}>Meditation:</Text>
                  <Text style={styles.attentionMeditationValue}>
                    {getSafeNumericValue(detailedEEGData.meditation || eegData.meditation)}%
                  </Text>
                </View>
              </View>
            )}

            {/* Band Powers - Always show if we have any data */}
            {(detailedEEGData.lastUpdateTime || eegData.bandPowers) && (
              <View style={styles.bandPowersContainer}>
                <Text style={styles.bandPowersTitle}>Band Powers</Text>
                <BandPowerDisplay 
                  bandPowers={{
                    delta: getSafeNumericValue(detailedEEGData.delta || realTimeBandPowers.delta || (eegData.bandPowers && eegData.bandPowers.delta)),
                    theta: getSafeNumericValue(detailedEEGData.theta || realTimeBandPowers.theta || (eegData.bandPowers && eegData.bandPowers.theta)),
                    lowAlpha: getSafeNumericValue(detailedEEGData.lowAlpha || (eegData.bandPowers && eegData.bandPowers.lowAlpha)),
                    highAlpha: getSafeNumericValue(detailedEEGData.highAlpha || (eegData.bandPowers && eegData.bandPowers.highAlpha)),
                    lowBeta: getSafeNumericValue(detailedEEGData.lowBeta || (eegData.bandPowers && eegData.bandPowers.lowBeta)),
                    highBeta: getSafeNumericValue(detailedEEGData.highBeta || (eegData.bandPowers && eegData.bandPowers.highBeta)),
                    lowGamma: getSafeNumericValue(detailedEEGData.lowGamma || (eegData.bandPowers && eegData.bandPowers.lowGamma)),
                    highGamma: getSafeNumericValue(detailedEEGData.middleGamma || (eegData.bandPowers && eegData.bandPowers.highGamma))
                  }}
                />
              </View>
            )}

            {/* Live EEG Plot */}
            {realTimeEegData.length > 0 && (
              <View style={styles.livePlotContainer}>
                <Text style={styles.livePlotTitle}>Live EEG Signal</Text>
                <View style={styles.plotContainer}>
                  <View style={styles.plotHeader}>
                    <Text style={styles.plotLabel}>Raw EEG Values (μV)</Text>
                    <Text style={styles.plotSampleCount}>Samples: {realTimeEegData.length}</Text>
                  </View>
                  <View style={styles.plotArea}>
                    {realTimeEegData.slice(-50).map((value, index) => {
                      const height = Math.abs(value) / 1000; // Scale the value
                      const normalizedHeight = Math.min(Math.max(height, 0.1), 0.9) * 100; // Normalize to 10-90%
                      return (
                        <View 
                          key={index} 
                          style={[
                            styles.plotBar, 
                            { 
                              height: `${normalizedHeight}%`,
                              backgroundColor: value > 0 ? '#4CAF50' : '#F44336'
                            }
                          ]} 
                        />
                      );
                    })}
                  </View>
                  <View style={styles.plotFooter}>
                    <Text style={styles.plotInfo}>Latest: {realTimeEegData[realTimeEegData.length - 1]}μV</Text>
                    <Text style={styles.plotInfo}>Range: {Math.min(...realTimeEegData.slice(-50))} to {Math.max(...realTimeEegData.slice(-50))}μV</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Attention & Meditation with Live Updates */}
            {detailedEEGData.lastUpdateTime && (
              <View style={styles.liveMetricsContainer}>
                <Text style={styles.liveMetricsTitle}>Live Brain Metrics</Text>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Attention</Text>
                    <Text style={styles.metricValue}>{detailedEEGData.attention || 0}%</Text>
                    <View style={styles.metricBar}>
                      <View 
                        style={[
                          styles.metricFill, 
                          { width: `${detailedEEGData.attention || 0}%`, backgroundColor: '#4CAF50' }
                        ]} 
                      />
                    </View>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Meditation</Text>
                    <Text style={styles.metricValue}>{detailedEEGData.meditation || 0}%</Text>
                    <View style={styles.metricBar}>
                      <View 
                        style={[
                          styles.metricFill, 
                          { width: `${detailedEEGData.meditation || 0}%`, backgroundColor: '#2196F3' }
                        ]} 
                      />
                    </View>
                  </View>
                </View>
                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Signal Quality</Text>
                    <Text style={styles.metricValue}>{detailedEEGData.signal || 0}</Text>
                    <View style={styles.metricBar}>
                      <View 
                        style={[
                          styles.metricFill, 
                          { 
                            width: `${Math.min((detailedEEGData.signal || 0) / 2, 100)}%`, 
                            backgroundColor: (detailedEEGData.signal || 0) > 100 ? '#F44336' : '#4CAF50'
                          }
                        ]} 
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Additional Direct Event Data */}
            {detailedEEGData.lastUpdateTime && (
              <View style={styles.additionalDataContainer}>
                <Text style={styles.additionalDataTitle}>Live Device Data</Text>
                
                {/* Battery Level */}
                {detailedEEGData.batteryLevel > 0 && (
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Battery:</Text>
                    <Text style={styles.dataValue}>{detailedEEGData.batteryLevel}%</Text>
                  </View>
                )}
                
                {/* Hardware Version */}
                {detailedEEGData.hardwareVersion && (
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Hardware:</Text>
                    <Text style={styles.dataValue}>{detailedEEGData.hardwareVersion}</Text>
                  </View>
                )}
                
                {/* Raw EEG Value */}
                {detailedEEGData.rawValue !== 0 && (
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Raw EEG:</Text>
                    <Text style={styles.dataValue}>{detailedEEGData.rawValue}</Text>
                  </View>
                )}
                
                {/* Last Update Time */}
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Last Update:</Text>
                  <Text style={styles.dataValue}>{detailedEEGData.lastUpdateTime}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* EEG Chart */}
        {(realTimeEegData.length > 0 || eegData) && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>EEG Visualization</Text>
            <EEGChart 
              eegData={realTimeEegData.length > 0 ? { rawData: realTimeEegData } : eegData}
              isRealData={true}
              connectionType="SDK"
            />
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>SDK-Only Mode Instructions</Text>
          <Text style={styles.instructionsText}>
            • This app uses ONLY the MacrotellectLink SDK for real EEG data
          </Text>
          <Text style={styles.instructionsText}>
            • No DirectBLE fallback - devices must connect through SDK
          </Text>
          <Text style={styles.instructionsText}>
            • Ensure BrainLink device is turned on before scanning
          </Text>
          <Text style={styles.instructionsText}>
            • Use "Force Real Data Mode" to ensure SDK is properly initialized
          </Text>
          <Text style={styles.instructionsText}>
            • Restart app if SDK initialization fails
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#F44336',
    padding: 10,
    borderRadius: 5,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  connectionModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  connectionModeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  connectionModeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  connectionModeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 8,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastDataTime: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  deviceCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  deviceInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  eegDataContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eegDataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  signalLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  signalValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  attentionMeditation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  attentionMeditationItem: {
    alignItems: 'center',
  },
  attentionMeditationLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  attentionMeditationValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  bandPowersContainer: {
    marginBottom: 16,
  },
  bandPowersTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  additionalDataContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  additionalDataTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dataLabel: {
    fontSize: 14,
    color: '#666',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  livePlotContainer: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  livePlotTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  plotContainer: {
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 8,
  },
  plotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  plotLabel: {
    fontSize: 12,
    color: '#666',
  },
  plotSampleCount: {
    fontSize: 12,
    color: '#999',
  },
  plotArea: {
    height: 80,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: '#fafafa',
    borderRadius: 4,
    padding: 4,
  },
  plotBar: {
    width: 3,
    minHeight: 2,
    borderRadius: 1,
    marginHorizontal: 0.5,
  },
  plotFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  plotInfo: {
    fontSize: 10,
    color: '#666',
  },
  liveMetricsContainer: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  liveMetricsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  metricFill: {
    height: '100%',
    borderRadius: 3,
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  instructionsContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
});

export default MacrotellectLinkDashboard;
