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
import EEGProcessor from '../utils/EEGProcessor';
import EEGChart from '../components/EEGChart';
import { BandPowerDisplay } from '../components/BandPowerDisplay';
import DeviceListModal from '../components/DeviceListModal';

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
  const [authorizedDevices, setAuthorizedDevices] = useState([]);

  useEffect(() => {
    // Initialize Bluetooth service
    BluetoothService.initialize();
    
    // Get authorized devices list
    const updateAuthorizedDevices = () => {
      const hwids = BluetoothService.getAuthorizedHWIDs();
      setAuthorizedDevices(hwids);
      console.log('📱 Authorized devices updated in UI:', hwids);
    };
    
    // Initial load
    updateAuthorizedDevices();
    
    // Set up data listener
    const unsubscribe = BluetoothService.onDataReceived((data) => {
      handleEEGData(data);
    });

    return () => {
      BluetoothService.disconnect();
      unsubscribe && unsubscribe();
    };
  }, []);

  // Update authorized devices when user changes (e.g., after login)
  useEffect(() => {
    if (user && user.token) {
      setTimeout(() => {
        const hwids = BluetoothService.getAuthorizedHWIDs();
        setAuthorizedDevices(hwids);
        console.log('📱 Authorized devices refreshed after user change:', hwids);
      }, 1000); // Small delay to ensure API call completes
    }
  }, [user]);

  const handleEEGData = (rawData) => {
    try {
      // Process the raw EEG data
      const processedData = EEGProcessor.processRawData(rawData);
      
      // Update EEG data array (keep last 256 samples for 1 second window)
      setEegData(prevData => {
        const newData = [...prevData, ...processedData];
        return newData.slice(-EEG_CONFIG.SAMPLING_RATE);
      });

      // Calculate band powers if we have enough data
      if (eegData.length >= EEG_CONFIG.WINDOW_SIZE) {
        const powers = EEGProcessor.calculateBandPowers(eegData.slice(-EEG_CONFIG.WINDOW_SIZE));
        setBandPowers(powers);
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
    console.log('📱 Device HWID:', device.hwid || 'Unknown');
    console.log('📱 Authorized HWIDs:', authorizedDevices);
    
    const deviceMessage = device.hwid ? 
      `Connected to ${device.name}\nHWID: ${device.hwid}` : 
      `Connected to ${device.name}`;
    
    Alert.alert('Success', deviceMessage);
  };

  const disconnectDevice = async () => {
    try {
      await BluetoothService.disconnect();
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

        {/* Authorized Devices Section */}
        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Device Authorization</Text>
          {authorizedDevices.length > 0 ? (
            <View>
              <Text style={styles.statusText}>
                Authorized BrainLink devices ({authorizedDevices.length}):
              </Text>
              {authorizedDevices.map((hwid, index) => (
                <View key={index} style={styles.deviceItem}>
                  <View style={[styles.statusIndicator, { backgroundColor: COLORS.success }]} />
                  <Text style={styles.deviceHwid}>HWID: {hwid}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View>
              <View style={styles.statusRow}>
                <View style={[styles.statusIndicator, { backgroundColor: COLORS.warning }]} />
                <Text style={styles.statusText}>No authorized devices found</Text>
              </View>
              <Text style={styles.instructionText}>
                Contact your administrator to authorize BrainLink devices for your account.
              </Text>
            </View>
          )}
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
  instructionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
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
