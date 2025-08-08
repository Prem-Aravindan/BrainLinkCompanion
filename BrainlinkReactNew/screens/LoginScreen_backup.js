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
  const [environment, setEnvironment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState('environment'); // 'environment' or 'login'

  const environments = [
    { key: 'EN_PROD', label: 'EN (PROD Environment)' },
    { key: 'NL_PROD', label: 'NL (PROD Environment)' },
    { key: 'LOCAL', label: 'Local (127.0.0.1:5000)' },
  ];

  const handleEnvironmentSelection = () => {
    if (!environment) {
      Alert.alert('Error', 'Please select an environment first');
      return;
    }
    setCurrentStep('login');
  };

  const handleBackToEnvironment = () => {
    setCurrentStep('environment');
    // Clear login form when going back
    setUsername('');
    setPassword('');
    setShowPassword(false);
  };

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
      
      if (result.success && result.token) {
        // Login successful - we have a token
        const userData = result.user || { 
          token: result.token, 
          loginTime: new Date().toISOString(),
          username: username
        };
        onLogin(userData);
      } else {
        Alert.alert('Login Failed', result.error || 'Login failed - no token received');
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
        
        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, currentStep === 'environment' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, currentStep === 'login' && styles.stepDotActive]} />
        </View>
        <Text style={styles.stepText}>
          {currentStep === 'environment' ? 'Step 1: Select Environment' : 'Step 2: Login Credentials'}
        </Text>

        {/* Environment Selection Step */}
        {currentStep === 'environment' && (
          <View style={styles.environmentContainer}>
            <Text style={styles.sectionTitle}>Select Environment</Text>
            <Text style={styles.sectionDescription}>
              Choose the environment you want to connect to
            </Text>
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
                ]}>
                  {environment === env.key && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.environmentText,
                  environment === env.key && styles.environmentTextSelected
                ]}>
                  {env.label}
                </Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={[
                styles.continueButton,
                !environment && styles.continueButtonDisabled
              ]}
              onPress={handleEnvironmentSelection}
              disabled={!environment}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Login Form Step */}
        {currentStep === 'login' && (
          <View style={styles.formContainer}>
            <View style={styles.environmentSummary}>
              <Text style={styles.environmentSummaryLabel}>Environment:</Text>
              <Text style={styles.environmentSummaryValue}>
                {environments.find(env => env.key === environment)?.label}
              </Text>
              <TouchableOpacity
                style={styles.changeEnvironmentButton}
                onPress={handleBackToEnvironment}
              >
                <Text style={styles.changeEnvironmentText}>Change</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {/* Original content - will be removed in next step */}
        {false && (
        <View>
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
              ]}>
                {environment === env.key && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.environmentText}>{env.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
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
              <Text style={styles.eyeText}>{showPassword ? '�' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
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
    backgroundColor: '#0a0a0f', // Dark modern background
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 48,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(255, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Step Indicator Styles
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepDotActive: {
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  stepText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 20,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  environmentSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.2)',
  },
  environmentSummaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: 8,
  },
  environmentSummaryValue: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    flex: 1,
  },
  changeEnvironmentButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
  },
  changeEnvironmentText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
  },
  // Modern Glassmorphism Environment Container
  environmentContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  environmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  environmentSelected: {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  // Modern Radio Button
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#2196F3',
    backgroundColor: 'transparent',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  environmentText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  // Modern Form Container
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Modern Input Styling
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Modern Password Container
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
  },
  eyeButton: {
    padding: 16,
    borderRadius: 12,
  },
  eyeText: {
    fontSize: 18,
    opacity: 0.7,
  },
  // Modern Login Button
  loginButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.3)',
  },
  loginButtonDisabled: {
    backgroundColor: 'rgba(158, 158, 158, 0.3)',
    shadowColor: 'transparent',
    borderColor: 'rgba(158, 158, 158, 0.2)',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

export default LoginScreen;
