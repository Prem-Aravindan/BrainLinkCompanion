import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants';
import BluetoothService from '../services/BluetoothService';
import ApiService from '../services/ApiService';

const BluetoothDiagnosticsScreen = ({ navigation }) => {
  const [diagnostics, setDiagnostics] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics(null);

    try {
      const results = {
        timestamp: new Date().toISOString(),
        bluetooth: {},
        api: {},
        devices: [],
      };

      // 1. Check Bluetooth initialization
      const btInitialized = await BluetoothService.initialize();
      results.bluetooth.initialized = btInitialized;
      results.bluetooth.available = BluetoothService.isBluetoothAvailable();

      // 2. Check API authorization
      if (ApiService.token) {
        const userDevicesResult = await ApiService.getUserDevices();
        results.api.authorized = userDevicesResult.success;
        results.api.authorizedHWIDs = userDevicesResult.devices || [];
        results.api.error = userDevicesResult.error;
      } else {
        results.api.authorized = false;
        results.api.error = 'No user token';
      }

      // 3. Scan for devices
      if (btInitialized) {
        try {
          const devices = await BluetoothService.scanForDevices();
          results.devices = devices.map(device => ({
            name: device.name || 'Unknown',
            id: device.id,
            hwid: device.hwid,
            rssi: device.rssi,
            isConnectable: device.isConnectable,
          }));
        } catch (scanError) {
          results.bluetooth.scanError = scanError.message;
        }
      }

      // 4. Get internal state
      results.bluetooth.authorizedHWIDs = BluetoothService.authorizedHWIDs || [];
      results.bluetooth.isConnected = BluetoothService.isConnected;

      setDiagnostics(results);
    } catch (error) {
      Alert.alert('Diagnostics Error', error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const renderDiagnostics = () => {
    if (!diagnostics) return null;

    return (
      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.sectionTitle}>🔧 Bluetooth Diagnostics</Text>
        <Text style={styles.timestamp}>Run at: {new Date(diagnostics.timestamp).toLocaleString()}</Text>

        {/* Bluetooth Status */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>📡 Bluetooth Status</Text>
          <Text style={styles.item}>Initialized: {diagnostics.bluetooth.initialized ? '✅' : '❌'}</Text>
          <Text style={styles.item}>Available: {diagnostics.bluetooth.available ? '✅' : '❌'}</Text>
          <Text style={styles.item}>Connected: {diagnostics.bluetooth.isConnected ? '✅' : '❌'}</Text>
          {diagnostics.bluetooth.scanError && (
            <Text style={styles.error}>Scan Error: {diagnostics.bluetooth.scanError}</Text>
          )}
        </View>

        {/* API Authorization */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>🔐 API Authorization</Text>
          <Text style={styles.item}>Authorized: {diagnostics.api.authorized ? '✅' : '❌'}</Text>
          <Text style={styles.item}>Token: {ApiService.token ? '✅' : '❌'}</Text>
          {diagnostics.api.error && (
            <Text style={styles.error}>Error: {diagnostics.api.error}</Text>
          )}
          <Text style={styles.item}>
            Authorized HWIDs: [{diagnostics.api.authorizedHWIDs.join(', ')}]
          </Text>
        </View>

        {/* Found Devices */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>📱 Found Devices ({diagnostics.devices.length})</Text>
          {diagnostics.devices.length === 0 ? (
            <Text style={styles.item}>No devices found</Text>
          ) : (
            diagnostics.devices.map((device, index) => (
              <View key={index} style={styles.deviceItem}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceDetail}>ID: {device.id}</Text>
                <Text style={styles.deviceDetail}>HWID: {device.hwid || 'Unknown'}</Text>
                <Text style={styles.deviceDetail}>RSSI: {device.rssi || 'Unknown'}</Text>
                <Text style={styles.deviceDetail}>
                  Connectable: {device.isConnectable ? '✅' : '❌'}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={styles.subsectionTitle}>💡 Recommendations</Text>
          {!diagnostics.bluetooth.initialized && (
            <Text style={styles.recommendation}>• Enable Bluetooth on device</Text>
          )}
          {!diagnostics.api.authorized && (
            <Text style={styles.recommendation}>• Login to authorize devices</Text>
          )}
          {diagnostics.devices.length === 0 && diagnostics.bluetooth.initialized && (
            <Text style={styles.recommendation}>• Ensure BrainLink device is nearby and powered on</Text>
          )}
          {diagnostics.devices.length > 0 && diagnostics.api.authorizedHWIDs.length > 0 && (
            <Text style={styles.recommendation}>
              • Found devices but none match authorized HWIDs
              {'\n'}• Update backend with correct HWID: {diagnostics.devices[0]?.hwid}
              {'\n'}• Or verify device authorization
            </Text>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Bluetooth Diagnostics</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          onPress={runDiagnostics}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.runButtonText}>Run Diagnostics</Text>
          )}
        </TouchableOpacity>

        {renderDiagnostics()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  runButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  runButtonDisabled: {
    backgroundColor: COLORS.secondary,
  },
  runButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.secondary,
    marginBottom: 20,
  },
  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  item: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  error: {
    fontSize: 14,
    color: COLORS.error,
    marginBottom: 4,
  },
  recommendation: {
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 8,
    lineHeight: 20,
  },
  deviceItem: {
    backgroundColor: COLORS.lightGray,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  deviceDetail: {
    fontSize: 12,
    color: COLORS.secondary,
    marginBottom: 2,
  },
});

export default BluetoothDiagnosticsScreen;
