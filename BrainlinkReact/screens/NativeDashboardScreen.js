import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useBrainLinkNative } from '../hooks/useBrainLinkNative';
import { BandPowerDisplay } from '../components/BandPowerDisplay';
import { EEGChart } from '../components/EEGChart';

/**
 * Native Dashboard Screen
 * 
 * This screen demonstrates the complete integration with the MacrotellectLink SDK
 * through our native module bridge. It provides:
 * - Device scanning and connection
 * - Real-time EEG data visualization
 * - Connection status monitoring
 * - Error handling and user feedback
 */
export const NativeDashboardScreen = ({ user, onLogout }) => {
  const {
    // Connection state
    isConnected,
    isConnecting,
    isScanning,
    connectionError,
    
    // Device state
    availableDevices,
    connectedDevice,
    
    // EEG data
    eegData,
    dataQuality,
    isReceivingData,
    
    // Actions
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    
    // Utility
    isSDKAvailable
  } = useBrainLinkNative();

  const handleScanPress = async () => {
    if (isScanning) {
      await stopScan();
    } else {
      await startScan();
    }
  };

  const handleConnectPress = async () => {
    if (isConnected) {
      await disconnect();
    } else if (availableDevices.length > 0) {
      // For demo purposes, connect to the first available device
      // In a real app, you'd show a device selection UI
      await connectToDevice(availableDevices[0].mac);
    } else {
      Alert.alert('No Devices', 'Please scan for devices first');
    }
  };

  const getConnectionStatusColor = () => {
    if (isConnected && isReceivingData) return '#4CAF50'; // Green
    if (isConnected) return '#FF9800'; // Orange
    if (isConnecting) return '#2196F3'; // Blue
    return '#F44336'; // Red
  };

  const getConnectionStatusText = () => {
    if (isConnected && isReceivingData) return 'Connected & Receiving Data';
    if (isConnected) return 'Connected (No Data)';
    if (isConnecting) return 'Connecting...';
    return 'Disconnected';
  };

  const getDataQualityText = () => {
    if (dataQuality === 0) return 'Excellent';
    if (dataQuality < 50) return 'Good';
    if (dataQuality < 100) return 'Fair';
    return 'Poor';
  };

  // Check if native SDK is available
  if (!isSDKAvailable) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Native SDK Not Available</Text>
          <Text style={styles.errorText}>
            The BrainLink Native SDK is only available on Android devices.
            {'\n\n'}
            To use this feature:
            {'\n'}• Build the app with Expo Dev Client
            {'\n'}• Install the MacrotellectLink SDK JAR
            {'\n'}• Run on an Android device
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>BrainLink Native Dashboard</Text>
            <Text style={styles.subtitle}>MacrotellectLink SDK Integration</Text>
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

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: getConnectionStatusColor() }]}>
          <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
        </View>
        
        {connectedDevice && (
          <Text style={styles.deviceInfo}>
            Device: {connectedDevice.name} ({connectedDevice.mac})
          </Text>
        )}
        
        {connectionError && (
          <Text style={styles.errorText}>{connectionError}</Text>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Control</Text>
        
        <TouchableOpacity
          style={[styles.button, isScanning && styles.buttonActive]}
          onPress={handleScanPress}
          disabled={isConnecting}
        >
          {isScanning && <ActivityIndicator size="small" color="white" style={styles.buttonIcon} />}
          <Text style={styles.buttonText}>
            {isScanning ? 'Stop Scan' : 'Scan for Devices'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, isConnected && styles.buttonConnected]}
          onPress={handleConnectPress}
          disabled={isConnecting || isScanning}
        >
          {isConnecting && <ActivityIndicator size="small" color="white" style={styles.buttonIcon} />}
          <Text style={styles.buttonText}>
            {isConnected ? 'Disconnect' : isConnecting ? 'Connecting...' : 'Connect'}
          </Text>
        </TouchableOpacity>

        {availableDevices.length > 0 && (
          <Text style={styles.deviceCount}>
            Found {availableDevices.length} device(s)
          </Text>
        )}
      </View>

      {/* Data Quality */}
      {isConnected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signal Quality</Text>
          <View style={styles.qualityContainer}>
            <Text style={styles.qualityLabel}>Quality: {getDataQualityText()}</Text>
            <Text style={styles.qualityValue}>Signal Strength: {200 - dataQuality}/200</Text>
          </View>
        </View>
      )}

      {/* Real-time EEG Data */}
      {isReceivingData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-time EEG Data</Text>
          
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Attention</Text>
              <Text style={styles.dataValue}>{eegData.attention}</Text>
            </View>
            
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Meditation</Text>
              <Text style={styles.dataValue}>{eegData.meditation}</Text>
            </View>
            
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Raw EEG</Text>
              <Text style={styles.dataValue}>{eegData.rawEEG}</Text>
            </View>
            
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Heart Rate</Text>
              <Text style={styles.dataValue}>{eegData.heartRate} BPM</Text>
            </View>
          </View>

          <Text style={styles.timestamp}>
            Last Update: {new Date(eegData.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      )}

      {/* Band Powers */}
      {isReceivingData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EEG Band Powers</Text>
          <BandPowerDisplay bandPowers={eegData.bandPowers} />
        </View>
      )}

      {/* EEG Chart */}
      {isReceivingData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-time Chart</Text>
          <EEGChart 
            rawData={eegData.rawEEG}
            attention={eegData.attention}
            meditation={eegData.meditation}
          />
        </View>
      )}

      {/* Debug Info */}
      {__DEV__ && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Info</Text>
          <Text style={styles.debugText}>
            SDK Available: {isSDKAvailable ? 'Yes' : 'No'}{'\n'}
            Is Connected: {isConnected ? 'Yes' : 'No'}{'\n'}
            Is Receiving Data: {isReceivingData ? 'Yes' : 'No'}{'\n'}
            Available Devices: {availableDevices.length}{'\n'}
            Data Quality: {dataQuality}{'\n'}
            Last Timestamp: {eegData.timestamp}
          </Text>
        </View>
      )}
    </ScrollView>
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
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
    marginBottom: 10,
    color: '#333',
  },
  statusBadge: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deviceInfo: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: '#FF9800',
  },
  buttonConnected: {
    backgroundColor: '#4CAF50',
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deviceCount: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
  },
  qualityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qualityLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  qualityValue: {
    fontSize: 14,
    color: '#666',
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataItem: {
    width: '48%',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  dataValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 15,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
    lineHeight: 20,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});
