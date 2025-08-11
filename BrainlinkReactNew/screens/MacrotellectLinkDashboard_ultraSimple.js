/**
 * Ultra-Simple EEG Dashboard - Raw Signal Only
 * No complex processing, just basic data display
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { useMacrotellectLink } from '../hooks/useMacrotellectLink';
import SimpleEEGDisplay from '../components/SimpleEEGDisplay';

export const MacrotellectLinkDashboard = ({ user, onLogout }) => {
  // Basic state
  const [realTimeEegData, setRealTimeEegData] = useState([]);
  const [dataRate, setDataRate] = useState(0);

  // Use hook
  const {
    devices,
    isScanning,
    isConnected,
    connectedDevice,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    clearDevices,
  } = useMacrotellectLink();

  // Simple EEG data handler
  const handleEEGData = (data) => {
    if (data && data.rawValue !== undefined) {
      setRealTimeEegData(prev => {
        const newData = [...prev, data.rawValue];
        return newData.length > 512 ? newData.slice(-512) : newData;
      });
    }
  };

  // Setup data listener
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
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>EEG Dashboard</Text>
        <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        <Text style={styles.statusText}>
          Device: {connectedDevice?.name || 'None'}
        </Text>
        <Text style={styles.statusText}>
          Data points: {realTimeEegData.length}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          onPress={isScanning ? stopScan : startScan}
          style={[styles.button, { backgroundColor: isScanning ? '#f44336' : '#4CAF50' }]}
        >
          <Text style={styles.buttonText}>
            {isScanning ? 'Stop Scan' : 'Start Scan'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={clearDevices}
          style={[styles.button, styles.clearButton]}
        >
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {devices.length > 0 && (
        <View style={styles.deviceList}>
          <Text style={styles.sectionTitle}>Available Devices:</Text>
          {devices.map((device, index) => (
            <TouchableOpacity
              key={`${device.id}-${index}`}
              onPress={() => connectToDevice(device)}
              style={styles.deviceItem}
            >
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceId}>{device.id}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isConnected && (
        <View style={styles.eegContainer}>
          <SimpleEEGDisplay 
            data={realTimeEegData}
            isConnected={isConnected}
            deviceInfo={connectedDevice}
          />
          
          <TouchableOpacity 
            onPress={disconnectDevice}
            style={[styles.button, styles.disconnectButton]}
          >
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutButton: {
    backgroundColor: '#666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 4,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  clearButton: {
    backgroundColor: '#9E9E9E',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
    marginTop: 16,
  },
  deviceList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  deviceItem: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  deviceId: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  eegContainer: {
    flex: 1,
  },
});

export default MacrotellectLinkDashboard;
