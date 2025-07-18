/**
 * Simple test script to verify BrainLinkModule integration
 * Run this with: node testBrainLinkModule.js
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

console.log('🔬 Testing BrainLinkModule Integration...\n');

// Check if BrainLinkModule is available
if (NativeModules.BrainLinkModule) {
  console.log('✅ BrainLinkModule found!');
  
  const module = NativeModules.BrainLinkModule;
  console.log('📋 Available methods:', Object.keys(module));
  
  // Test initialization
  module.initializeMacrotellectLink()
    .then(() => {
      console.log('✅ MacrotellectLink initialized successfully');
      return module.getConnectionStatus();
    })
    .then((status) => {
      console.log('📡 Connection status:', status);
    })
    .catch((error) => {
      console.log('⚠️ Test error:', error.message);
    });
    
} else {
  console.log('❌ BrainLinkModule not found');
  console.log('Available modules:', Object.keys(NativeModules));
}

console.log('\n🏁 Test completed');
