import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, SafeAreaView, View, ActivityIndicator, Text } from 'react-native';
import LoginScreen from './screens/LoginScreen';
import { MacrotellectLinkDashboard } from './screens/MacrotellectLinkDashboard';
import ApiService from './services/ApiService';
import MacrotellectLinkService from './services/MacrotellectLinkService';
import { COLORS } from './constants';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const validation = await ApiService.validateSession();
      if (validation.valid) {
        setUser(validation.user);
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.log('No existing session found');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    
    // Initialize MacrotellectLink SDK after successful login
    try {
      console.log('🔐 User logged in, initializing MacrotellectLink SDK...');
      if (MacrotellectLinkService.isAvailable()) {
        await MacrotellectLinkService.initialize();
        console.log('✅ MacrotellectLink SDK initialized successfully');
      } else {
        console.warn('⚠️ MacrotellectLink SDK not available on this platform');
      }
    } catch (error) {
      console.error('Error initializing MacrotellectLink SDK after login:', error);
    }
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
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      {!isLoggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <MacrotellectLinkDashboard 
          user={user}
          onLogout={handleLogout}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
