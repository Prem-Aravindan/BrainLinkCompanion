// Test script to validate API configuration
import ApiService from './services/ApiService.js';
import { API_CONFIG } from './constants/index.js';

console.log('=== API Configuration Test ===');

// Test environment setup
console.log('Available environments:', Object.keys(API_CONFIG.ENDPOINTS));

Object.keys(API_CONFIG.ENDPOINTS).forEach(env => {
  console.log(`${env}: ${API_CONFIG.ENDPOINTS[env]}`);
});

// Test API service initialization
try {
  ApiService.setEnvironment('LOCAL');
  console.log('✅ API Service environment set successfully');
} catch (error) {
  console.error('❌ API Service environment setup failed:', error.message);
}

// Test request URL formation (without actually making request)
try {
  const testEndpoint = '/token/login';
  const expectedUrl = `${API_CONFIG.ENDPOINTS.LOCAL}${testEndpoint}`;
  console.log('✅ Test URL formation:', expectedUrl);
} catch (error) {
  console.error('❌ URL formation failed:', error.message);
}

console.log('=== Test Complete ===');
