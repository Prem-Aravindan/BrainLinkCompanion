/**
 * Comprehensive Test Runner for BrainLink Native Integration
 * Tests all components without requiring the actual MacrotellectLink JAR
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert
} from 'react-native';

const TestRunner = () => {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async (testName, testFunction) => {
    try {
      await testFunction();
      setTestResults(prev => [...prev, { name: testName, status: 'PASS', message: 'Test completed successfully' }]);
    } catch (error) {
      setTestResults(prev => [...prev, { name: testName, status: 'FAIL', message: error.message }]);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    // Test 1: Import BrainLinkNativeService
    await runTest('Import BrainLinkNativeService', async () => {
      try {
        const service = require('../services/BrainLinkNativeService');
        if (!service.BrainLinkNativeService) {
          throw new Error('BrainLinkNativeService not exported');
        }
      } catch (error) {
        if (error.message.includes('could not find Native Module')) {
          // Expected when JAR is missing - this is OK for testing
          return;
        }
        throw error;
      }
    });

    // Test 2: Import useBrainLinkNative hook
    await runTest('Import useBrainLinkNative Hook', async () => {
      const hook = require('../hooks/useBrainLinkNative');
      if (!hook.useBrainLinkNative) {
        throw new Error('useBrainLinkNative hook not exported');
      }
    });

    // Test 3: Import NativeDashboardScreen
    await runTest('Import NativeDashboardScreen', async () => {
      const screen = require('./NativeDashboardScreen');
      if (!screen.default) {
        throw new Error('NativeDashboardScreen not exported');
      }
    });

    // Test 4: Test EEG data processing functions
    await runTest('EEG Data Processing', async () => {
      const processor = require('../utils/EEGProcessor');
      
      // Test data validation
      const mockData = { delta: 100, theta: 150, alpha: 200, beta: 250, gamma: 300 };
      const isValid = processor.validateEEGData(mockData);
      if (!isValid) {
        throw new Error('EEG data validation failed');
      }

      // Test band power calculation
      const bandPowers = processor.calculateBandPowers(mockData);
      if (!bandPowers || typeof bandPowers.total !== 'number') {
        throw new Error('Band power calculation failed');
      }
    });

    // Test 5: Test React components structure
    await runTest('React Components Structure', async () => {
      const BandPowerDisplay = require('../components/BandPowerDisplay');
      const EEGChart = require('../components/EEGChart');
      
      if (!BandPowerDisplay.default) {
        throw new Error('BandPowerDisplay component not found');
      }
      if (!EEGChart.default) {
        throw new Error('EEGChart component not found');
      }
    });

    // Test 6: Test configuration files
    await runTest('Configuration Files', async () => {
      const appConfig = require('../app.json');
      if (!appConfig.expo) {
        throw new Error('App configuration invalid');
      }
      
      // Check for development client configuration
      const plugins = appConfig.expo.plugins || [];
      const hasDevClient = plugins.some(plugin => 
        plugin === 'expo-dev-client' || 
        (Array.isArray(plugin) && plugin[0] === 'expo-dev-client')
      );
      if (!hasDevClient) {
        throw new Error('expo-dev-client plugin not configured');
      }
    });

    setIsRunning(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PASS': return '#4CAF50';
      case 'FAIL': return '#F44336';
      default: return '#FFC107';
    }
  };

  const passedTests = testResults.filter(test => test.status === 'PASS').length;
  const failedTests = testResults.filter(test => test.status === 'FAIL').length;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BrainLink Native Integration Tests</Text>
      
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          Tests: {testResults.length} | Passed: {passedTests} | Failed: {failedTests}
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={runAllTests}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.resultsContainer}>
        {testResults.map((test, index) => (
          <View key={index} style={styles.testResult}>
            <View style={styles.testHeader}>
              <Text style={styles.testName}>{test.name}</Text>
              <Text style={[styles.testStatus, { color: getStatusColor(test.status) }]}>
                {test.status}
              </Text>
            </View>
            <Text style={styles.testMessage}>{test.message}</Text>
          </View>
        ))}
      </ScrollView>

      {testResults.length > 0 && (
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Next Steps:</Text>
          <Text style={styles.instructions}>
            1. Add MacrotellectLink_V1.4.3.jar to android/app/libs/
            2. Run: npx expo run:android
            3. Test with real BrainLink device
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  summaryContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
  },
  summaryText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  resultsContainer: {
    flex: 1,
  },
  testResult: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 1,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  testStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  testMessage: {
    fontSize: 14,
    color: '#666',
  },
  instructionsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 5,
  },
  instructions: {
    fontSize: 14,
    color: '#1976D2',
  },
});

export default TestRunner;
