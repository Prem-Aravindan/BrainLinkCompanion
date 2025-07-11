import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Dimensions } from 'react-native';
import { COLORS, EEG_CONFIG } from '../constants';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';
import { createEEGProcessor } from '../utils/eegProcessing';
import { BandPowerDisplay } from '../components/BandPowerDisplay';
import DeviceListModal from '../components/DeviceListModal';
import { useBrainLinkRealData } from '../hooks/useBrainLinkRealData';

// Create the main EEG processor instance
const eegProcessor = createEEGProcessor(EEG_CONFIG.SAMPLING_RATE);

const screenWidth = Dimensions.get('window').width;

const DashboardScreen = ({ user = {}, onLogout }) => {
  const username = user.username || 'Unknown User';

  // Use the TGAM hook for real-time EEG data
  const {
    isConnected,
    isConnecting,
    deviceName,
    connectionError,
    eegData,
    dataQuality,
    connect,
    disconnect,
    reconnect,
    startRecording,
    stopRecording,
    isRecording,
    getParserStats,
  } = useBrainLinkRealData();

  // UI state
  const [bluetoothAvailable, setBluetoothAvailable] = useState(true);
  const [bluetoothStatus, setBluetoothStatus] = useState('Checking...');
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTogglingRecording, setIsTogglingRecording] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);

  // Derived state from TGAM EEG data
  const bandPowers = {
    delta: eegData.delta,
    theta: eegData.theta,
    alpha: eegData.alpha,
    beta: eegData.beta,
    gamma: eegData.gamma,
  };

  useEffect(() => {
    // Initialize Bluetooth service with error handling
    const initializeBluetooth = async () => {
      try {
        setBluetoothStatus('Initializing...');
        const initialized = await BluetoothService.initialize();
        if (!initialized) {
          console.warn('Bluetooth service failed to initialize');
          setBluetoothAvailable(false);
          setBluetoothStatus('Not Available');
        } else {
          setBluetoothAvailable(true);
          setBluetoothStatus('Ready');
        }
      } catch (error) {
        console.error('Bluetooth initialization failed:', error);
        setBluetoothAvailable(false);
        setBluetoothStatus(`Error: ${error.message}`);
      }
    };
    
    initializeBluetooth();

    // Cleanup function
    return () => {
      // Cleanup is handled by the useBrainLinkRealData hook
    };
  }, []);

  const connectToDevice = async () => {
    if (isConnecting) {
      console.log('⚠️ Connection already in progress, ignoring request');
      return;
    }
    
    setShowDeviceList(true);
  };

  const handleDeviceSelected = async (device) => {
    try {
      console.log(`🔗 Attempting to connect to device: ${device.name}`);
      setShowDeviceList(false);
      
      // Use the hook's connect method
      await connect(device.id);
      
    } catch (error) {
      console.error('❌ Connection error:', error);
      Alert.alert('Connection Error', `Failed to connect: ${error.message}`);
    }
  };

  const disconnectDevice = async () => {
    if (!isConnected || isDisconnecting) {
      console.log('⚠️ Cannot disconnect: not connected or already disconnecting');
      return;
    }
    
    try {
      setIsDisconnecting(true);
      console.log('🔌 Disconnecting device...');
      
      // Use the hook's disconnect method
      await disconnect();
      console.log('✅ Device disconnected successfully');
    } catch (error) {
      console.error('❌ Disconnect error:', error);
      Alert.alert('Disconnect Error', `Failed to disconnect: ${error.message}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const toggleRecording = async () => {
    if (!isConnected || isTogglingRecording) {
      if (!isConnected) {
        Alert.alert('No Device', 'Please connect to a device first');
      }
      return;
    }
    
    try {
      setIsTogglingRecording(true);
      
      if (!isRecording) {
        // Start recording using the hook
        console.log('🎬 Starting EEG recording...');
        await startRecording();
        
        Alert.alert(
          'Recording Started',
          'EEG data streaming has been started. Data will appear in real-time.'
        );
        console.log('✅ EEG recording started successfully');
      } else {
        // Stop recording using the hook
        console.log('⏹️ Stopping EEG recording...');
        await stopRecording();
        
        Alert.alert(
          'Recording Stopped',
          'EEG data streaming has been stopped.'
        );
        console.log('✅ EEG recording stopped successfully');
      }
    } catch (error) {
      console.error('❌ Recording toggle failed:', error);
      Alert.alert(
        'Recording Error',
        `Failed to ${isRecording ? 'stop' : 'start'} recording: ${error.message}`
      );
    } finally {
      setIsTogglingRecording(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BrainLink Dashboard</Text>
          <Text style={styles.headerSubtitle}>Welcome, {username}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Device Status</Text>
          
          {!bluetoothAvailable && (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>⚠️ Bluetooth Not Available</Text>
              <Text style={styles.warningText}>
                Status: {bluetoothStatus}
              </Text>
              <Text style={styles.warningText}>
                The development build may not include the react-native-ble-plx module properly. 
                You can test the app functionality using simulated data.
              </Text>
            </View>
          )}
          
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, { backgroundColor: isConnected ? COLORS.success : COLORS.error }]} />
            <Text style={styles.statusText}>
              {isConnected ? `Connected to ${deviceName}` : 'Not Connected'}
            </Text>
          </View>
            {!isConnected ? (
            <TouchableOpacity 
              style={[styles.button, styles.connectButton, (!bluetoothAvailable || isConnecting) && styles.disabledButton]}
              onPress={connectToDevice}
              disabled={isConnecting || !bluetoothAvailable}
            >
              <View style={styles.buttonContent}>
                {isConnecting && (
                  <ActivityIndicator color={COLORS.white} size="small" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.buttonText}>
                  {isConnecting ? 'Connecting...' : bluetoothAvailable ? 'Connect Device' : 'Bluetooth Unavailable'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[
                  styles.button, 
                  styles.disconnectButton,
                  isDisconnecting && styles.disabledButton
                ]}
                onPress={disconnectDevice}
                disabled={isDisconnecting}
              >
                <Text style={styles.buttonText}>
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.button, 
                  isRecording ? styles.stopButton : styles.recordButton,
                  isTogglingRecording && styles.disabledButton
                ]}
                onPress={toggleRecording}
                disabled={isTogglingRecording}
              >
                <Text style={styles.buttonText}>
                  {isTogglingRecording 
                    ? (isRecording ? 'Stopping...' : 'Starting...')
                    : (isRecording ? 'Stop Recording' : 'Start Recording')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Device List Modal */}
        <DeviceListModal
          visible={showDeviceList}
          onClose={() => setShowDeviceList(false)}
          onDeviceSelected={handleDeviceSelected}
        />

        {/* Connection Error Display */}
        {connectionError && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>⚠️ Connection Issue</Text>
            <Text style={styles.errorText}>{connectionError}</Text>
          </View>
        )}

        {/* TGAM Data Quality */}
        {isConnected && (
          <View style={styles.statusCard}>
            <Text style={styles.cardTitle}>Data Quality</Text>
            <View style={styles.dataQualityContainer}>
              <View style={styles.qualityMetric}>
                <Text style={styles.qualityLabel}>Signal Strength:</Text>
                <Text style={[styles.qualityValue, 
                  dataQuality.signalStrength > 80 ? styles.goodQuality :
                  dataQuality.signalStrength > 50 ? styles.fairQuality : styles.poorQuality
                ]}>
                  {dataQuality.signalStrength}%
                </Text>
              </View>
              <View style={styles.qualityMetric}>
                <Text style={styles.qualityLabel}>Frames/sec:</Text>
                <Text style={styles.qualityValue}>{dataQuality.framesPerSecond}</Text>
              </View>
              <View style={styles.qualityMetric}>
                <Text style={styles.qualityLabel}>Total Frames:</Text>
                <Text style={styles.qualityValue}>{dataQuality.totalFrames}</Text>
              </View>
              <View style={styles.qualityMetric}>
                <Text style={styles.qualityLabel}>Poor Signal:</Text>
                <Text style={styles.qualityValue}>{eegData.poorSignal}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Real-time EEG Metrics */}
        {isConnected && (
          <View style={styles.statusCard}>
            <Text style={styles.cardTitle}>Live EEG Data</Text>
            <View style={styles.eegMetricsContainer}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Attention:</Text>
                <Text style={styles.metricValue}>{eegData.attention}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Meditation:</Text>
                <Text style={styles.metricValue}>{eegData.meditation}</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Raw EEG:</Text>
                <Text style={styles.metricValue}>{eegData.rawEEG.toFixed(2)} µV</Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Last Update:</Text>
                <Text style={styles.metricValue}>
                  {eegData.timestamp ? new Date(eegData.timestamp).toLocaleTimeString() : 'No data'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Band Powers */}
        {isConnected && (
          <BandPowerDisplay bandPowers={bandPowers} />
        )}

        {/* Instructions */}
        {!isConnected && (
          <View style={styles.instructionsCard}>
            <Text style={styles.cardTitle}>Getting Started</Text>
            <Text style={styles.instructionText}>
              1. Turn on your BrainLink device{'\n'}
              2. Make sure Bluetooth is enabled{'\n'}
              3. Tap "Connect Device" to scan for devices{'\n'}
              4. Select your BrainLink device from the list{'\n'}
              5. Place the device on your forehead{'\n'}
              6. Start recording to begin monitoring
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.8,
  },
  logoutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  logoutText: {
    color: COLORS.white,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },  chartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  instructionsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: COLORS.text,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  connectButton: {
    backgroundColor: COLORS.primary,
  },
  disconnectButton: {
    backgroundColor: COLORS.error,
  },
  disabledButton: {
    backgroundColor: COLORS.lightGray,
    opacity: 0.6,
  },
  recordButton: {
    backgroundColor: COLORS.success,
  },
  stopButton: {
    backgroundColor: COLORS.warning,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '500',
    fontSize: 16,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    padding: 12,
    marginBottom: 15,
    borderRadius: 4,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  disabledButton: {
    backgroundColor: COLORS.disabled,
    opacity: 0.6,
  },
  errorCard: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    padding: 15,
    marginBottom: 15,
    borderRadius: 4,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#721c24',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#721c24',
    lineHeight: 20,
  },
  dataQualityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  qualityMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  qualityLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  qualityValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  goodQuality: {
    color: '#28a745',
  },
  fairQuality: {
    color: '#ffc107',
  },
  poorQuality: {
    color: '#dc3545',
  },
  eegMetricsContainer: {
    marginTop: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});

export default DashboardScreen;
