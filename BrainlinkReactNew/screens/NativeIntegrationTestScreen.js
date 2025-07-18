/**
 * React Hook Test Component
 * 
 * This component tests the useBrainLinkNative hook functionality
 * and provides a UI for testing the native integration.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { useBrainLinkNative } from '../hooks/useBrainLinkNative';

export const NativeIntegrationTestScreen = () => {
  const [testResults, setTestResults] = useState([]);
  const [isTestingInProgress, setIsTestingInProgress] = useState(false);

  const {
    // Connection state
    isConnected,
    isConnecting,
    isScanning,
    connectionError,
    
    // Device state
    availableDevices,
    connectedDevice,
    
    // EEG data
    eegData,
    dataQuality,
    isReceivingData,
    
    // Actions
    startScan,
    stopScan,
    connectToDevice,
    disconnect,
    
    // Utility
    isSDKAvailable
  } = useBrainLinkNative();

  useEffect(() => {
    // Run initial tests when component mounts
    runHookTests();
  }, []);

  const addTestResult = (testName, passed, details) => {
    const result = {
      id: Date.now(),
      testName,
      passed,
      details,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setTestResults(prev => [...prev, result]);
    console.log(`${passed ? '✅' : '❌'} ${testName}: ${details}`);
  };

  const runHookTests = async () => {
    setIsTestingInProgress(true);
    setTestResults([]);
    
    console.log('🧪 Running React Hook Tests...');

    // Test 1: Hook initialization
    addTestResult(
      'Hook Initialization', 
      true, 
      'useBrainLinkNative hook loaded successfully'
    );

    // Test 2: SDK availability check
    addTestResult(
      'SDK Availability',
      isSDKAvailable !== undefined,
      `isSDKAvailable: ${isSDKAvailable}`
    );

    // Test 3: Initial state values
    const initialStateValid = (
      typeof isConnected === 'boolean' &&
      typeof isConnecting === 'boolean' &&
      typeof isScanning === 'boolean' &&
      Array.isArray(availableDevices) &&
      typeof isReceivingData === 'boolean'
    );
    
    addTestResult(
      'Initial State',
      initialStateValid,
      `State types correct: ${initialStateValid}`
    );

    // Test 4: EEG data structure
    const eegDataValid = (
      eegData &&
      typeof eegData.attention === 'number' &&
      typeof eegData.meditation === 'number' &&
      eegData.bandPowers &&
      typeof eegData.bandPowers.delta === 'number'
    );
    
    addTestResult(
      'EEG Data Structure',
      eegDataValid,
      `EEG data structure valid: ${eegDataValid}`
    );

    // Test 5: Action functions exist
    const actionsExist = (
      typeof startScan === 'function' &&
      typeof stopScan === 'function' &&
      typeof connectToDevice === 'function' &&
      typeof disconnect === 'function'
    );
    
    addTestResult(
      'Action Functions',
      actionsExist,
      `All action functions available: ${actionsExist}`
    );

    setIsTestingInProgress(false);
  };

  const testScanFunction = async () => {
    try {
      addTestResult('Scan Test', true, 'Starting scan test...');
      await startScan();
      addTestResult('Scan Start', true, 'Scan started successfully');
      
      // Wait a moment then stop scan
      setTimeout(async () => {
        try {
          await stopScan();
          addTestResult('Scan Stop', true, 'Scan stopped successfully');
        } catch (error) {
          addTestResult('Scan Stop', false, `Error: ${error.message}`);
        }
      }, 3000);
      
    } catch (error) {
      addTestResult('Scan Test', false, `Error: ${error.message}`);
    }
  };

  const testConnectionFlow = async () => {
    if (availableDevices.length === 0) {
      Alert.alert('No Devices', 'Please scan for devices first');
      return;
    }

    try {
      const deviceMac = availableDevices[0].mac || 'TEST:MAC:ADDRESS';
      addTestResult('Connection Test', true, `Testing connection to: ${deviceMac}`);
      
      await connectToDevice(deviceMac);
      addTestResult('Connect Call', true, 'Connection call completed');
      
    } catch (error) {
      addTestResult('Connection Test', false, `Error: ${error.message}`);
    }
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  const getStatusColor = (status) => {
    if (isConnected && isReceivingData) return '#4CAF50';
    if (isConnected) return '#FF9800';
    if (isConnecting) return '#2196F3';
    return '#F44336';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Native Integration Test</Text>
        <Text style={styles.subtitle}>BrainLink SDK Testing Dashboard</Text>
      </View>

      {/* SDK Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SDK Status</Text>
        <View style={styles.statusRow}>
          <Text style={styles.label}>Available:</Text>
          <Text style={[styles.value, { color: isSDKAvailable ? '#4CAF50' : '#F44336' }]}>
            {isSDKAvailable ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Status</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected'}
          </Text>
        </View>
        
        {connectionError && (
          <Text style={styles.errorText}>{connectionError}</Text>
        )}
        
        <View style={styles.statusRow}>
          <Text style={styles.label}>Scanning:</Text>
          <Text style={styles.value}>{isScanning ? 'Yes' : 'No'}</Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.label}>Devices Found:</Text>
          <Text style={styles.value}>{availableDevices.length}</Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.label}>Receiving Data:</Text>
          <Text style={styles.value}>{isReceivingData ? 'Yes' : 'No'}</Text>
        </View>
      </View>

      {/* Test Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Controls</Text>
        
        <TouchableOpacity 
          style={styles.testButton}
          onPress={runHookTests}
          disabled={isTestingInProgress}
        >
          <Text style={styles.buttonText}>
            {isTestingInProgress ? 'Testing...' : 'Run Hook Tests'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.scanButton]}
          onPress={testScanFunction}
          disabled={isScanning}
        >
          <Text style={styles.buttonText}>
            {isScanning ? 'Scanning...' : 'Test Scan Function'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.connectButton]}
          onPress={testConnectionFlow}
          disabled={isConnecting || availableDevices.length === 0}
        >
          <Text style={styles.buttonText}>Test Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.testButton, styles.clearButton]}
          onPress={clearTestResults}
        >
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Test Results</Text>
        
        {testResults.length === 0 ? (
          <Text style={styles.noResults}>No test results yet</Text>
        ) : (
          testResults.map((result) => (
            <View key={result.id} style={styles.testResult}>
              <View style={styles.testResultHeader}>
                <Text style={[styles.testResultIcon, { color: result.passed ? '#4CAF50' : '#F44336' }]}>
                  {result.passed ? '✅' : '❌'}
                </Text>
                <Text style={styles.testResultName}>{result.testName}</Text>
                <Text style={styles.testResultTime}>{result.timestamp}</Text>
              </View>
              <Text style={styles.testResultDetails}>{result.details}</Text>
            </View>
          ))
        )}
      </View>

      {/* Current EEG Data */}
      {isReceivingData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live EEG Data</Text>
          
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Attention</Text>
              <Text style={styles.dataValue}>{eegData.attention}</Text>
            </View>
            
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Meditation</Text>
              <Text style={styles.dataValue}>{eegData.meditation}</Text>
            </View>
            
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Signal Quality</Text>
              <Text style={styles.dataValue}>{200 - dataQuality}/200</Text>
            </View>
            
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>Delta</Text>
              <Text style={styles.dataValue}>{eegData.bandPowers.delta.toFixed(2)}</Text>
            </View>
          </View>
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
    backgroundColor: '#673AB7',
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#FF9800',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  clearButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noResults: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
    padding: 20,
  },
  testResult: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  testResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  testResultIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  testResultName: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  testResultTime: {
    fontSize: 12,
    color: '#666',
  },
  testResultDetails: {
    fontSize: 12,
    color: '#666',
    marginLeft: 24,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataItem: {
    width: '48%',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});
