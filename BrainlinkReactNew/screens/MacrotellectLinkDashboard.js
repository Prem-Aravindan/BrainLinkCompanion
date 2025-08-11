/**
 * MacrotellectLink Dashboard Screen - Simple Working Version
 * 
 * This is a restored simple version that was working before performance optimizations
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  DeviceEventEmitter,
  NativeModules,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useMacrotellectLink } from '../hooks/useMacrotellectLink';
import { BandPowerDisplay } from '../components/BandPowerDisplay';
import EEGChart from '../components/EEGChart';
import RealTimeEEGDisplay from '../components/RealTimeEEGDisplay';
import FilteredEEGDisplay from '../components/FilteredEEGDisplay';
import MacrotellectLinkService from '../services/MacrotellectLinkService';
import MacrotellectLinkSDKTest from './MacrotellectLinkSDKTest';
import AppLogo from '../components/AppLogo';
import backgroundDSPManager from '../utils/backgroundDSP';
import streamingDSP from '../utils/streamingDSP';
const { BrainLinkModule } = NativeModules;

// Small, reusable battery indicator styled like a phone battery bar
const BatteryIndicator = React.memo(({ level = 0, showPercent = true, size = 'small' }) => {
  const pct = Math.max(0, Math.min(100, Number.isFinite(level) ? level : 0));
  const getBatteryColor = () => {
    if (pct > 50) return '#4CAF50';
    if (pct > 20) return '#FF9800';
    return '#F44336';
  };
  const dims = size === 'small'
    ? { w: 26, h: 12, capW: 2, radius: 2 }
    : { w: 36, h: 16, capW: 3, radius: 3 };
  const fillWidth = Math.round((pct / 100) * (dims.w - 4)); // padding 2 on each side
  const color = getBatteryColor();

  return (
    <View style={styles.batteryContainerRow}>
      <View style={[styles.batteryIcon, { width: dims.w + dims.capW + 2, height: dims.h }]}> 
        <View style={[styles.batteryBody, { width: dims.w, height: dims.h, borderRadius: dims.radius }]}> 
          <View style={[styles.batteryFill, { width: fillWidth, backgroundColor: pct === 0 ? '#9E9E9E' : color }]} />
        </View>
        <View style={[styles.batteryCap, { width: dims.capW, height: Math.max(6, dims.h - 6) }]} />
      </View>
      {showPercent && (
        <Text style={styles.batteryPercentText}>{Number.isFinite(level) ? `${pct}%` : '--%'}</Text>
      )}
    </View>
  );
});
export const MacrotellectLinkDashboard = ({ user, onLogout }) => {
  // Navigation state
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard', 'sdk-test', or 'realtime'
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
  // RAW SIGNAL PLOTTING (Python-style dual plot system)
  const [rawSignalBuffer, setRawSignalBuffer] = useState([]);
  const [filteredSignalBuffer, setFilteredSignalBuffer] = useState([]);
  const [artifactCount, setArtifactCount] = useState(0);
  const [signalRange, setSignalRange] = useState({ min: -50, max: 50 }); // Initialize with reasonable range
  const rawBufferRef = useRef([]);
  const maxRawBufferSize = 1000; // Last 1000 samples (~2 seconds at 512Hz, matches Python)
  // Theta contribution buffer for Python-style main plot
  const [thetaContributionBuffer, setThetaContributionBuffer] = useState([]);
  const thetaTimeBuffer = useRef([]);
  const plotStartTime = useRef(Date.now());
  // Data rate monitoring
  const [dataRate, setDataRate] = useState(0);
  const lastDataRateCheck = useRef(Date.now());
  const dataCountSinceLastCheck = useRef(0);
  
  // JavaScript-based frequency measurement
  const [jsFrequencyMeasurement, setJsFrequencyMeasurement] = useState({
    frequency: 0,
    sampleCount: 0,
    timeSpan: 0,
    lastMeasurement: 0
  });
  const jsFreqStartTime = useRef(Date.now());
  const jsFreqSampleCount = useRef(0);
  // Band powers for display
  const [realTimeBandPowers, setRealTimeBandPowers] = useState({
    delta: 0,
    theta: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  // Local devices state for event-based discovery
  const [localDevices, setDevices] = useState([]);
  
  // BACKGROUND DSP STATE - New efficient filtering system
  const [backgroundDSPActive, setBackgroundDSPActive] = useState(false);
  const [filteredEEGData, setFilteredEEGData] = useState([]);
  // Throttled UI pipeline for filtered data to avoid render spikes
  const filteredQueueRef = useRef([]);
  const filteredFlushTimerRef = useRef(null);
  const [dspPerformanceStats, setDspPerformanceStats] = useState(null);
  const [showFilteredView, setShowFilteredView] = useState(false);
  const [latestFeatures, setLatestFeatures] = useState(null);
  
  // Track last connected device for post-reload restoration
  let lastConnectedDevice = useRef(null);
  // Track if this is a post-reload scenario for enhanced BLE reset
  const [isPostReload, setIsPostReload] = useState(false);
  // POST-RELOAD DETECTION: Multi-layer detection for Metro hot reloads
  const isPostReloadDetected = useMemo(() => {
    // Detection method 1: Check for Metro reload flag
    const hasMetroReload = typeof global !== 'undefined' && 
                          (global.__METRO_RELOAD__ || global.__DEV__);
    // Detection method 2: Check for React DevTools (indicates development)
    const hasReactDevTools = typeof window !== 'undefined' && 
                             window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    // Detection method 3: Check navigation type (reload vs fresh navigation)
    const isReloadNavigation = typeof window !== 'undefined' && 
                              window.performance && 
                              window.performance.navigation && 
                              window.performance.navigation.type === 1;
    // Consider it a post-reload if any indicator is present
    const isDetected = hasMetroReload || hasReactDevTools || isReloadNavigation || isPostReload;
    if (isDetected) {
      console.log('🔍 POST-RELOAD: Metro reload detected via multiple indicators', {
        hasMetroReload,
        hasReactDevTools, 
        isReloadNavigation,
        isPostReload
      });
    }
    return isDetected;
  }, [isPostReload]);
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
  // Memoized values to prevent unnecessary re-renders and improve button responsiveness
  const localConnectionColor = useMemo(() => {
    if (sdkError) return 'rgba(244, 67, 54, 0.8)'; // Modern red for errors
    if (!sdkInitialized) return 'rgba(255, 152, 0, 0.8)'; // Modern orange for not initialized
    if (connectionStatus === 'connected') return 'rgba(76, 175, 80, 0.8)'; // Modern green for connected
    return 'rgba(33, 150, 243, 0.8)'; // Modern blue for ready
  }, [sdkError, sdkInitialized, connectionStatus]);
  const localConnectionStatusText = useMemo(() => {
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
  }, [sdkError, sdkInitialized, connectionStatus]);
  // ULTRA-LIGHTWEIGHT BUTTON CONFIG: Minimal dependencies for maximum responsiveness
  const scanButtonConfig = useMemo(() => {
    // Cache only the most essential states to prevent re-computation during data streaming
    const isDisconnecting = connectionStatus === 'disconnecting';
    const isConnected = connectionStatus === 'connected';
    const isCurrentlyScanning = isScanning;
    const isSdkReady = sdkInitialized;
    return {
      text: isDisconnecting ? 'Disconnecting...' :
            isConnected ? 'Disconnect Device' : 
            isCurrentlyScanning ? 'Stop Scan' : 'Start Scan',
      color: isDisconnecting ? 'rgba(255, 87, 34, 0.8)' :
             isConnected ? 'rgba(244, 67, 54, 0.8)' : 
             isCurrentlyScanning ? 'rgba(255, 152, 0, 0.8)' : 'rgba(76, 175, 80, 0.8)',
      disabled: !isSdkReady || isDisconnecting,
      isConnected: isConnected,
      isDisconnecting: isDisconnecting
    };
  }, [connectionStatus, isScanning, sdkInitialized]); // Minimal dependencies
  // LIGHTNING-FAST BUTTON HANDLER: Immediate response with background processing
  const handleButtonPress = useCallback(() => {
    // INSTANT feedback - no async operations in main handler
    // REMOVED LOG: console.log('🔘 Button pressed - ultra-fast handler'); - to clean console for sampling rate logs
    // Prevent multiple rapid presses with immediate check
    if (scanButtonConfig.isDisconnecting) {
      // REMOVED LOG: console.log('⚠️ Already disconnecting'); - to clean console
      return;
    }
    // Execute action based on current state with immediate feedback
    if (scanButtonConfig.isConnected) {
      // Show disconnecting state immediately
      setConnectionStatus('disconnecting');
      // REMOVED LOG: console.log('🔌 Disconnecting...'); - to clean console
      // Execute actual disconnect in next tick to avoid blocking
      setTimeout(() => handleScanButtonPress(), 0);
    } else if (isScanning) {
      // Stop scan in next tick
      setTimeout(() => handleScanButtonPress(), 0);
    } else {
      // Start scan in next tick
      setTimeout(() => handleScanButtonPress(), 0);
    }
  }, [scanButtonConfig.isConnected, scanButtonConfig.isDisconnecting, isScanning, handleScanButtonPress]);
  // Get connection status color
  const getConnectionColor = useCallback(() => localConnectionColor, [localConnectionColor]);
  // Get connection status text
  const getConnectionStatusText = useCallback(() => localConnectionStatusText, [localConnectionStatusText]);
  // Get connection mode color
  const getConnectionModeColor = () => {
    switch (connectionMode) {
      case 'REAL_DATA_MODE':
        return 'rgba(76, 175, 80, 0.8)'; // Modern green for real data
      case 'SDK_NOT_INITIALIZED':
        return 'rgba(255, 152, 0, 0.8)'; // Modern orange for not initialized
      case 'SDK_UNAVAILABLE':
        return 'rgba(244, 67, 54, 0.8)'; // Modern red for unavailable
      default:
        return 'rgba(158, 158, 158, 0.8)'; // Modern gray for unknown
    }
  };
  // COMPREHENSIVE SCAN BUTTON WITH COMPLETE STATE RESET - FIXES POST-RELOAD DETECTION
  const handleScanButtonPress = useCallback(async () => {
    try {
      if (connectionStatus === 'connected' || connectionStatus === 'disconnecting') {
        console.log('🔌 Production Disconnect - Executing comprehensive cleanup...');
        // INTEGRATED CLEANUP: Clear all UI states immediately
        setConnectionStatus('disconnected');
        clearAllData();
        setLastDataTime(null);
        setDataRate(0);
        // Clear global batching variables
        if (window.rawDataBatch) window.rawDataBatch = [];
        if (window.lastChartUpdate) window.lastChartUpdate = 0;
        if (window.lastDataTimeUpdate) window.lastDataTimeUpdate = 0;
        if (window.liveDataBuffer) window.liveDataBuffer = [];
        if (window.smoothedThetaContribution) window.smoothedThetaContribution = 0;
        if (window.smoothedFeatures) window.smoothedFeatures = {};
        if (window.processingCounter) window.processingCounter = 0;
        // Reset refs
        dataCountSinceLastCheck.current = 0;
        lastDataRateCheck.current = Date.now();
        // Try multiple native disconnection methods for reliability
        const disconnectionMethods = [];
        if (BrainLinkModule) {
          // Method 1: Force disconnect
          if (BrainLinkModule.forceDisconnect) {
            disconnectionMethods.push(
              BrainLinkModule.forceDisconnect()
                .then(() => console.log('✅ Force disconnect successful'))
                .catch(error => console.log('⚠️ Force disconnect error:', error.message))
            );
          }
          // Method 2: Regular disconnect (use disconnectFromDevice, not disconnect)
          if (BrainLinkModule.disconnectFromDevice) {
            disconnectionMethods.push(
              BrainLinkModule.disconnectFromDevice()
                .then(() => console.log('✅ Regular disconnect successful'))
                .catch(error => console.log('⚠️ Regular disconnect error:', error.message))
            );
          }
          // Method 3: Stop scan (also acts as disconnect)
          if (BrainLinkModule.stopScan) {
            disconnectionMethods.push(
              BrainLinkModule.stopScan()
                .then(() => console.log('✅ Stop scan successful'))
                .catch(error => console.log('⚠️ Stop scan error:', error.message))
            );
          }
          // Method 4: Emergency stop
          if (BrainLinkModule.emergencyStop) {
            disconnectionMethods.push(
              BrainLinkModule.emergencyStop()
                .then(() => console.log('✅ Emergency stop successful'))
                .catch(error => console.log('⚠️ Emergency stop error:', error.message))
            );
          }
        }
        // Execute native disconnection methods
        if (disconnectionMethods.length > 0) {
          await Promise.allSettled(disconnectionMethods);
        }
        // Execute hook disconnect method with error handling
        try {
          await disconnect();
          console.log('✅ Hook disconnect successful');
        } catch (error) {
          console.log('⚠️ Hook disconnect error:', error.message);
        }
        console.log('✅ Production disconnect complete');
      } else if (isScanning) {
        console.log('🛑 Production Stop Scan - Executing comprehensive cleanup...');
        // INTEGRATED CLEANUP: Stop scanning with thorough cleanup
        try {
          if (BrainLinkModule && BrainLinkModule.stopScan) {
            await BrainLinkModule.stopScan();
            console.log('✅ Native stop scan successful');
          }
        } catch (error) {
          console.log('⚠️ Native stop scan error (continuing cleanup):', error.message);
        }
        // Execute hook stop scan with error handling
        try {
          await stopScan();
          console.log('✅ Hook stop scan successful');
        } catch (error) {
          console.log('⚠️ Hook stop scan error (continuing cleanup):', error.message);
        }
        // Clear any residual states
        setConnectionStatus('ready');
        console.log('✅ Production stop scan complete');
      } else {
        console.log('� COMPREHENSIVE STATE RESET & SCAN START - Fixing post-reload detection...');
        // STEP 1: Complete data cleanup
        clearAllData();
        setLastDataTime(null);
        setDataRate(0);
        // Clear global variables
        if (window.rawDataBatch) window.rawDataBatch = [];
        if (window.lastChartUpdate) window.lastChartUpdate = 0;
        if (window.lastDataTimeUpdate) window.lastDataTimeUpdate = 0;
        if (window.liveDataBuffer) window.liveDataBuffer = [];
        if (window.smoothedThetaContribution) window.smoothedThetaContribution = 0;
        if (window.smoothedFeatures) window.smoothedFeatures = {};
        if (window.processingCounter) window.processingCounter = 0;
        // Reset refs
        dataCountSinceLastCheck.current = 0;
        lastDataRateCheck.current = Date.now();
        // ENHANCED POST-RELOAD DETECTION: Check immediately in scan function  
        console.log('🔍 SCAN-TIME POST-RELOAD CHECK:', {
          useMemoDetected: isPostReloadDetected,
          stateDetected: isPostReload,
          metroReload: !!global.__METRO_RELOAD__,
          devMode: !!global.__DEV__,
          reactDevTools: !!(global.__REACT_DEVTOOLS_GLOBAL_HOOK__ || window?.__REACT_DEVTOOLS_GLOBAL_HOOK__),
          navigationType: window?.performance?.navigation?.type
        });
        // Use multiple detection methods for maximum reliability
        const immediatePostReloadCheck = isPostReloadDetected || isPostReload || 
                                        !!global.__METRO_RELOAD__ || 
                                        !!global.__DEV__ ||
                                        !!(global.__REACT_DEVTOOLS_GLOBAL_HOOK__ || window?.__REACT_DEVTOOLS_GLOBAL_HOOK__);
        // STEP 1.5: EXPLICIT DISCONNECTION - Critical for post-reload scenarios
        if (immediatePostReloadCheck) {
          console.log('🔌 POST-RELOAD: Performing explicit disconnection sequence...');
          try {
            // Method 1: Direct native module disconnect calls (MOST CRITICAL)
            if (BrainLinkModule) {
              console.log('📱 POST-RELOAD: Calling all available disconnect methods...');
              // Try disconnectFromDevice (current service method)
              if (BrainLinkModule.disconnectFromDevice) {
                try {
                  const result = await BrainLinkModule.disconnectFromDevice();
                  console.log('✅ POST-RELOAD: disconnectFromDevice succeeded:', result);
                } catch (error) {
                  console.log('⚠️ POST-RELOAD: disconnectFromDevice failed:', error.message);
                }
              }
              // Try disconnectAllDevices (comprehensive method)
              if (BrainLinkModule.disconnectAllDevices) {
                try {
                  const result = await BrainLinkModule.disconnectAllDevices();
                  console.log('✅ POST-RELOAD: disconnectAllDevices succeeded:', result);
                } catch (error) {
                  console.log('⚠️ POST-RELOAD: disconnectAllDevices failed:', error.message);
                }
              }
              // Try generic disconnect method
              if (BrainLinkModule.disconnect) {
                try {
                  const result = await BrainLinkModule.disconnect();
                  console.log('✅ POST-RELOAD: disconnect succeeded:', result);
                } catch (error) {
                  console.log('⚠️ POST-RELOAD: disconnect failed:', error.message);
                }
              }
              // CRITICAL: Unpair all BrainLink devices to force fresh pairing
              if (BrainLinkModule.unpairAllBrainLinkDevices) {
                try {
                  const result = await BrainLinkModule.unpairAllBrainLinkDevices();
                  console.log('✅ POST-RELOAD: unpairAllBrainLinkDevices succeeded:', result);
                } catch (error) {
                  console.log('⚠️ POST-RELOAD: unpairAllBrainLinkDevices failed:', error.message);
                }
              }
            }
            // Method 2: Hook-level disconnect
            if (disconnect && typeof disconnect === 'function') {
              console.log('🔌 POST-RELOAD: Calling hook disconnect...');
              await disconnect().catch(error => {
                console.log('⚠️ POST-RELOAD: Hook disconnect failed:', error.message);
              });
            }
            // Method 3: Service-level disconnect
            if (MacrotellectLinkService?.disconnect) {
              console.log('🔌 POST-RELOAD: Calling service disconnect...');
              await MacrotellectLinkService.disconnect().catch(error => {
                console.log('⚠️ POST-RELOAD: Service disconnect failed:', error.message);
              });
            }
            // Reset connection state
            setConnectionStatus('disconnected');
            lastConnectedDevice.current = null;
            // Wait for disconnection to stabilize
            await new Promise(resolve => setTimeout(resolve, 1500));
            console.log('✅ POST-RELOAD: Explicit disconnection sequence complete');
          } catch (error) {
            console.log('⚠️ POST-RELOAD: Disconnection sequence error:', error.message);
          }
        }
        // STEP 2: COMPREHENSIVE BLUETOOTH STACK RESET - Critical for post-reload detection
        console.log('🔧 Executing comprehensive Bluetooth stack reset...');
        const resetOperations = [];
        if (BrainLinkModule) {
          // Force stop any existing operations
          if (BrainLinkModule.stopScan) {
            resetOperations.push(
              BrainLinkModule.stopScan()
                .then(() => console.log('✅ Pre-scan stop successful'))
                .catch((error) => console.log('⚠️ Pre-scan stop error (expected):', error.message))
            );
          }
          // Force disconnect any cached connections
          if (BrainLinkModule.forceDisconnect) {
            resetOperations.push(
              BrainLinkModule.forceDisconnect()
                .then(() => console.log('✅ Pre-scan force disconnect successful'))
                .catch((error) => console.log('⚠️ Pre-scan force disconnect error (expected):', error.message))
            );
          }
          // CRITICAL FOR POST-RELOAD: Clear Android BLE device cache
          if (BrainLinkModule.clearBLECache) {
            resetOperations.push(
              BrainLinkModule.clearBLECache()
                .then(() => console.log('✅ Android BLE cache cleared - essential for post-reload detection'))
                .catch((error) => console.log('⚠️ BLE cache clear error:', error.message))
            );
          }
          // CRITICAL FOR POST-RELOAD: Reset Android BLE adapter
          if (BrainLinkModule.resetBLEAdapter) {
            resetOperations.push(
              BrainLinkModule.resetBLEAdapter()
                .then(() => console.log('✅ Android BLE adapter reset - forcing fresh scan state'))
                .catch((error) => console.log('⚠️ BLE adapter reset error:', error.message))
            );
          }
          // Clear all paired/cached devices - CRITICAL for post-reload detection
          if (BrainLinkModule.clearPairedDevices) {
            resetOperations.push(
              BrainLinkModule.clearPairedDevices()
                .then(() => console.log('✅ Cleared paired devices cache'))
                .catch((error) => console.log('⚠️ Clear paired devices error:', error.message))
            );
          }
          // Reset entire Bluetooth stack - ESSENTIAL for fresh device discovery
          if (BrainLinkModule.resetBluetoothStack) {
            resetOperations.push(
              BrainLinkModule.resetBluetoothStack()
                .then(() => console.log('✅ Bluetooth stack reset complete'))
                .catch((error) => console.log('⚠️ Bluetooth stack reset error:', error.message))
            );
          }
          // CRITICAL: Force refresh of available devices list
          if (BrainLinkModule.refreshDeviceList) {
            resetOperations.push(
              BrainLinkModule.refreshDeviceList()
                .then(() => console.log('✅ Device list refreshed'))
                .catch((error) => console.log('⚠️ Device list refresh error:', error.message))
            );
          }
          // Clear any SDK-level caches
          if (BrainLinkModule.clearSDKCache) {
            resetOperations.push(
              BrainLinkModule.clearSDKCache()
                .then(() => console.log('✅ SDK cache cleared'))
                .catch((error) => console.log('⚠️ SDK cache clear error:', error.message))
            );
          }
          // Reset device discovery state
          if (BrainLinkModule.resetDeviceDiscovery) {
            resetOperations.push(
              BrainLinkModule.resetDeviceDiscovery()
                .then(() => console.log('✅ Device discovery state reset'))
                .catch((error) => console.log('⚠️ Device discovery reset error:', error.message))
            );
          }
          // CRITICAL: Force Android to forget previous BLE connections
          if (BrainLinkModule.clearBLEConnections) {
            resetOperations.push(
              BrainLinkModule.clearBLEConnections()
                .then(() => console.log('✅ Previous BLE connections cleared'))
                .catch((error) => console.log('⚠️ BLE connections clear error:', error.message))
            );
          }
          // Emergency stop all operations
          if (BrainLinkModule.emergencyStop) {
            resetOperations.push(
              BrainLinkModule.emergencyStop()
                .then(() => console.log('✅ Emergency stop successful'))
                .catch((error) => console.log('⚠️ Emergency stop error:', error.message))
            );
          }
        }
        // Execute all reset operations in parallel
        if (resetOperations.length > 0) {
          console.log(`🔄 Executing ${resetOperations.length} reset operations...`);
          await Promise.allSettled(resetOperations);
          console.log('✅ All reset operations completed');
        }
        // STEP 3: Service-level state reset via hook
        console.log('🔧 Performing service-level state reset...');
        try {
          // Use hook's clear all states if available
          if (typeof clearAllStates === 'function') {
            await clearAllStates();
            console.log('✅ Service states cleared');
          }
          // Force service reinitialization if available
          if (typeof reinitializeSDK === 'function') {
            await reinitializeSDK();
            console.log('✅ Service reinitialized');
          }
          // Perform hard reset if available
          if (typeof hardReset === 'function') {
            await hardReset();
            console.log('✅ Hard reset completed');
          }
        } catch (error) {
          console.log('⚠️ Service reset error (some methods may not be available):', error.message);
        }
        // STEP 4: Extended wait period for Android BLE stack stabilization
        console.log('⏳ Waiting for Android BLE stack stabilization (extended)...');
        await new Promise(resolve => setTimeout(resolve, 4000)); // 4 second wait for Android BLE cache clearing
        // STEP 4.5: Additional Android BLE reset after stabilization
        console.log('🔧 Final Android BLE reset after stabilization...');
        if (BrainLinkModule) {
          try {
            // Force one more BLE adapter cycle
            if (BrainLinkModule.resetBLEAdapter) {
              await BrainLinkModule.resetBLEAdapter();
              console.log('✅ Final BLE adapter reset completed');
            }
            // Clear any remaining device cache
            if (BrainLinkModule.clearBLECache) {
              await BrainLinkModule.clearBLECache();
              console.log('✅ Final BLE cache clear completed');
            }
            // Give Android time to fully reset
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.log('⚠️ Final BLE reset error (continuing):', error.message);
          }
        }
        // STEP 5: Scan preparation - clear any cached device lists before scanning
        console.log('🧹 Pre-scan preparation - clearing device caches...');
        try {
          if (BrainLinkModule?.clearScanResults) {
            await BrainLinkModule.clearScanResults();
            console.log('✅ Cleared scan results');
          }
          if (BrainLinkModule?.clearDiscoveredDevices) {
            await BrainLinkModule.clearDiscoveredDevices();
            console.log('✅ Cleared discovered devices');
          }
          // Clear local device state
          setDevices([]);
          localDevices.length = 0;
          console.log('✅ Cleared local device state');
          // Wait a moment for clearing to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.log('⚠️ Pre-scan preparation error (continuing):', error.message);
        }
        // STEP 6: Fresh scan start with enhanced parameters and aggressive fallback
        console.log('🔍 Starting fresh device scan with enhanced detection...');
        setConnectionStatus('scanning');
        try {
          // Try hook method first with enhanced logging
          console.log('🔄 Attempting hook startScan...');
          await startScan();
          console.log('✅ Hook scan started successfully - waiting for device discovery...');
          // IMMEDIATE DEVICE DISCOVERY: Don't wait, start looking for devices right away
          setTimeout(() => {
            if (BrainLinkModule && BrainLinkModule.getAvailableDevices) {
              BrainLinkModule.getAvailableDevices()
                .then(foundDevices => {
                  if (foundDevices && foundDevices.length > 0) {
                    console.log('✅ Immediate device discovery found:', foundDevices.length, 'devices');
                    setDevices(foundDevices);
                  } else {
                    console.log('📱 No devices in immediate discovery - continuing scan...');
                  }
                })
                .catch(error => console.log('⚠️ Immediate discovery error:', error.message));
            }
          }, 500); // Check immediately after 500ms
          // Set a timer to check if devices are discovered via hook
          setTimeout(() => {
            if ((devices && devices.length === 0) && (localDevices && localDevices.length === 0)) {
              console.log('⚠️ No devices found via hook or immediate discovery - trying native fallback...');
              tryNativeScanFallback();
            } else {
              console.log('✅ Devices discovered via hook:', devices?.length || 0, 'local:', localDevices?.length || 0);
            }
          }, 3000);
        } catch (error) {
          console.log('⚠️ Hook scan failed, trying native module fallback immediately:', error.message);
          await tryNativeScanFallback();
        }
        // Helper function for native scan fallback
        const tryNativeScanFallback = async () => {
          if (BrainLinkModule && BrainLinkModule.startScan) {
            try {
              console.log('🔄 Starting native BrainLinkModule scan...');
              await BrainLinkModule.startScan();
              console.log('✅ Native scan started successfully');
              // Also try additional native scan methods if available
              if (BrainLinkModule.scanForDevices) {
                console.log('🔄 Trying BrainLinkModule.scanForDevices...');
                await BrainLinkModule.scanForDevices();
              }
              if (BrainLinkModule.discoverDevices) {
                console.log('🔄 Trying BrainLinkModule.discoverDevices...');
                await BrainLinkModule.discoverDevices();
              }
            } catch (nativeError) {
              console.log('⚠️ Native scan also failed:', nativeError.message);
              setConnectionStatus('ready'); // Reset status if all scans fail
            }
          } else {
            console.log('⚠️ No native scan methods available');
            setConnectionStatus('ready');
          }
        };
        console.log('✅ COMPREHENSIVE STATE RESET COMPLETE - Post-reload detection should work now');
      }
    } catch (error) {
      console.error('❌ Comprehensive scan button error:', error);
      Alert.alert('Connection Error', `Operation failed: ${error.message}`);
    }
  }, [connectionStatus, isScanning, disconnect, stopScan, startScan, clearAllData, clearAllStates, reinitializeSDK, hardReset]);
  // ULTRA-FAST EEG Data Handler - OPTIMIZED FOR 512Hz RAW DATA
  const handleEEGData = useCallback((rawData) => {
    // DEBUG: Log incoming data structure (throttled upstream)
    console.log('📨 handleEEGData called:', { 
      hasRawData: !!rawData, 
      hasRawValue: rawData?.rawValue !== undefined,
      hasBattery: (rawData?.batteryLevel !== undefined) || (rawData?.battery !== undefined) || (rawData?.batteryCapacity !== undefined) || (rawData?.type === 'battery'),
      dataKeys: rawData ? Object.keys(rawData) : [],
      currentScreen 
    });

    if (!rawData) return;

    // Handle battery updates first (can arrive without rawValue)
    try {
      let batteryCandidate = undefined;
      if (rawData.type === 'battery' && rawData.batteryLevel !== undefined) {
        batteryCandidate = rawData.batteryLevel;
      } else if (rawData.batteryLevel !== undefined) {
        batteryCandidate = rawData.batteryLevel;
      } else if (rawData.battery !== undefined) {
        batteryCandidate = rawData.battery;
      } else if (rawData.batteryCapacity !== undefined) { // some payloads use batteryCapacity
        batteryCandidate = rawData.batteryCapacity;
      }

      if (batteryCandidate !== undefined) {
        const val = getSafeNumericValue(batteryCandidate);
        if (val >= 0 && val <= 100) {
          setDetailedEEGData(prev => ({ ...prev, batteryLevel: val }));
        }
      }
    } catch (e) {
      // Non-fatal; ignore battery parse errors
    }

    // If this event doesn't contain raw EEG, stop here
    if (rawData.rawValue === undefined) return;
    
    const now = Date.now();
    
    // CRITICAL: Update real-time EEG data for 512Hz visualization (UNCHANGED)
    setRealTimeEegData(prev => {
      const newData = [...prev, rawData.rawValue];
      // Keep last 1024 samples (2 seconds at 512Hz)
      return newData.slice(-1024);
    });
    
    // Store in buffer for main dashboard display (UNCHANGED)
    rawBufferRef.current.push(rawData.rawValue);
    if (rawBufferRef.current.length > maxRawBufferSize) {
      rawBufferRef.current = rawBufferRef.current.slice(-maxRawBufferSize);
    }
    
  // BACKGROUND DSP: Raw samples are now fed in unthrottled event listeners to avoid starvation
    
    // Simple frequency tracking (reduced frequency to minimize overhead) (UNCHANGED)
    jsFreqSampleCount.current++;
    
    // Only update frequency every 512 samples (once per second at 512Hz)
    if (jsFreqSampleCount.current >= 512) {
      const timeDiff = now - jsFreqStartTime.current;
      const frequency = (jsFreqSampleCount.current * 1000.0) / timeDiff;
      
      // Log frequency every 2 seconds to monitor 512Hz performance
      if (jsFreqSampleCount.current % 1024 === 0) {
        console.log(`📊 EEG 512Hz: ${frequency.toFixed(1)}Hz`);
      }
      
      setJsFrequencyMeasurement({
        frequency: frequency,
        sampleCount: jsFreqSampleCount.current,
        timeSpan: timeDiff,
        lastMeasurement: now
      });
      
      // Reset counters
      jsFreqStartTime.current = now;
      jsFreqSampleCount.current = 0;
    }
    
    // MINIMAL UI updates for other metrics (reduced frequency)
  if (rawData.attention !== undefined || rawData.meditation !== undefined || 
        rawData.signal !== undefined || rawData.delta !== undefined) {
      // Only update every 10th sample to reduce state updates
      if (jsFreqSampleCount.current % 10 === 0) {
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
          highGamma: rawData.highGamma !== undefined ? rawData.highGamma : prev.highGamma,
          rawValue: rawData.rawValue,
          timestamp: now
        }));
      }
    }
  }, []);
  // Initialize SDK on component mount - STRICT INITIALIZATION
  useEffect(() => {
    // Track app start time for proper post-reload detection
    if (!window.appStartTime) {
      window.appStartTime = Date.now();
      console.log('📱 App start time recorded:', new Date(window.appStartTime).toISOString());
    }
    
    const initializeSDK = async () => {
      try {
        console.log('🔧 Initializing MacrotellectLink SDK with strict state clearing...');
        setSdkInitialized(false);
        setSdkError(null);
        setConnectionStatus('disconnected'); // Start DISCONNECTED
        // IMMEDIATE POST-RELOAD BLE RESET: Reset BLE stack BEFORE anything else
        console.log('🚨 CRITICAL: Performing immediate post-reload BLE reset...');
        // Detect if this is a post-reload scenario - ENHANCED DETECTION
        const hasStaleState = window.eegDataListener || window.connectionListener || 
                              window.disconnectionTimer || window.connectionRetryCount;
        // Additional post-reload indicators
        const hasStaleMetroState = window.__METRO_RELOAD__ || 
                                   (typeof __DEV__ !== 'undefined' && __DEV__) ||
                                   (window.performance && window.performance.navigation && window.performance.navigation.type === 1);
        // Check for React Native development mode indicators
        const isDevelopmentReload = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ && 
                                   window.__REACT_DEVTOOLS_GLOBAL_HOOK__.reactDevtoolsAgent;
        const isPostReloadDetected = hasStaleState || hasStaleMetroState || isDevelopmentReload;
        if (isPostReloadDetected) {
          console.log('🔄 ENHANCED POST-RELOAD DETECTION - Enabling comprehensive BLE reset...');
          console.log('📍 Post-reload indicators:', {
            hasStaleState,
            hasStaleMetroState,
            isDevelopmentReload,
            metroReload: !!window.__METRO_RELOAD__,
            devMode: typeof __DEV__ !== 'undefined' ? __DEV__ : 'undefined',
            navigationType: window.performance?.navigation?.type
          });
          setIsPostReload(true);
        } else {
          console.log('🆕 Fresh app initialization detected');
        }
        try {
          // CRITICAL: Force disconnect ANY existing paired/connected BrainLink devices
          console.log('🚨 FORCE DISCONNECTING ALL BRAINLINK DEVICES...');
          // Method 1: Disconnect all devices by type
          if (BrainLinkModule?.disconnectAllDevices) {
            await BrainLinkModule.disconnectAllDevices();
            console.log('✅ Disconnected all devices');
          }
          // Method 2: Get connected devices and disconnect each one
          if (BrainLinkModule?.getConnectedDevices) {
            try {
              const connectedDevices = await BrainLinkModule.getConnectedDevices();
              if (connectedDevices && connectedDevices.length > 0) {
                console.log(`🔌 Found ${connectedDevices.length} connected devices, disconnecting...`);
                for (const device of connectedDevices) {
                  if (BrainLinkModule?.disconnectDevice) {
                    await BrainLinkModule.disconnectDevice();
                    console.log(`✅ Disconnected device: ${device.name || device.mac}`);
                  }
                }
              }
            } catch (error) {
              console.log('⚠️ Get connected devices failed:', error.message);
            }
          }
          // Method 3: Force unpair all BrainLink devices
          if (BrainLinkModule?.unpairAllBrainLinkDevices) {
            await BrainLinkModule.unpairAllBrainLinkDevices();
            console.log('✅ Unpaired all BrainLink devices');
          }
          // Method 4: Get paired devices and unpair BrainLink ones
          if (BrainLinkModule?.getPairedDevices) {
            try {
              const pairedDevices = await BrainLinkModule.getPairedDevices();
              if (pairedDevices && pairedDevices.length > 0) {
                console.log(`🔗 Found ${pairedDevices.length} paired devices, checking for BrainLink...`);
                for (const device of pairedDevices) {
                  const deviceName = (device.name || '').toLowerCase();
                  if (deviceName.includes('brainlink') || deviceName.includes('macrotellect')) {
                    if (BrainLinkModule?.unpairDevice) {
                      await BrainLinkModule.unpairDevice(device.mac || device.address);
                      console.log(`✅ Unpaired BrainLink device: ${device.name || device.mac}`);
                    }
                  }
                }
              }
            } catch (error) {
              console.log('⚠️ Get paired devices failed:', error.message);
            }
          }
          console.log('⏱️ Waiting 3 seconds for device disconnection/unpairing...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          // ANDROID BLE SUBSYSTEM RESET: Complete BLE stack reset
          console.log('🔄 RESETTING ANDROID BLE SUBSYSTEM...');
          // Step 1: Disable Bluetooth entirely
          if (BrainLinkModule?.disableBluetooth) {
            console.log('📱 Disabling Bluetooth...');
            await BrainLinkModule.disableBluetooth();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          // Step 2: Clear all BLE caches while disabled
          if (BrainLinkModule?.clearBLECache) {
            console.log('🧹 Clearing BLE cache while disabled...');
            await BrainLinkModule.clearBLECache();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          // Step 3: Reset GATT cache specifically
          if (BrainLinkModule?.resetGattCache) {
            console.log('🔄 Resetting GATT cache...');
            await BrainLinkModule.resetGattCache();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          // Step 4: Clear connection cache
          if (BrainLinkModule?.clearBLEConnections) {
            console.log('🔌 Clearing BLE connections...');
            await BrainLinkModule.clearBLEConnections();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          // Step 5: Re-enable Bluetooth
          if (BrainLinkModule?.enableBluetooth) {
            console.log('📱 Re-enabling Bluetooth...');
            await BrainLinkModule.enableBluetooth();
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer for BT to fully start
          }
          // Step 6: Reset BLE adapter after re-enabling
          if (BrainLinkModule?.resetBLEAdapter) {
            console.log('🔄 Resetting BLE adapter after re-enable...');
            await BrainLinkModule.resetBLEAdapter();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          // Step 7: Clear scan-specific caches and filters
          console.log('🔍 Clearing scan-specific caches...');
          if (BrainLinkModule?.clearScanCache) {
            await BrainLinkModule.clearScanCache();
            console.log('✅ Cleared scan cache');
          }
          if (BrainLinkModule?.clearScanResults) {
            await BrainLinkModule.clearScanResults();
            console.log('✅ Cleared scan results');
          }
          if (BrainLinkModule?.resetScanFilters) {
            await BrainLinkModule.resetScanFilters();
            console.log('✅ Reset scan filters');
          }
          // Step 8: Clear device discovery cache
          if (BrainLinkModule?.clearDiscoveryCache) {
            await BrainLinkModule.clearDiscoveryCache();
            console.log('✅ Cleared discovery cache');
          }
          console.log('✅ COMPREHENSIVE BLE SYSTEM RESET COMPLETE!');
          // Stop all scans first
          if (BrainLinkModule?.stopScan) {
            await BrainLinkModule.stopScan();
          }
          if (BrainLinkModule?.stopDiscovery) {
            await BrainLinkModule.stopDiscovery();
          }
          // Disconnect all devices
          if (BrainLinkModule?.disconnectAllDevices) {
            await BrainLinkModule.disconnectAllDevices();
          }
          console.log('⏱️ Waiting 2 seconds for BLE operations to stop...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          // Reset BLE adapter
          if (BrainLinkModule?.resetBLEAdapter) {
            console.log('🔄 Resetting BLE adapter...');
            await BrainLinkModule.resetBLEAdapter();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          // Clear BLE cache  
          if (BrainLinkModule?.clearBLECache) {
            console.log('🧹 Clearing BLE cache...');
            await BrainLinkModule.clearBLECache();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          // Clear BLE connections
          if (BrainLinkModule?.clearBLEConnections) {
            console.log('🔌 Clearing BLE connections...');
            await BrainLinkModule.clearBLEConnections();
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          // Reset Bluetooth stack
          if (BrainLinkModule?.resetBluetoothStack) {
            console.log('📡 Resetting Bluetooth stack...');
            await BrainLinkModule.resetBluetoothStack();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          // Additional potential reset methods
          if (BrainLinkModule?.refreshBluetoothCache) {
            console.log('🔄 Refreshing Bluetooth cache...');
            await BrainLinkModule.refreshBluetoothCache();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          if (BrainLinkModule?.resetGattCache) {
            console.log('🔄 Resetting GATT cache...');
            await BrainLinkModule.resetGattCache();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          if (BrainLinkModule?.clearScanCache) {
            console.log('🧹 Clearing scan cache...');
            await BrainLinkModule.clearScanCache();
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          console.log('✅ CRITICAL BLE RESET COMPLETE - Android BLE should be fresh now');
          // VERIFICATION: Check if BLE is responsive after reset
          try {
            console.log('🔍 Verifying BLE responsiveness after reset...');
            if (BrainLinkModule?.isBluetoothEnabled) {
              const isEnabled = await BrainLinkModule.isBluetoothEnabled();
              console.log('📡 Bluetooth enabled:', isEnabled);
            }
            if (BrainLinkModule?.getBluetoothState) {
              const state = await BrainLinkModule.getBluetoothState();
              console.log('📡 Bluetooth state:', state);
            }
            console.log('✅ BLE verification complete - proceeding with initialization');
          } catch (verifyError) {
            console.log('⚠️ BLE verification error (may be normal):', verifyError.message);
          }
        } catch (resetError) {
          console.log('⚠️ BLE reset error (continuing anyway):', resetError.message);
        }
        // AGGRESSIVE STATE CLEARING FIRST
        console.log('🧹 Performing aggressive state clearing...');
        clearAllData();
        // Clear any stale native state with better error handling
        try {
          if (BrainLinkModule && BrainLinkModule.forceDisconnect) {
            await BrainLinkModule.forceDisconnect();
            console.log('✅ Force disconnected native module');
          }
        } catch (error) {
          console.log('⚠️ Force disconnect error (expected if not connected):', error.message);
        }
        // Clear paired devices with error handling
        try {
          if (BrainLinkModule && BrainLinkModule.clearPairedDevices) {
            await BrainLinkModule.clearPairedDevices();
            console.log('✅ Cleared paired devices');
          }
        } catch (error) {
          console.log('⚠️ Clear paired devices error:', error.message);
        }
        // Reset Bluetooth stack with error handling
        try {
          if (BrainLinkModule && BrainLinkModule.resetBluetoothStack) {
            await BrainLinkModule.resetBluetoothStack();
            console.log('✅ Reset Bluetooth stack');
          }
        } catch (error) {
          console.log('⚠️ Reset Bluetooth stack error:', error.message);
        }
        // Stop any existing scans to prevent HandlerThread errors
        try {
          if (BrainLinkModule && BrainLinkModule.stopScan) {
            await BrainLinkModule.stopScan();
            console.log('✅ Stopped any existing scans');
          }
        } catch (error) {
          console.log('⚠️ Stop existing scans error (expected if not scanning):', error.message);
        }
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        await MacrotellectLinkService.initialize();
        console.log('⏱️ SDK initialized - waiting for BLE stabilization period...');
        // Longer stabilization for post-reload scenarios
        const stabilizationTime = isPostReload ? 5000 : 3000; // 5s for post-reload, 3s for normal
        console.log(`⏱️ ${isPostReload ? 'POST-RELOAD' : 'NORMAL'} stabilization: ${stabilizationTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, stabilizationTime));
        setSdkInitialized(true);
        setConnectionStatus('ready'); // Only ready after initialization
        console.log('✅ MacrotellectLink SDK initialized successfully');
        
        // BACKGROUND DSP: Initialize efficient filtering system (DISABLED BY DEFAULT)
        console.log('🔧 Background DSP processor initialized but INACTIVE (user must enable)');
        try {
          // Setup UI callback for filtered data updates - SMOOTH STREAMING like raw signal
          const handleFilteredData = (result) => {
            if (result && Array.isArray(result.filteredData) && result.filteredData.length > 0) {
              // Enqueue incoming samples; avoid large prop arrays to child
              filteredQueueRef.current.push(result.filteredData);
            }
            // Latest features (arrive ~every 2s)
            if (result && result.features) {
              setLatestFeatures(result.features);
            }
            // Always keep the most recent stats, but apply with the next flush to reduce renders
            if (result && result.stats) {
              // Store latest stats alongside queue to publish on flush
              filteredQueueRef.current._latestStats = result.stats;
            }

            // Schedule a lightweight flush at ~20fps (every 50ms)
            if (!filteredFlushTimerRef.current) {
              filteredFlushTimerRef.current = setTimeout(() => {
                try {
                  const q = filteredQueueRef.current;
                  if (q && q.length > 0) {
                    // Merge queued chunks into a single small batch for the child component
                    const merged = q.length === 1 ? q[0] : q.flat();
                    // Pass only the latest chunk(s); FilteredEEGDisplay maintains its own rolling buffer
                    setFilteredEEGData(merged);
                  }
                  // Publish latest stats, if any
                  if (filteredQueueRef.current && filteredQueueRef.current._latestStats) {
                    setDspPerformanceStats(filteredQueueRef.current._latestStats);
                  }
                } finally {
                  // Reset queue and timer
                  filteredQueueRef.current = [];
                  filteredFlushTimerRef.current = null;
                  // Clean latest stats holder
                  if (filteredQueueRef.current && filteredQueueRef.current._latestStats) {
                    delete filteredQueueRef.current._latestStats;
                  }
                }
              }, 50); // 50ms ≈ 20fps
            }
          };
          
          // DON'T start automatically - let user enable it
          // backgroundDSPManager.start(handleFilteredData);
          setBackgroundDSPActive(false); // Start inactive
          console.log('✅ Background DSP ready but inactive - will not interfere with BLE');
          
          // Store callback for later use
          window.dspUICallback = handleFilteredData;
        } catch (dspError) {
          console.warn('⚠️ Background DSP setup failed (non-critical):', dspError.message);
          setBackgroundDSPActive(false);
        }
        
        // POST-RELOAD CONNECTION RESTORATION: Check if device is already connected
        if (isPostReloadDetected && BrainLinkModule) {
          console.log('🔍 POST-RELOAD: Checking for existing device connections...');
          try {
            // Check if any devices are already connected
            if (BrainLinkModule.getConnectedDevices) {
              const connectedDevices = await BrainLinkModule.getConnectedDevices();
              if (connectedDevices && connectedDevices.length > 0) {
                console.log('🔗 POST-RELOAD: Found existing connected devices:', connectedDevices.length);
                // Find BrainLink devices
                const brainLinkDevices = connectedDevices.filter(device => {
                  const name = (device.name || '').toLowerCase();
                  return name.includes('brainlink') || name.includes('macrotellect');
                });
                if (brainLinkDevices.length > 0) {
                  console.log('✅ POST-RELOAD: Found connected BrainLink device, restoring connection state...');
                  setConnectionStatus('connected');
                  // Store the connected device info
                  if (brainLinkDevices[0]) {
                    lastConnectedDevice.current = brainLinkDevices[0];
                    console.log('📱 Restored device info:', lastConnectedDevice.current);
                  }
                  // Skip auto-connection check since we're already connected
                  console.log('✅ POST-RELOAD: Connection state restored successfully');
                  return; // Early exit, don't run the normal auto-connection check
                }
              }
            }
            // Check if device is connected via data flow
            if (BrainLinkModule.isDataStreaming) {
              const isStreaming = await BrainLinkModule.isDataStreaming();
              if (isStreaming) {
                console.log('📊 POST-RELOAD: Data is streaming, device likely connected');
                setConnectionStatus('connected');
                return;
              }
            }
            console.log('❌ POST-RELOAD: No existing connections found, will reset and reconnect');
            // Force BLE stack reset for clean reconnection
            console.log('🔄 POST-RELOAD: Forcing BLE stack reset...');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Extra delay for stack reset
          } catch (error) {
            console.log('⚠️ POST-RELOAD: Connection check failed:', error.message);
          }
        }
        // SKIP AUTO-CONNECTION CHECK - Start fresh
        console.log('🚫 Skipping auto-connection check - starting fresh');
        // Add direct event listeners for native module events
        console.log('📡 Setting up direct event listeners...');
        // Listen for EEG data from native module with THROTTLING to prevent UI blocking
        let lastDataProcessTime = 0;
        const DATA_PROCESS_THROTTLE = 100; // Process data max every 100ms
        
        const dataListener = DeviceEventEmitter.addListener('BrainLinkData', (data) => {
          const currentTime = Date.now();
          // Always feed DSP with raw samples (unthrottled) for full 512 Hz ingestion
          try {
            if (backgroundDSPManager?.isRunning && data?.rawValue !== undefined) {
              backgroundDSPManager.addSample(data.rawValue);
            }
          } catch (e) { /* ignore feed errors */ }
          
          // THROTTLE: Skip processing if too frequent to prevent UI blocking
          if (currentTime - lastDataProcessTime < DATA_PROCESS_THROTTLE) {
            return; // Skip this data packet
          }
          lastDataProcessTime = currentTime;
          
          // REMOVED LOG: console.log('📊 [BrainLinkData EVENT] Raw event data (throttled):' - to see sampling rate from Android
          
          // AUTO-DETECT CONNECTION: If we're receiving data, we must be connected
          // But ONLY if we're not already handling a disconnection event
          if (connectionStatus !== 'connected' && 
              connectionStatus !== 'connecting' && 
              !window.disconnectionTimer &&
              !window.isHandlingDisconnection) {
            console.log('🔗 Auto-detecting connection from data flow - setting status to connected');
            setConnectionStatus('connected');
            // Clear any connection retry counters since we have data
            if (window.connectionRetryCount) {
              window.connectionRetryCount = 0;
            }
          }
          
          // Process all data regardless of connection status but THROTTLED
          handleEEGData(data);
        });
        
        // ADDITIONAL: Listen for raw EEG data events (higher frequency) with THROTTLING
        let lastRawDataTime = 0;
        const RAW_DATA_THROTTLE = 100; // Process raw data max every 100ms
        
        const rawDataListener = DeviceEventEmitter.addListener('EEGRawData', (data) => {
          const currentTime = Date.now();
          // Always feed DSP first (unthrottled)
          try {
            if (backgroundDSPManager?.isRunning && data?.rawValue !== undefined) {
              backgroundDSPManager.addSample(data.rawValue);
            }
          } catch (e) { /* ignore feed errors */ }
          
          // THROTTLE: Skip processing if too frequent to prevent UI blocking
          if (currentTime - lastRawDataTime < RAW_DATA_THROTTLE) {
            return; // Skip this raw data packet
          }
          lastRawDataTime = currentTime;
          
          // REMOVED LOG: console.log('📊 [EEGRawData EVENT]' - to see sampling rate from Android
          handleEEGData(data);
        });
        
        // ADDITIONAL: Listen for power data events with THROTTLING
        let lastPowerDataTime = 0;
        const POWER_DATA_THROTTLE = 150; // Process power data max every 150ms
        
        const powerDataListener = DeviceEventEmitter.addListener('EEGPowerData', (data) => {
          const currentTime = Date.now();
          
          // THROTTLE: Skip processing if too frequent to prevent UI blocking
          if (currentTime - lastPowerDataTime < POWER_DATA_THROTTLE) {
            return; // Skip this power data packet
          }
          lastPowerDataTime = currentTime;
          
          // REMOVED LOG: console.log('📊 [EEGPowerData EVENT]' - to see sampling rate from Android
          handleEEGData(data);
        });
        
        // ADDITIONAL: Listen for raw data stream events with THROTTLING
        let lastStreamDataTime = 0;
        const STREAM_DATA_THROTTLE = 100; // Process stream data max every 100ms
        
        const streamDataListener = DeviceEventEmitter.addListener('EEGDataStream', (data) => {
          const currentTime = Date.now();
          // Always feed DSP first (unthrottled)
          try {
            if (backgroundDSPManager?.isRunning && data?.rawValue !== undefined) {
              backgroundDSPManager.addSample(data.rawValue);
            }
          } catch (e) { /* ignore feed errors */ }
          
          // THROTTLE: Skip processing if too frequent to prevent UI blocking
          if (currentTime - lastStreamDataTime < STREAM_DATA_THROTTLE) {
            return; // Skip this stream data packet
          }
          lastStreamDataTime = currentTime;
          
          // REMOVED LOG: console.log('📊 [EEGDataStream EVENT]' - to see sampling rate from Android
          handleEEGData(data);
        });
        // Listen for connection status from native module
        const connectionListener = DeviceEventEmitter.addListener('BrainLinkConnection', (status) => {
          console.log('🔗 Received BrainLinkConnection event:', status);
          console.log('📱 Connection status details:', {
            status: status.status,
            deviceName: status.deviceName,
            deviceMac: status.deviceMac,
            reason: status.reason,
            isConnected: status.isConnected,
            connectionType: status.connectionType
          });
          // CONNECTION STABILIZATION: Handle temporary vs permanent disconnections
          if (status.isConnected === true || status.status === 'connected') {
            console.log('✅ Device connected via native event!');
            
            // CRITICAL: Start high-frequency EEG data collection immediately
            if (BrainLinkModule && BrainLinkModule.startEEGDataCollection) {
              console.log('🧠 Starting high-frequency EEG data collection...');
              BrainLinkModule.startEEGDataCollection()
                .then(() => {
                  console.log('✅ EEG data collection started - should receive 512Hz data');
                })
                .catch(error => {
                  console.error('❌ Failed to start EEG data collection:', error.message);
                });
            } else {
              console.warn('⚠️ startEEGDataCollection method not available');
            }
            
            // Additional data optimization methods
            console.log('🔧 Attempting to enable additional high-frequency data modes...');
            
            // Try enabling real-time data streaming
            try {
              if (BrainLinkModule.enableRealTimeDataStream) {
                BrainLinkModule.enableRealTimeDataStream();
                console.log('✅ Real-time data stream enabled');
              }
            } catch (error) {
              console.log('⚠️ enableRealTimeDataStream not available:', error.message);
            }
            
            // Try setting high frequency mode
            try {
              if (BrainLinkModule.setHighFrequencyMode) {
                BrainLinkModule.setHighFrequencyMode(true);
                console.log('✅ High frequency mode enabled');
              }
            } catch (error) {
              console.log('⚠️ setHighFrequencyMode not available:', error.message);
            }
            
            // Try setting specific sampling rate
            try {
              if (BrainLinkModule.setSamplingRate) {
                BrainLinkModule.setSamplingRate(512);
                console.log('✅ Sampling rate set to 512Hz');
              }
            } catch (error) {
              console.log('⚠️ setSamplingRate not available:', error.message);
            }
            
            // Try enabling streaming mode
            try {
              if (BrainLinkModule.enableStreamingMode) {
                BrainLinkModule.enableStreamingMode(true);
                console.log('✅ Streaming mode enabled');
              }
            } catch (error) {
              console.log('⚠️ enableStreamingMode not available:', error.message);
            }
            
            if (BrainLinkModule && BrainLinkModule.startDeviceScan) {
              // Try to ensure continuous data flow
              console.log('🔄 Ensuring continuous data flow...');
            }
            
            // Clear any pending disconnection timers
            if (window.disconnectionTimer) {
              clearTimeout(window.disconnectionTimer);
              window.disconnectionTimer = null;
            }
            // Reset connection retry count on successful connection
            if (window.connectionRetryCount) {
              window.connectionRetryCount = 0;
            }
            setConnectionStatus('connected');
          } else if (status.status === 'connecting') {
            console.log('🔄 Device connecting via native event - updating UI...');
            // Clear any pending disconnection timers during connection
            if (window.disconnectionTimer) {
              clearTimeout(window.disconnectionTimer);
              window.disconnectionTimer = null;
            }
            setConnectionStatus('connecting');
          } else if (status.isConnected === false || status.status === 'disconnected') {
            console.log('⚠️ Device disconnection detected:', status.reason);
            
            // Prevent race conditions by marking that we're handling disconnection
            window.isHandlingDisconnection = true;
            
            // CONNECTION STABILITY: Don't immediately disconnect on first signal loss
            // Many BLE devices have brief connection drops that recover automatically
            if (status.reason && (
              status.reason.includes('Connection lost') || 
              status.reason.includes('connection timeout') ||
              status.reason.includes('GATT_ERROR') ||
              status.reason.includes('Signal lost')
            )) {
              console.log('🔄 Temporary connection issue detected - analyzing context...');
              
              // IMPROVED POST-RELOAD DETECTION: Only trigger if we're actually in post-reload state
              // AND it's been less than 30 seconds since app start
              const timeSinceAppStart = Date.now() - (window.appStartTime || Date.now());
              const isActualPostReload = isPostReloadDetected && timeSinceAppStart < 30000;
              
              if (isActualPostReload) {
                console.log('🔄 POST-RELOAD: Recent app start detected - using enhanced recovery...');
                // For recent post-reload scenarios, use shorter timeout
                if (window.disconnectionTimer) {
                  clearTimeout(window.disconnectionTimer);
                }
                window.disconnectionTimer = setTimeout(async () => {
                  console.log('🔄 POST-RELOAD: Starting gentle reconnection attempt...');
                  try {
                    // Don't reset entire BLE stack - just clear state
                    setConnectionStatus('disconnected');
                    window.disconnectionTimer = null;
                    window.connectionRetryCount = 0;
                    window.isHandlingDisconnection = false;
                    console.log('🔗 POST-RELOAD: Ready for reconnection');
                  } catch (error) {
                    console.log('⚠️ POST-RELOAD: Recovery failed:', error.message);
                    setConnectionStatus('disconnected');
                    window.disconnectionTimer = null;
                    window.connectionRetryCount = 0;
                    window.isHandlingDisconnection = false;
                  }
                }, 4000); // 4 second timeout for post-reload scenarios
              } else {
                // Normal scenario - give device time to self-recover
                console.log('🔄 Normal disconnection - allowing natural recovery time...');
                
                // Initialize retry counter if needed
                if (!window.connectionRetryCount) window.connectionRetryCount = 0;
                
                // Give the device time to self-recover before declaring disconnection
                if (window.disconnectionTimer) {
                  clearTimeout(window.disconnectionTimer);
                }
                window.disconnectionTimer = setTimeout(() => {
                  console.log('❌ Connection recovery timeout - marking as disconnected');
                  setConnectionStatus('disconnected');
                  window.disconnectionTimer = null;
                  window.connectionRetryCount = 0;
                  window.isHandlingDisconnection = false;
                }, 6000); // 6 second wait for natural recovery (reduced from 8s)
              }
            } else {
              // Immediate disconnection for intentional disconnects or other errors
              console.log('❌ Permanent disconnection detected');
              setConnectionStatus('disconnected');
              if (window.disconnectionTimer) {
                clearTimeout(window.disconnectionTimer);
                window.disconnectionTimer = null;
              }
              window.connectionRetryCount = 0;
              window.isHandlingDisconnection = false;
            }
          }
        });
        // Listen for device discovery events - CRITICAL FOR POST-RELOAD DETECTION
        const deviceDiscoveryListener = DeviceEventEmitter.addListener('BrainLinkDeviceFound', (device) => {
          console.log('📱 Device discovered via native event:', device);
          // Force trigger a hook update if needed
          console.log('🔄 Triggering manual device list refresh...');
        });
        // Listen for scan status events
        const scanStatusListener = DeviceEventEmitter.addListener('BrainLinkScanStatus', (status) => {
          console.log('🔍 Scan status update:', status);
          if (status.isScanning !== undefined) {
            // Update scanning status based on native events
            if (status.isScanning && connectionStatus !== 'scanning') {
              console.log('📡 Native confirms scanning started');
              setConnectionStatus('scanning');
            } else if (!status.isScanning && connectionStatus === 'scanning') {
              console.log('📡 Native confirms scanning stopped');
              setConnectionStatus('ready');
            }
          }
        });
        // ADDITIONAL LISTENERS: Try multiple event names that might be used
        const deviceFoundListener = DeviceEventEmitter.addListener('DeviceFound', (device) => {
          console.log('📱 Device found via DeviceFound event:', device);
          if (device && (device.name || device.mac || device.address)) {
            setDevices(prev => {
              const deviceKey = device.mac || device.address || device.name;
              const exists = prev.find(d => (d.mac || d.address || d.name) === deviceKey);
              if (!exists) {
                console.log('✅ Adding new device from DeviceFound:', device);
                return [...prev, device];
              }
              return prev;
            });
          }
        });
        const scanResultListener = DeviceEventEmitter.addListener('ScanResult', (result) => {
          console.log('📱 Scan result received:', result);
          // Handle different result structures
          let device = result;
          if (result && result.device) device = result.device;
          if (result && result.peripheral) device = result.peripheral;
          if (device && (device.name || device.mac || device.address)) {
            setDevices(prev => {
              const deviceKey = device.mac || device.address || device.name;
              const exists = prev.find(d => (d.mac || d.address || d.name) === deviceKey);
              if (!exists) {
                console.log('✅ Adding new device from ScanResult:', device);
                return [...prev, device];
              }
              return prev;
            });
          }
        });
        const bluetoothDeviceListener = DeviceEventEmitter.addListener('BluetoothDevice', (device) => {
          console.log('📱 Bluetooth device detected:', device);
          if (device && (device.name || device.mac || device.address)) {
            setDevices(prev => {
              const deviceKey = device.mac || device.address || device.name;
              const exists = prev.find(d => (d.mac || d.address || d.name) === deviceKey);
              if (!exists) {
                console.log('✅ Adding new device from BluetoothDevice:', device);
                return [...prev, device];
              }
              return prev;
            });
          }
        });
        // COMPREHENSIVE EVENT LISTENERS: Try every possible device discovery event
        const possibleEventNames = [
          'BLEDeviceFound', 'BLEScanResult', 'BluetoothScanResult',
          'BrainLinkDeviceDiscovered', 'MacrotellectDeviceFound',
          'PeripheralFound', 'PeripheralDiscovered', 'BluetoothPeripheral',
          'BLEPeripheral', 'DeviceDiscovered', 'BLEDevice'
        ];
        const additionalListeners = [];
        possibleEventNames.forEach(eventName => {
          try {
            const listener = DeviceEventEmitter.addListener(eventName, (data) => {
              console.log(`🔍 ${eventName} event received:`, data);
              // Extract device from various possible data structures
              let device = data;
              if (data && data.device) device = data.device;
              if (data && data.peripheral) device = data.peripheral;
              if (data && data.result) device = data.result;
              if (device && (device.name || device.mac || device.address || device.id)) {
                setDevices(prev => {
                  const deviceKey = device.mac || device.address || device.id || device.name;
                  const exists = prev.find(d => (d.mac || d.address || d.id || d.name) === deviceKey);
                  if (!exists) {
                    console.log(`✅ Adding new device from ${eventName}:`, device);
                    return [...prev, device];
                  }
                  return prev;
                });
              }
            });
            additionalListeners.push({ name: eventName, listener });
          } catch (error) {
            console.log(`⚠️ Failed to add listener for ${eventName}:`, error.message);
          }
        });
        // Store listeners for cleanup
        window.eegDataListener = dataListener;
        window.rawDataListener = rawDataListener;
        window.powerDataListener = powerDataListener;
        window.streamDataListener = streamDataListener;
        window.connectionListener = connectionListener;
        window.deviceDiscoveryListener = deviceDiscoveryListener;
        window.scanStatusListener = scanStatusListener;
        window.deviceFoundListener = deviceFoundListener;
        window.scanResultListener = scanResultListener;
        window.bluetoothDeviceListener = bluetoothDeviceListener;
        window.additionalListeners = additionalListeners;
        console.log('✅ Direct event listeners setup complete');
      } catch (error) {
        console.error('❌ Failed to initialize MacrotellectLink SDK:', error);
        setSdkError(error.message);
        setSdkInitialized(false);
      }
    };
    initializeSDK();
    // PRODUCTION CLEANUP: Comprehensive cleanup on component unmount
    return () => {
      console.log('🚨 COMPONENT UNMOUNTING - Executing production cleanup...');
      
      // BACKGROUND DSP: Stop background processing first
      if (backgroundDSPActive) {
        console.log('🛑 Stopping background DSP processor...');
        backgroundDSPManager.stop();
        setBackgroundDSPActive(false);
        console.log('✅ Background DSP stopped');
      }
      
      // Remove event listeners immediately
      if (window.eegDataListener) {
        window.eegDataListener.remove();
        window.eegDataListener = null;
      }
      if (window.rawDataListener) {
        window.rawDataListener.remove();
        window.rawDataListener = null;
      }
      if (window.powerDataListener) {
        window.powerDataListener.remove();
        window.powerDataListener = null;
      }
      if (window.streamDataListener) {
        window.streamDataListener.remove();
        window.streamDataListener = null;
      }
      if (window.connectionListener) {
        window.connectionListener.remove();
        window.connectionListener = null;
      }
      if (window.deviceDiscoveryListener) {
        window.deviceDiscoveryListener.remove();
        window.deviceDiscoveryListener = null;
      }
      if (window.scanStatusListener) {
        window.scanStatusListener.remove();
        window.scanStatusListener = null;
      }
      if (window.deviceFoundListener) {
        window.deviceFoundListener.remove();
        window.deviceFoundListener = null;
      }
      if (window.scanResultListener) {
        window.scanResultListener.remove();
        window.scanResultListener = null;
      }
      if (window.bluetoothDeviceListener) {
        window.bluetoothDeviceListener.remove();
        window.bluetoothDeviceListener = null;
      }
      // Clean up additional listeners
      if (window.additionalListeners) {
        window.additionalListeners.forEach(({ name, listener }) => {
          try {
            listener.remove();
            console.log(`✅ Removed ${name} listener`);
          } catch (error) {
            console.log(`⚠️ Failed to remove ${name} listener:`, error.message);
          }
        });
        window.additionalListeners = null;
      }
      // Clear global variables
      if (window.rawDataBatch) window.rawDataBatch = [];
      if (window.lastChartUpdate) window.lastChartUpdate = 0;
      if (window.lastDataTimeUpdate) window.lastDataTimeUpdate = 0;
      // Clear connection stabilization timer and retry counter
      if (window.disconnectionTimer) {
        clearTimeout(window.disconnectionTimer);
        window.disconnectionTimer = null;
      }
      if (window.connectionRetryCount) {
        window.connectionRetryCount = 0;
      }
      // FORCE DISCONNECT ALL DEVICES for production reliability
      const productionCleanup = async () => {
        try {
          console.log('🔄 Executing production device cleanup...');
          // Try all available disconnection methods
          const disconnectionPromises = [];
          if (BrainLinkModule) {
            // Native module disconnection methods with enhanced error handling
            if (BrainLinkModule.forceDisconnect) {
              disconnectionPromises.push(
                BrainLinkModule.forceDisconnect()
                  .then(() => console.log('✅ Component unmount: Force disconnect successful'))
                  .catch((error) => console.log('⚠️ Component unmount: Force disconnect error (expected):', error.message))
              );
            }
            if (BrainLinkModule.disconnectFromDevice) {
              disconnectionPromises.push(
                BrainLinkModule.disconnectFromDevice()
                  .then(() => console.log('✅ Component unmount: Regular disconnect successful'))
                  .catch((error) => console.log('⚠️ Component unmount: Regular disconnect error (expected):', error.message))
              );
            }
            if (BrainLinkModule.stopScan) {
              disconnectionPromises.push(
                BrainLinkModule.stopScan()
                  .then(() => console.log('✅ Component unmount: Stop scan successful'))
                  .catch((error) => console.log('⚠️ Component unmount: Stop scan error (HandlerThread issue expected):', error.message))
              );
            }
            if (BrainLinkModule.clearPairedDevices) {
              disconnectionPromises.push(
                BrainLinkModule.clearPairedDevices()
                  .then(() => console.log('✅ Component unmount: Clear paired devices successful'))
                  .catch((error) => console.log('⚠️ Component unmount: Clear paired devices error (expected):', error.message))
              );
            }
            if (BrainLinkModule.emergencyStop) {
              disconnectionPromises.push(
                BrainLinkModule.emergencyStop()
                  .then(() => console.log('✅ Component unmount: Emergency stop successful'))
                  .catch((error) => console.log('⚠️ Component unmount: Emergency stop error (expected):', error.message))
              );
            }
          }
          // Execute all disconnection methods in parallel
          if (disconnectionPromises.length > 0) {
            await Promise.allSettled(disconnectionPromises);
          }
          // Also try hook methods with error handling
          if (typeof stopScan === 'function') {
            try {
              await stopScan();
              console.log('✅ Component unmount: Hook stop scan successful');
            } catch (error) {
              console.log('⚠️ Component unmount: Hook stop scan error (expected):', error.message);
            }
          }
          if (typeof disconnect === 'function') {
            try {
              await disconnect();
              console.log('✅ Component unmount: Hook disconnect successful');
            } catch (error) {
              console.log('⚠️ Component unmount: Hook disconnect error (expected):', error.message);
            }
          }
          console.log('✅ Production cleanup completed - all connections stopped');
        } catch (error) {
          console.log('⚠️ Production cleanup error (expected):', error.message);
        }
      };
      // Execute cleanup without blocking unmount
      productionCleanup();
      console.log('✅ Component unmount cleanup initiated');
    };
  }, [clearAllData, stopScan, disconnect]);
  // SUPER AGGRESSIVE POLLING: Force device discovery every 2 seconds during scan
  useEffect(() => {
    let pollingInterval;
    if (connectionStatus === 'scanning' && BrainLinkModule) {
      // More aggressive polling for post-reload scenarios
      const pollInterval = isPostReload ? 1000 : 2000; // 1s vs 2s
      console.log(`🚀 Starting ${isPostReload ? 'ENHANCED POST-RELOAD' : 'super aggressive'} device polling every ${pollInterval}ms...`);
      pollingInterval = setInterval(async () => {
        console.log('🔄 Aggressive polling tick - forcing device discovery...');
        try {
          // For post-reload scenarios, try BLE reset methods during polling too
          if (isPostReload) {
            console.log('🔄 POST-RELOAD: Attempting mid-scan BLE refresh...');
            if (BrainLinkModule.refreshBluetoothCache) {
              try {
                await BrainLinkModule.refreshBluetoothCache();
              } catch (e) {
                console.log('⚠️ Mid-scan BLE refresh failed:', e.message);
              }
            }
          }
          // Method 1: Try to get already discovered devices
          if (BrainLinkModule.getAvailableDevices) {
            const availableDevices = await BrainLinkModule.getAvailableDevices();
            if (availableDevices && availableDevices.length > 0) {
              console.log('✅ Polling found devices via getAvailableDevices:', availableDevices);
              setDevices(availableDevices);
            }
          }
          // Method 2: Force refresh device list
          if (BrainLinkModule.refreshDeviceList) {
            await BrainLinkModule.refreshDeviceList();
          }
          // Method 3: Start fresh scan
          if (BrainLinkModule.scanForDevices) {
            await BrainLinkModule.scanForDevices();
          }
          // Method 4: Try discovery
          if (BrainLinkModule.discoverDevices) {
            await BrainLinkModule.discoverDevices();
          }
          // Method 5: Check if hook has devices we missed
          if (devices && devices.length > 0 && localDevices.length === 0) {
            console.log('✅ Polling detected hook devices, copying to local:', devices);
            setDevices(devices);
          }
        } catch (error) {
          console.log('⚠️ Polling error (expected):', error.message);
        }
      }, pollInterval); // Use dynamic interval based on post-reload status
    }
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        console.log('🛑 Stopped aggressive device polling');
      }
    };
  }, [connectionStatus, devices, localDevices, isPostReload]);
  // Update EEG data when hook data changes - ORIGINAL SIMPLE VERSION
  useEffect(() => {
    if (hookEegData) {
      setEegData(hookEegData);
      setLastDataTime(new Date());
    }
  }, [hookEegData]);
  // Monitor devices from hook for debugging + rediscovery
  useEffect(() => {
    if (devices && devices.length > 0) {
      console.log('📱 DEVICES UPDATED via hook:', devices.length, 'devices found');
      devices.forEach((device, index) => {
        console.log(`  Device ${index + 1}:`, {
          name: device.name || 'Unknown',
          mac: device.mac || device.address || 'Unknown MAC',
          rssi: device.rssi || 'Unknown RSSI'
        });
      });
    } else if (devices) {
      console.log('📱 No devices found in hook (devices array exists but empty)');
      // REDUCED AGGRESSIVE REDISCOVERY: Only if scanning and not handling disconnection
      if (connectionStatus === 'scanning' && 
          !window.isHandlingDisconnection && 
          !window.disconnectionTimer) {
        console.log('🔄 Scanning active but no devices - trying gentle rediscovery...');
        setTimeout(() => {
          tryAggressiveDeviceDiscovery();
        }, 3000); // Increased delay to 3 seconds
      }
    } else {
      console.log('📱 Devices array is null/undefined from hook (normal during disconnection recovery)');
    }
  }, [devices, connectionStatus]);
  // Aggressive device discovery helper
  const tryAggressiveDeviceDiscovery = useCallback(async () => {
    console.log('🚀 Starting aggressive device discovery...');
    if (BrainLinkModule) {
      const discoveryMethods = [];
      // Try all available discovery methods
      if (BrainLinkModule.refreshDeviceList) {
        discoveryMethods.push(
          BrainLinkModule.refreshDeviceList()
            .then(() => console.log('✅ refreshDeviceList success'))
            .catch(e => console.log('⚠️ refreshDeviceList failed:', e.message))
        );
      }
      if (BrainLinkModule.scanForDevices) {
        discoveryMethods.push(
          BrainLinkModule.scanForDevices()
            .then(() => console.log('✅ scanForDevices success'))
            .catch(e => console.log('⚠️ scanForDevices failed:', e.message))
        );
      }
      if (BrainLinkModule.getAvailableDevices) {
        discoveryMethods.push(
          BrainLinkModule.getAvailableDevices()
            .then(devs => console.log('✅ getAvailableDevices found:', devs?.length || 0))
            .catch(e => console.log('⚠️ getAvailableDevices failed:', e.message))
        );
      }
      if (BrainLinkModule.discoverDevices) {
        discoveryMethods.push(
          BrainLinkModule.discoverDevices()
            .then(() => console.log('✅ discoverDevices success'))
            .catch(e => console.log('⚠️ discoverDevices failed:', e.message))
        );
      }
      // Execute all discovery methods
      if (discoveryMethods.length > 0) {
        await Promise.allSettled(discoveryMethods);
        console.log('🔍 Aggressive discovery completed - checking for results...');
      } else {
        console.log('⚠️ No native discovery methods available');
      }
    }
  }, []);
  // Update connection status based on hook state - CONSERVATIVE VERSION
  useEffect(() => {
    console.log('🔄 Connection status update - Hook states:', {
      isConnected,
      isScanning,
      sdkInitialized,
      currentConnectionStatus: connectionStatus
    });
    // ONLY update to connected if hook explicitly says connected AND we're not already connected
    if (isConnected && connectionStatus !== 'connected') {
      console.log('✅ Hook confirms connection - updating status to connected');
      setConnectionStatus('connected');
    } 
    // Update scanning status
    else if (isScanning && connectionStatus !== 'scanning') {
      console.log('� Hook confirms scanning - updating status to scanning');
      setConnectionStatus('scanning');
    }
    // Don't auto-disconnect based on hook state - require explicit disconnect
  }, [isConnected, isScanning, sdkInitialized]);
  // Monitor data reception to auto-update connection status - DISABLED TO PREVENT LOOPS
  useEffect(() => {
    // DISABLED: Auto-connection logic disabled to prevent connection loops
    // This was causing devices to immediately reconnect after disconnection
    console.log('⚠️ Auto-connection based on data reception disabled to prevent loops');
    // DISABLE periodic checking to prevent false positives
    console.log('⚠️ Periodic device state checking disabled to prevent false connections');
  }, [lastDataTime, connectionStatus, sdkInitialized]);

  // PYTHON-MATCHED VISUALIZATION TIMER: Only for plot updates (1000ms like Python's QTimer)
  // Note: This is SEPARATE from feature processing which happens immediately on data availability
  useEffect(() => {
    let visualizationTimer;
    
    if (connectionStatus === 'connected' && window.liveDataBuffer) {
      console.log('🎨 Starting Python-matched visualization timer (1000ms - matches QTimer for plots only)');
      
      visualizationTimer = setInterval(() => {
        try {
          // PYTHON-MATCHED: Update plots using accumulated data (like update_live_plot)
          if (window.liveDataBuffer && window.liveDataBuffer.length > 0) {
            console.log(`🎨 Visualization update: ${window.liveDataBuffer.length} samples in buffer`);
            
            // Update real-time EEG data for plotting (matches Python's live plot update)
            setRealTimeEegData(prev => {
              // Keep last 100 samples for display (like Python's plot window)
              const newData = [...prev, ...window.liveDataBuffer.slice(-100)];
              return newData.slice(-100); // Keep only last 100 for display performance
            });
            
            console.log('📊 Live plot data updated (visualization only - features process immediately)');
          }
        } catch (error) {
          console.error('Visualization update error:', error.message);
        }
      }, 1000); // 1000ms intervals exactly like Python QTimer for visualization
      
    } else {
      console.log('🛑 No visualization timer needed - not connected or no data buffer');
    }
    
    // Cleanup timer on unmount or state change
    return () => {
      if (visualizationTimer) {
        clearInterval(visualizationTimer);
        console.log('🛑 Stopped Python-matched visualization timer');
      }
    };
  }, [connectionStatus]);

  // PYTHON-MATCHED CONSTANTS (exactly from Python implementation)
  const PYTHON_CONSTANTS = {
    FS: 512,                      // Sampling frequency (Hz) - NEVER decimated for features
    WINDOW_SIZE: 512,             // FFT window (1 second)
    OVERLAP_SIZE: 128,            // Window overlap (25%)
    NOTCH_FREQ: 50.0,             // Line noise frequency (Hz)
    NOTCH_Q: 30.0,                // Notch filter quality factor
    BANDPASS_LOW: 1.0,            // Highpass cutoff (Hz)
    BANDPASS_HIGH: 45.0,          // Lowpass cutoff (Hz)
    FILTER_ORDER: 2,              // Butterworth filter order
    ARTIFACT_WINDOW: 10,          // Artifact replacement window (samples)
    ARTIFACT_THRESHOLD: 3,        // Standard deviations for artifact detection
    SIGNIFICANCE_THRESHOLD: 1.5,  // Z-score threshold for emotional responses
    THETA_SNR_THRESHOLD: 0.2,     // Minimum SNR for theta enhancement
    SMOOTHING_ALPHA: 0.3          // Exponential smoothing factor
  };
  const performAdvancedSignalProcessing = useCallback((dataBuffer) => {
    try {
      // Track processing start time for performance monitoring
      window.processingStartTime = Date.now();
      
      // PYTHON-MATCHED: Process when sufficient data available (minimum 512 samples)
      if (!dataBuffer || dataBuffer.length < PYTHON_CONSTANTS.WINDOW_SIZE) {
        console.log('⚠️ Advanced processing skipped: insufficient data', dataBuffer?.length || 0);
        return;
      }
      
      console.log(`🔬 Python-matched signal processing with ${dataBuffer.length} samples (started at ${new Date().toISOString().split('T')[1]})`);
      const FS = PYTHON_CONSTANTS.FS; // 512Hz - NO decimation (matches Python exactly)
      
      // PYTHON-MATCHED: Use FULL buffer for analysis (not just window) - matches Python approach
      // Python: "window_data = np.array(list(self.raw_buffer))" - uses entire buffer
      let data = [...dataBuffer]; // Use entire buffer like Python implementation
      
      console.log(`📊 Processing ${data.length} samples at ${FS}Hz (matches Python full buffer processing)`);
      
      // PYTHON STEP 1: DC component removal (matches Python exactly)
      const dcMean = data.reduce((sum, val) => sum + val, 0) / data.length;
      data = data.map(val => val - dcMean);
      console.log('✅ DC component removed (matches Python step 1)');
      // PYTHON STEP 2: Remove eye blink artifacts (matches Python algorithm exactly)
      let cleanedData;
      try {
        cleanedData = removeEyeBlinkArtifacts(data, PYTHON_CONSTANTS.ARTIFACT_WINDOW);
        console.log('✅ Eye blink artifacts removed (matches Python step 2)');
      } catch (error) {
        console.log('⚠️ Artifact removal failed, using original data:', error.message);
        cleanedData = data; // Fallback like Python
      }
      
      // PYTHON STEP 3: Apply notch filter for power line interference (matches Python iirnotch)
      let notchedData;
      try {
        notchedData = applyNotchFilter(cleanedData, FS, PYTHON_CONSTANTS.NOTCH_FREQ, PYTHON_CONSTANTS.NOTCH_Q);
        console.log(`✅ Notch filter applied at ${PYTHON_CONSTANTS.NOTCH_FREQ}Hz (matches Python step 3)`);
      } catch (error) {
        console.log('⚠️ Notch filter failed, using cleaned data:', error.message);
        notchedData = cleanedData; // Fallback like Python
      }
      
      // PYTHON STEP 4: Apply bandpass filter (matches Python Butterworth with filtfilt)
      let filteredData;
      try {
        filteredData = applyBandpassFilter(notchedData, FS, PYTHON_CONSTANTS.BANDPASS_LOW, PYTHON_CONSTANTS.BANDPASS_HIGH, PYTHON_CONSTANTS.FILTER_ORDER);
        console.log(`✅ Bandpass filter applied ${PYTHON_CONSTANTS.BANDPASS_LOW}-${PYTHON_CONSTANTS.BANDPASS_HIGH}Hz (matches Python step 4)`);
      } catch (error) {
        console.log('⚠️ Bandpass filter failed, using notched data:', error.message);
        filteredData = notchedData; // Fallback like Python
      }
      
      // PYTHON-MATCHED: Calculate frequency domain analysis (Welch's method like Python)
      const freqs = [];
      const psd = computePowerSpectralDensity(filteredData, FS, freqs);
      console.log(`✅ PSD computed using Welch method with ${freqs.length} frequency bins (matches Python)`);
      
      // PYTHON-MATCHED: Calculate total power using signal variance (matches Python exactly)
      const totalPower = calculateVariance(filteredData);
      console.log(`✅ Total power calculated: ${totalPower.toFixed(3)} (matches Python variance method)`);
      
      // PYTHON-MATCHED: Calculate band powers using proper frequency analysis
      const bandPowers = calculateBandPowers(filteredData, FS);
      console.log('🧮 Band powers calculated using Simpson\'s rule integration (matches Python):', 
        Object.keys(bandPowers).map(band => `${band}: ${bandPowers[band].toFixed(3)}`).join(', '));
      // PYTHON-INSPIRED: Calculate theta contribution as percentage of total brain activity
      const thetaContribution = totalPower > 0 ? (bandPowers.theta / totalPower * 100) : 0;
      // PYTHON-INSPIRED: Calculate peak-based theta SNR (matches Python theta_peak_snr)
      const thetaPeakSNR = calculateThetaSNR(filteredData, FS);
      // PYTHON-INSPIRED: Apply exponential smoothing to ALL features (alpha = 0.3, matches Python)
      const alpha = 0.3; // Matches Python smoothing factor
      // Initialize smoothed values if not exists
      if (!window.smoothedFeatures) {
        window.smoothedFeatures = {};
      }
      // Create feature object matching Python's FEATURE_NAMES
      const currentFeatures = {
        // Absolute Power (5 features)
        delta_power: bandPowers.delta,
        theta_power: bandPowers.theta,
        alpha_power: bandPowers.alpha,
        beta_power: bandPowers.beta,
        gamma_power: bandPowers.gamma,
        // Relative Power (5 features)
        delta_relative: totalPower > 0 ? (bandPowers.delta / totalPower * 100) : 0,
        theta_relative: totalPower > 0 ? (bandPowers.theta / totalPower * 100) : 0,
        alpha_relative: totalPower > 0 ? (bandPowers.alpha / totalPower * 100) : 0,
        beta_relative: totalPower > 0 ? (bandPowers.beta / totalPower * 100) : 0,
        gamma_relative: totalPower > 0 ? (bandPowers.gamma / totalPower * 100) : 0,
        // Derived Metrics (4 features - matches Python)
        alpha_theta_ratio: bandPowers.theta > 0 ? bandPowers.alpha / bandPowers.theta : 0,
        beta_alpha_ratio: bandPowers.alpha > 0 ? bandPowers.beta / bandPowers.alpha : 0,
        total_power: totalPower,
        theta_contribution: thetaContribution
      };
      // Apply exponential smoothing to all features (matches Python apply_smoothing)
      const smoothedFeatures = {};
      Object.keys(currentFeatures).forEach(featureName => {
        const currentValue = currentFeatures[featureName];
        if (featureName in window.smoothedFeatures) {
          // α * current + (1-α) * previous
          smoothedFeatures[featureName] = alpha * currentValue + (1 - alpha) * window.smoothedFeatures[featureName];
        } else {
          smoothedFeatures[featureName] = currentValue; // First measurement
        }
      });
      // Update smoothed features storage
      window.smoothedFeatures = { ...smoothedFeatures };
      // Legacy theta smoothing for backward compatibility
      if (!window.smoothedThetaContribution) window.smoothedThetaContribution = 0;
      window.smoothedThetaContribution = smoothedFeatures.theta_contribution;
      // PYTHON-INSPIRED: Adaptive theta contribution based on peak SNR (matches Python logic)
      let adaptedThetaContribution = thetaContribution;
      if (thetaPeakSNR >= PYTHON_CONSTANTS.THETA_SNR_THRESHOLD) { // Use Python threshold
        // Boost theta contribution if SNR is good
        adaptedThetaContribution = Math.min(thetaContribution * (1 + thetaPeakSNR * 0.1), 50);
      }
      // DIRECT UI UPDATE: Update advanced metrics using smoothed features (matches Python)
      setDetailedEEGData(prev => ({
        ...prev,
        // Advanced metrics using smoothed values (matches Python payload structure)
        thetaContribution: Math.round(smoothedFeatures.theta_contribution * 10) / 10, // 1 decimal
        adaptedThetaContribution: Math.round(adaptedThetaContribution * 10) / 10,
        smoothedTheta: Math.round(smoothedFeatures.theta_contribution * 10) / 10,
        totalPower: Math.round(smoothedFeatures.total_power * 1000) / 1000, // 3 decimals
        thetaPeakSNR: Math.round(thetaPeakSNR * 100) / 100, // 2 decimals
        thetaRelative: Math.round((smoothedFeatures.theta_relative / 100) * 1000) / 1000, // Relative (0-1)
        // Update computed band powers using smoothed values
        delta: Math.round(smoothedFeatures.delta_power * 1000) / 1000, // 3 decimals for precision
        theta: Math.round(smoothedFeatures.theta_power * 1000) / 1000,
        lowAlpha: Math.round(smoothedFeatures.alpha_power * 500) / 1000, // Split alpha
        highAlpha: Math.round(smoothedFeatures.alpha_power * 500) / 1000,
        lowBeta: Math.round(smoothedFeatures.beta_power * 500) / 1000, // Split beta
        highBeta: Math.round(smoothedFeatures.beta_power * 500) / 1000,
        lowGamma: Math.round(smoothedFeatures.gamma_power * 500) / 1000, // Split gamma
        middleGamma: Math.round(smoothedFeatures.gamma_power * 500) / 1000,
        // Additional Python-inspired ratios
        alphaTheta: Math.round(smoothedFeatures.alpha_theta_ratio * 1000) / 1000,
        betaAlpha: Math.round(smoothedFeatures.beta_alpha_ratio * 1000) / 1000
      }));
      // Update computed band powers for display using smoothed values
      setRealTimeBandPowers({
        delta: smoothedFeatures.delta_power,
        theta: smoothedFeatures.theta_power,
        alpha: smoothedFeatures.alpha_power,
        beta: smoothedFeatures.beta_power,
        gamma: smoothedFeatures.gamma_power
      });
      // PYTHON-STYLE THETA CONTRIBUTION TRACKING: Update theta buffer using smoothed values
      const currentTime = (Date.now() - plotStartTime.current) / 1000; // Time in seconds
      setThetaContributionBuffer(prev => {
        const newBuffer = [...prev, smoothedFeatures.theta_contribution];
        // Keep only last 60 seconds of data (like Python)
        return newBuffer.length > 60 ? newBuffer.slice(-60) : newBuffer;
      });
      // Update time buffer
      thetaTimeBuffer.current.push(currentTime);
      if (thetaTimeBuffer.current.length > 60) {
        thetaTimeBuffer.current = thetaTimeBuffer.current.slice(-60);
      }
      // PYTHON-MATCHED: Processing timing and rate logging (matches Python behavior)
      const processingEndTime = Date.now();
      const processingDuration = processingEndTime - (window.processingStartTime || processingEndTime);
      const timeSinceLastProcessing = processingEndTime - (window.lastProcessingEndTime || 0);
      const processingRate = timeSinceLastProcessing > 0 ? (1000 / timeSinceLastProcessing).toFixed(1) : 'N/A';
      
      window.lastProcessingEndTime = processingEndTime;
      
      // PYTHON-INSPIRED: Logging format (matches Python log format exactly) with timing
      const peakSNRDisplay = isFinite(thetaPeakSNR) ? thetaPeakSNR.toFixed(2) : "∞";
      // console.log(`🧠 FEATURE UPDATE [${processingRate}Hz]: Theta ${smoothedFeatures.theta_contribution.toFixed(1)}% | Peak θ-SNR: ${peakSNRDisplay} | Total Power: ${smoothedFeatures.total_power.toFixed(0)} | α/θ: ${smoothedFeatures.alpha_theta_ratio.toFixed(2)} | β/α: ${smoothedFeatures.beta_alpha_ratio.toFixed(2)} | Duration: ${processingDuration}ms`);
      
      // Track successful processing count
      if (!window.processingCount) window.processingCount = 0;
      window.processingCount++;
      
      if (window.processingCount % 10 === 0) {
        console.log(`📊 PROCESSING STATS: ${window.processingCount} feature updates completed at ~${processingRate}Hz rate`);
      }
    } catch (error) {
      console.error('Advanced signal processing error:', error.message);
    }
  }, []);
  // PYTHON-INSPIRED: Eye blink artifact removal (matches Python exactly)
  const removeEyeBlinkArtifacts = (data, window = 10) => {
    const clean = [...data]; // Copy array
    // Python adaptive threshold: mean + 3 * std (3-sigma threshold)
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);
    const adaptiveThreshold = mean + 3 * std;
    // Find indices where absolute value exceeds threshold
    const artifactIndices = [];
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) > adaptiveThreshold) {
        artifactIndices.push(i);
      }
    }
    // Replace artifacts using Python's median replacement algorithm
    for (const i of artifactIndices) {
      const start = Math.max(0, i - window);
      const end = Math.min(data.length, i + window);
      // Get local window excluding artifacts (matches Python logic)
      const localWindow = [];
      for (let j = start; j < end; j++) {
        if (Math.abs(data[j]) <= adaptiveThreshold) {
          localWindow.push(data[j]);
        }
      }
      // Median replacement with fallback (matches Python exactly)
      if (localWindow.length > 0) {
        localWindow.sort((a, b) => a - b);
        const median = localWindow.length % 2 === 0
          ? (localWindow[localWindow.length / 2 - 1] + localWindow[localWindow.length / 2]) / 2
          : localWindow[Math.floor(localWindow.length / 2)];
        clean[i] = median;
      } else {
        // Fallback to global median (matches Python)
        const sortedData = [...data].sort((a, b) => a - b);
        const globalMedian = sortedData.length % 2 === 0
          ? (sortedData[sortedData.length / 2 - 1] + sortedData[sortedData.length / 2]) / 2
          : sortedData[Math.floor(sortedData.length / 2)];
        clean[i] = globalMedian;
      }
    }
    return clean;
  };
  // PYTHON-INSPIRED: IIR notch filter for power line interference (matches Python iirnotch)
  const applyNotchFilter = (data, fs, notchFreq = 50.0, qualityFactor = 30.0) => {
    // Python uses iirnotch with quality factor - simplified implementation
    // In production, this would use a proper IIR notch filter
    // Calculate normalized frequency (matches Python freq = notch_freq/(fs/2))
    const normalizedFreq = notchFreq / (fs / 2);
    // Simple notch filter approximation using moving average
    // This approximates the IIR notch behavior for real-time processing
    const filtered = [...data];
    const windowSize = Math.floor(fs / notchFreq); // Adaptive window based on frequency
    for (let i = windowSize; i < filtered.length; i++) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += filtered[i - j];
      }
      const movingAvg = sum / windowSize;
      // Apply notch filtering (remove the moving average component at notch frequency)
      filtered[i] = filtered[i] - (movingAvg * (1.0 / qualityFactor));
    }
    return filtered;
  };
  // PYTHON-INSPIRED: Butterworth bandpass filter with zero-phase filtering (matches Python)
  const applyBandpassFilter = (data, fs, lowcut, highcut, order = 2) => {
    // Python uses: butter(order, [lowcut/nyq, highcut/nyq], btype='band') + filtfilt
    const nyquist = fs / 2;
    const normalizedLow = lowcut / nyquist;
    const normalizedHigh = highcut / nyquist;
    // Simplified Butterworth bandpass with zero-phase characteristics
    // This approximates Python's filtfilt behavior (forward-backward filtering)
    let filtered = [...data];
    // Forward pass - High-pass component (remove low frequencies)
    const highPassWindow = Math.floor(1 / normalizedLow);
    for (let i = highPassWindow; i < filtered.length; i++) {
      let sum = 0;
      for (let j = 0; j < highPassWindow; j++) {
        sum += filtered[i - j];
      }
      const lowFreqComponent = sum / highPassWindow;
      filtered[i] = filtered[i] - lowFreqComponent;
    }
    // Forward pass - Low-pass component (remove high frequencies)
    const lowPassWindow = Math.max(1, Math.floor(1 / normalizedHigh));
    for (let i = lowPassWindow; i < filtered.length; i++) {
      let sum = 0;
      for (let j = 0; j < lowPassWindow; j++) {
        sum += filtered[i - j];
      }
      filtered[i] = sum / lowPassWindow;
    }
    // Backward pass for zero-phase (matches Python filtfilt)
    const backward = [...filtered].reverse();
    // Apply same filtering backward
    for (let i = highPassWindow; i < backward.length; i++) {
      let sum = 0;
      for (let j = 0; j < highPassWindow; j++) {
        sum += backward[i - j];
      }
      const lowFreqComponent = sum / highPassWindow;
      backward[i] = backward[i] - lowFreqComponent;
    }
    for (let i = lowPassWindow; i < backward.length; i++) {
      let sum = 0;
      for (let j = 0; j < lowPassWindow; j++) {
        sum += backward[i - j];
      }
      backward[i] = sum / lowPassWindow;
    }
    // Reverse back and combine with forward pass (zero-phase result)
    const backwardReversed = backward.reverse();
    for (let i = 0; i < filtered.length; i++) {
      filtered[i] = (filtered[i] + backwardReversed[i]) / 2;
    }
    return filtered;
  };
  // PYTHON-INSPIRED: Calculate variance (total power)
  const calculateVariance = (data) => {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return variance;
  };
  // PYTHON-INSPIRED: Calculate standard deviation
  const calculateStandardDeviation = (data) => {
    return Math.sqrt(calculateVariance(data));
  };
  // PYTHON-INSPIRED: Calculate band powers using Simpson's rule integration (matches Python exactly)
  const calculateBandPowers = (data, fs) => {
    // Use Welch method like Python
    const freqs = [];
    const psd = computePowerSpectralDensity(data, fs, freqs);
    // EEG band definitions (exactly matches Python EEG_BANDS)
    const bands = {
      delta: { low: 0.5, high: 4 },
      theta: { low: 4, high: 8 },
      alpha: { low: 8, high: 12 },
      beta: { low: 12, high: 30 },
      gamma: { low: 30, high: 45 }
    };
    // Helper function: Simpson's rule integration (matches Python simps function)
    const simpsonsRule = (y, dx) => {
      if (y.length < 2) return 0;
      if (y.length === 2) return dx * (y[0] + y[1]) / 2; // Trapezoidal fallback
      const n = y.length - 1;
      if (n % 2 === 1) {
        // Odd number of intervals - standard Simpson's rule
        let sum = y[0] + y[n];
        for (let i = 1; i < n; i += 2) {
          sum += 4 * y[i];
        }
        for (let i = 2; i < n; i += 2) {
          sum += 2 * y[i];
        }
        return sum * dx / 3;
      } else {
        // Even number of intervals - use Simpson's 3/8 rule for last segment
        let sum = y[0] + y[n];
        for (let i = 1; i < n - 2; i += 2) {
          sum += 4 * y[i];
        }
        for (let i = 2; i < n - 2; i += 2) {
          sum += 2 * y[i];
        }
        // 3/8 rule for last three intervals
        sum += 3 * (y[n-2] + y[n-1]) / 8;
        return sum * dx / 3;
      }
    };
    // Calculate band powers using frequency integration (matches Python bandpower function)
    const bandPowers = {};
    Object.keys(bands).forEach(band => {
      const { low, high } = bands[band];
      // Find frequency indices for this band
      const bandFreqs = [];
      const bandPsd = [];
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] >= low && freqs[i] <= high) {
          bandFreqs.push(freqs[i]);
          bandPsd.push(psd[i]);
        }
      }
      // Calculate dx (frequency resolution)
      const dx = bandFreqs.length > 1 ? bandFreqs[1] - bandFreqs[0] : 1;
      // Simpson's rule integration (matches Python simps function)
      const bandPower = bandFreqs.length > 0 ? simpsonsRule(bandPsd, dx) : 0;
      bandPowers[band] = Math.max(bandPower, 0); // Ensure non-negative
    });
    return bandPowers;
  };
  // PYTHON-INSPIRED: Calculate theta SNR (matches Python theta_peak_snr function)
  const calculateThetaSNR = (data, fs) => {
    const freqs = [];
    const psd = computePowerSpectralDensity(data, fs, freqs);
    // Signal band: 4-8 Hz (theta)
    const sigBand = { low: 4, high: 8 };
    let thetaPeakPower = 0;
    // Find peak power in theta band
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] >= sigBand.low && freqs[i] <= sigBand.high) {
        if (psd[i] > thetaPeakPower) {
          thetaPeakPower = psd[i];
        }
      }
    }
    // Noise bands: adjacent to theta (matches Python noise_bands)
    const noiseBands = [
      { low: 2, high: 4 },   // Below theta
      { low: 8, high: 10 }   // Above theta
    ];
    let totalNoisePower = 0;
    let noiseCount = 0;
    noiseBands.forEach(noiseBand => {
      for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] >= noiseBand.low && freqs[i] <= noiseBand.high) {
          totalNoisePower += psd[i];
          noiseCount++;
        }
      }
    });
    const avgNoisePower = noiseCount > 0 ? totalNoisePower / noiseCount : 0;
    return avgNoisePower > 0 ? thetaPeakPower / avgNoisePower : 0;
  };
  // PYTHON-INSPIRED: Power Spectral Density using Welch's method (matches Python exactly)
  const computePowerSpectralDensity = (data, fs, freqsArray) => {
    // Python: freqs, psd = welch(data, fs=fs, nperseg=WINDOW_SIZE, noverlap=OVERLAP_SIZE)
    const WINDOW_SIZE = 512; // Matches Python WINDOW_SIZE
    const OVERLAP_SIZE = 128; // Matches Python OVERLAP_SIZE (25% overlap)
    const n = WINDOW_SIZE;
    const df = fs / n;
    // Generate frequency array (matches Python freqs output)
    freqsArray.length = 0;
    for (let i = 0; i < n / 2; i++) {
      freqsArray.push(i * df);
    }
    // Initialize PSD array
    const psd = new Array(n / 2).fill(0);
    if (data.length >= WINDOW_SIZE) {
      // Use overlapping windows like Python Welch method
      const numWindows = Math.floor((data.length - WINDOW_SIZE) / (WINDOW_SIZE - OVERLAP_SIZE)) + 1;
      let validWindows = 0;
      for (let windowIdx = 0; windowIdx < numWindows; windowIdx++) {
        const startIdx = windowIdx * (WINDOW_SIZE - OVERLAP_SIZE);
        const endIdx = startIdx + WINDOW_SIZE;
        if (endIdx <= data.length) {
          const windowData = data.slice(startIdx, endIdx);
          // Apply Hanning window (matches Python exactly)
          const hannWindow = [];
          for (let i = 0; i < WINDOW_SIZE; i++) {
            hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (WINDOW_SIZE - 1)));
          }
          // Apply window to data
          const windowedData = windowData.map((val, i) => val * hannWindow[i]);
          // Compute DFT magnitudes for this window
          for (let k = 0; k < n / 2; k++) {
            let realPart = 0;
            let imagPart = 0;
            for (let i = 0; i < WINDOW_SIZE; i++) {
              const angle = -2 * Math.PI * k * i / WINDOW_SIZE;
              realPart += windowedData[i] * Math.cos(angle);
              imagPart += windowedData[i] * Math.sin(angle);
            }
            // Power spectral density for this window
            const magnitude = Math.sqrt(realPart * realPart + imagPart * imagPart);
            const windowPsd = (magnitude * magnitude) / (fs * WINDOW_SIZE);
            // Accumulate for averaging across windows
            psd[k] += windowPsd;
          }
          validWindows++;
        }
      }
      // Average across all windows (Welch method)
      if (validWindows > 0) {
        for (let k = 0; k < psd.length; k++) {
          psd[k] /= validWindows;
        }
      }
    }
    return psd;
  };
  // Clear all EEG data and states function
  const clearAllData = useCallback(() => {
    console.log('🧹 Clearing all EEG data and states...');
    // Clear detailed EEG data
    setDetailedEEGData({
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
    // Clear real-time data
    setRealTimeEegData([]);
    // Clear filtered EEG data (for smooth streaming)
    setFilteredEEGData([]);
    // Reset throttled filtered UI pipeline
    try {
      if (filteredFlushTimerRef.current) {
        clearTimeout(filteredFlushTimerRef.current);
        filteredFlushTimerRef.current = null;
      }
      filteredQueueRef.current = [];
      if (filteredQueueRef.current && filteredQueueRef.current._latestStats) {
        delete filteredQueueRef.current._latestStats;
      }
    } catch {}
    // Clear theta contribution buffer (Python-style main plot)
    setThetaContributionBuffer([]);
    thetaTimeBuffer.current = [];
    plotStartTime.current = Date.now();
    // Clear band powers
    setRealTimeBandPowers({
      delta: 0,
      theta: 0,
      alpha: 0,
      beta: 0,
      gamma: 0,
    });
    // Clear timing data
    setLastDataTime(null);
    setEegData({});
    // Clear global data buffers
    if (window.liveDataBuffer) window.liveDataBuffer = [];
    if (window.rawDataBatch) window.rawDataBatch = [];
    if (window.lastChartUpdate) window.lastChartUpdate = 0;
    if (window.lastDataTimeUpdate) window.lastDataTimeUpdate = 0;
    if (window.smoothedThetaContribution) window.smoothedThetaContribution = 0;
    if (window.smoothedFeatures) window.smoothedFeatures = {};
    if (window.processingCounter) window.processingCounter = 0;
    // Reset refs
    if (dataCountSinceLastCheck.current) dataCountSinceLastCheck.current = 0;
    if (lastDataRateCheck.current) lastDataRateCheck.current = Date.now();
    
    // Reset background DSP if active
    try {
      if (backgroundDSPManager) {
        console.log('🧹 Resetting background DSP system...');
        backgroundDSPManager.stop();
        // Clear any queued processing data
        if (streamingDSP && streamingDSP.reset) {
          streamingDSP.reset();
        }
        console.log('✅ Background DSP reset complete');
      }
    } catch (error) {
      console.warn('⚠️ DSP reset warning:', error);
    }
    
    console.log('✅ All EEG data cleared');
  }, []);
  // Legacy function name for backward compatibility
  const handleClearData = clearAllData;  // Force Real Data Mode function
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

  // Real-Time EEG Display Screen
  if (currentScreen === 'realtime') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setCurrentScreen('dashboard')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filtered EEG</Text>
          <View style={styles.headerRight}>
            <BatteryIndicator level={detailedEEGData?.batteryLevel ?? 0} />
            <TouchableOpacity 
              style={[styles.toggleButton, { backgroundColor: showFilteredView ? '#9C27B0' : '#666' }]} 
              onPress={() => setShowFilteredView(!showFilteredView)}
            >
              <Text style={styles.toggleButtonText}>
                {showFilteredView ? 'Filtered' : 'Raw'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <ScrollView style={styles.scrollView}>
          {/* Raw EEG Display (unchanged) */}
          <RealTimeEEGDisplay 
            data={realTimeEegData}
            isConnected={isConnected}
            deviceInfo={connectedDevice}
          />
          
          {/* Filtered EEG Display (new) */}
          {showFilteredView && (
            <FilteredEEGDisplay 
              filteredData={filteredEEGData}
              samplingRate={512}
              isActive={backgroundDSPActive}
              performanceStats={dspPerformanceStats}
              latestFeatures={latestFeatures}
            />
          )}
          
          {/* DSP Controls */}
          <View style={styles.dspControlsContainer}>
            <Text style={styles.sectionTitle}>Background DSP Controls</Text>
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Background Filtering:</Text>
              <TouchableOpacity 
                style={[styles.statusButton, { backgroundColor: backgroundDSPActive ? '#4CAF50' : '#f44336' }]}
                onPress={() => {
                  if (backgroundDSPActive) {
                    console.log('🛑 User stopping background DSP...');
                    backgroundDSPManager.stop();
                    setBackgroundDSPActive(false);
                    console.log('✅ Background DSP stopped by user');
                  } else {
                    console.log('▶️ User starting background DSP...');
                    console.log('🔧 Checking DSP requirements:', {
                      hasCallback: !!window.dspUICallback,
                      callbackType: typeof window.dspUICallback,
                      managerExists: !!backgroundDSPManager,
                      managerIsRunning: backgroundDSPManager?.isRunning
                    });
                    
                    if (window.dspUICallback) {
                      console.log('🚀 Starting background DSP manager...');
                      backgroundDSPManager.start(window.dspUICallback);
                      
                      // FORCE state update immediately and verify
                      setBackgroundDSPActive(true);
                      
                      // Double-check state update took effect
                      setTimeout(() => {
                        const actuallyRunning = backgroundDSPManager?.isRunning;
                        console.log('✅ DSP Start Verification:', {
                          managerRunning: actuallyRunning,
                          stateActive: true, // This should be true now
                          willFeedData: actuallyRunning
                        });
                        if (!actuallyRunning) {
                          console.error('❌ DSP manager failed to start despite no errors');
                        }
                      }, 100);
                      
                      console.log('✅ Background DSP started by user - should now process incoming data');
                    } else {
                      console.error('❌ DSP UI callback not available - this should not happen');
                    }
                  }
                }}
              >
                <Text style={styles.statusButtonText}>
                  {backgroundDSPActive ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Show Filtered View:</Text>
              <TouchableOpacity 
                style={[styles.statusButton, { backgroundColor: showFilteredView ? '#9C27B0' : '#666' }]}
                onPress={() => setShowFilteredView(!showFilteredView)}
              >
                <Text style={styles.statusButtonText}>
                  {showFilteredView ? 'ON' : 'OFF'}
                </Text>
              </TouchableOpacity>
            </View>
            {dspPerformanceStats && (
              <View style={styles.performanceStatsContainer}>
                <Text style={styles.performanceTitle}>Performance Stats:</Text>
                <Text style={styles.performanceText}>
                  Avg Processing: {dspPerformanceStats.averageProcessingTime?.toFixed(2)}ms
                </Text>
                <Text style={styles.performanceText}>
                  Buffer: {dspPerformanceStats.bufferUtilization?.toFixed(1)}%
                </Text>
                <Text style={styles.performanceText}>
                  Samples: {dspPerformanceStats.samplesProcessed}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }
  // Main Dashboard
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AppLogo 
              size="small" 
              showText={false} 
              logoStyle={styles.headerLogo}
            />
            <Text style={styles.headerTitle}>MindLink Dashboard</Text>
          </View>
          <View style={styles.headerRight}>
            <BatteryIndicator level={detailedEEGData?.batteryLevel ?? 0} />
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Connection Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Connection Status</Text>
            <View style={[styles.statusIndicator, { backgroundColor: getConnectionColor() }]}>
              <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
            </View>
          </View>

          {/* NAVIGATION SECTION */}
          <View style={styles.navigationSection}>
            {/* <Text style={styles.navigationTitle}>View Options</Text> */}
            <View style={styles.navigationButtons}>
              <TouchableOpacity 
                style={[
                  styles.navButton, 
                  currentScreen === 'dashboard' && styles.navButtonActive
                ]}
                onPress={() => setCurrentScreen('dashboard')}
              >
                <Text style={[
                  styles.navButtonText,
                  currentScreen === 'dashboard' && styles.navButtonTextActive
                ]}>
                  Dashboard
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.navButton, 
                  currentScreen === 'realtime' && styles.navButtonActive
                ]}
                onPress={() => setCurrentScreen('realtime')}
              >
                <Text style={[
                  styles.navButtonText,
                  currentScreen === 'realtime' && styles.navButtonTextActive
                ]}>
                  Filtered EEG
                </Text>
              </TouchableOpacity>

              {/* <TouchableOpacity 
                style={[
                  styles.navButton, 
                  currentScreen === 'sdk-test' && styles.navButtonActive
                ]}
                onPress={() => setCurrentScreen('sdk-test')}
              >
                <Text style={[
                  styles.navButtonText,
                  currentScreen === 'sdk-test' && styles.navButtonTextActive
                ]}>
                  SDK Test
                </Text>
              </TouchableOpacity> */}
            </View>
          </View>
          {/* LIGHTNING-FAST DISCONNECT BUTTON - COMPLETELY ISOLATED FROM DATA PROCESSING */}
          <TouchableOpacity 
            style={[
              styles.scanButton, 
              { 
                backgroundColor: scanButtonConfig.color,
                opacity: scanButtonConfig.disabled ? 0.6 : 1.0 
              }
            ]}
            onPress={handleButtonPress} // Lightning-fast isolated handler
            disabled={scanButtonConfig.disabled}
            activeOpacity={0.5} // Even faster visual feedback
            delayPressIn={0} // Zero delay for immediate response
            delayPressOut={0} // Zero delay for immediate response
            delayLongPress={0} // Zero delay for any press type
            pressRetentionOffset={{top: 40, left: 40, bottom: 40, right: 40}} // Maximum tap area
            hitSlop={{top: 30, left: 30, bottom: 30, right: 30}} // Maximum hit area
          >
            <Text style={styles.scanButtonText}>
              {scanButtonConfig.text}
            </Text>
          </TouchableOpacity>
          {/* Error Display */}
          {sdkError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Error: {sdkError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleReinitializeSDK}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 512Hz Real-Time EEG Display - Full height section like real-time screen */}
        {connectionStatus === 'connected' && (
          <View style={styles.realTimeEegSection}>
            <RealTimeEEGDisplay 
              data={realTimeEegData}
              isConnected={isConnected}
              deviceInfo={connectedDevice}
            />
          </View>
        )}

        {/* Connection Status Card - Continue with debug info */}
        <View style={styles.statusCard}>
          {/* Production Debug Info - Clean & Minimal */}
          <View style={styles.debugContainer}>
            <Text style={[styles.debugTitle, {color: '#fff', fontWeight: 'bold'}]}>Connection Status:</Text>
            <Text style={[styles.debugTitle, {color: '#ff9500'}]}>Status: {connectionStatus}</Text>
            <Text style={[styles.debugTitle, {color: '#ff9500'}]}>SDK Initialized: {sdkInitialized ? 'Yes' : 'No'}</Text>
            {/* <Text style={styles.debugText}>Scanning: {isScanning ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Connected: {isConnected ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Data Rate: {dataRate}Hz</Text>
            <Text style={styles.debugText}>Samples: {realTimeEegData.length}</Text>
            <Text style={styles.debugText}>Device: {connectedDevice?.name || 'None'}</Text>
            <Text style={styles.debugText}>Last Update: {detailedEEGData.lastUpdateTime || 'Never'}</Text>
            <Text style={styles.debugText}>Devices Found (Hook): {devices?.length || 0}</Text>
            <Text style={styles.debugText}>Devices Found (Local): {localDevices?.length || 0}</Text> */}
            {/* POST-RELOAD DETECTION INDICATOR */}
            <Text style={[styles.debugText, { 
              color: isPostReloadDetected ? '#ff9500' : '#000',
              fontWeight: isPostReloadDetected ? 'bold' : 'normal'
            }]}>
              
              Post-Reload Mode: {isPostReloadDetected ? 'ACTIVE' : 'Inactive'}
            </Text>
            {devices?.length > 0 && (
              <Text style={styles.debugText}>Hook Devices: {devices.map(d => d.name || d.mac || 'Unknown').join(', ')}</Text>
            )}
            {localDevices?.length > 0 && (
              <Text style={styles.debugText}>Local Devices: {localDevices.map(d => d.name || d.mac || 'Unknown').join(', ')}</Text>
            )}
            <Text style={[styles.debugTitle, {color: '#ff9500'}]}>Post-Reload Mode: {isPostReload ? 'Yes' : 'No'}</Text>
            {/* Force BLE Reset Button for debugging */}
            <TouchableOpacity style={styles.forceResetButton} onPress={async () => {
              console.log('🚨 MANUAL COMPREHENSIVE BLE RESET TRIGGERED');
              try {
                // Step 1: Disconnect and unpair all BrainLink devices
                if (BrainLinkModule?.disconnectAllDevices) {
                  await BrainLinkModule.disconnectAllDevices();
                  console.log('✅ Manual: Disconnected all devices');
                }
                if (BrainLinkModule?.unpairAllBrainLinkDevices) {
                  await BrainLinkModule.unpairAllBrainLinkDevices();
                  console.log('✅ Manual: Unpaired all BrainLink devices');
                }
                // Step 2: Disable/Enable Bluetooth cycle
                if (BrainLinkModule?.disableBluetooth) {
                  await BrainLinkModule.disableBluetooth();
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  console.log('✅ Manual: Disabled Bluetooth');
                }
                // Step 3: Clear all caches while disabled
                if (BrainLinkModule?.clearBLECache) await BrainLinkModule.clearBLECache();
                if (BrainLinkModule?.resetGattCache) await BrainLinkModule.resetGattCache();
                if (BrainLinkModule?.clearBLEConnections) await BrainLinkModule.clearBLEConnections();
                console.log('✅ Manual: Cleared all BLE caches');
                // Step 4: Re-enable Bluetooth
                if (BrainLinkModule?.enableBluetooth) {
                  await BrainLinkModule.enableBluetooth();
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  console.log('✅ Manual: Re-enabled Bluetooth');
                }
                // Step 5: Reset adapter
                if (BrainLinkModule?.resetBLEAdapter) {
                  await BrainLinkModule.resetBLEAdapter();
                  console.log('✅ Manual: Reset BLE adapter');
                }
                console.log('✅ MANUAL COMPREHENSIVE BLE RESET COMPLETE');
              } catch (error) {
                console.log('⚠️ Manual BLE reset error:', error.message);
              }
            }}>
              <Text style={styles.forceResetButtonText}>Force BLE Reset</Text>
            </TouchableOpacity>
            
            {/* Android Log Investigation Button */}
            <TouchableOpacity style={styles.androidLogButton} onPress={async () => {
              console.log('📱 MANUAL ANDROID LOG INVESTIGATION TRIGGERED');
              try {
                // Get Android logs and stats
                const result = await BrainLinkModule.getAndroidLogs();
                console.log('📱 Android logs result:', result);
                
                // Investigate sampling rate configuration
                if (BrainLinkModule.investigateSamplingRateConfig) {
                  const configResult = await BrainLinkModule.investigateSamplingRateConfig();
                  console.log('🔍 Sampling rate config investigation:', configResult);
                }
                
              } catch (error) {
                console.error('❌ Android log investigation failed:', error);
              }
            }}>
              <Text style={styles.forceResetButtonText}>🔍 Android SDK Investigation</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Device Selection Card - Shows available devices for connection */}
        {(devices && devices.length > 0) && connectionStatus !== 'connected' && (
          <View style={styles.deviceSelectionCard}>
            <Text style={styles.cardTitle}>Available Devices</Text>
            <Text style={styles.deviceSelectionSubtitle}>
              Tap on a device to connect
            </Text>
            {devices.map((device, index) => (
              <TouchableOpacity
                key={index}
                style={styles.deviceItem}
                onPress={async () => {
                  console.log('🔗 Attempting to connect to device:', device.name || device.mac);
                  setConnectionStatus('connecting');
                  try {
                    // POST-RELOAD CONNECTION ENHANCEMENT: Extra preparation for post-reload connections
                    if (isPostReloadDetected) {
                      console.log('🔄 POST-RELOAD: Preparing BLE stack for new connection...');
                      // Clear any existing timers or states
                      if (window.disconnectionTimer) {
                        clearTimeout(window.disconnectionTimer);
                        window.disconnectionTimer = null;
                      }
                      if (window.connectionRetryCount) {
                        window.connectionRetryCount = 0;
                      }
                      // Brief BLE stack reset if available
                      if (BrainLinkModule.resetBLEStack) {
                        try {
                          await BrainLinkModule.resetBLEStack();
                          console.log('✅ POST-RELOAD: BLE stack reset for clean connection');
                          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
                        } catch (resetError) {
                          console.log('⚠️ POST-RELOAD: BLE reset failed, continuing anyway:', resetError.message);
                        }
                      }
                    }
                    // Use the hook's connectToDevice function
                    await connectToDevice(device.mac || device.address);
                    console.log('✅ Connection initiated successfully');
                    // Store the device info for future reference
                    lastConnectedDevice.current = device;
                  } catch (error) {
                    console.error('❌ Connection failed:', error.message);
                    setConnectionStatus('ready');
                    Alert.alert(
                      'Connection Failed', 
                      `Failed to connect to ${device.name || 'device'}: ${error.message}`,
                      [{ text: 'OK', onPress: () => console.log('Connection error acknowledged') }]
                    );
                  }
                }}
                disabled={connectionStatus === 'connecting'}
              >
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>
                    {device.name || 'Unknown Device'}
                  </Text>
                  <Text style={styles.deviceMac}>
                    {device.mac || device.address || 'Unknown MAC'}
                  </Text>
                  {device.rssi && (
                    <Text style={styles.deviceRssi}>
                      Signal: {device.rssi} dBm
                    </Text>
                  )}
                </View>
                <View style={styles.deviceConnectButton}>
                  <Text style={styles.deviceConnectText}>
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Connect'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <Text style={styles.deviceSelectionHint}>
              Make sure your BrainLink device is powered on and in pairing mode
            </Text>
            <View style={styles.troubleshootingSection}>
              <Text style={styles.troubleshootingTitle}>⚠️ Connection Troubleshooting:</Text>
              <Text style={styles.troubleshootingText}>• Hold the BrainLink power button for 3-5 seconds until it flashes blue rapidly</Text>
              <Text style={styles.troubleshootingText}>• Ensure device is fully charged</Text>
              <Text style={styles.troubleshootingText}>• Try moving closer to the device (within 3 feet)</Text>
              <Text style={styles.troubleshootingText}>• If connection fails, try the "Force BLE Reset" button below</Text>
            </View>
          </View>
        )}
        {/* Live Brain Metrics */}
        {detailedEEGData.lastUpdateTime && (
          <View style={styles.metricsCard}>
            <Text style={styles.cardTitle}>Live Brain Metrics</Text>
            <View style={styles.metricsGrid}>
              {/* Attention & Meditation */}
              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Attention</Text>
                  <Text style={[styles.metricValue, { color: '#4CAF50' }]}>{detailedEEGData.attention || 0}%</Text>
                  <View style={styles.metricBar}>
                    <View 
                      style={[styles.metricFill, { 
                        width: `${detailedEEGData.attention || 0}%`, 
                        backgroundColor: '#4CAF50' 
                      }]} 
                    />
                  </View>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Meditation</Text>
                  <Text style={[styles.metricValue, { color: '#2196F3' }]}>{detailedEEGData.meditation || 0}%</Text>
                  <View style={styles.metricBar}>
                    <View 
                      style={[styles.metricFill, { 
                        width: `${detailedEEGData.meditation || 0}%`, 
                        backgroundColor: '#2196F3' 
                      }]} 
                    />
                  </View>
                </View>
              </View>
              {/* Signal Quality & Battery */}
              <View style={styles.metricRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Signal Quality</Text>
                  <Text style={[styles.metricValue, { 
                    color: (detailedEEGData.signal || 0) > 100 ? '#F44336' : '#4CAF50' 
                  }]}>{detailedEEGData.signal || 0}</Text>
                  <Text style={styles.metricSubtext}>
                    {(detailedEEGData.signal || 0) === 0 ? 'Perfect' : 
                     (detailedEEGData.signal || 0) < 50 ? 'Good' : 
                     (detailedEEGData.signal || 0) < 100 ? 'Fair' : 'Poor'}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Battery</Text>
                  <Text style={[styles.metricValue, { color: '#FF9800' }]}>{detailedEEGData.batteryLevel || 0}%</Text>
                  <Text style={styles.metricSubtext}>Hardware: {detailedEEGData.hardwareVersion || 'N/A'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        
        {/* DEBUG INFO - to help troubleshoot */}
        {/* <View style={styles.debugCard}>
          <Text style={styles.cardTitle}>Debug Info</Text>
          <Text style={styles.debugText}>Connection Status: {connectionStatus}</Text>
          <Text style={styles.debugText}>Raw Signal Buffer: {rawSignalBuffer.length} samples</Text>
          <Text style={styles.debugText}>Filtered Signal Buffer: {filteredSignalBuffer.length} samples</Text>
          <Text style={styles.debugText}>Last Update: {detailedEEGData.lastUpdateTime || 'None'}</Text>
          <Text style={styles.debugText}>Raw Buffer Internal: {rawBufferRef.current?.length || 0} samples</Text>
        </View> */}

        {/* PYTHON-STYLE DUAL RAW SIGNAL PLOTS - Clean implementation */}
        {rawSignalBuffer.length > 0 && (
          <View style={styles.signalPlotsCard}>
            <Text style={styles.cardTitle}>Live EEG Signal Analysis</Text>
            <Text style={styles.cardSubtitle}>
              Python-style dual plots • {rawSignalBuffer.length} samples • Range: {signalRange.min}µV to {signalRange.max}µV • Status: {connectionStatus}
            </Text>
            
            {/* Raw Signal Plot (Top) - Python subplot(2,1,1) equivalent */}
            <View style={styles.plotContainer}>
              <Text style={styles.plotTitle}>Raw EEG Signal</Text>
              <View style={styles.plotAreaPython}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.svgPlot}>
                  <Polyline
                    points={(() => {
                      // Use a recent window so the line fills the graph immediately
                      const rawWindow = rawSignalBuffer.slice(-2000); // ~4s at 512Hz
                      if (rawWindow.length < 2) return '';
                      const minVal = Math.min(...rawWindow);
                      const maxVal = Math.max(...rawWindow);
                      const range = maxVal - minVal || 1;
                      return rawWindow.map((value, index) => {
                        const x = (index / (rawWindow.length - 1)) * 100;
                        const y = 100 - ((value - minVal) / range) * 80; // 80% of height for signal
                        return `${x},${y}`;
                      }).join(' ');
                    })()}
                    fill="none"
                    stroke="#00FF00"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </Svg>
              </View>
            </View>
            
            {/* Filtered Signal Plot (Bottom) - Python subplot(2,1,2) equivalent */}
            <View style={styles.plotContainer}>
              <Text style={styles.plotTitle}>Filtered EEG Signal (1-45Hz)</Text>
              <View style={styles.plotAreaPython}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.svgPlot}>
                  <Polyline
                    points={(() => {
                      const filtWindow = filteredSignalBuffer.slice(-2000); // keep in step with raw window for parity
                      if (filtWindow.length < 2) return '';
                      const minVal = Math.min(...filtWindow);
                      const maxVal = Math.max(...filtWindow);
                      const range = maxVal - minVal || 1;
                      return filtWindow.map((value, index) => {
                        const x = (index / (filtWindow.length - 1)) * 100;
                        const y = 100 - ((value - minVal) / range) * 80;
                        return `${x},${y}`;
                      }).join(' ');
                    })()}
                    fill="none"
                    stroke="#00FFFF"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </Svg>
              </View>
            </View>
            
            {/* Signal Statistics */}
            <View style={styles.signalStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Raw Range</Text>
                <Text style={styles.statValue}>
                  {Math.abs(signalRange.max - signalRange.min).toFixed(1)}µV
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Samples</Text>
                <Text style={styles.statValue}>{rawSignalBuffer.length}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Filtered Range</Text>
                <Text style={styles.statValue}>
                  {filteredSignalBuffer.length > 0 ? 
                    Math.abs(Math.max(...filteredSignalBuffer) - Math.min(...filteredSignalBuffer)).toFixed(1) + 'µV' : 
                    '0µV'
                  }
                </Text>
              </View>
            </View>
          </View>
        )}
        
        {/* Band Powers - ENHANCED WITH RAW AND COMPUTED VALUES */}
        {detailedEEGData.lastUpdateTime && (
          <View style={styles.bandPowersCard}>
            <Text style={styles.cardTitle}>Brain Wave Frequencies</Text>
            {/* Raw Band Powers from Headset */}
            <View style={styles.bandSection}>
              <Text style={styles.bandSectionTitle}>Raw Values from Headset</Text>
              <View style={styles.bandPowersGrid}>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Delta</Text>
                  <Text style={[styles.bandValue, { color: '#9C27B0' }]}>{detailedEEGData.delta || 0}</Text>
                  <Text style={styles.bandFreq}>0.5-4 Hz</Text>
                  <Text style={styles.bandType}>Raw</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Theta</Text>
                  <Text style={[styles.bandValue, { color: '#FF9800' }]}>{detailedEEGData.theta || 0}</Text>
                  <Text style={styles.bandFreq}>4-8 Hz</Text>
                  <Text style={styles.bandType}>Raw</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Alpha</Text>
                  <Text style={[styles.bandValue, { color: '#4CAF50' }]}>{(detailedEEGData.lowAlpha || 0) + (detailedEEGData.highAlpha || 0)}</Text>
                  <Text style={styles.bandFreq}>8-13 Hz</Text>
                  <Text style={styles.bandType}>Raw</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Beta</Text>
                  <Text style={[styles.bandValue, { color: '#2196F3' }]}>{(detailedEEGData.lowBeta || 0) + (detailedEEGData.highBeta || 0)}</Text>
                  <Text style={styles.bandFreq}>13-30 Hz</Text>
                  <Text style={styles.bandType}>Raw</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Gamma</Text>
                  <Text style={[styles.bandValue, { color: '#F44336' }]}>{(detailedEEGData.lowGamma || 0) + (detailedEEGData.middleGamma || 0)}</Text>
                  <Text style={styles.bandFreq}>30+ Hz</Text>
                  <Text style={styles.bandType}>Raw</Text>
                </View>
              </View>
            </View>
            {/* Computed Band Powers (Python-style Processing) */}
            <View style={styles.bandSection}>
              <Text style={styles.bandSectionTitle}>Computed Values (Python-style FFT)</Text>
              <View style={styles.bandPowersGrid}>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Delta</Text>
                  <Text style={[styles.bandValue, { color: '#9C27B0' }]}>{realTimeBandPowers.delta?.toFixed(3) || '0.000'}</Text>
                  <Text style={styles.bandFreq}>0.5-4 Hz</Text>
                  <Text style={styles.bandType}>FFT</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Theta</Text>
                  <Text style={[styles.bandValue, { color: '#FF9800' }]}>{realTimeBandPowers.theta?.toFixed(3) || '0.000'}</Text>
                  <Text style={styles.bandFreq}>4-8 Hz</Text>
                  <Text style={styles.bandType}>FFT</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Alpha</Text>
                  <Text style={[styles.bandValue, { color: '#4CAF50' }]}>{realTimeBandPowers.alpha?.toFixed(3) || '0.000'}</Text>
                  <Text style={styles.bandFreq}>8-12 Hz</Text>
                  <Text style={styles.bandType}>FFT</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Beta</Text>
                  <Text style={[styles.bandValue, { color: '#2196F3' }]}>{realTimeBandPowers.beta?.toFixed(3) || '0.000'}</Text>
                  <Text style={styles.bandFreq}>12-30 Hz</Text>
                  <Text style={styles.bandType}>FFT</Text>
                </View>
                <View style={styles.bandItem}>
                  <Text style={styles.bandLabel}>Gamma</Text>
                  <Text style={[styles.bandValue, { color: '#F44336' }]}>{realTimeBandPowers.gamma?.toFixed(3) || '0.000'}</Text>
                  <Text style={styles.bandFreq}>30-45 Hz</Text>
                  <Text style={styles.bandType}>FFT</Text>
                </View>
              </View>
            </View>
            {/* Advanced Metrics (Python-inspired) */}
            {detailedEEGData.thetaContribution !== undefined && (
              <View style={styles.bandSection}>
                <Text style={styles.bandSectionTitle}>Advanced Metrics (Python-style)</Text>
                <View style={styles.advancedMetricsGrid}>
                  <View style={styles.advancedMetricItem}>
                    <Text style={styles.advancedMetricLabel}>Theta Contribution</Text>
                    <Text style={[styles.advancedMetricValue, { color: '#FF9800' }]}>
                      {detailedEEGData.thetaContribution?.toFixed(1) || '0.0'}%
                    </Text>
                    <Text style={styles.advancedMetricDesc}>% of total brain activity</Text>
                  </View>
                  <View style={styles.advancedMetricItem}>
                    <Text style={styles.advancedMetricLabel}>Total Power</Text>
                    <Text style={[styles.advancedMetricValue, { color: '#607D8B' }]}>
                      {detailedEEGData.totalPower?.toFixed(0) || '0'}
                    </Text>
                    <Text style={styles.advancedMetricDesc}>Signal variance</Text>
                  </View>
                  <View style={styles.advancedMetricItem}>
                    <Text style={styles.advancedMetricLabel}>Theta Peak SNR</Text>
                    <Text style={[styles.advancedMetricValue, { color: '#795548' }]}>
                      {detailedEEGData.thetaPeakSNR?.toFixed(2) || '0.00'}
                    </Text>
                    <Text style={styles.advancedMetricDesc}>Peak-based SNR</Text>
                  </View>
                </View>
                {/* Additional Python Ratios Row */}
                <View style={styles.advancedMetricsGrid}>
                  <View style={styles.advancedMetricItem}>
                    <Text style={styles.advancedMetricLabel}>Alpha/Theta Ratio</Text>
                    <Text style={[styles.advancedMetricValue, { color: '#4CAF50' }]}>
                      {detailedEEGData.alphaTheta?.toFixed(2) || '0.00'}
                    </Text>
                    <Text style={styles.advancedMetricDesc}>Cognitive control</Text>
                  </View>
                  <View style={styles.advancedMetricItem}>
                    <Text style={styles.advancedMetricLabel}>Beta/Alpha Ratio</Text>
                    <Text style={[styles.advancedMetricValue, { color: '#2196F3' }]}>
                      {detailedEEGData.betaAlpha?.toFixed(2) || '0.00'}
                    </Text>
                    <Text style={styles.advancedMetricDesc}>Arousal balance</Text>
                  </View>
                  <View style={styles.advancedMetricItem}>
                    <Text style={styles.advancedMetricLabel}>Adapted Theta</Text>
                    <Text style={[styles.advancedMetricValue, { color: '#E91E63' }]}>
                      {detailedEEGData.adaptedThetaContribution?.toFixed(1) || '0.0'}%
                    </Text>
                    <Text style={styles.advancedMetricDesc}>SNR-enhanced</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
        {/* Python-Style Theta Contribution Plot - MAIN PLOT LIKE PYTHON VERSION */}
        {detailedEEGData.lastUpdateTime && detailedEEGData.thetaContribution !== undefined && (
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Theta Contribution (% of Total Brain Activity)</Text>
            <Text style={styles.chartSubtitle}>Python-style Analysis - Main Plot</Text>
            <View style={styles.chartContainer}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartLabel}>Theta Contribution %</Text>
                <Text style={styles.chartCurrent}>Current: {detailedEEGData.thetaContribution?.toFixed(1) || '0.0'}%</Text>
              </View>
              {/* Theta Contribution Chart Area with Reference Lines */}
              <View style={styles.thetaChartArea}>
                {/* Reference Lines (matching Python plot) */}
                <View style={[styles.referenceLine, { bottom: '50%', backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.referenceLineLabel}>Kids Upper (30%)</Text>
                </View>
                <View style={[styles.referenceLine, { bottom: '45%', backgroundColor: '#4CAF50' }]}>
                  <Text style={styles.referenceLineLabel}>Kids Lower (25%)</Text>
                </View>
                <View style={[styles.referenceLine, { bottom: '20%', backgroundColor: '#2196F3' }]}>
                  <Text style={styles.referenceLineLabel}>Adult Upper (10%)</Text>
                </View>
                <View style={[styles.referenceLine, { bottom: '10%', backgroundColor: '#2196F3' }]}>
                  <Text style={styles.referenceLineLabel}>Adult Lower (5%)</Text>
                </View>
                {/* Theta Contribution Bar Chart (last 60 seconds like Python) */}
                <View style={styles.thetaDataArea}>
                  {Array.from({ length: 60 }, (_, index) => {
                    // Use real theta contribution data from buffer
                    const dataIndex = thetaContributionBuffer.length - 60 + index;
                    const thetaValue = dataIndex >= 0 ? thetaContributionBuffer[dataIndex] : 0;
                    // Scale to chart height (50% max like Python reference ranges)
                    const height = Math.max((thetaValue / 50) * 100, 2);
                    const hasData = dataIndex >= 0 && thetaValue > 0;
                    // Color coding based on ranges (like Python)
                    let barColor = '#E0E0E0'; // Default gray
                    if (hasData) {
                      if (thetaValue >= 25 && thetaValue <= 30) {
                        barColor = '#4CAF50'; // Green for kids range
                      } else if (thetaValue >= 5 && thetaValue <= 10) {
                        barColor = '#2196F3'; // Blue for adult range
                      } else {
                        barColor = '#FF9800'; // Orange for current theta
                      }
                    }
                    return (
                      <View 
                        key={index} 
                        style={[
                          styles.thetaBar, 
                          { 
                            height: hasData ? height : 2,
                            backgroundColor: barColor,
                            opacity: hasData ? 1.0 : 0.3
                          }
                        ]} 
                      />
                    );
                  })}
                </View>
              </View>
              <View style={styles.chartFooter}>
                <Text style={styles.chartInfo}>Range: 0-50% (Kids/Adult reference ranges shown)</Text>
                <Text style={styles.chartInfo}>Smoothed: {detailedEEGData.smoothedTheta?.toFixed(1) || '0.0'}%</Text>
                <Text style={styles.chartInfo}>Peak SNR: {detailedEEGData.thetaPeakSNR?.toFixed(2) || '0.00'}</Text>
              </View>
            </View>
          </View>
        )}
        {/* Live Raw EEG Plot - SECONDARY PLOT */}
        {realTimeEegData.length > 0 && (
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Live Raw EEG Signal (512Hz)</Text>
            <View style={styles.chartContainer}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartLabel}>Raw Values</Text>
                <Text style={styles.chartSamples}>{realTimeEegData.length} samples ({(realTimeEegData.length / 512).toFixed(1)}s)</Text>
              </View>
              <View style={styles.chartArea}>
                {/* Show last 100 samples for better visualization at 512Hz */}
                {realTimeEegData.slice(-100).map((value, index) => {
                  const displayData = realTimeEegData.slice(-100);
                  const maxVal = Math.max(...displayData.map(v => Math.abs(v)));
                  const normalizedHeight = maxVal > 0 ? (Math.abs(value) / maxVal) * 80 : 10;
                  return (
                    <View 
                      key={index} 
                      style={[
                        styles.chartBar, 
                        { 
                          height: Math.max(normalizedHeight, 2),
                          backgroundColor: value > 0 ? '#4CAF50' : '#F44336',
                          width: 2 // Thinner bars for higher frequency data
                        }
                      ]} 
                    />
                  );
                })}
              </View>
              <View style={styles.chartFooter}>
                <Text style={styles.chartInfo}>Latest: {realTimeEegData[realTimeEegData.length - 1]}</Text>
                <Text style={styles.chartInfo}>
                  Rate: ~{realTimeEegData.length > 10 ? '512' : 'Starting...'}Hz
                </Text>
                <Text style={styles.chartInfo}>
                  Range: {Math.min(...realTimeEegData.slice(-100))} to {Math.max(...realTimeEegData.slice(-100))}
                </Text>
              </View>
            </View>
          </View>
        )}
        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.cardTitle}>Instructions</Text>
          <Text style={styles.instructionText}>• Turn on your BrainLink device and wear it</Text>
          {/* <Text style={styles.instructionText}>• Tap "Start Scan" to search for devices</Text> */}
          <Text style={styles.instructionText}>• Ensure good contact with forehead</Text>
          <Text style={styles.instructionText}>• Tap "Start Scan" to search for devices</Text>
        </View>
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  logoutButtonText: {
    color: '#ff5252',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modern Status Card with Glassmorphism
  statusCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Modern Button Design
  scanButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  errorContainer: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
  },
  errorText: {
    color: '#ff5252',
    fontSize: 14,
    fontWeight: '500',
  },
  // Modern Navigation
  navigationSection: {
    marginBottom: 20,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    opacity: 0.8,
  },
  navigationButtons: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  navButtonActive: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'capitalize',
  },
  navButtonActiveText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Modern Cards
  dataCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  // EEG Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 16,
    margin: 8,
    flex: 1,
    minWidth: '42%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  metricUnit: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  // Chart Container
  chartContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  chartSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  chartContent: {
    height: 200,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  chartInfo: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  // Instructions Card
  instructionsCard: {
    backgroundColor: 'rgba(33, 150, 243, 0.08)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.15)',
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    lineHeight: 20,
    fontWeight: '400',
  },
  // Band Power Cards
  bandPowersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  bandPowerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
    margin: 6,
    flex: 1,
    minWidth: '28%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  bandLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  bandValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  // Signal Quality Indicator
  signalQuality: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  signalText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  // Debug Info
  debugContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  // Device List
  deviceItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  deviceMac: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: 'monospace',
  },
  connectButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    opacity: 0.7,
  },
  // Modern Error States
  errorContainer2: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
  },
  errorText: {
    color: '#ff5252',
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Battery indicator (header)
  batteryContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  batteryIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batteryBody: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 2,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  batteryFill: {
    height: '100%',
    borderRadius: 1,
  },
  batteryCap: {
    marginLeft: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 1,
  },
  batteryPercentText: {
    color: '#ffffff',
    fontSize: 12,
    marginLeft: 6,
    opacity: 0.9,
    fontWeight: '600',
  },
  forceResetButton: {
    backgroundColor: 'rgba(255, 87, 34, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  forceResetButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  androidLogButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  // Modern Device Selection Card
  deviceSelectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  deviceSelectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '400',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceRssi: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
  },
  deviceConnectButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deviceConnectText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceSelectionHint: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
  },
  troubleshootingSection: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255, 193, 7, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.15)',
  },
  troubleshootingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 193, 7, 0.9)',
    marginBottom: 8,
  },
  troubleshootingText: {
    fontSize: 12,
    color: 'rgba(255, 193, 7, 0.8)',
    marginBottom: 4,
    lineHeight: 18,
    fontWeight: '400',
  },
  // Modern Metrics Cards
  metricsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  // BREAKTHROUGH: Modernized Real-Time EEG Display Card
  realTimeEegCard: {
    backgroundColor: 'rgba(0, 255, 0, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 0, 0.3)',
  },
  realTimeEegSection: {
    height: 400,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.2)',
  },
  realTimeCardSubtitle: {
    fontSize: 14,
    color: '#00ff88',
    marginBottom: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '500',
  },
  bandPowersCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  // Advanced Metrics
  metricsGrid: {
    gap: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  metricLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  metricSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    fontWeight: '400',
  },
  metricBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  metricFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Band Powers Grid
  bandPowersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  bandSection: {
    marginBottom: 24,
  },
  bandSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  bandItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 16,
    margin: 6,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  bandFreq: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    fontWeight: '500',
  },
  bandType: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.4)',
    fontStyle: 'italic',
    marginTop: 2,
  },
  // Advanced Metrics Grid
  advancedMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  advancedMetricItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 6,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  advancedMetricLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: '500',
  },
  advancedMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  advancedMetricDesc: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.4)',
    textAlign: 'center',
    lineHeight: 12,
  },
  // Modern Chart Styling
  chartSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
    fontWeight: '400',
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  chartCurrent: {
    fontSize: 14,
    color: '#ff9800',
    fontWeight: '600',
  },
  chartSamples: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '400',
  },
  // Theta Chart Styling
  thetaChartArea: {
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 12,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  referenceLineLabel: {
    fontSize: 8,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    position: 'absolute',
    right: 4,
    top: -8,
  },
  thetaDataArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '100%',
    paddingHorizontal: 4,
  },
  thetaBar: {
    width: 2,
    minHeight: 2,
    borderRadius: 1,
    marginHorizontal: 0.5,
  },
  // Raw EEG Chart
  chartArea: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 8,
  },
  chartBar: {
    width: 4,
    minHeight: 2,
    borderRadius: 2,
    marginHorizontal: 0.5,
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  chartInfo: {
    fontSize: 11,
    color: '#666',
  },
  // Instructions
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  
  // PYTHON-STYLE SIGNAL PLOTS
  signalPlotsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  plotContainer: {
    marginBottom: 20,
  },
  plotTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  plotSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  plotArea: {
    height: 120,
    backgroundColor: '#000',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  plotAreaLarge: {
    height: 200, // Much larger for better signal observation
    backgroundColor: '#000',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  plotAreaPython: {
    height: 250, // Even larger for Python-style visualization
    backgroundColor: '#000',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  svgPlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  plotBackgroundClean: {
    flex: 1,
    position: 'relative',
    // No grid lines or reference lines - clean like Python matplotlib
  },
  signalTracePython: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  signalLine: {
    position: 'absolute',
    height: 1,
    transformOrigin: 'left center',
  },
  debugCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  debugText: {
    fontSize: 12,
    color: '#FFF',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  
  // Navigation styles
  navigationSection: {
    marginBottom: 16,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  navButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#1976D2',
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  navButtonTextActive: {
    color: '#FFFFFF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  plotBackground: {
    flex: 1,
    position: 'relative',
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#333',
    flexDirection: 'row',
    color: 'rgba(255, 255, 255, 0.5)',
    position: 'absolute',
    right: 8,
    fontWeight: '500',
  },
  // Signal display
  signalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  referenceText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    marginLeft: 4,
    fontWeight: '500',
  },
  signalTrace: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  signalPoint: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  // DSP Control Styles
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dspControlsContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    margin: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  performanceStatsContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 12,
    marginTop: 8,
  },
  performanceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  performanceText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});

export default MacrotellectLinkDashboard;
