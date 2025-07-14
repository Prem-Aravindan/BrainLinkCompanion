import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useBrainLinkRealData } from '../hooks/useBrainLinkRealData';
import { COLORS } from '../constants';

const RealDataTestScreen = ({ user = {}, onLogout }) => {
  const {
    // Connection state
    isConnected,
    isConnecting,
    deviceName,
    connectionError,
    
    // EEG data
    attention,
    meditation,
    delta,
    theta,
    alpha,
    beta,
    gamma,
    rawEEG,
    heartRate,
    poorSignal,
    
    // Data quality
    signalStrength,
    framesPerSecond,
    lastUpdateTime,
    
    // Control methods
    connect,
    disconnect,
    scanForDevices,
    getParserStats,
  } = useBrainLinkRealData();

  const formatValue = (value, decimals = 0) => {
    if (typeof value !== 'number' || !isFinite(value)) return '0';
    return value.toFixed(decimals);
  };

  const getSignalQuality = () => {
    if (poorSignal > 80) return { text: 'Very Poor', color: COLORS.error };
    if (poorSignal > 50) return { text: 'Poor', color: COLORS.warning };
    if (poorSignal > 20) return { text: 'Good', color: COLORS.primary };
    return { text: 'Excellent', color: COLORS.success };
  };

  const signalQuality = getSignalQuality();
  const parserStats = getParserStats();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BrainLink Real Data Test</Text>
          <Text style={styles.headerSubtitle}>TGAM Protocol Implementation</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Connection Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connection Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusIndicator, { backgroundColor: isConnected ? COLORS.success : COLORS.error }]} />
            <Text style={styles.statusText}>
              {isConnected ? `Connected to ${deviceName || 'Unknown'}` : 
               isConnecting ? 'Connecting...' : 'Disconnected'}
            </Text>
          </View>
          
          {connectionError && (
            <Text style={styles.errorText}>Error: {connectionError}</Text>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.button, isConnecting && styles.buttonDisabled]} 
              onPress={() => connect()}
              disabled={isConnecting || isConnected}
            >
              <Text style={styles.buttonText}>
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton, !isConnected && styles.buttonDisabled]} 
              onPress={() => disconnect()}
              disabled={!isConnected}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Signal Quality */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signal Quality</Text>
          <View style={styles.qualityRow}>
            <View style={[styles.qualityIndicator, { backgroundColor: signalQuality.color }]} />
            <Text style={[styles.qualityText, { color: signalQuality.color }]}>
              {signalQuality.text} ({100 - poorSignal}%)
            </Text>
          </View>
          <Text style={styles.infoText}>
            Poor Signal: {poorSignal}% | FPS: {framesPerSecond} | Strength: {signalStrength}%
          </Text>
        </View>

        {/* Mental States */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mental States</Text>
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Attention</Text>
              <Text style={styles.dataValue}>{formatValue(attention)}%</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Meditation</Text>
              <Text style={styles.dataValue}>{formatValue(meditation)}%</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Heart Rate</Text>
              <Text style={styles.dataValue}>{formatValue(heartRate)} BPM</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Raw EEG</Text>
              <Text style={styles.dataValue}>{formatValue(rawEEG)} µV</Text>
            </View>
          </View>
        </View>

        {/* EEG Power Bands */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>EEG Power Bands</Text>
          <View style={styles.bandList}>
            <View style={styles.bandItem}>
              <Text style={styles.bandLabel}>Delta (0.5-4 Hz)</Text>
              <Text style={styles.bandValue}>{formatValue(delta, 2)}</Text>
            </View>
            <View style={styles.bandItem}>
              <Text style={styles.bandLabel}>Theta (4-8 Hz)</Text>
              <Text style={styles.bandValue}>{formatValue(theta, 2)}</Text>
            </View>
            <View style={styles.bandItem}>
              <Text style={styles.bandLabel}>Alpha (8-12 Hz)</Text>
              <Text style={styles.bandValue}>{formatValue(alpha, 2)}</Text>
            </View>
            <View style={styles.bandItem}>
              <Text style={styles.bandLabel}>Beta (12-30 Hz)</Text>
              <Text style={styles.bandValue}>{formatValue(beta, 2)}</Text>
            </View>
            <View style={styles.bandItem}>
              <Text style={styles.bandLabel}>Gamma (30-100 Hz)</Text>
              <Text style={styles.bandValue}>{formatValue(gamma, 2)}</Text>
            </View>
          </View>
        </View>

        {/* Parser Statistics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>TGAM Parser Statistics</Text>
          <Text style={styles.infoText}>
            Valid Frames: {parserStats.validFrames}
          </Text>
          <Text style={styles.infoText}>
            Invalid Frames: {parserStats.invalidFrames}
          </Text>
          <Text style={styles.infoText}>
            Checksum Errors: {parserStats.checksumErrors}
          </Text>
          <Text style={styles.infoText}>
            Total Bytes: {parserStats.totalBytes}
          </Text>
          {lastUpdateTime && (
            <Text style={styles.infoText}>
              Last Update: {new Date(lastUpdateTime).toLocaleTimeString()}
            </Text>
          )}
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.primary,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    color: COLORS.text,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.48,
  },
  disconnectButton: {
    backgroundColor: COLORS.error,
  },
  buttonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '600',
    textAlign: 'center',
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  qualityIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  qualityText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.7,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataItem: {
    width: '48%',
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.7,
  },
  dataValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  bandList: {
    marginTop: 8,
  },
  bandItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  bandLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  bandValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default RealDataTestScreen;
