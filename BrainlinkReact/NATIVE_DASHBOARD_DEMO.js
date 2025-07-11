/**
 * Demo: Native Dashboard Integration
 * 
 * This file shows how to integrate the new Native Dashboard
 * into your existing React Native app navigation.
 */

// Option 1: Replace existing dashboard in App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { NativeDashboardScreen } from './screens/NativeDashboardScreen';
import { LoginScreen } from './screens/LoginScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen 
          name="Dashboard" 
          component={NativeDashboardScreen}
          options={{ title: 'BrainLink Native' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Option 2: Add as new tab in tab navigator
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from './screens/DashboardScreen'; // Legacy dashboard

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen 
        name="Legacy" 
        component={DashboardScreen}
        options={{ title: 'Legacy TGAM' }}
      />
      <Tab.Screen 
        name="Native" 
        component={NativeDashboardScreen}
        options={{ title: 'Native SDK' }}
      />
    </Tab.Navigator>
  );
}

// Option 3: Conditional rendering based on platform
import { Platform } from 'react-native';

export function ConditionalDashboard() {
  // Use native SDK on Android, fallback to legacy on iOS/other
  if (Platform.OS === 'android') {
    return <NativeDashboardScreen />;
  } else {
    return <DashboardScreen />;
  }
}

// Option 4: Feature flag approach
const USE_NATIVE_SDK = true; // Toggle this to switch implementations

export function FeatureFlagDashboard() {
  if (USE_NATIVE_SDK) {
    return <NativeDashboardScreen />;
  } else {
    return <DashboardScreen />;
  }
}
