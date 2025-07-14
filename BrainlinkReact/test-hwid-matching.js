// Test HWID matching logic
const testHWIDMatching = () => {
  const deviceMAC = 'CC3416346938';  // MAC address from device 
  const authorizedHWID = '5C3616346938';  // HWID from API

  console.log('Testing HWID matching...');
  console.log('Device MAC:', deviceMAC);
  console.log('Authorized HWID:', authorizedHWID);

  // Test direct match
  if (deviceMAC === authorizedHWID) {
    console.log('✅ Direct match');
  } else {
    console.log('❌ No direct match');
  }

  // Test last 10 characters
  if (deviceMAC.length >= 10 && authorizedHWID.length >= 10) {
    const deviceLast10 = deviceMAC.slice(-10);
    const authorizedLast10 = authorizedHWID.slice(-10);
    console.log('Device last 10:', deviceLast10);
    console.log('Authorized last 10:', authorizedLast10);
    if (deviceLast10 === authorizedLast10) {
      console.log('✅ Last 10 characters match');
    } else {
      console.log('❌ Last 10 characters do not match');
    }
  }

  // Test last 8 characters (skip the differing middle part)
  if (deviceMAC.length >= 8 && authorizedHWID.length >= 8) {
    const deviceLast8 = deviceMAC.slice(-8);
    const authorizedLast8 = authorizedHWID.slice(-8);
    console.log('Device last 8:', deviceLast8);
    console.log('Authorized last 8:', authorizedLast8);
    if (deviceLast8 === authorizedLast8) {
      console.log('✅ Last 8 characters match');
    } else {
      console.log('❌ Last 8 characters do not match');
    }
  }

  // Test CC -> 5C conversion
  if (deviceMAC.startsWith('CC') && authorizedHWID.startsWith('5C')) {
    const deviceConverted = '5C' + deviceMAC.slice(2);
    console.log('Device converted CC->5C:', deviceConverted);
    if (deviceConverted === authorizedHWID) {
      console.log('✅ CC->5C conversion match');
    } else {
      console.log('❌ CC->5C conversion does not match');
      
      // Try matching last 8 chars after conversion
      const deviceConvertedLast8 = deviceConverted.slice(-8);
      const authorizedLast8 = authorizedHWID.slice(-8);
      console.log('Device converted last 8:', deviceConvertedLast8);
      console.log('Authorized last 8:', authorizedLast8);
      if (deviceConvertedLast8 === authorizedLast8) {
        console.log('✅ CC->5C conversion with last 8 chars match');
      }
    }
  }

  console.log('\n--- Trying alternative matching strategies ---');
  
  // Alternative: match first 2 chars (ignoring CC/5C) + last 6 chars
  const deviceSuffix = deviceMAC.slice(2, 4) + deviceMAC.slice(-6);
  const authorizedSuffix = authorizedHWID.slice(2, 4) + authorizedHWID.slice(-6);
  console.log('Device suffix (chars 3-4 + last 6):', deviceSuffix);
  console.log('Authorized suffix (chars 3-4 + last 6):', authorizedSuffix);
  if (deviceSuffix === authorizedSuffix) {
    console.log('✅ Suffix strategy match');
  }
};

testHWIDMatching();
