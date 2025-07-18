import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../constants';
import MacrotellectLinkService from '../services/MacrotellectLinkService';
import PermissionService from '../services/PermissionService';

const DeviceListModal = ({ visible, onClose, onDeviceSelected }) => {
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  useEffect(() => {
    if (visible) {
      scanForDevices();
    }
  }, [visible]);

  const scanForDevices = async () => {
    setIsScanning(true);
    try {
      // First, request Bluetooth permissions
      const hasPermissions = await PermissionService.requestBluetoothPermissions();
      if (!hasPermissions) {
        setIsScanning(false);
        Alert.alert(
          'Permissions Required',
          'Bluetooth and location permissions are required to scan for devices.'
        );
        return;
      }

      console.log('🔍 Starting BrainLink device scan...');
      
      // Start MacrotellectLink scan for BrainLink devices
      await MacrotellectLinkService.startScan();
      
      // Set up listener for found devices
      const unsubscribe = MacrotellectLinkService.onConnectionChange((status, device) => {
        if (status === 'found' && device) {
          setDevices(prevDevices => {
            // Check if device already exists
            const exists = prevDevices.find(d => d.address === device.address);
            if (!exists) {
              return [...prevDevices, {
                id: device.address,
                name: device.name,
                address: device.address,
                paired: false
              }];
            }
            return prevDevices;
          });
        }
      });
      
      // Stop scanning after a reasonable time
      setTimeout(async () => {
        try {
          await MacrotellectLinkService.stopScan();
          setIsScanning(false);
          unsubscribe && unsubscribe();
        } catch (error) {
          console.error('Error stopping scan:', error);
          setIsScanning(false);
        }
      }, 10000); // 10 seconds scan time
      
    } catch (error) {
      Alert.alert('Scan Error', error.message);
      setIsScanning(false);
    }
  };

  const handleDeviceSelect = async (device) => {
    setSelectedDevice(device);
    try {
      // MacrotellectLink SDK handles connection automatically
      // Just simulate successful connection for now
      console.log('🎯 Device selected for connection:', device.name);
      
      // Let the service handle the connection
      onDeviceSelected(device);
      onClose();
    } catch (error) {
      Alert.alert('Connection Error', error.message);
    } finally {
      setSelectedDevice(null);
    }
  };

  const renderDevice = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        selectedDevice?.id === item.id && styles.deviceItemConnecting
      ]}
      onPress={() => handleDeviceSelect(item)}
      disabled={selectedDevice !== null}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>{item.id}</Text>
        <Text style={styles.deviceStatus}>
          {item.paired ? 'Paired' : 'Available'}
        </Text>
      </View>
      <View style={styles.deviceIcon}>
        {selectedDevice?.id === item.id ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Icon name="bluetooth" size={24} color={COLORS.primary} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select BrainLink Device</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.scanContainer}>
          <TouchableOpacity
            style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
            onPress={scanForDevices}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Icon name="refresh" size={20} color={COLORS.white} />
            )}
            <Text style={styles.scanButtonText}>
              {isScanning ? 'Scanning...' : 'Refresh Scan'}
            </Text>
          </TouchableOpacity>
        </View>

        {devices.length === 0 && !isScanning ? (
          <View style={styles.emptyContainer}>
            <Icon name="bluetooth-outline" size={64} color={COLORS.lightGray} />
            <Text style={styles.emptyText}>No BrainLink devices found</Text>
            <Text style={styles.emptySubtext}>
              Make sure your device is turned on and in pairing mode
            </Text>
          </View>
        ) : (
          <FlatList
            data={devices}
            renderItem={renderDevice}
            keyExtractor={(item) => item.id}
            style={styles.deviceList}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}

        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>Instructions:</Text>
          <Text style={styles.instructionText}>
            • Turn on your BrainLink device{'\n'}
            • Make sure Bluetooth is enabled{'\n'}
            • Tap "Refresh Scan" to search for devices{'\n'}
            • Select your device from the list
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: 8,
  },
  scanContainer: {
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
  },
  scanButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  scanButtonText: {
    color: COLORS.white,
    fontWeight: '500',
    marginLeft: 8,
  },
  deviceList: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: COLORS.white,
  },
  deviceItemConnecting: {
    backgroundColor: COLORS.lightGray,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  deviceStatus: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
  deviceIcon: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  instructions: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
});

export default DeviceListModal;
