import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

const BandPowerBar = ({ 
  label, 
  value, 
  maxValue = 1, 
  color = COLORS.primary,
  unit = '%' 
}) => {
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  const getBarColor = () => {
    if (percentage > 70) return COLORS.success;
    if (percentage > 40) return COLORS.warning;
    return COLORS.error;
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {(value * 100).toFixed(1)}{unit}
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
  const bands = [
    { key: 'delta', label: 'Delta (0.5-4 Hz)', color: COLORS.primary },
    { key: 'theta', label: 'Theta (4-8 Hz)', color: '#9C27B0' },
    { key: 'alpha', label: 'Alpha (8-12 Hz)', color: '#2196F3' },
    { key: 'beta', label: 'Beta (12-30 Hz)', color: '#FF9800' },
    { key: 'gamma', label: 'Gamma (30-100 Hz)', color: '#F44336' },
  ];

  return (
    <View style={styles.displayContainer}>
      <Text style={styles.title}>Frequency Band Powers</Text>
      {bands.map(band => (
        <BandPowerBar
          key={band.key}
          label={band.label}
          value={bandPowers[band.key] || 0}
          color={band.color}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
    textAlign: 'center',
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
