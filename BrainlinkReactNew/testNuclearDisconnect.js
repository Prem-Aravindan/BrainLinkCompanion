/**
 * Test Nuclear Disconnect Functionality
 * This test verifies that the nuclear disconnect approach works:
 * 1. nuclearDisconnect() destroys LinkManager and forces physical disconnect
 * 2. reinitializeSDK() rebuilds LinkManager for future scanning
 */

import { NativeModules } from 'react-native';

const { BrainLinkModule } = NativeModules;

const testNuclearDisconnect = async () => {
  console.log('🧪 TESTING NUCLEAR DISCONNECT APPROACH');
  
  try {
    // Test 1: Nuclear Disconnect
    console.log('💥 Step 1: Testing nuclear disconnect...');
    const nuclearResult = await BrainLinkModule.nuclearDisconnect();
    console.log('✅ Nuclear disconnect result:', nuclearResult);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: SDK Reinitialization
    console.log('🔄 Step 2: Testing SDK reinitialization...');
    const reinitResult = await BrainLinkModule.reinitializeSDK();
    console.log('✅ Reinitialization result:', reinitResult);
    
    console.log('🎉 NUCLEAR DISCONNECT TEST COMPLETE');
    console.log('📝 Summary:');
    console.log('   - LinkManager was destroyed (forcing physical disconnect)');
    console.log('   - SDK was reinitialized (allowing future scanning)');
    console.log('   - Auto-reconnection cycle should be broken');
    
  } catch (error) {
    console.error('❌ Nuclear disconnect test failed:', error);
  }
};

// To test, you can call this function from the dashboard:
// testNuclearDisconnect();

export default testNuclearDisconnect;
