/**
 * MacrotellectLink SDK Test
 * 
 * This test verifies that the MacrotellectLink SDK is properly integrated
 * and can initialize to provide real EEG data instead of demo mode.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeModules } from 'react-native';

const { BrainLinkModule } = NativeModules;

const MacrotellectLinkSDKTest = () => {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (test, status, message) => {
    setTestResults(prev => [
      ...prev,
      {
        test,
        status, // 'pass', 'fail', 'info'
        message,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  };

  const runSDKTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    try {
      // Test 1: Check if native module is available
      addResult('Native Module Check', 'info', 'Checking BrainLinkModule availability...');
      
      if (!BrainLinkModule) {
        addResult('Native Module Check', 'fail', 'BrainLinkModule is not available');
        setIsRunning(false);
        return;
      }
      
      addResult('Native Module Check', 'pass', 'BrainLinkModule is available');
      console.log('🔍 BrainLinkModule methods:', Object.keys(BrainLinkModule));

      // Test 2: Check SDK constants
      addResult('SDK Constants', 'info', 'Checking SDK constants...');
      
      const constants = await BrainLinkModule.getConstants();
      addResult('SDK Constants', 'pass', `SDK Version: ${constants.SDK_VERSION || 'Unknown'}`);

      // Test 3: Initialize SDK
      addResult('SDK Initialization', 'info', 'Initializing MacrotellectLink SDK...');
      
      try {
        const initResult = await BrainLinkModule.initialize();
        addResult('SDK Initialization', 'pass', `SDK initialized: ${initResult}`);
      } catch (initError) {
        addResult('SDK Initialization', 'fail', `SDK init failed: ${initError.message}`);
        
        // Check if it's a service timeout
        if (initError.message.includes('timeout')) {
          addResult('SDK Diagnosis', 'info', 'Service timeout detected - this causes DirectBLE fallback');
          addResult('SDK Diagnosis', 'info', 'DirectBLE fallback connects devices in DEMO MODE');
          addResult('SDK Diagnosis', 'info', 'For real data, restart app and ensure BrainLink device is on');
        }
      }

      // Test 4: Start scan test
      addResult('Scan Test', 'info', 'Testing device scanning...');
      
      try {
        const scanResult = await BrainLinkModule.startScan();
        addResult('Scan Test', 'pass', `Scan started: ${scanResult}`);
        
        // Stop scan after 5 seconds
        setTimeout(async () => {
          try {
            await BrainLinkModule.stopScan();
            addResult('Scan Test', 'pass', 'Scan stopped successfully');
          } catch (stopError) {
            addResult('Scan Test', 'fail', `Stop scan failed: ${stopError.message}`);
          }
        }, 5000);
        
      } catch (scanError) {
        addResult('Scan Test', 'fail', `Scan failed: ${scanError.message}`);
      }

      // Test 5: Get connected devices
      addResult('Device Check', 'info', 'Checking connected devices...');
      
      try {
        const devices = await BrainLinkModule.getConnectedDevices();
        addResult('Device Check', 'pass', `Connected devices: ${devices.length}`);
        
        if (devices.length > 0) {
          devices.forEach((device, index) => {
            addResult('Device Info', 'info', `Device ${index + 1}: ${device.name} (${device.address})`);
          });
        }
      } catch (deviceError) {
        addResult('Device Check', 'fail', `Device check failed: ${deviceError.message}`);
      }

    } catch (error) {
      addResult('Test Error', 'fail', `Test suite failed: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass': return '#4CAF50';
      case 'fail': return '#F44336';
      case 'info': return '#2196F3';
      default: return '#757575';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return '✅';
      case 'fail': return '❌';
      case 'info': return 'ℹ️';
      default: return '⚪';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MacrotellectLink SDK Test</Text>
      <Text style={styles.subtitle}>
        This test verifies SDK integration for real EEG data
      </Text>

      <TouchableOpacity
        style={[styles.button, isRunning && styles.buttonDisabled]}
        onPress={runSDKTests}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>
          {isRunning ? 'Running Tests...' : 'Run SDK Tests'}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.resultsContainer}>
        {testResults.map((result, index) => (
          <View key={index} style={styles.resultItem}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultIcon}>
                {getStatusIcon(result.status)}
              </Text>
              <Text style={styles.resultTest}>{result.test}</Text>
              <Text style={styles.resultTime}>{result.timestamp}</Text>
            </View>
            <Text style={[styles.resultMessage, { color: getStatusColor(result.status) }]}>
              {result.message}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Test Results Legend:</Text>
        <Text style={styles.legendItem}>✅ Pass - Feature working correctly</Text>
        <Text style={styles.legendItem}>❌ Fail - Issue detected</Text>
        <Text style={styles.legendItem}>ℹ️ Info - Status information</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  resultItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    color: '#333',
  },
  resultTime: {
    fontSize: 12,
    color: '#999',
  },
  resultMessage: {
    fontSize: 14,
    marginLeft: 24,
  },
  legend: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  legendItem: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
});

export default MacrotellectLinkSDKTest;
