/**
 * MacrotellectLink Dashboard Screen
 * 
 * This screen uses the official MacrotellectLink SDK to:
 * - Exit demo mode and receive real EEG data
 * - Display comprehensive brainwave metrics
 * - Show device connection status
 * - Provide user-friendly controls
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform
} from 'react-native';
import { useMacrotellectLink } from '../hooks/useMacrotellectLink';
import { BandPowerDisplay } from '../components/BandPowerDisplay';
import EEGChart from '../components/EEGChart';
import MacrotellectLinkService from '../services/MacrotellectLinkService';
import DirectBLEScanner from '../services/DirectBLEScanner';
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

  // DirectBLE state
  const [bleScanner, setBLEScanner] = useState(null);
  const [bleDevices, setBLEDevices] = useState([]);
  const [bleConnected, setBLEConnected] = useState(false);
  const [bleStreaming, setBLEStreaming] = useState(false);
  const [bleEEGData, setBLEEEGData] = useState({});
  const [isDirectBLEMode, setIsDirectBLEMode] = useState(false);
  const bleRef = useRef(null);

  // Battery and device info state
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [deviceVersion, setDeviceVersion] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [connectionMode, setConnectionMode] = useState('NOT_INITIALIZED');
  const [isForceInitializing, setIsForceInitializing] = useState(false);

  const {
    // Connection state
    isInitialized,
    isScanning,
    isConnected,
    connectedDevice,
    connectionStatus,
    signalQuality,
    isReceivingData,
    
    // EEG data
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
    clearError
  } = useMacrotellectLink();

  const handleStartScan = async () => {
    try {
      await startScan();
    } catch (error) {
      Alert.alert('Scan Error', error.message);
    }
  };

  const handleStopScan = async () => {
    try {
      await stopScan();
    } catch (error) {
      Alert.alert('Stop Error', error.message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      Alert.alert('Disconnect Error', error.message);
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'disconnected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getConnectionStatusText = () => {
    const demoText = MacrotellectLinkService.isDemoMode() ? ' (DEMO)' : '';
    switch (connectionStatus) {
      case 'connected': return `Connected - Real EEG Data${demoText}`;
      case 'connecting': return `Connecting...${demoText}`;
      case 'disconnected': return `Disconnected${demoText}`;
      default: return `Unknown${demoText}`;
    }
  };

  const getSignalQualityColor = () => {
    switch (signalQuality) {
      case 'Good': return '#4CAF50';
      case 'Fair': return '#FF9800';
      case 'Poor': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getBatteryColor = () => {
    if (batteryLevel === null) return '#9E9E9E';
    if (isDemoMode) return '#FF9800'; // Orange for demo mode
    if (batteryLevel > 50) return '#4CAF50'; // Green for good battery
    if (batteryLevel > 20) return '#FF9800'; // Orange for medium battery
    return '#F44336'; // Red for low battery
  };

  const getConnectionModeText = () => {
    switch (connectionMode) {
      case 'REAL_DATA_MODE':
        return 'REAL EEG DATA';
      case 'DEMO_MODE_DIRECTBLE':
        return 'DEMO MODE';
      case 'NOT_INITIALIZED':
        return 'NOT INITIALIZED';
      default:
        return 'UNKNOWN';
    }
  };

  const getConnectionModeColor = () => {
    switch (connectionMode) {
      case 'REAL_DATA_MODE':
        return '#4CAF50'; // Green for real data
      case 'DEMO_MODE_DIRECTBLE':
        return '#FF9800'; // Orange for demo mode
      case 'NOT_INITIALIZED':
        return '#9E9E9E'; // Gray for not initialized
      default:
        return '#9E9E9E';
    }
  };

  // DirectBLE initialization
  useEffect(() => {
    const initBLE = async () => {
      const scanner = new DirectBLEScanner();
      bleRef.current = scanner;
      setBLEScanner(scanner);

      // Listen for EEG data
      scanner.on('eegData', (data) => {
        // Filter data based on contact quality if available
        const shouldProcess = MacrotellectLinkService.shouldProcessData(data, 50); // 50% quality threshold
        
        if (shouldProcess) {
          setBLEEEGData(data);
          setIsDirectBLEMode(true); // Ensure DirectBLE mode is active when receiving data
          setBLEStreaming(true); // Ensure streaming status is active
          
          // Enhanced logging to debug band power display
          if (data.delta || data.theta || data.alpha || data.beta || data.gamma) {
            console.log('✅ Dashboard received EEG data WITH band powers:', {
              raw: data.raw || data.rawEEG,
              delta: data.delta,
              theta: data.theta,
              alpha: data.alpha,
              beta: data.beta,
              gamma: data.gamma,
              contactQuality: data.contactQuality
            });
          } else {
            console.log('📡 Dashboard received EEG data WITHOUT band powers:', {
              raw: data.raw || data.rawEEG,
              timestamp: data.timestamp,
              contactQuality: data.contactQuality
            });
          }
        } else {
          console.log('🚫 Dashboard filtered out poor quality data:', {
            raw: data.raw || data.rawEEG,
            contactQuality: data.contactQuality,
            reason: 'Poor contact or demo mode detected'
          });
        }
      });

      // Listen for battery data
      scanner.on('batteryData', (data) => {
        setBatteryLevel(data.battery);
        setIsDemoMode(data.isDemoMode);
        console.log(`🔋 Dashboard received battery data: ${data.battery}% ${data.isDemoMode ? '(Demo Mode)' : '(Real Device)'}`);
      });

      // Listen for version data
      scanner.on('versionData', (data) => {
        setDeviceVersion(data.version);
        console.log(`📱 Dashboard received version data: ${data.version}`);
      });

      // Listen for connection events
      scanner.on('connected', (device) => {
        setBLEConnected(true);
        console.log('🔗 BLE Device connected:', device.id);
      });

      scanner.on('disconnected', () => {
        setBLEConnected(false);
        setBLEStreaming(false);
        console.log('🔌 BLE Device disconnected');
      });
    };

    initBLE();

    return () => {
      if (bleRef.current) {
        bleRef.current.destroy();
      }
    };
  }, []);

  // DirectBLE handlers
  const handleDirectBLEScan = async () => {
    if (!bleScanner) return;
    
    try {
      console.log('🔍 Starting DirectBLE scan for authorized devices...');
      setBLEDevices([]);
      
      await bleScanner.startScan((device) => {
        setBLEDevices(prev => {
          const exists = prev.find(d => d.id === device.id);
          if (!exists) {
            return [...prev, device];
          }
          return prev;
        });
      });
    } catch (error) {
      Alert.alert('DirectBLE Scan Error', error.message);
    }
  };

  const handleConnectToBLEDevice = async (device) => {
    if (!bleScanner) return;

    try {
      console.log('🔗 Connecting to BLE device:', device.id);
      await bleScanner.connectToDevice(device.id);
      setBLEConnected(true);
      setBLEStreaming(true);
      setIsDirectBLEMode(true);
      Alert.alert('Success', `Connected to ${device.name || device.id} and started EEG streaming!`);
    } catch (error) {
      Alert.alert('Connection Error', error.message);
    }
  };

  const handleDirectBLEDisconnect = async () => {
    if (!bleScanner) return;

    try {
      await bleScanner.disconnect();
      setBLEConnected(false);
      setBLEStreaming(false);
      setIsDirectBLEMode(false);
    } catch (error) {
      Alert.alert('Disconnect Error', error.message);
    }
  };

  // Test DirectBLE - Primary function for real EEG streaming
  const testDirectBLE = async () => {
    if (!bleScanner) {
      Alert.alert('DirectBLE Error', 'BLE Scanner not initialized');
      return;
    }

    try {
      if (bleConnected) {
        // If already connected, disconnect
        await handleDirectBLEDisconnect();
        return;
      }

      // Clear previous devices and start fresh scan
      setBLEDevices([]);
      setBLEEEGData(null);
      clearError(); // Use the existing clearError from the hook
      
      console.log('🔍 Starting DirectBLE scan for real EEG streaming...');
      
      // Start scanning for BrainLink devices with auto-connect
      await bleScanner.startScan(
        (device) => {
          console.log('🧠 Found authorized BrainLink device:', device);
          setBLEDevices(prev => {
            const exists = prev.find(d => d.id === device.id);
            if (!exists) {
              return [...prev, { ...device, authorized: true }];
            }
            return prev;
          });
          
          // Auto-connect to the first authorized device found
          if (!bleConnected) {
            console.log('🚀 Auto-connecting to authorized device:', device.id);
            handleConnectToBLEDevice(device);
            
            // Stop scanning after finding first authorized device
            setTimeout(() => {
              bleScanner.stopScan();
            }, 1000);
          }
        },
        (error, devices) => {
          console.log('🔍 Scan completed');
          if (error) {
            console.error('Scan error:', error);
          }
        }
      );
      
    } catch (error) {
      console.error('DirectBLE Test Error:', error);
      // Show error in Alert since we don't have setLastError
      Alert.alert('DirectBLE Test Error', error.message);
    }
  };

  const handleForceSDKInit = async () => {
    try {
      setIsForceInitializing(true);
      console.log('🔥 User requested force SDK initialization...');
      
      const success = await MacrotellectLinkService.forceSDKInitialization();
      if (success) {
        Alert.alert(
          'SDK Initialized Successfully',
          'MacrotellectLink SDK is now active. You will receive REAL EEG data from your BrainLink device.',
          [{ text: 'OK' }]
        );
        setConnectionMode('REAL_DATA_MODE');
      } else {
        Alert.alert(
          'SDK Initialization Failed',
          'Unable to initialize MacrotellectLink SDK. The app will continue in demo mode with DirectBLE fallback.',
          [{ text: 'OK' }]
        );
        setConnectionMode('DEMO_MODE_DIRECTBLE');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to force SDK initialization: ' + error.message);
    } finally {
      setIsForceInitializing(false);
    }
  };

  // Update connection mode based on service state
  useEffect(() => {
    const updateConnectionMode = () => {
      if (MacrotellectLinkService.isAvailable()) {
        setConnectionMode(MacrotellectLinkService.getConnectionMode());
      } else {
        setConnectionMode('NOT_INITIALIZED');
      }
    };

    updateConnectionMode();
    
    // Update every 5 seconds
    const interval = setInterval(updateConnectionMode, 5000);
    return () => clearInterval(interval);
  }, [isConnected, isInitialized]);

  return (
    <>
      {currentScreen === 'sdk-test' ? (
        <View style={styles.container}>
          {/* SDK Test Screen Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setCurrentScreen('dashboard')}
              >
                <Text style={styles.backButtonText}>← Back to Dashboard</Text>
              </TouchableOpacity>
              <Text style={styles.title}>MacrotellectLink SDK Test</Text>
            </View>
          </View>
          
          {/* SDK Test Component */}
          <MacrotellectLinkSDKTest />
        </View>
      ) : (
        <ScrollView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View>
                <Text style={styles.title}>MacrotellectLink Dashboard</Text>
                <Text style={styles.subtitle}>
                  {MacrotellectLinkService.isDemoMode() 
                    ? 'Demo Mode - Development/Testing' 
                    : 'Real EEG Data via Official SDK'}
                </Text>
                {user && <Text style={styles.userInfo}>Welcome, {user.username}</Text>}
              </View>
              {onLogout && (
                <TouchableOpacity 
                  style={styles.logoutButton} 
                  onPress={onLogout}
                >
                  <Text style={styles.logoutButtonText}>Logout</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SDK Test Button */}
          <View style={styles.section}>
            <TouchableOpacity 
              style={[styles.button, styles.testButton]}
              onPress={() => setCurrentScreen('sdk-test')}
            >
              <Text style={styles.buttonText}>🔧 Test MacrotellectLink SDK</Text>
            </TouchableOpacity>
          </View>

      {/* DirectBLE Test Button - Test Real EEG Streaming */}
      <View style={styles.directBleSection}>
        <Text style={styles.directBleTitle}>🔗 Direct BLE Connection</Text>
        <Text style={styles.directBleSubtitle}>Test real EEG streaming from BrainLink device</Text>
        
        <TouchableOpacity 
          style={[styles.directBleButton, bleConnected && styles.directBleButtonConnected]}
          onPress={testDirectBLE}
        >
          <Text style={styles.directBleButtonText}>
            {bleConnected ? '✅ Connected - Streaming' : '🔍 Test DirectBLE Connection'}
          </Text>
        </TouchableOpacity>

        {bleDevices && bleDevices.length > 0 && (
          <View style={styles.bleDevicesList}>
            <Text style={styles.bleDevicesTitle}>Found Devices:</Text>
            {bleDevices.map((device, index) => (
              <View key={index} style={styles.bleDeviceItem}>
                <Text style={styles.bleDeviceName}>{device?.name || 'Unknown'}</Text>
                <Text style={styles.bleDeviceId}>{device?.id || 'Unknown ID'}</Text>
                {device?.authorized && <Text style={styles.bleDeviceAuthorized}>✅ Authorized</Text>}
              </View>
            ))}
          </View>
        )}

        {bleEEGData && (
          <View style={styles.bleEEGContainer}>
            <Text style={styles.bleEEGTitle}>📊 Real EEG Data:</Text>
            <Text style={styles.bleEEGValue}>Raw: {bleEEGData?.raw || 'N/A'}</Text>
            <Text style={styles.bleEEGValue}>Voltage: {bleEEGData?.voltage || 'N/A'}µV</Text>
            <Text style={styles.bleEEGTimestamp}>Time: {bleEEGData?.timestamp || 'N/A'}</Text>
          </View>
        )}
      </View>

      {/* Error Display */}
      {lastError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{lastError}</Text>
          <TouchableOpacity style={styles.clearErrorButton} onPress={clearError}>
            <Text style={styles.clearErrorText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Demo Mode Warning */}
      {MacrotellectLinkService.isDemoMode() && (
        <View style={styles.demoWarning}>
          <Text style={styles.demoWarningTitle}>🎭 Demo Mode Active</Text>
          <Text style={styles.demoWarningText}>
            Running in development mode with simulated EEG data.{'\n'}
            To use real BrainLink devices, run on an Android device with the MacrotellectLink SDK.
          </Text>
        </View>
      )}

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: getConnectionStatusColor() }]}>
          <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
        </View>
        
        {/* Connection Mode Indicator */}
        <View style={styles.connectionModeContainer}>
          <Text style={styles.connectionModeLabel}>Data Mode:</Text>
          <View style={[styles.connectionModeBadge, { backgroundColor: getConnectionModeColor() }]}>
            <Text style={styles.connectionModeText}>{getConnectionModeText()}</Text>
          </View>
        </View>
        
        {/* Force SDK Initialization Button */}
        {connectionMode === 'DEMO_MODE_DIRECTBLE' && (
          <TouchableOpacity 
            style={[styles.button, styles.forceSDKButton]} 
            onPress={handleForceSDKInit}
            disabled={isForceInitializing}
          >
            <Text style={styles.buttonText}>
              {isForceInitializing ? 'Initializing SDK...' : 'Force Real Data Mode'}
            </Text>
          </TouchableOpacity>
        )}
        
        {connectedDevice && (
          <Text style={styles.deviceInfo}>
            Device: {connectedDevice.name} ({connectedDevice.mac})
          </Text>
        )}

        {/* Signal Quality */}
        {isConnected && (
          <View style={styles.signalContainer}>
            <Text style={styles.signalLabel}>Signal Quality:</Text>
            <View style={[styles.signalBadge, { backgroundColor: getSignalQualityColor() }]}>
              <Text style={styles.signalText}>{signalQuality}</Text>
            </View>
            <Text style={styles.signalValue}>Signal: {eegData.signal}</Text>
          </View>
        )}

        {/* Battery Level */}
        {batteryLevel !== null && (
          <View style={styles.batteryContainer}>
            <Text style={styles.batteryLabel}>Battery:</Text>
            <View style={[styles.batteryBadge, { backgroundColor: getBatteryColor() }]}>
              <Text style={styles.batteryText}>{batteryLevel}%</Text>
            </View>
            {isDemoMode && (
              <Text style={styles.demoModeText}>Demo Mode</Text>
            )}
          </View>
        )}

        {/* Device Version */}
        {deviceVersion !== null && (
          <Text style={styles.deviceVersion}>Version: {deviceVersion}</Text>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Control</Text>
        <View style={styles.buttonRow}>
          {!isScanning && !isConnected && (
            <TouchableOpacity 
              style={[styles.button, styles.scanButton]} 
              onPress={handleStartScan}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Starting...' : 'Start Scan'}
              </Text>
            </TouchableOpacity>
          )}
          
          {isScanning && (
            <TouchableOpacity 
              style={[styles.button, styles.stopButton]} 
              onPress={handleStopScan}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Stop Scan</Text>
            </TouchableOpacity>
          )}
          
          {isConnected && (
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]} 
              onPress={handleDisconnect}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SDK Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SDK Status</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Initialized</Text>
            <Text style={[styles.statusValue, { color: isInitialized ? '#4CAF50' : '#F44336' }]}>
              {isInitialized ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Scanning</Text>
            <Text style={[styles.statusValue, { color: isScanning ? '#FF9800' : '#9E9E9E' }]}>
              {isScanning ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Data Stream</Text>
            <Text style={[styles.statusValue, { color: isReceivingData ? '#4CAF50' : '#F44336' }]}>
              {isReceivingData ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>

      {/* DirectBLE Alternative Connection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DirectBLE Connection (Real Hardware)</Text>
        <Text style={styles.subtitle}>
          Direct BLE connection with HWID authorization and EEG streaming
        </Text>
        
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Mode</Text>
            <Text style={[styles.statusValue, { color: isDirectBLEMode ? '#4CAF50' : '#9E9E9E' }]}>
              {isDirectBLEMode ? 'DirectBLE' : 'SDK'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>BLE Connected</Text>
            <Text style={[styles.statusValue, { color: bleConnected ? '#4CAF50' : '#F44336' }]}>
              {bleConnected ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>EEG Streaming</Text>
            <Text style={[styles.statusValue, { color: bleStreaming ? '#4CAF50' : '#F44336' }]}>
              {bleStreaming ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          {!bleConnected && (
            <TouchableOpacity 
              style={[styles.button, styles.scanButton]} 
              onPress={handleDirectBLEScan}
            >
              <Text style={styles.buttonText}>Scan for BrainLink</Text>
            </TouchableOpacity>
          )}
          
          {bleConnected && (
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]} 
              onPress={handleDirectBLEDisconnect}
            >
              <Text style={styles.buttonText}>Disconnect BLE</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Found BLE Devices */}
        {bleDevices && bleDevices.length > 0 && !bleConnected && (
          <View style={styles.devicesList}>
            <Text style={styles.devicesTitle}>Authorized BrainLink Devices:</Text>
            {bleDevices.map((device) => (
              <TouchableOpacity
                key={device?.id || Math.random()}
                style={styles.deviceItem}
                onPress={() => handleConnectToBLEDevice(device)}
              >
                <Text style={styles.deviceName}>{device?.name || 'BrainLink Device'}</Text>
                <Text style={styles.deviceId}>ID: {device?.id || 'Unknown'}</Text>
                <Text style={styles.deviceRSSI}>Signal: {device?.rssi || 'Unknown'} dBm</Text>
                <Text style={styles.deviceStatus}>✅ Authorized</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* DirectBLE EEG Data */}
        {isDirectBLEMode && bleStreaming && Object.keys(bleEEGData).length > 0 && (
          <View style={styles.bleDataSection}>
            <Text style={styles.sectionTitle}>🧠 Live DirectBLE EEG Data</Text>
            
            {/* Core Mental States */}
            {(getSafeNumericValue(bleEEGData.attention) > 0 || getSafeNumericValue(bleEEGData.meditation) > 0) && (
              <View style={styles.metricsGrid}>
                {getSafeNumericValue(bleEEGData.attention) > 0 && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Attention</Text>
                    <Text style={styles.metricValue}>{getSafeNumericValue(bleEEGData.attention)}</Text>
                  </View>
                )}
                {getSafeNumericValue(bleEEGData.meditation) > 0 && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Meditation</Text>
                    <Text style={styles.metricValue}>{getSafeNumericValue(bleEEGData.meditation)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Band Power Display - Visual Progress Bars */}
            {(getSafeNumericValue(bleEEGData.delta) > 0 || getSafeNumericValue(bleEEGData.theta) > 0 || getSafeNumericValue(bleEEGData.alpha) > 0 || getSafeNumericValue(bleEEGData.beta) > 0 || getSafeNumericValue(bleEEGData.gamma) > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🌊 Frequency Band Powers</Text>
                <View style={styles.bandPowerContainer}>
                  {/* Delta */}
                  {getSafeNumericValue(bleEEGData.delta) > 0 && (
                    <View style={styles.bandPowerItem}>
                      <Text style={styles.bandLabel}>Delta (0.5-4 Hz)</Text>
                      <Text style={styles.bandValue}>{getSafeNumericValue(bleEEGData.delta).toFixed(1)}%</Text>
                      <View style={styles.bandBar}>
                        <View 
                          style={[
                            styles.bandBarFill, 
                            { 
                              width: `${Math.min(getSafeNumericValue(bleEEGData.delta), 100)}%`,
                              backgroundColor: '#4CAF50'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  )}
                  
                  {/* Theta */}
                  {getSafeNumericValue(bleEEGData.theta) > 0 && (
                    <View style={styles.bandPowerItem}>
                      <Text style={styles.bandLabel}>Theta (4-8 Hz)</Text>
                      <Text style={styles.bandValue}>{getSafeNumericValue(bleEEGData.theta).toFixed(1)}%</Text>
                      <View style={styles.bandBar}>
                        <View 
                          style={[
                            styles.bandBarFill, 
                            { 
                              width: `${Math.min(getSafeNumericValue(bleEEGData.theta), 100)}%`,
                              backgroundColor: '#9C27B0'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  )}
                  
                  {/* Alpha */}
                  {getSafeNumericValue(bleEEGData.alpha) > 0 && (
                    <View style={styles.bandPowerItem}>
                      <Text style={styles.bandLabel}>Alpha (8-12 Hz)</Text>
                      <Text style={styles.bandValue}>{getSafeNumericValue(bleEEGData.alpha).toFixed(1)}%</Text>
                      <View style={styles.bandBar}>
                        <View 
                          style={[
                            styles.bandBarFill, 
                            { 
                              width: `${Math.min(getSafeNumericValue(bleEEGData.alpha), 100)}%`,
                              backgroundColor: '#2196F3'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  )}
                  
                  {/* Beta */}
                  {getSafeNumericValue(bleEEGData.beta) > 0 && (
                    <View style={styles.bandPowerItem}>
                      <Text style={styles.bandLabel}>Beta (12-30 Hz)</Text>
                      <Text style={styles.bandValue}>{getSafeNumericValue(bleEEGData.beta).toFixed(1)}%</Text>
                      <View style={styles.bandBar}>
                        <View 
                          style={[
                            styles.bandBarFill, 
                            { 
                              width: `${Math.min(getSafeNumericValue(bleEEGData.beta), 100)}%`,
                              backgroundColor: '#FF9800'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  )}
                  
                  {/* Gamma */}
                  {getSafeNumericValue(bleEEGData.gamma) > 0 && (
                    <View style={styles.bandPowerItem}>
                      <Text style={styles.bandLabel}>Gamma (30-45 Hz)</Text>
                      <Text style={styles.bandValue}>{getSafeNumericValue(bleEEGData.gamma).toFixed(1)}%</Text>
                      <View style={styles.bandBar}>
                        <View 
                          style={[
                            styles.bandBarFill, 
                            { 
                              width: `${Math.min(getSafeNumericValue(bleEEGData.gamma), 100)}%`,
                              backgroundColor: '#F44336'
                            }
                          ]} 
                        />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Raw Signal Info */}
            {bleEEGData.rawEEG && (
              <View style={styles.rawSignalInfo}>
                <Text style={styles.rawSignalLabel}>Raw EEG Signal:</Text>
                <Text style={styles.rawSignalValue}>{bleEEGData.rawEEG} µV</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Real-time EEG Data */}
      {isConnected && isReceivingData && (
        <>
          {/* Core Metrics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Core EEG Metrics</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Attention</Text>
                <Text style={styles.metricValue}>{eegData.attention}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Meditation</Text>
                <Text style={styles.metricValue}>{eegData.meditation}</Text>
              </View>
              {getSafeNumericValue(eegData.appreciation) > 0 && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Appreciation</Text>
                  <Text style={styles.metricValue}>{eegData.appreciation}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Band Powers - Python-matching processed values */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brainwave Band Powers (Processed)</Text>
            <BandPowerDisplay 
              bandPowers={{
                delta: getSafeNumericValue(eegData.delta),
                theta: getSafeNumericValue(eegData.theta),
                alpha: getSafeNumericValue(eegData.alpha),
                beta: getSafeNumericValue(eegData.beta),
                gamma: getSafeNumericValue(eegData.gamma)
              }}
            />
          </View>

          {/* Advanced Theta Metrics - matches Python BrainCompanion output */}
          {(getSafeNumericValue(eegData.thetaContribution) > 0 || getSafeNumericValue(eegData.thetaRelative) > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Advanced Theta Analysis</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Theta Contribution</Text>
                  <Text style={styles.metricValue}>{getSafeNumericValue(eegData.thetaContribution).toFixed(1)}%</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Theta Relative</Text>
                  <Text style={styles.metricValue}>{(getSafeNumericValue(eegData.thetaRelative) * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Smoothed Theta</Text>
                  <Text style={styles.metricValue}>{getSafeNumericValue(eegData.smoothedTheta).toFixed(1)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Device Metrics (BrainLink Pro) */}
          {(getSafeNumericValue(eegData.batteryCapacity) > 0 || getSafeNumericValue(eegData.heartRate) > 0 || getSafeNumericValue(eegData.temperature) > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Device Metrics</Text>
              <View style={styles.metricsGrid}>
                {getSafeNumericValue(eegData.batteryCapacity) > 0 && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Battery</Text>
                    <Text style={styles.metricValue}>{eegData.batteryCapacity}%</Text>
                  </View>
                )}
                {getSafeNumericValue(eegData.heartRate) > 0 && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Heart Rate</Text>
                    <Text style={styles.metricValue}>{eegData.heartRate} BPM</Text>
                  </View>
                )}
                {getSafeNumericValue(eegData.temperature) > 0 && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Temperature</Text>
                    <Text style={styles.metricValue}>{eegData.temperature}°C</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Gravity Data (BrainLink Pro) */}
          {(gravityData.x !== 0 || gravityData.y !== 0 || gravityData.z !== 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gravity Data</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Pitch (X)</Text>
                  <Text style={styles.metricValue}>{gravityData.x.toFixed(2)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Yaw (Y)</Text>
                  <Text style={styles.metricValue}>{gravityData.y.toFixed(2)}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Roll (Z)</Text>
                  <Text style={styles.metricValue}>{gravityData.z.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EEG Visualization</Text>
            <EEGChart 
              data={[
                eegData.delta,
                eegData.theta,
                eegData.lowAlpha + eegData.highAlpha,
                eegData.lowBeta + eegData.highBeta,
                eegData.lowGamma + eegData.middleGamma
              ]}
              labels={['Delta', 'Theta', 'Alpha', 'Beta', 'Gamma']}
            />
          </View>
        </>
      )}

      {/* Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        <Text style={styles.instructionText}>
          {MacrotellectLinkService.isDemoMode() ? (
            `🎭 DEMO MODE INSTRUCTIONS:\n` +
            `1. Tap "Start Scan" to simulate device discovery\n` +
            `2. App will simulate connection to BrainLink_Pro_Demo\n` +
            `3. Realistic EEG data will be generated for testing\n` +
            `4. All features work as they would with real hardware\n\n` +
            `📱 FOR REAL DEVICES:\n` +
            `• Run on Android device with MacrotellectLink SDK\n` +
            `• Ensure BrainLink device is powered on and paired`
          ) : (
            `1. Ensure your BrainLink device is powered on\n` +
            `2. Tap "Start Scan" to discover devices\n` +
            `3. SDK will automatically connect to authorized devices\n` +
            `4. Real EEG data will stream once connected\n` +
            `5. Signal quality "Good" (0) indicates proper contact`
          )}
        </Text>
      </View>

      {eegData.timestamp && (
        <Text style={styles.timestamp}>
          Last update: {new Date(eegData.timestamp).toLocaleTimeString()}
        </Text>
      )}
    </ScrollView>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
  },
  userInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    marginBottom: 10,
  },
  clearErrorButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F44336',
    borderRadius: 4,
  },
  clearErrorText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  demoWarning: {
    backgroundColor: '#FFF3CD',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  demoWarningTitle: {
    color: '#FF9800',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  demoWarningText: {
    color: '#8B6914',
    fontSize: 14,
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  deviceInfo: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  signalLabel: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  signalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  signalText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  signalValue: {
    fontSize: 12,
    color: '#666',
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  batteryLabel: {
    fontSize: 14,
    color: '#333',
    marginRight: 8,
  },
  batteryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  batteryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  demoModeText: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  deviceVersion: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#FF9800',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  timestamp: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 20,
  },
  devicesList: {
    marginTop: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
  },
  devicesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  deviceItem: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deviceRSSI: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deviceStatus: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  bleDataSection: {
    marginTop: 15,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
  },
  
  // DirectBLE Test Section Styles
  directBleSection: {
    backgroundColor: '#f0f8ff',
    margin: 16,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  directBleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 8,
    textAlign: 'center',
  },
  directBleSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  directBleButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  directBleButtonConnected: {
    backgroundColor: '#4CAF50',
  },
  directBleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bleDevicesList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  bleDevicesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  bleDeviceItem: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  bleDeviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  bleDeviceId: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  bleDeviceAuthorized: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 4,
  },
  bleEEGContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  bleEEGTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  bleEEGValue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  bleEEGTimestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  rawSignalInfo: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  rawSignalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  rawSignalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
  },
  
  // Band Power Display Styles
  bandPowerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  bandPowerItem: {
    marginBottom: 12,
  },
  bandLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  bandValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 6,
    textAlign: 'right',
  },
  bandBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bandBarFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  connectionModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  connectionModeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  connectionModeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  connectionModeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  forceSDKButton: {
    backgroundColor: '#FF9800',
    marginTop: 8,
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#9C27B0',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginBottom: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
