import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { COLORS } from '../constants';

const screenWidth = Dimensions.get('window').width;

const EEGChart = ({ 
  data = [], 
  title = 'EEG Signal', 
  height = 200,
  showTitle = true,
  color = COLORS.primary 
}) => {
  const getChartData = () => {
    if (data.length === 0) {
      // Return empty chart data
      return {
        labels: Array.from({ length: 50 }, () => ''),
        datasets: [{
          data: Array.from({ length: 50 }, () => 0),
          color: (opacity = 1) => color,
          strokeWidth: 2,
        }],
      };
    }

    // Take last 50 data points for display
    const displayData = data.slice(-50);
    const labels = Array.from({ length: displayData.length }, () => '');

    return {
      labels,
      datasets: [{
        data: displayData,
        color: (opacity = 1) => color,
        strokeWidth: 2,
      }],
    };
  };

  const chartConfig = {
    backgroundColor: COLORS.white,
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    decimalPlaces: 2,
    color: (opacity = 1) => color,
    labelColor: (opacity = 1) => COLORS.text,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "0", // Hide dots for cleaner line
    },
    propsForBackgroundLines: {
      strokeWidth: 1,
      stroke: COLORS.lightGray,
      strokeOpacity: 0.3,
    },
  };

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.title}>{title}</Text>}
      <LineChart
        data={getChartData()}
        width={screenWidth - 40}
        height={height}
        chartConfig={chartConfig}
        bezier={false} // Disable bezier for real-time data
        style={styles.chart}
        withHorizontalLabels={false}
        withVerticalLabels={false}
        withInnerLines={true}
        withOuterLines={false}
      />
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
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
});

export default EEGChart;
