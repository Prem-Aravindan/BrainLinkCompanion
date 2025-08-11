/**
 * High-Frequency EEG Data Display - Optimized for 512Hz Raw Data
 * Focuses on raw data visualization without heavy calculations
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';

const RealTimeEEGDisplay = ({ data = [], isConnected = false, deviceInfo = null }) => {
  // Simple high-frequency data buffer - no complex calculations
  const [rawDataBuffer, setRawDataBuffer] = useState([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [currentRate, setCurrentRate] = useState(0);
  
  // Performance tracking - minimal overhead
  const lastRateUpdate = useRef(Date.now());
  const samplesSinceLastUpdate = useRef(0);
  
  // Visualization settings - optimized for performance
  const maxBufferSize = 1024; // 2 seconds at 512Hz
  const plotWidth = 350;
  const plotHeight = 200;
  // Number of recent samples to draw in the plot (default to 512 = ~1s at 512Hz)
  const plotWindowSamples = 512;
  
  // Process incoming data - SIMPLIFIED for performance
  useEffect(() => {
    if (data && data.length > 0) {
      // Direct buffer update without complex processing
      setRawDataBuffer(prevBuffer => {
        const newBuffer = [...prevBuffer, ...data];
        return newBuffer.slice(-maxBufferSize); // Keep only recent samples
      });
      
      // Simple sample counting
      setSampleCount(prev => prev + data.length);
      samplesSinceLastUpdate.current += data.length;
      
      // Update rate every second (minimal frequency to reduce overhead)
      const now = Date.now();
      if (now - lastRateUpdate.current >= 1000) {
        const rate = (samplesSinceLastUpdate.current * 1000) / (now - lastRateUpdate.current);
        setCurrentRate(Math.round(rate));
        
        // Reset counters
        lastRateUpdate.current = now;
        samplesSinceLastUpdate.current = 0;
      }
    }
  }, [data]);
  
  // Generate simple SVG path - optimized for performance
  const generateSignalPath = () => {
    if (rawDataBuffer.length < 2) return '';
    
  // Use only recent samples for visualization to reduce processing
  const recentSamples = rawDataBuffer.slice(-plotWindowSamples);
    if (recentSamples.length < 2) return '';
    
    // Simple auto-scaling
    const min = Math.min(...recentSamples);
    const max = Math.max(...recentSamples);
    const range = max - min || 1;
    
    // Generate path points
    const points = recentSamples.map((value, index) => {
      const x = (index / (recentSamples.length - 1)) * plotWidth;
      const y = plotHeight - ((value - min) / range) * plotHeight;
      return `${x},${y}`;
    }).join(' ');
    
    return points;
  };

  return (
    <ScrollView style={styles.container}>
      {/* Connection Status */}
      {/* <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, isConnected ? styles.connected : styles.disconnected]} />
        <Text style={styles.statusText}>
          {isConnected ? `Connected to ${deviceInfo?.name || 'BrainLink'}` : 'Disconnected'}
        </Text>
      </View> */}

      {/* Simple Performance Metrics */}
      <View style={styles.metricsContainer}>
        <Text style={styles.sectionTitle}>512Hz Raw EEG Data</Text>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Total Samples:</Text>
          <Text style={styles.metricValue}>{sampleCount.toLocaleString()}</Text>
        </View>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Current Rate:</Text>
          <Text style={[styles.metricValue, currentRate > 500 ? styles.highRate : styles.normalRate]}>
            {currentRate} Hz
          </Text>
        </View>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Buffer Size:</Text>
          <Text style={styles.metricValue}>{rawDataBuffer.length} samples</Text>
        </View>
        
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Time Span:</Text>
          <Text style={styles.metricValue}>{(rawDataBuffer.length / 512).toFixed(1)}s</Text>
        </View>
      </View>

      {/* High-Frequency EEG Signal Plot */}
      <View style={styles.plotContainer}>
        <Text style={styles.sectionTitle}>Live EEG Signal</Text>
        {rawDataBuffer.length > 1 ? (
          <View style={styles.svgContainerMatched}>
            <Svg width={plotWidth} height={plotHeight} style={styles.svg}>
              {/* Grid lines to match FilteredEEGDisplay */}
              <Line x1="0" y1={plotHeight / 2} x2={plotWidth} y2={plotHeight / 2} stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />
              <Line x1={plotWidth * 0.25} y1="0" x2={plotWidth * 0.25} y2={plotHeight} stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />
              <Line x1={plotWidth * 0.5} y1="0" x2={plotWidth * 0.5} y2={plotHeight} stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />
              <Line x1={plotWidth * 0.75} y1="0" x2={plotWidth * 0.75} y2={plotHeight} stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />

              {/* Signal line - blue to contrast filtered purple */}
              <Polyline
                points={generateSignalPath()}
                fill="none"
                stroke="#2196F3"
                strokeWidth="2"
              />
            </Svg>

            {/* Simple signal info */}
            <View style={styles.signalInfoMatched}>
              <Text style={styles.signalTextMatched}>
                Latest: {rawDataBuffer[rawDataBuffer.length - 1]}
              </Text>
              <Text style={styles.signalTextMatched}>
                Range: {Math.min(...rawDataBuffer.slice(-100))} to {Math.max(...rawDataBuffer.slice(-100))}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>Waiting for 512Hz EEG data...</Text>
            <Text style={styles.noDataSubtext}>
              Connect headset and start data streaming
            </Text>
          </View>
        )}
      </View>

      {/* Latest Raw Values - Simple Debug */}
      <View style={styles.debugContainer}>
        <Text style={styles.sectionTitle}>Latest Raw Values</Text>
        <View style={styles.debugGrid}>
          {rawDataBuffer.slice(-12).map((value, index) => (
            <Text key={index} style={styles.debugValue}>
              {value}
            </Text>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  connected: {
    backgroundColor: '#00ff00',
  },
  disconnected: {
    backgroundColor: '#ff0000',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  metricsContainer: {
  backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  plotContainer: {
  backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  debugContainer: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#00ff00',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  metricLabel: {
    color: '#ccc',
    fontSize: 14,
  },
  metricValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  highRate: {
    color: '#00ff00',
  },
  normalRate: {
    color: '#ffaa00',
  },
  svgContainerMatched: {
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 8,
    borderWidth: 0,
  },
  signalInfo: {
    marginTop: 10,
    alignItems: 'center',
  },
  signalInfoMatched: {
    marginTop: 10,
    alignItems: 'center',
  },
  signalText: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  signalTextMatched: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 30,
  },
  noDataText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noDataSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  debugGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  debugValue: {
    color: '#00ff00',
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#222',
    padding: 5,
    margin: 2,
    borderRadius: 3,
    minWidth: 50,
    textAlign: 'center',
  },
});

export default RealTimeEEGDisplay;