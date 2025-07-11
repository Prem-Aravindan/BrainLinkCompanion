import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../constants';

const screenWidth = Dimensions.get('window').width;

const EEGChart = ({ 
  data = [], 
  title = 'EEG Signal', 
  height = 200,
  showTitle = true,
  color = COLORS.primary 
}) => {
  const getLatestValues = () => {
    if (data.length === 0) {
      return [];
    }
    // Show last 10 values
    return data.slice(-10);
  };

  const getAverageValue = () => {
    if (data.length === 0) return 0;
    const recent = data.slice(-20);
    return (recent.reduce((sum, val) => sum + val, 0) / recent.length).toFixed(2);
  };

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.title}>{title}</Text>}
      
      <View style={styles.valueContainer}>
        <Text style={styles.averageLabel}>Current Average:</Text>
        <Text style={[styles.averageValue, { color }]}>{getAverageValue()}</Text>
      </View>
      
      <View style={styles.valuesGrid}>
        <Text style={styles.valuesLabel}>Recent Values:</Text>
        <View style={styles.valuesRow}>
          {getLatestValues().map((value, index) => (
            <Text key={index} style={styles.valueItem}>
              {typeof value === 'number' ? value.toFixed(1) : value}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 15,
    margin: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  valueContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  averageLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 5,
  },
  averageValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  valuesGrid: {
    marginTop: 10,
  },
  valuesLabel: {
    fontSize: 12,
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  valuesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  valueItem: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    color: COLORS.text,
    minWidth: 45,
    textAlign: 'center',
  },
});

export default EEGChart;
