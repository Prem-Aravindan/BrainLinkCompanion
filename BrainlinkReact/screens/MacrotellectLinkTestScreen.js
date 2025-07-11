/**
 * MacrotellectLink Test Screen
 * Tests the official MacrotellectLink SDK integration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  SafeAreaView
} from 'react-native';
import { useMacrotellectLink } from '../hooks/useMacrotellectLink';

const MacrotellectLinkTestScreen = () => {
  const {
    // Connection state
    isInitialized,
    isScanning,
    isConnected,
    connectedDevice,
    connectionStatus,
    
    // Data
    eegData,
    rawData,
    gravityData,
    rrData,
    
    // Derived metrics
    bandPowers,
    signalQuality,
    mentalStates,
    
    // Actions
    initialize,
    startScan,
    stopScan,
    connect,
    disconnect,
    
    // Status
    isLoading,
    lastError,
    isAvailable,
    clearError
  } = useMacrotellectLink();

  const [showRawData, setShowRawData] = useState(false);
  const [showGravityData, setShowGravityData] = useState(false);
  const [dataUpdateCount, setDataUpdateCount] = useState(0);

  // Count data updates
  useEffect(() => {
    if (eegData.timestamp) {
      setDataUpdateCount(prev => prev + 1);
    }
  }, [eegData.timestamp]);

  const renderConnectionStatus = () => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'connected': return '#4CAF50';
        case 'connecting': return '#FF9800';
        case 'disconnected': return '#9E9E9E';
        case 'failed': return '#F44336';
        default: return '#9E9E9E';
      }
    };

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(connectionStatus) }]} />
          <Text style={styles.statusText}>{connectionStatus.toUpperCase()}</Text>
        </View>
        
        {connectedDevice && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceText}>Device: {connectedDevice.name}</Text>
            <Text style={styles.deviceText}>ID: {connectedDevice.id}</Text>
            <Text style={styles.deviceText}>Type: {connectedDevice.isBLE ? 'BLE (4.0)' : 'Classic (3.0)'}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderSignalQuality = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Signal Quality</Text>
      <View style={styles.signalContainer}>
        <View style={[styles.signalBar, { width: `${signalQuality.percentage}%`, backgroundColor: getSignalColor(signalQuality.level) }]} />
        <Text style={styles.signalText}>{signalQuality.percentage}% - {signalQuality.description}</Text>
      </View>
      <Text style={styles.signalValue}>Raw Signal: {eegData.signal}</Text>
    </View>
  );

  const getSignalColor = (level) => {
    switch (level) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FFC107';
      case 'poor': return '#FF9800';
      case 'very_poor': return '#FF5722';
      default: return '#F44336';
    }
  };

  const renderEEGData = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>EEG Data (Updates: {dataUpdateCount})</Text>
      
      {/* Mental States */}
      <View style={styles.mentalStates}>
        <View style={styles.mentalState}>
          <Text style={styles.mentalStateLabel}>Attention</Text>
          <Text style={styles.mentalStateValue}>{eegData.attention}</Text>
        </View>
        <View style={styles.mentalState}>
          <Text style={styles.mentalStateLabel}>Meditation</Text>
          <Text style={styles.mentalStateValue}>{eegData.meditation}</Text>
        </View>
      </View>

      {/* Band Powers */}
      <View style={styles.bandPowers}>
        <Text style={styles.bandTitle}>EEG Band Powers</Text>
        
        <View style={styles.bandRow}>
          <Text style={styles.bandLabel}>Delta:</Text>
          <Text style={styles.bandValue}>{eegData.delta}</Text>
          <Text style={styles.bandPercent}>({bandPowers.deltaPercent.toFixed(1)}%)</Text>
        </View>
        
        <View style={styles.bandRow}>
          <Text style={styles.bandLabel}>Theta:</Text>
          <Text style={styles.bandValue}>{eegData.theta}</Text>
          <Text style={styles.bandPercent}>({bandPowers.thetaPercent.toFixed(1)}%)</Text>
        </View>
        
        <View style={styles.bandRow}>
          <Text style={styles.bandLabel}>Alpha:</Text>
          <Text style={styles.bandValue}>{bandPowers.alpha}</Text>
          <Text style={styles.bandPercent}>({bandPowers.alphaPercent.toFixed(1)}%)</Text>
        </View>
        
        <View style={styles.bandRow}>
          <Text style={styles.bandLabel}>Beta:</Text>
          <Text style={styles.bandValue}>{bandPowers.beta}</Text>
          <Text style={styles.bandPercent}>({bandPowers.betaPercent.toFixed(1)}%)</Text>
        </View>
        
        <View style={styles.bandRow}>
          <Text style={styles.bandLabel}>Gamma:</Text>
          <Text style={styles.bandValue}>{bandPowers.gamma}</Text>
          <Text style={styles.bandPercent}>({bandPowers.gammaPercent.toFixed(1)}%)</Text>
        </View>
      </View>

      {/* Additional Data */}
      <View style={styles.additionalData}>
        <Text style={styles.additionalTitle}>Additional Metrics</Text>
        <Text style={styles.additionalText}>Battery: {eegData.batteryCapacity}%</Text>
        <Text style={styles.additionalText}>Heart Rate: {eegData.heartRate} BPM</Text>
        <Text style={styles.additionalText}>Temperature: {eegData.temperature}°C</Text>
        <Text style={styles.additionalText}>Appreciation: {eegData.appreciation}</Text>
      </View>
    </View>
  );

  const renderControls = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Controls</Text>
      
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[styles.button, !isAvailable && styles.buttonDisabled]}
          onPress={initialize}
          disabled={!isAvailable || isLoading}
        >
          <Text style={styles.buttonText}>
            {isInitialized ? 'Initialized ✓' : 'Initialize SDK'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[styles.button, styles.scanButton, (!isInitialized || isLoading) && styles.buttonDisabled]}
          onPress={isScanning ? stopScan : startScan}
          disabled={!isInitialized || isLoading}
        >
          <Text style={styles.buttonText}>
            {isScanning ? 'Stop Scan' : 'Start Scan & Connect'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[styles.button, styles.disconnectButton, (!isConnected || isLoading) && styles.buttonDisabled]}
          onPress={disconnect}
          disabled={!isConnected || isLoading}
        >
          <Text style={styles.buttonText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      {/* Data toggles */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show Raw Data</Text>
        <Switch value={showRawData} onValueChange={setShowRawData} />
      </View>
      
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show Gravity Data</Text>
        <Switch value={showGravityData} onValueChange={setShowGravityData} />
      </View>
    </View>
  );

  const renderRawData = () => {
    if (!showRawData) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Raw EEG Data</Text>
        <Text style={styles.rawDataText}>Current: {rawData}</Text>
      </View>
    );
  };

  const renderGravityData = () => {
    if (!showGravityData) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Gravity Data (BrainLink Pro)</Text>
        <Text style={styles.gravityText}>X (Pitch): {gravityData.x.toFixed(3)}</Text>
        <Text style={styles.gravityText}>Y (Yaw): {gravityData.y.toFixed(3)}</Text>
        <Text style={styles.gravityText}>Z (Roll): {gravityData.z.toFixed(3)}</Text>
      </View>
    );
  };

  const renderRRData = () => {
    if (rrData.rrIntervals.length === 0 && rrData.oxygenPercentage === 0) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Heart Rate & Blood Oxygen</Text>
        <Text style={styles.rrText}>RR Intervals: {rrData.rrIntervals.length}</Text>
        <Text style={styles.rrText}>Blood Oxygen: {rrData.oxygenPercentage}%</Text>
      </View>
    );
  };

  const renderStatus = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>System Status</Text>
      <Text style={styles.statusInfo}>Available: {isAvailable ? '✓' : '✗'}</Text>
      <Text style={styles.statusInfo}>Initialized: {isInitialized ? '✓' : '✗'}</Text>
      <Text style={styles.statusInfo}>Loading: {isLoading ? '✓' : '✗'}</Text>
      
      {lastError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {lastError}</Text>
          <TouchableOpacity onPress={clearError} style={styles.clearErrorButton}>
            <Text style={styles.clearErrorText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (!isAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unavailableContainer}>
          <Text style={styles.unavailableTitle}>MacrotellectLink SDK Not Available</Text>
          <Text style={styles.unavailableText}>
            This feature requires:
            {'\n'}• Android device
            {'\n'}• MacrotellectLink_V1.4.3.jar in android/app/libs/
            {'\n'}• Native module compilation
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>MacrotellectLink SDK Test</Text>
        
        {renderStatus()}
        {renderConnectionStatus()}
        {renderControls()}
        
        {isConnected && (
          <>
            {renderSignalQuality()}
            {renderEEGData()}
            {renderRawData()}
            {renderGravityData()}
            {renderRRData()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
  },
  deviceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  signalContainer: {
    marginBottom: 10,
  },
  signalBar: {
    height: 20,
    borderRadius: 10,
    marginBottom: 5,
  },
  signalText: {
    fontSize: 14,
    color: '#666',
  },
  signalValue: {
    fontSize: 12,
    color: '#999',
  },
  mentalStates: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  mentalState: {
    alignItems: 'center',
  },
  mentalStateLabel: {
    fontSize: 14,
    color: '#666',
  },
  mentalStateValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  bandPowers: {
    marginBottom: 15,
  },
  bandTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  bandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  bandLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  bandValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  bandPercent: {
    fontSize: 12,
    color: '#999',
    flex: 1,
    textAlign: 'right',
  },
  additionalData: {
    marginTop: 10,
  },
  additionalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  additionalText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  controlRow: {
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#FF5722',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333',
  },
  rawDataText: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#333',
  },
  gravityText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 5,
  },
  rrText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  statusInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  errorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 5,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#c62828',
  },
  clearErrorButton: {
    padding: 5,
  },
  clearErrorText: {
    color: '#1976d2',
    fontSize: 12,
  },
  unavailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unavailableTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  unavailableText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default MacrotellectLinkTestScreen;
