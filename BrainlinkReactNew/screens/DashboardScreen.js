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
  DeviceEventEmitter,
  Image,
} from 'react-native';
import { Dimensions } from 'react-native';
import { COLORS, EEG_CONFIG } from '../constants';
import MacrotellectLinkService from '../services/MacrotellectLinkService';
import BluetoothService from '../services/BluetoothService';
import EEGProcessor from '../utils/EEGProcessor';
import EEGChart from '../components/EEGChart';
import { BandPowerDisplay } from '../components/BandPowerDisplay';
import DeviceListModal from '../components/DeviceListModal';
import AppLogo from '../components/AppLogo';

const screenWidth = Dimensions.get('window').width;

const DashboardScreen = ({ user = {}, onLogout }) => {
  const username = user.username || 'Unknown User';

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState(null);
  const [eegData, setEegData] = useState([]);
  const [bandPowers, setBandPowers] = useState({
    delta: 0,
    theta: 0,
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [brainLinkConnected, setBrainLinkConnected] = useState(false);
  const [brainLinkTesting, setBrainLinkTesting] = useState(false);
  const [lastBrainLinkData, setLastBrainLinkData] = useState(null);
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

  useEffect(() => {
    console.log('🎯 Setting up direct React Native event listeners...');
    
    // Set up direct event listeners for BrainLinkModule events
    const dataListener = DeviceEventEmitter.addListener('BrainLinkData', (data) => {
      console.log('📊 DashboardScreen received BrainLinkData:', data);
      handleEEGData(data);
    });

    const connectionListener = DeviceEventEmitter.addListener('BrainLinkConnection', (connectionData) => {
      console.log('🔗 DashboardScreen connection status changed:', connectionData);
      console.log('🔗 Connection status:', connectionData.status);
      console.log('🔗 Device name:', connectionData.deviceName);
      console.log('🔗 Device MAC:', connectionData.deviceMac);
      
      if (connectionData.status === 'connected') {
        setIsConnected(true);
        setIsConnecting(false);
        setDeviceName(connectionData.deviceName || 'BrainLink Device');
        console.log('✅ DashboardScreen device connected:', connectionData.deviceName);
      } else if (connectionData.status === 'disconnected' || connectionData.status === 'failed') {
        setIsConnected(false);
        setIsConnecting(false);
        setDeviceName(null);
        setEegData([]);
        console.log('❌ DashboardScreen device disconnected or failed');
      } else if (connectionData.status === 'connecting') {
        setIsConnecting(true);
        console.log('🔄 DashboardScreen device connecting...');
      }
    });

    // Initialize the BrainLink service
    console.log('🚀 Initializing BrainLink service...');
    BluetoothService.initialize();
    
    return () => {
      console.log('🧹 Cleaning up event listeners...');
      dataListener.remove();
      connectionListener.remove();
    };
  }, []);

  // Note: MacrotellectLink SDK handles device authorization automatically via Bluetooth
  // No need to refresh authorized devices list - SDK validates during scan/connect

  const handleEEGData = (rawData) => {
    try {
      console.log('📊 Processing EEG data:', rawData);
      
      // Update detailed EEG data if it's brainwave data
      if (rawData.type === 'brainwave') {
        console.log('🧠 Processing brainwave data...');
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
        setBandPowers({
          delta: rawData.delta || 0,
          theta: rawData.theta || 0,
          alpha: (rawData.lowAlpha || 0) + (rawData.highAlpha || 0),
          beta: (rawData.lowBeta || 0) + (rawData.highBeta || 0),
          gamma: (rawData.lowGamma || 0) + (rawData.middleGamma || 0),
        });
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
      if (rawData.type === 'raw') {
        console.log('🔢 Processing raw EEG data point:', rawData.rawValue);
        
        // Update raw data display
        setDetailedEEGData(prev => ({
          ...prev,
          rawValue: rawData.rawValue || 0,
          lastUpdateTime: new Date().toLocaleTimeString(),
        }));
        
        // Add raw data to chart
        if (rawData.rawValue !== undefined) {
          setEegData(prevData => {
            const newData = [...prevData, rawData.rawValue];
            return newData.slice(-256); // Keep last 256 samples for 1 second window
          });
        }
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
      
    } catch (error) {
      console.error('Error processing EEG data:', error);
    }
  };
  const connectToDevice = async () => {
    setShowDeviceList(true);
  };

  const handleDeviceSelected = (device) => {
    setIsConnected(true);
    setDeviceName(device.name);
    
    // Log device details for debugging
    console.log('📱 Device selected:', device.name);
    console.log('📱 MacrotellectLink SDK will handle device authorization automatically');
    
    const deviceMessage = device.hwid ? 
      `Connected to ${device.name}\nHWID: ${device.hwid}` : 
      `Connected to ${device.name}`;
    
    Alert.alert('Success', deviceMessage);
  };

  const disconnectDevice = async () => {
    try {
      await MacrotellectLinkService.disconnect();
      setIsConnected(false);
      setDeviceName(null);
      setEegData([]);
      setIsRecording(false);
      Alert.alert('Disconnected', 'Device disconnected successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // Here you would implement actual recording functionality
    Alert.alert(
      isRecording ? 'Recording Stopped' : 'Recording Started',
      isRecording ? 'EEG recording has been stopped' : 'EEG recording has been started'
    );
  };
  const getChartData = () => {
    if (eegData.length < 50) {
      return {
        labels: Array.from({ length: 50 }, (_, i) => ''),
        datasets: [{
          data: Array.from({ length: 50 }, () => 0),
        }],
      };
    }

    const lastSamples = eegData.slice(-50); // Show last 50 samples
    return {
      labels: Array.from({ length: 50 }, (_, i) => ''),
      datasets: [{
        data: lastSamples,
        color: (opacity = 1) => COLORS.primary,
        strokeWidth: 2,
      }],
    };
  };

  // BrainLink module testing functions
  const testBrainLinkScan = async () => {
    setBrainLinkTesting(true);
    try {
      console.log('🔍 Starting BrainLink scan...');
      const result = await BluetoothService.startBrainLinkScan();
      
      if (result) {
        Alert.alert('Success', 'BrainLink scan started! Check console for device discoveries.');
        
        // Stop scan after 10 seconds
        setTimeout(async () => {
          await BluetoothService.stopBrainLinkScan();
          console.log('🛑 BrainLink scan stopped');
          setBrainLinkTesting(false);
        }, 10000);
      } else {
        Alert.alert('Error', 'Failed to start BrainLink scan');
        setBrainLinkTesting(false);
      }
    } catch (error) {
      console.error('BrainLink scan error:', error);
      Alert.alert('Error', `BrainLink scan failed: ${error.message}`);
      setBrainLinkTesting(false);
    }
  };

  const testBrainLinkConnect = async () => {
    try {
      // Example device ID - replace with actual device ID from scan results
      const deviceId = 'test-device-id';
      console.log('🔗 Connecting to BrainLink device...');
      
      const result = await BluetoothService.connectToBrainLinkDevice(deviceId);
      
      if (result) {
        setBrainLinkConnected(true);
        Alert.alert('Success', 'Connected to BrainLink device! Starting EEG data collection...');
        
        // Start EEG data collection
        await BluetoothService.startBrainLinkEEGData();
      } else {
        Alert.alert('Error', 'Failed to connect to BrainLink device');
      }
    } catch (error) {
      console.error('BrainLink connection error:', error);
      Alert.alert('Error', `BrainLink connection failed: ${error.message}`);
    }
  };

  const testBrainLinkDisconnect = async () => {
    try {
      console.log('❌ Disconnecting from BrainLink device...');
      
      await BluetoothService.stopBrainLinkEEGData();
      const result = await BluetoothService.disconnectBrainLinkDevice();
      
      if (result) {
        setBrainLinkConnected(false);
        setLastBrainLinkData(null);
        Alert.alert('Success', 'Disconnected from BrainLink device');
      } else {
        Alert.alert('Error', 'Failed to disconnect from BrainLink device');
      }
    } catch (error) {
      console.error('BrainLink disconnection error:', error);
      Alert.alert('Error', `BrainLink disconnection failed: ${error.message}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppLogo 
            size="small" 
            showText={false} 
            logoStyle={styles.headerLogo}
          />
          <View>
            <Text style={styles.headerTitle}>BrainLink Dashboard</Text>
            <Text style={styles.headerSubtitle}>Welcome, {username}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Device Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, { backgroundColor: isConnected ? COLORS.success : COLORS.error }]} />
            <Text style={styles.statusText}>
              {isConnected ? `Connected to ${deviceName}` : 'Not Connected'}
            </Text>
          </View>
            {!isConnected ? (
            <TouchableOpacity 
              style={[styles.button, styles.connectButton]}
              onPress={connectToDevice}
              disabled={isConnecting}
            >
              <Text style={styles.buttonText}>Connect Device</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={[styles.button, styles.disconnectButton]}
                onPress={disconnectDevice}
              >
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, isRecording ? styles.stopButton : styles.recordButton]}
                onPress={toggleRecording}
              >
                <Text style={styles.buttonText}>
                  {isRecording ? 'Stop Recording' : 'Start Recording'}
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

        {/* MacrotellectLink SDK Status */}
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>MacrotellectLink SDK</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, { backgroundColor: COLORS.success }]} />
            <Text style={styles.statusText}>SDK handles device authorization automatically via Bluetooth</Text>
          </View>
          <Text style={styles.instructionText}>
            The MacrotellectLink SDK will automatically detect and connect to authorized BrainLink devices during scan.
          </Text>
        </View>{/* EEG Chart */}
        {isConnected && (
          <EEGChart 
            data={eegData}
            title="Real-time EEG Signal"
            height={200}
          />
        )}

        {/* Band Powers */}
        {isConnected && (
          <BandPowerDisplay bandPowers={bandPowers} />
        )}

        {/* Detailed EEG Data */}
        {isConnected && (
          <View style={styles.detailedDataCard}>
            <Text style={styles.cardTitle}>Detailed EEG Metrics</Text>
            
            {/* Signal Quality & Basic Metrics */}
            <View style={styles.dataSection}>
              <Text style={styles.sectionTitle}>Signal Quality & Basic Metrics</Text>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Signal Quality:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.signal}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Attention:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.attention}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Meditation:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.meditation}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Raw Value:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.rawValue}</Text>
              </View>
              {detailedEEGData.lastUpdateTime && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Last Update:</Text>
                  <Text style={styles.dataValue}>{detailedEEGData.lastUpdateTime}</Text>
                </View>
              )}
            </View>

            {/* Band Powers */}
            <View style={styles.dataSection}>
              <Text style={styles.sectionTitle}>Band Power Frequencies</Text>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Delta:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.delta}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Theta:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.theta}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Low Alpha:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.lowAlpha}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>High Alpha:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.highAlpha}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Low Beta:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.lowBeta}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>High Beta:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.highBeta}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Low Gamma:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.lowGamma}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Middle Gamma:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.middleGamma}</Text>
              </View>
            </View>

            {/* Additional Metrics */}
            <View style={styles.dataSection}>
              <Text style={styles.sectionTitle}>Additional Metrics</Text>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>AP:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.ap}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Grind:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.grind}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Heart Rate:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.heartRate} BPM</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Temperature:</Text>
                <Text style={styles.dataValue}>{detailedEEGData.temperature.toFixed(1)}°C</Text>
              </View>
            </View>

            {/* Device Info */}
            <View style={styles.dataSection}>
              <Text style={styles.sectionTitle}>Device Information</Text>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Battery Level:</Text>
                <Text style={[styles.dataValue, { color: detailedEEGData.batteryLevel > 20 ? COLORS.success : COLORS.error }]}>
                  {detailedEEGData.batteryLevel}%
                </Text>
              </View>
              {detailedEEGData.hardwareVersion && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Hardware Version:</Text>
                  <Text style={styles.dataValue}>{detailedEEGData.hardwareVersion}</Text>
                </View>
              )}
            </View>
          </View>
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
    backgroundColor: '#0a0a0f', // Modern dark background
  },
  header: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    paddingHorizontal: 24,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  logoutText: {
    color: '#ff5252',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 20,
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
  // Modern Chart Card
  chartCard: {
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
  // Modern Instructions Card
  instructionsCard: {
    backgroundColor: 'rgba(33, 150, 243, 0.08)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  // Modern Detailed Data Card
  detailedDataCard: {
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
  dataSection: {
    marginVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dataLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    flex: 1,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'right',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 12,
    borderRadius: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  // Modern Button Styling
  button: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  connectButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  disconnectButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  recordButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  stopButton: {
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  instructionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 22,
    fontWeight: '400',
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 10,
  },
  deviceHwid: {
    fontSize: 14,
    color: COLORS.text,
    fontFamily: 'monospace',
  },
});

export default DashboardScreen;
