/**
 * Simple EEG Data Display - Raw Signal Only
 * Minimalist implementation for stable raw data visualization
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

const SimpleEEGDisplay = ({ data = [], isConnected = false, deviceInfo = null }) => {
  // Simple data rate calculation
  const dataRate = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return data.length; // Just show buffer length for now
  }, [data]);

  // Create SVG path for the EEG signal
  const svgPath = useMemo(() => {
    if (!data || data.length < 2) return '';
    
    const maxSamples = 512; // Show last 512 samples
    const displayData = data.slice(-maxSamples);
    const width = 350;
    const height = 200;
    
    if (displayData.length === 0) return '';
    
    // Normalize data to fit in the display area
    const min = Math.min(...displayData);
    const max = Math.max(...displayData);
    const range = max - min;
    
    if (range === 0) {
      // Flat line for constant data
      return `0,${height/2} ${width},${height/2}`;
    }
    
    const points = displayData.map((value, index) => {
      const x = (index / (displayData.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });
    
    return points.join(' ');
  }, [data]);

  // Connection status indicator
  const statusColor = isConnected ? '#4CAF50' : '#f44336';
  const statusText = isConnected ? 'Connected' : 'Disconnected';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Raw EEG Signal</Text>
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <Text style={styles.stat}>Buffer: {data.length} samples</Text>
        <Text style={styles.stat}>
          Device: {deviceInfo?.name || 'None'}
        </Text>
      </View>
      
      <View style={styles.chartContainer}>
        {svgPath ? (
          <Svg width={350} height={200} style={styles.svg}>
            <Polyline
              points={svgPath}
              fill="none"
              stroke="#2196F3"
              strokeWidth="1.5"
            />
          </Svg>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>
              {isConnected ? 'Waiting for EEG data...' : 'Device not connected'}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Latest value: {data.length > 0 ? data[data.length - 1]?.toFixed(2) : 'N/A'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stat: {
    fontSize: 12,
    color: '#666',
  },
  chartContainer: {
    height: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    backgroundColor: 'transparent',
  },
  noDataContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  noDataText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
});

export default SimpleEEGDisplay;
