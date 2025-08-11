/**
 * Filtered EEG Display - Shows processed/filtered EEG data
 * 
 * This component displays the output from the background DSP processor.
 * Designed to be lightweight and efficient for high-frequency updates.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import Svg, { Polyline, Line } from 'react-native-svg';

const FilteredEEGDisplay = ({ 
  filteredData = [], 
  samplingRate = 128,
  isActive = false,
  performanceStats = null,
  latestFeatures = null,
}) => {
  // Component state for smooth streaming display
  const [displayBuffer, setDisplayBuffer] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(0);
  
  // Maximum samples to display (like raw EEG - about 2-3 seconds)
  const maxDisplaySamples = Math.min(1536, samplingRate * 3); // 3 seconds max

  // Handle incoming filtered data - add to rolling buffer for smooth streaming
  useEffect(() => {
    if (filteredData && filteredData.length > 0) {
      setDisplayBuffer(prevBuffer => {
        // Add new samples to the existing buffer (like raw signal does)
        const newBuffer = [...prevBuffer, ...filteredData];
        
        // Keep only recent samples (rolling window)
        if (newBuffer.length > maxDisplaySamples) {
          return newBuffer.slice(-maxDisplaySamples);
        }
        
        return newBuffer;
      });
      setLastUpdate(Date.now());
    }
  }, [filteredData, maxDisplaySamples]);

  // Create SVG path for the filtered signal - optimized for streaming
  const svgPath = useMemo(() => {
    if (!displayBuffer || displayBuffer.length < 2) return '';
    
  const width = 350;
  const height = 200;
    
    // For streaming display, use last portion of buffer (like raw EEG)
  const displaySamples = Math.min(displayBuffer.length, 512); // Show last 1 second
    const dataToShow = displayBuffer.slice(-displaySamples);
    
    // Normalize data for display
    const validData = dataToShow.filter(val => isFinite(val));
    if (validData.length === 0) return '';
    
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    const range = max - min;
    
    if (range === 0) {
      // Flat line for constant data
      const y = height / 2;
      return `0,${y} ${width},${y}`;
    }
    
    // Create points for the polyline - streaming style
    const points = validData.map((value, index) => {
      const x = (index / (validData.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    
    return points;
  }, [displayBuffer]);

  // Calculate display statistics
  const displayStats = useMemo(() => {
    if (!displayBuffer || displayBuffer.length === 0) {
      return { mean: 0, rms: 0, peak: 0, latest: 0 };
    }
    
    const validData = displayBuffer.filter(val => isFinite(val));
    if (validData.length === 0) {
      return { mean: 0, rms: 0, peak: 0, latest: 0 };
    }
    
    const mean = validData.reduce((sum, val) => sum + val, 0) / validData.length;
    const rms = Math.sqrt(validData.reduce((sum, val) => sum + val * val, 0) / validData.length);
    const peak = Math.max(...validData.map(Math.abs));
    const latest = validData[validData.length - 1];
    
    return { mean, rms, peak, latest };
  }, [displayBuffer]);

  // Status indicator color
  const statusColor = isActive ? '#4CAF50' : '#FF9800';
  const statusText = isActive ? 'Filtering Active' : 'Filter Inactive';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Filtered EEG Signal</Text>
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>
      
      <View style={styles.statsContainer}>
        <Text style={styles.stat}>
          Rate: {samplingRate}Hz | Total: {displayBuffer.length} | Showing: {Math.min(displayBuffer.length, 512)} samples
        </Text>
        <Text style={styles.stat}>
          RMS: {displayStats.rms.toFixed(2)} | Peak: {displayStats.peak.toFixed(2)} | Latest: {displayStats.latest.toFixed(3)}
        </Text>
      </View>
      
      <View style={styles.chartContainer}>
        {svgPath ? (
          <Svg width={350} height={200} style={styles.svg}>
            {/* Grid lines for better readability */}
            <Line x1="0" y1={100} x2="350" y2={100} stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />
            <Line x1="87.5" y1="0" x2="87.5" y2="200" stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />
            <Line x1="175" y1="0" x2="175" y2="200" stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />
            <Line x1="262.5" y1="0" x2="262.5" y2="200" stroke="#E0E0E0" strokeWidth="1" strokeDasharray="5,5" />
            
            {/* Filtered signal */}
            <Polyline
              points={svgPath}
              fill="none"
              stroke="#9C27B0"
              strokeWidth="2"
            />
          </Svg>
        ) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>
              {isActive ? 'Processing filtered data...' : 'Background filtering inactive'}
            </Text>
          </View>
        )}
      </View>
      
      {latestFeatures && (
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Window {new Date(latestFeatures.t0).toLocaleTimeString()} - {new Date(latestFeatures.t1).toLocaleTimeString()} (fs={latestFeatures.fs})</Text>
          {(() => {
            const f = latestFeatures || {};
            const toExp = (v) => (Number.isFinite(v) ? Number(v).toExponential(2) : '--');
            const toFix = (v, n=3) => (Number.isFinite(v) ? Number(v).toFixed(n) : '--');
            const lines = [
              // Absolute powers
              ['delta_power', toExp(f.delta_power)],
              ['theta_power', toExp(f.theta_power)],
              ['alpha_power', toExp(f.alpha_power)],
              ['beta_power', toExp(f.beta_power)],
              ['gamma_power', toExp(f.gamma_power)],
              // Relative powers
              ['delta_relative', toFix(f.delta_relative)],
              ['theta_relative', toFix(f.theta_relative)],
              ['alpha_relative', toFix(f.alpha_relative)],
              ['beta_relative', toFix(f.beta_relative)],
              ['gamma_relative', toFix(f.gamma_relative)],
              // Peak freqs
              ['delta_peak_freq', `${toFix(f.delta_peak_freq, 1)} Hz`],
              ['theta_peak_freq', `${toFix(f.theta_peak_freq, 1)} Hz`],
              ['alpha_peak_freq', `${toFix(f.alpha_peak_freq, 1)} Hz`],
              ['beta_peak_freq', `${toFix(f.beta_peak_freq, 1)} Hz`],
              ['gamma_peak_freq', `${toFix(f.gamma_peak_freq, 1)} Hz`],
              // Peak amps
              ['delta_peak_amp', toExp(f.delta_peak_amp)],
              ['theta_peak_amp', toExp(f.theta_peak_amp)],
              ['alpha_peak_amp', toExp(f.alpha_peak_amp)],
              ['beta_peak_amp', toExp(f.beta_peak_amp)],
              ['gamma_peak_amp', toExp(f.gamma_peak_amp)],
              // Composite
              ['alpha_theta_ratio', toFix(f.alpha_theta_ratio)],
              ['beta_alpha_ratio', toFix(f.beta_alpha_ratio)],
              ['total_power', toExp(f.total_power)],
              ['theta_contribution', toFix(f.theta_contribution)],
            ];
            return (
              <View style={styles.featuresList}>
                {lines.map(([k, v]) => (
                  <Text key={k} style={styles.kvLine}>
                    <Text style={styles.k}>{k}</Text>: {v}
                  </Text>
                ))}
              </View>
            );
          })()}
        </View>
      )}

      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Latest:</Text>
          <Text style={styles.detailValue}>{displayStats.latest.toFixed(3)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Mean:</Text>
          <Text style={styles.detailValue}>{displayStats.mean.toFixed(3)}</Text>
        </View>
        {performanceStats && (
          <View style={styles.performanceContainer}>
            <Text style={styles.performanceTitle}>DSP Performance:</Text>
            <Text style={styles.performanceText}>
              Avg: {performanceStats.averageProcessingTime?.toFixed(2)}ms | 
              Buffer: {performanceStats.bufferUtilization?.toFixed(1)}%
            </Text>
          </View>
        )}
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    marginBottom: 12,
  },
  stat: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 8,
  },
  svg: {
    backgroundColor: 'transparent',
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  detailsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
  },
  performanceContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  performanceTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 2,
  },
  performanceText: {
    fontSize: 11,
    color: '#666',
  },
  featuresContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#eef7ff',
    borderRadius: 4,
    width: '100%',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  featuresTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#245',
    marginBottom: 6,
  },
  featuresList: {
    flexDirection: 'column',
  },
  kvLine: { fontSize: 12, color: '#123', marginBottom: 2 },
  k: { fontWeight: 'bold' },
});

export default FilteredEEGDisplay;
