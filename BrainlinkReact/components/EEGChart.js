import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { VictoryChart, VictoryLine, VictoryAxis } from 'victory-native';
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
      return Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }));
    }

    // Take last 50 data points for display
    const displayData = data.slice(-50);
    return displayData.map((value, index) => ({ x: index, y: value }));
  };

  return (
    <View style={styles.container}>
      {showTitle && <Text style={styles.title}>{title}</Text>}
      <VictoryChart
        width={screenWidth - 40}
        height={height}
        padding={{ left: 50, top: 10, right: 20, bottom: 30 }}
      >
        <VictoryAxis 
          dependentAxis
          style={{
            axis: { stroke: COLORS.lightGray },
            tickLabels: { fontSize: 10, fill: COLORS.text },
            grid: { stroke: COLORS.lightGray, strokeOpacity: 0.3 }
          }}
        />
        <VictoryAxis
          style={{
            axis: { stroke: COLORS.lightGray },
            tickLabels: { fontSize: 10, fill: COLORS.text },
            grid: { stroke: COLORS.lightGray, strokeOpacity: 0.3 }
          }}
        />
        <VictoryLine
          data={getChartData()}
          style={{
            data: { stroke: color, strokeWidth: 2 }
          }}
          animate={{
            duration: 100,
            onLoad: { duration: 500 }
          }}
        />
      </VictoryChart>
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
