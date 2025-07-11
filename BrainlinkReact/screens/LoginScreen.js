import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { COLORS, API_CONFIG } from '../constants';
import ApiService from '../services/ApiService';

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [environment, setEnvironment] = useState('EN_PROD');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const environments = [
    { key: 'EN_PROD', label: 'EN (PROD Environment)' },
    { key: 'NL_PROD', label: 'NL (PROD Environment)' },
    { key: 'LOCAL', label: 'Local (127.0.0.1:5000)' },
  ];
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLoading(true);
    try {
      // Set the API environment
      ApiService.setEnvironment(environment);
      
      // Attempt login
      const result = await ApiService.login(username, password);
      
      console.log('Login result:', result);
      
      if (result.success && (result.user || result.token)) {
        // Pass user data if available, otherwise pass an empty object with token info
        const userData = result.user || { token: result.token, loginTime: new Date().toISOString() };
        onLogin(userData);
      } else {
        Alert.alert('Login Failed', result.error || 'No user info returned');
      }
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>BrainLink Companion</Text>
        
        {/* Environment Selection */}
        <View style={styles.environmentContainer}>
          <Text style={styles.sectionTitle}>Select Environment</Text>
          {environments.map((env) => (
            <TouchableOpacity
              key={env.key}
              style={[
                styles.environmentOption,
                environment === env.key && styles.environmentSelected
              ]}
              onPress={() => setEnvironment(env.key)}
            >
              <View style={[
                styles.radio,
                environment === env.key && styles.radioSelected
              ]} />
              <Text style={styles.environmentText}>{env.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#666"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 30,
  },
  environmentContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 10,
  },
  environmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  environmentSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    paddingHorizontal: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.white,
    marginRight: 10,
  },
  radioSelected: {
    backgroundColor: COLORS.white,
  },
  environmentText: {
    color: COLORS.white,
    fontSize: 14,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 20,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    color: COLORS.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 5,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  eyeButton: {
    padding: 10,
  },
  eyeText: {
    fontSize: 18,
  },
  loginButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 5,
    padding: 15,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.disabled,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
