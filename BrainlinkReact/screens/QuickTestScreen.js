/**
 * Quick Test Runner for Native Module Integration
 * 
 * Run this script to test the BrainLink native module setup
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { testNativeModuleIntegration, testBrainLinkService, runAllTests } from '../test-native-integration';

export const QuickTestScreen = () => {
  const [testResults, setTestResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Run tests automatically on mount
    runTests();
  }, []);

  const runTests = async () => {
    setIsRunning(true);
    console.log('🚀 Starting BrainLink Native Module Tests...');
    
    try {
      const results = runAllTests();
      setTestResults(results);
      console.log('✅ Tests completed:', results);
    } catch (error) {
      console.error('❌ Tests failed:', error);
      setTestResults({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getTestStatus = (tests) => {
    if (!tests || !Array.isArray(tests)) return 'Unknown';
    const passed = tests.filter(test => test.passed).length;
    const total = tests.length;
    return `${passed}/${total}`;
  };

  const getOverallStatus = () => {
    if (!testResults) return 'No Results';
    if (testResults.error) return 'Error';
    
    const moduleTests = testResults.module?.tests || [];
    const serviceTests = testResults.service?.tests || [];
    
    const allTests = [...moduleTests, ...serviceTests];
    const passedTests = allTests.filter(test => test.passed).length;
    const totalTests = allTests.length;
    
    return totalTests > 0 && passedTests === totalTests ? 'PASS' : 'FAIL';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 BrainLink Test Runner</Text>
        <Text style={styles.subtitle}>Native Module Integration Test</Text>
      </View>

      {/* Overall Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Status</Text>
        <View style={[
          styles.statusBadge, 
          { backgroundColor: getOverallStatus() === 'PASS' ? '#4CAF50' : '#F44336' }
        ]}>
          <Text style={styles.statusText}>
            {isRunning ? 'RUNNING...' : getOverallStatus()}
          </Text>
        </View>
      </View>

      {/* Test Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Controls</Text>
        <TouchableOpacity 
          style={[styles.button, isRunning && styles.buttonDisabled]}
          onPress={runTests}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? 'Running Tests...' : 'Run Tests Again'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Native Module Tests */}
      {testResults?.module && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Native Module Tests ({getTestStatus(testResults.module.tests)})
          </Text>
          
          {testResults.module.tests.map((test, index) => (
            <View key={index} style={styles.testResult}>
              <Text style={[styles.testIcon, { color: test.passed ? '#4CAF50' : '#F44336' }]}>
                {test.passed ? '✅' : '❌'}
              </Text>
              <View style={styles.testContent}>
                <Text style={styles.testName}>{test.name}</Text>
                <Text style={styles.testDetails}>{test.result}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Service Tests */}
      {testResults?.service && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Service Tests ({getTestStatus(testResults.service.tests)})
          </Text>
          
          {testResults.service.tests.map((test, index) => (
            <View key={index} style={styles.testResult}>
              <Text style={[styles.testIcon, { color: test.passed ? '#4CAF50' : '#F44336' }]}>
                {test.passed ? '✅' : '❌'}
              </Text>
              <View style={styles.testContent}>
                <Text style={styles.testName}>{test.name}</Text>
                <Text style={styles.testDetails}>{test.result}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Error Display */}
      {testResults?.error && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Error Details</Text>
          <Text style={styles.errorText}>{testResults.error}</Text>
        </View>
      )}

      {/* Next Steps */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Next Steps</Text>
        <Text style={styles.nextStepsText}>
          {getOverallStatus() === 'PASS' 
            ? "✅ All tests passed! Your native integration is working correctly.\n\n• Build development client: npm run build:android:dev\n• Test on real device with BrainLink hardware\n• Use NativeDashboardScreen for real EEG data"
            : "❌ Some tests failed. Check the results above.\n\n• Ensure you built with development client\n• Verify JAR file is in android/app/libs/\n• Check that BrainLinkPackage is registered in MainApplication"
          }
        </Text>
      </View>

      {/* Test Timestamp */}
      {testResults?.timestamp && (
        <View style={styles.section}>
          <Text style={styles.timestampText}>
            Last run: {new Date(testResults.timestamp).toLocaleString()}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#9C27B0',
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    backgroundColor: 'white',
    margin: 10,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  statusBadge: {
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  testResult: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  testIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  testContent: {
    flex: 1,
  },
  testName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  testDetails: {
    fontSize: 12,
    color: '#666',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 5,
  },
  nextStepsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  timestampText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
