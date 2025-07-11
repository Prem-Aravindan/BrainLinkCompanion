import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

const BandPowerBar = ({ 
  label, 
  value, 
  maxValue = 1, 
  color = COLORS.primary,
  unit = '' 
}) => {
  const numValue = Number(value) || 0;
  const numMaxValue = Number(maxValue) || 1;
  const percentage = Math.min((numValue / numMaxValue) * 100, 100);
  
  const getBarColor = () => {
    if (percentage > 70) return COLORS.success;
    if (percentage > 40) return COLORS.warning;
    return COLORS.error;
  };

  const formatDisplayValue = (val) => {
    if (unit === '%') {
      return `${(val * 100).toFixed(1)}${unit}`;
    } else if (unit === '') {
      return val.toFixed(3);
    } else {
      return `${val.toFixed(1)}${unit}`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {formatDisplayValue(numValue)}
        </Text>
      </View>
      <View style={styles.barContainer}>
        <View 
          style={[
            styles.barFill,
            { 
              width: `${percentage}%`,
              backgroundColor: color || getBarColor()
            }
          ]} 
        />
      </View>
    </View>
  );
};

const BandPowerDisplay = ({ bandPowers }) => {
  // Debug logging to track prop updates (reduced frequency)
  const [renderCount, setRenderCount] = React.useState(0);
  
  React.useEffect(() => {
    setRenderCount(prev => prev + 1);
    // Only log every 10th update to reduce noise
    if (renderCount % 10 === 0) {
      console.log('🎨 BandPowerDisplay update #', renderCount + 1, {
        thetaContribution: bandPowers?.thetaContribution?.toFixed(1),
        totalPower: bandPowers?.totalPower?.toFixed(0),
      });
    }
  }, [bandPowers]);

  const bands = [
    { key: 'delta', label: 'Delta (0.5-4 Hz)', color: COLORS.primary },
    { key: 'theta', label: 'Theta (4-8 Hz)', color: '#9C27B0' },
    { key: 'alpha', label: 'Alpha (8-12 Hz)', color: '#2196F3' },
    { key: 'beta', label: 'Beta (12-30 Hz)', color: '#FF9800' },
    { key: 'gamma', label: 'Gamma (30-100 Hz)', color: '#F44336' },
  ];

  // Helper function to format numbers
  const formatValue = (value, decimals = 1) => {
    if (value === undefined || value === null || isNaN(value)) return '0.0';
    return Number(value).toFixed(decimals);
  };

  // Helper function to format SNR values
  const formatSNR = (value) => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    if (value === Infinity || value === Number.POSITIVE_INFINITY) return '∞';
    return Number(value).toFixed(2);
  };

  return (
    <View style={styles.displayContainer}>
      <Text style={styles.title}>EEG Analysis (Updates: {renderCount})</Text>
      
      {/* Show last update time for debugging */}
      {bandPowers.lastUpdate && (
        <Text style={styles.debugText}>
          Last Update: {new Date(bandPowers.lastUpdate).toLocaleTimeString()}
        </Text>
      )}
      
      {/* Theta Contribution - Main Metric (matches Python output) */}
      {bandPowers.thetaContribution !== undefined && (
        <View style={styles.metricContainer}>
          <Text style={styles.metricTitle}>Theta Contribution</Text>
          <Text style={styles.metricValue}>
            {formatValue(bandPowers.thetaContribution, 1)}%
          </Text>
          <Text style={styles.metricSubtext}>
            % of Total Brain Activity
          </Text>
        </View>
      )}

      {/* Advanced Metrics */}
      <View style={styles.advancedMetrics}>
        {bandPowers.thetaPeakSNR !== undefined && (
          <View style={styles.smallMetric}>
            <Text style={styles.smallMetricLabel}>Theta Peak SNR</Text>
            <Text style={styles.smallMetricValue}>
              {formatSNR(bandPowers.thetaPeakSNR)}
            </Text>
          </View>
        )}
        
        {bandPowers.totalPower !== undefined && (
          <View style={styles.smallMetric}>
            <Text style={styles.smallMetricLabel}>Total Power</Text>
            <Text style={styles.smallMetricValue}>
              {formatValue(bandPowers.totalPower, 0)}
            </Text>
          </View>
        )}
      </View>

      {/* Frequency Band Powers */}
      <Text style={styles.sectionTitle}>Frequency Bands</Text>
      {bands.map(band => (
        <BandPowerBar
          key={band.key}
          label={band.label}
          value={bandPowers[band.key] || 0}
          color={band.color}
          maxValue={Math.max(0.3, Math.max(...bands.map(b => bandPowers[b.key] || 0)))}
          unit=""
        />
      ))}

      {/* Relative Powers */}
      {bandPowers.relativeTheta !== undefined && (
        <>
          <Text style={styles.sectionTitle}>Relative Powers</Text>
          <View style={styles.relativePowers}>
            <Text style={styles.relativeText}>
              δ: {formatValue(bandPowers.relativeDelta * 100)}%
            </Text>
            <Text style={styles.relativeText}>
              θ: {formatValue(bandPowers.relativeTheta * 100)}%
            </Text>
            <Text style={styles.relativeText}>
              α: {formatValue(bandPowers.relativeAlpha * 100)}%
            </Text>
            <Text style={styles.relativeText}>
              β: {formatValue(bandPowers.relativeBeta * 100)}%
            </Text>
            <Text style={styles.relativeText}>
              γ: {formatValue(bandPowers.relativeGamma * 100)}%
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  debugText: {
    fontSize: 10,
    color: COLORS.text + '60',
    textAlign: 'center',
    marginBottom: 10,
  },
  displayContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    margin: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  metricContainer: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 2,
  },
  metricSubtext: {
    fontSize: 12,
    color: COLORS.text + '80',
    fontStyle: 'italic',
  },
  advancedMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  smallMetric: {
    alignItems: 'center',
    flex: 1,
  },
  smallMetricLabel: {
    fontSize: 12,
    color: COLORS.text + '80',
    marginBottom: 2,
    textAlign: 'center',
  },
  smallMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  relativePowers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  relativeText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '500',
    margin: 2,
  },
  container: {
    marginBottom: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    minWidth: 50,
    textAlign: 'right',
  },
  barContainer: {
    height: 20,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 10,
    minWidth: 2,
  },
});

export { BandPowerBar, BandPowerDisplay };
