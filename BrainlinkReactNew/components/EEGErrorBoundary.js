/**
 * Error Boundary Component - Prevents crashes from propagating
 * Specifically designed for high-frequency EEG data visualization
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

class EEGErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      errorCount: 0,
      lastError: null,
      lastErrorTime: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true,
      lastError: error.message,
      lastErrorTime: new Date().toISOString()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error but don't crash the app
    console.warn('🚨 EEG Component Error Boundary caught:', {
      error: error.message,
      stack: errorInfo.componentStack?.substring(0, 200), // Truncate stack trace
      timestamp: new Date().toISOString(),
      errorCount: this.state.errorCount + 1
    });

    // Increment error count
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1
    }));

    // Auto-recovery after 3 seconds
    setTimeout(() => {
      if (this.state.errorCount < 10) { // Don't keep retrying if too many errors
        this.setState({ 
          hasError: false,
          lastError: null
        });
      }
    }, 3000);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>EEG Visualization Error</Text>
          <Text style={styles.errorText}>
            Attempting to recover... (Error #{this.state.errorCount})
          </Text>
          <Text style={styles.errorDetails}>
            {this.state.lastError}
          </Text>
          {this.state.errorCount >= 10 && (
            <Text style={styles.criticalError}>
              Too many errors - manual restart required
            </Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    padding: 20,
    backgroundColor: '#ffe6e6',
    borderRadius: 8,
    margin: 10,
    borderColor: '#ff6b6b',
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d63031',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#636e72',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 12,
    color: '#636e72',
    fontStyle: 'italic',
  },
  criticalError: {
    fontSize: 14,
    color: '#d63031',
    fontWeight: 'bold',
    marginTop: 8,
  },
});

export default EEGErrorBoundary;
