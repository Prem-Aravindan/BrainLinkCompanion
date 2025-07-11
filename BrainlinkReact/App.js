import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import TestRunner from './screens/TestRunner';
import QuickTestScreen from './screens/QuickTestScreen';
import NativeDashboardScreen from './screens/NativeDashboardScreen';
import MacrotellectLinkTestScreen from './screens/MacrotellectLinkTestScreen';
import ApiService from './services/ApiService';
import { COLORS } from './constants';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState('login'); // 'login', 'dashboard', 'test', 'quicktest', 'native', 'macrotellect'

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const validation = await ApiService.validateSession();
      if (validation.valid) {
        setUser(validation.user);
        setIsLoggedIn(true);
        setCurrentScreen('dashboard');
      }
    } catch (error) {
      console.log('No existing session found');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    setCurrentScreen('dashboard');
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await ApiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsLoggedIn(false);
      setCurrentScreen('login');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loadingContainer}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color={COLORS.primary} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Navigation Component
  const NavigationBar = () => (
    <View style={styles.navBar}>
      {isLoggedIn && (
        <>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'dashboard' && styles.navButtonActive]}
            onPress={() => setCurrentScreen('dashboard')}
          >
            <Text style={styles.navButtonText}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'test' && styles.navButtonActive]}
            onPress={() => setCurrentScreen('test')}
          >
            <Text style={styles.navButtonText}>Tests</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'quicktest' && styles.navButtonActive]}
            onPress={() => setCurrentScreen('quicktest')}
          >
            <Text style={styles.navButtonText}>Quick Test</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'native' && styles.navButtonActive]}
            onPress={() => setCurrentScreen('native')}
          >
            <Text style={styles.navButtonText}>Native</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'macrotellect' && styles.navButtonActive]}
            onPress={() => setCurrentScreen('macrotellect')}
          >
            <Text style={styles.navButtonText}>SDK</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderCurrentScreen = () => {
    if (!isLoggedIn) {
      return <LoginScreen onLogin={handleLogin} />;
    }

    switch (currentScreen) {
      case 'dashboard':
        return <DashboardScreen user={user} onLogout={handleLogout} />;
      case 'test':
        return <TestRunner />;
      case 'quicktest':
        return <QuickTestScreen />;
      case 'native':
        return <NativeDashboardScreen user={user} onLogout={handleLogout} />;
      case 'macrotellect':
        return <MacrotellectLinkTestScreen />;
      default:
        return <DashboardScreen user={user} onLogout={handleLogout} />;
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <NavigationBar />
        <View style={styles.contentContainer}>
          {renderCurrentScreen()}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  navButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginHorizontal: 2,
    borderRadius: 5,
    alignItems: 'center',
  },
  navButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
