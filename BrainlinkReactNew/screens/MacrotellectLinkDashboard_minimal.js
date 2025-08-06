/**
 * MacrotellectLink Minimal Dashboard - 512Hz Real-Time Focus
 * Clean, minimal design with breakthrough 512Hz visualization
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
import { useMacrotellectLink } from '../hooks/useMacrotellectLink';
import RealTimeEEGDisplay from '../components/RealTimeEEGDisplay';
import MacrotellectLinkSDKTest from './MacrotellectLinkSDKTest';

const { BrainLinkModule } = NativeModules;

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

  // Real-time EEG data array for charts - THIS IS THE BREAKTHROUGH 512Hz DATA
  const [realTimeEegData, setRealTimeEegData] = useState([]);

  // Data rate monitoring
  const [dataRate, setDataRate] = useState(0);
  const lastDataRateCheck = useRef(Date.now());
  const dataCountSinceLastCheck = useRef(0);

  // Use the MacrotellectLink hook for device management
  const {
    devices,
    isScanning,
    scanningStatus,
    isConnected,
    connectedDevice,
    connectionError,
    eegData: hookEegData,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    clearDevices,
    isInitialized,
    initializationError,
    reinitialize,
    getConnectionState,
    getScanStatus,
    emergencyStop,
  } = useMacrotellectLink();

  // Local devices list for device selection
  const [localDevices, setLocalDevices] = useState([]);
  const lastConnectedDevice = useRef(null);

  // ULTRA-LIGHTWEIGHT EEG DATA HANDLER - OPTIMIZED FOR 512Hz
  const handleEEGData = useCallback((data) => {
    try {
      const now = Date.now();
      
      // Update detailed EEG data from the native module
      setDetailedEEGData(prev => ({
        ...prev,
        signal: getSafeNumericValue(data.signal),
        attention: getSafeNumericValue(data.attention),
        meditation: getSafeNumericValue(data.meditation),
        delta: getSafeNumericValue(data.delta),
        theta: getSafeNumericValue(data.theta),
        lowAlpha: getSafeNumericValue(data.lowAlpha),
        highAlpha: getSafeNumericValue(data.highAlpha),
        lowBeta: getSafeNumericValue(data.lowBeta),
        highBeta: getSafeNumericValue(data.highBeta),
        lowGamma: getSafeNumericValue(data.lowGamma),
        middleGamma: getSafeNumericValue(data.middleGamma),
        ap: getSafeNumericValue(data.ap),
        grind: getSafeNumericValue(data.grind),
        heartRate: getSafeNumericValue(data.heartRate),
        temperature: getSafeNumericValue(data.temperature),
        batteryLevel: getSafeNumericValue(data.batteryLevel),
        hardwareVersion: data.hardwareVersion || prev.hardwareVersion,
        rawValue: getSafeNumericValue(data.rawValue), // THIS IS THE KEY 512Hz RAW DATA
        lastUpdateTime: new Date().toLocaleTimeString(),
      }));

      // CRITICAL: Update real-time data for 512Hz visualization
      if (data.rawValue !== undefined && data.rawValue !== null) {
        setRealTimeEegData(prevData => {
          const newData = [...prevData, getSafeNumericValue(data.rawValue)];
          // Keep only last 1024 samples (2 seconds at 512Hz) for performance
          return newData.slice(-1024);
        });
      }

      // Update data rate
      dataCountSinceLastCheck.current += 1;
      if (now - lastDataRateCheck.current >= 1000) {
        const rate = (dataCountSinceLastCheck.current * 1000) / (now - lastDataRateCheck.current);
        setDataRate(Math.round(rate));
        lastDataRateCheck.current = now;
        dataCountSinceLastCheck.current = 0;
      }

      setLastDataTime(now);
    } catch (error) {
      console.log('⚠️ handleEEGData error:', error.message);
    }
  }, []);

  // POST-RELOAD DETECTION: Check if app was reloaded with existing connections
  const [isPostReload, setIsPostReload] = useState(false);
  const [isPostReloadDetected, setIsPostReloadDetected] = useState(false);

  // Initialize EEG data listener
  useEffect(() => {
    let subscription;
    
    if (Platform.OS === 'android') {
      subscription = DeviceEventEmitter.addListener('EEGDataUpdate', handleEEGData);
    }
    
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [handleEEGData]);

  // Connection status management
  useEffect(() => {
    if (isConnected && connectedDevice) {
      setConnectionStatus('connected');
      console.log('✅ Device connected via hook:', connectedDevice.name);
    } else if (isScanning) {
      setConnectionStatus('scanning');
    } else if (isInitialized) {
      setConnectionStatus('ready');
    } else {
      setConnectionStatus('initializing');
    }
  }, [isConnected, connectedDevice, isScanning, isInitialized]);

  // Memoized values to prevent unnecessary re-renders and improve button responsiveness
  const getConnectionColor = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return '#4CAF50';
      case 'connecting':
        return '#FF9800';
      case 'scanning':
        return '#2196F3';
      case 'ready':
        return '#9E9E9E';
      default:
        return '#F44336';
    }
  }, [connectionStatus]);

  const getConnectionStatusText = useMemo(() => {
    switch (connectionStatus) {
      case 'connected':
        return `CONNECTED (${connectedDevice?.name || 'Device'})`;
      case 'connecting':
        return 'CONNECTING';
      case 'scanning':
        return 'SCANNING';
      case 'ready':
        return 'READY TO SCAN';
      case 'initializing':
        return 'INITIALIZING';
      default:
        return 'DISCONNECTED';
    }
  }, [connectionStatus, connectedDevice]);

  // ULTRA-LIGHTWEIGHT BUTTON CONFIG: Minimal dependencies for maximum responsiveness
  const scanButtonConfig = useMemo(() => {
    // PERFORMANCE: Use primitive boolean check to avoid complex state dependencies
    const isCurrentlyScanning = isScanning;
    
    return {
      text: isCurrentlyScanning ? 'Stop Scan' : 'Start Scan',
      color: isCurrentlyScanning ? '#F44336' : '#4CAF50',
      disabled: false // Always enabled for immediate response
    };
  }, [isScanning]);

  // LIGHTNING-FAST BUTTON HANDLER: Zero dependencies, immediate action
  const handleButtonPress = useCallback(() => {
    if (isScanning) {
      stopScan();
    } else {
      startScan();
    }
  }, [isScanning, stopScan, startScan]);

  // Clear all EEG data function
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
    
    // Clear timing data
    setLastDataTime(null);
    setEegData({});
    
    console.log('✅ All EEG data cleared');
  }, []);

  // Reinitialize SDK function
  const handleReinitializeSDK = async () => {
    try {
      console.log('🔄 Reinitializing SDK...');
      setSdkError(null);
      clearAllData();
      await reinitialize();
      console.log('✅ SDK reinitialized successfully');
    } catch (error) {
      console.error('❌ SDK reinitialization failed:', error);
      setSdkError(error.message);
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

  // Real-Time EEG Display Screen (Fullscreen 512Hz)
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
          <Text style={styles.headerTitle}>512Hz Real-Time EEG</Text>
        </View>
        <RealTimeEEGDisplay 
          data={realTimeEegData}
          isConnected={isConnected}
          deviceInfo={connectedDevice}
        />
      </View>
    );
  }

  // Main Minimal Dashboard
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BrainLink Live Dashboard</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
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
            <Text style={styles.navigationTitle}>View Options</Text>
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
                  512Hz Real-Time
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
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
              </TouchableOpacity>
            </View>
          </View>

          {/* SCAN BUTTON */}
          <TouchableOpacity 
            style={[
              styles.scanButton, 
              { 
                backgroundColor: scanButtonConfig.color,
                opacity: scanButtonConfig.disabled ? 0.6 : 1.0 
              }
            ]}
            onPress={handleButtonPress}
            disabled={scanButtonConfig.disabled}
            activeOpacity={0.5}
            delayPressIn={0}
            delayPressOut={0}
            delayLongPress={0}
            pressRetentionOffset={{top: 40, left: 40, bottom: 40, right: 40}}
            hitSlop={{top: 30, left: 30, bottom: 30, right: 30}}
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

          {/* Minimal Debug Info */}
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Connection Status:</Text>
            <Text style={styles.debugText}>Status: {connectionStatus}</Text>
            <Text style={styles.debugText}>SDK Initialized: {isInitialized ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Connected: {isConnected ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Data Rate: {dataRate}Hz</Text>
            <Text style={styles.debugText}>Samples: {realTimeEegData.length}</Text>
            <Text style={styles.debugText}>Device: {connectedDevice?.name || 'None'}</Text>
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
                    await connectToDevice(device.mac || device.address);
                    console.log('✅ Connection initiated successfully');
                    lastConnectedDevice.current = device;
                  } catch (error) {
                    console.error('❌ Connection failed:', error.message);
                    setConnectionStatus('ready');
                    Alert.alert(
                      'Connection Failed', 
                      `Failed to connect to ${device.name || 'device'}: ${error.message}`,
                      [{ text: 'OK' }]
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
          </View>
        )}

        {/* BREAKTHROUGH: Minimal 512Hz Real-Time EEG Display */}
        {isConnected && realTimeEegData.length > 0 && (
          <RealTimeEEGDisplay 
            data={realTimeEegData}
            isConnected={isConnected}
            deviceInfo={connectedDevice}
          />
        )}

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.cardTitle}>Instructions</Text>
          <Text style={styles.instructionText}>• Turn on your BrainLink device</Text>
          <Text style={styles.instructionText}>• Tap "Start Scan" to search for devices</Text>
          <Text style={styles.instructionText}>• Ensure good contact with forehead</Text>
          <Text style={styles.instructionText}>• Signal quality should be green for best results</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  logoutButton: {
    backgroundColor: '#F44336',
    padding: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Status Card
  statusCard: {
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
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scanButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    padding: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugContainer: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  // Device Selection Card
  deviceSelectionCard: {
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
  deviceSelectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  deviceMac: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 11,
    color: '#999',
  },
  deviceConnectButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deviceConnectText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deviceSelectionHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  // Cards
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  instructionsCard: {
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
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
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
});

export default MacrotellectLinkDashboard;
