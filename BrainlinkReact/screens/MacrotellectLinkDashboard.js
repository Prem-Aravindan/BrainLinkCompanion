/**
 * MacrotellectLink Dashboard Screen
 * 
 * This screen uses the official MacrotellectLink SDK to:
 * - Exit demo mode and receive real EEG data
 * - Display comprehensive brainwave metrics
 * - Show device connection status
 * - Provide user-friendly controls
 */

import React from 'react';
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

export const MacrotellectLinkDashboard = ({ user, onLogout }) => {
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

  return (
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
              {eegData.appreciation > 0 && (
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
                delta: eegData.delta,
                theta: eegData.theta,
                alpha: eegData.alpha,
                beta: eegData.beta,
                gamma: eegData.gamma
              }}
            />
          </View>

          {/* Advanced Theta Metrics - matches Python BrainCompanion output */}
          {(eegData.thetaContribution > 0 || eegData.thetaRelative > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Advanced Theta Analysis</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Theta Contribution</Text>
                  <Text style={styles.metricValue}>{eegData.thetaContribution.toFixed(1)}%</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Theta Relative</Text>
                  <Text style={styles.metricValue}>{(eegData.thetaRelative * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Smoothed Theta</Text>
                  <Text style={styles.metricValue}>{eegData.smoothedTheta.toFixed(1)}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Device Metrics (BrainLink Pro) */}
          {(eegData.batteryCapacity > 0 || eegData.heartRate > 0 || eegData.temperature > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Device Metrics</Text>
              <View style={styles.metricsGrid}>
                {eegData.batteryCapacity > 0 && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Battery</Text>
                    <Text style={styles.metricValue}>{eegData.batteryCapacity}%</Text>
                  </View>
                )}
                {eegData.heartRate > 0 && (
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Heart Rate</Text>
                    <Text style={styles.metricValue}>{eegData.heartRate} BPM</Text>
                  </View>
                )}
                {eegData.temperature > 0 && (
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
});
