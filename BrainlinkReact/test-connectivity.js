// Test script to check localhost connectivity
import ApiService from './services/ApiService.js';
import { API_CONFIG } from './constants/index.js';

console.log('=== Localhost Connectivity Test ===');

// Set environment to LOCAL
ApiService.setEnvironment('LOCAL');
console.log('Environment set to LOCAL:', API_CONFIG.ENDPOINTS.LOCAL);

// Test basic connectivity
async function testConnectivity() {
  try {
    console.log('Testing basic connectivity to localhost...');
    
    // Try a simple request to test if server is running
    const response = await fetch('http://127.0.0.1:5000/api/cas', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('✅ Server is accessible! Status:', response.status);
    
    if (response.ok) {
      try {
        const data = await response.json();
        console.log('Server response:', data);
      } catch (e) {
        console.log('Server responded but not with JSON');
      }
    }
    
  } catch (error) {
    console.error('❌ Cannot connect to localhost server:', error.message);
    console.log('Make sure your backend server is running on http://127.0.0.1:5000');
  }
}

// Test login endpoint specifically
async function testLoginEndpoint() {
  try {
    console.log('Testing login endpoint...');
    
    const response = await fetch('http://127.0.0.1:5000/api/cas/token/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'test',
        password: 'test'
      }),
    });
    
    console.log('Login endpoint status:', response.status);
    
    try {
      const text = await response.text();
      console.log('Login endpoint response:', text);
    } catch (e) {
      console.log('Could not parse login response');
    }
    
  } catch (error) {
    console.error('❌ Login endpoint test failed:', error.message);
  }
}

// Run tests
testConnectivity();
testLoginEndpoint();

console.log('=== Test Complete ===');
