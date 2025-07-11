#!/usr/bin/env node

/**
 * BrainLink Data Flow Debug Tool
 * 
 * This script helps debug the entire data flow from BLE device to UI output:
 * 1. Simulates different types of BLE packet data
 * 2. Tests the parseBrainLinkPacket function
 * 3. Tests the EEG processing pipeline
 * 4. Identifies where the data flow breaks down
 */

const fs = require('fs');
const path = require('path');

// Import our modules
const { createEEGProcessor } = require('./utils/eegProcessing');

// Simulate the packet parsing function from BluetoothService
function parseBrainLinkPacket(packet) {
  try {
    // BrainLink packets typically contain:
    // - Status bytes
    // - EEG data (usually 2 bytes, little-endian)
    // - Quality indicators
    
    if (packet.length < 3) {
      return null; // Packet too short
    }
    
    // Extract EEG value from packet
    // This is a simplified parser - may need adjustment based on actual BrainLink protocol
    const bytes = Buffer.from(packet, 'latin1');
    
    // Look for EEG data in the packet
    // BrainLink often sends 14-bit values (0-16383) for raw EEG
    let eegValue = null;
    
    // Try different positions in the packet for EEG data
    for (let i = 0; i < bytes.length - 1; i++) {
      const rawValue = (bytes[i + 1] << 8) | bytes[i]; // Little-endian 16-bit
      
      // BrainLink EEG values are typically in range 0-16383 (14-bit)
      if (rawValue >= 0 && rawValue <= 16383) {
        // Convert to microvolts (typical BrainLink conversion)
        eegValue = (rawValue - 8192) * 0.5; // Center around 0, scale to microvolts
        break;
      }
    }
    
    if (eegValue !== null) {
      console.log(`✅ Parsed EEG value: ${eegValue.toFixed(2)} µV`);
      return eegValue;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error parsing BrainLink packet:', error);
    return null;
  }
}

// Create different types of test packets
function createTestPackets() {
  const packets = [];
  
  // 1. Normal EEG packets with realistic 14-bit values
  console.log('\n=== Creating Normal EEG Test Packets ===');
  for (let i = 0; i < 10; i++) {
    // Generate realistic 14-bit EEG values (0-16383)
    const rawValue = Math.floor(Math.random() * 16384); // 0-16383
    const byte1 = rawValue & 0xFF; // Low byte
    const byte2 = (rawValue >> 8) & 0xFF; // High byte
    
    // Create packet with some header bytes and EEG data
    const packet = Buffer.from([0xAA, 0x55, byte1, byte2, 0x00, 0x00]);
    packets.push({
      type: 'normal',
      raw: rawValue,
      expected: (rawValue - 8192) * 0.5,
      packet: packet.toString('latin1')
    });
    console.log(`Packet ${i + 1}: raw=${rawValue}, expected=${((rawValue - 8192) * 0.5).toFixed(2)}µV`);
  }
  
  // 2. Constant value packets (problematic case)
  console.log('\n=== Creating Constant Value Test Packets ===');
  const constantValue = 16383; // Maximum 14-bit value
  const byte1 = constantValue & 0xFF;
  const byte2 = (constantValue >> 8) & 0xFF;
  for (let i = 0; i < 5; i++) {
    const packet = Buffer.from([0xAA, 0x55, byte1, byte2, 0x00, 0x00]);
    packets.push({
      type: 'constant',
      raw: constantValue,
      expected: (constantValue - 8192) * 0.5,
      packet: packet.toString('latin1')
    });
  }
  console.log(`Constant packets: raw=${constantValue}, expected=${((constantValue - 8192) * 0.5).toFixed(2)}µV`);
  
  // 3. Invalid packets
  console.log('\n=== Creating Invalid Test Packets ===');
  packets.push({
    type: 'invalid_short',
    packet: 'AB'
  });
  
  packets.push({
    type: 'invalid_values',
    packet: Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]).toString('latin1')
  });
  
  return packets;
}

// Test the packet parsing
function testPacketParsing(packets) {
  console.log('\n🔍 === Testing Packet Parsing ===');
  
  const results = [];
  
  packets.forEach((testPacket, index) => {
    console.log(`\nTesting packet ${index + 1} (${testPacket.type}):`);
    console.log(`  Raw packet bytes: [${Buffer.from(testPacket.packet, 'latin1').join(', ')}]`);
    
    const parsed = parseBrainLinkPacket(testPacket.packet);
    
    if (parsed !== null) {
      console.log(`  ✅ Parsed: ${parsed.toFixed(2)} µV`);
      if (testPacket.expected !== undefined) {
        const diff = Math.abs(parsed - testPacket.expected);
        console.log(`  Expected: ${testPacket.expected.toFixed(2)} µV, Difference: ${diff.toFixed(4)}`);
      }
      results.push({ type: testPacket.type, value: parsed });
    } else {
      console.log(`  ❌ Failed to parse`);
      results.push({ type: testPacket.type, value: null });
    }
  });
  
  return results;
}

// Test the EEG processing pipeline
function testEEGProcessing(parsedValues) {
  console.log('\n🧠 === Testing EEG Processing Pipeline ===');
  
  // Filter out null values
  const validValues = parsedValues.filter(result => result.value !== null).map(result => result.value);
  
  if (validValues.length === 0) {
    console.log('❌ No valid EEG values to process');
    return null;
  }
  
  console.log(`📊 Processing ${validValues.length} valid EEG values`);
  console.log(`Value range: ${Math.min(...validValues).toFixed(2)} to ${Math.max(...validValues).toFixed(2)} µV`);
  
  // Create processor
  const processor = createEEGProcessor(512); // 512 Hz sampling rate
  
  // Need enough samples for processing (window size = 512)
  const windowSize = 512;
  
  if (validValues.length < windowSize) {
    // Pad with interpolated values to reach window size
    console.log(`⚠️ Only ${validValues.length} samples, padding to ${windowSize} for processing...`);
    
    // Generate realistic EEG-like data based on the provided samples
    const paddedValues = [];
    const avgValue = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    const stdDev = Math.sqrt(validValues.reduce((sum, val) => sum + Math.pow(val - avgValue, 2), 0) / validValues.length);
    
    // Add original values
    paddedValues.push(...validValues);
    
    // Generate additional samples with similar statistical properties
    while (paddedValues.length < windowSize) {
      // Add some randomness that mimics EEG characteristics
      const noise = (Math.random() - 0.5) * stdDev * 0.5; // 50% of original noise
      const trend = Math.sin((paddedValues.length / windowSize) * Math.PI * 4) * stdDev * 0.2; // Low-frequency trend
      const newValue = avgValue + noise + trend;
      paddedValues.push(newValue);
    }
    
    validValues.splice(0, validValues.length, ...paddedValues);
  }
  
  try {
    const result = processor.process(validValues.slice(-windowSize));
    
    console.log('\n📈 Processing Results:');
    console.log(`  Delta: ${result.bandPowers.delta.toFixed(2)} (${((result.bandPowers.delta / (result.bandPowers.delta + result.bandPowers.theta + result.bandPowers.alpha + result.bandPowers.beta + result.bandPowers.gamma)) * 100).toFixed(1)}%)`);
    console.log(`  Theta: ${result.bandPowers.theta.toFixed(2)} (${((result.bandPowers.theta / (result.bandPowers.delta + result.bandPowers.theta + result.bandPowers.alpha + result.bandPowers.beta + result.bandPowers.gamma)) * 100).toFixed(1)}%)`);
    console.log(`  Alpha: ${result.bandPowers.alpha.toFixed(2)} (${((result.bandPowers.alpha / (result.bandPowers.delta + result.bandPowers.theta + result.bandPowers.alpha + result.bandPowers.beta + result.bandPowers.gamma)) * 100).toFixed(1)}%)`);
    console.log(`  Beta: ${result.bandPowers.beta.toFixed(2)} (${((result.bandPowers.beta / (result.bandPowers.delta + result.bandPowers.theta + result.bandPowers.alpha + result.bandPowers.beta + result.bandPowers.gamma)) * 100).toFixed(1)}%)`);
    console.log(`  Gamma: ${result.bandPowers.gamma.toFixed(2)} (${((result.bandPowers.gamma / (result.bandPowers.delta + result.bandPowers.theta + result.bandPowers.alpha + result.bandPowers.beta + result.bandPowers.gamma)) * 100).toFixed(1)}%)`);
    console.log(`  Total Power: ${result.thetaMetrics.totalPower.toFixed(2)}`);
    console.log(`  Theta Contribution: ${(result.thetaMetrics.thetaContribution * 100).toFixed(3)}%`);
    
    return result;
  } catch (error) {
    console.error('❌ EEG processing failed:', error);
    return null;
  }
}

// Analyze potential issues
function analyzeIssues(parsedResults, processingResult) {
  console.log('\n🔍 === Issue Analysis ===');
  
  // Check parsed values
  const validValues = parsedResults.filter(result => result.value !== null);
  const constantValues = parsedResults.filter(result => result.type === 'constant');
  
  console.log('\n📊 Parsed Value Analysis:');
  console.log(`  Total packets: ${parsedResults.length}`);
  console.log(`  Valid values: ${validValues.length}`);
  console.log(`  Constant values: ${constantValues.length}`);
  
  if (validValues.length > 0) {
    const values = validValues.map(r => r.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length);
    
    console.log(`  Value range: ${min.toFixed(2)} to ${max.toFixed(2)} µV`);
    console.log(`  Average: ${avg.toFixed(2)} µV`);
    console.log(`  Std deviation: ${stdDev.toFixed(2)} µV`);
    
    // Check for issues
    if (constantValues.length === validValues.length) {
      console.log('⚠️  ISSUE: All values are constant - device may be sending dummy data');
    }
    
    if (stdDev < 1.0) {
      console.log('⚠️  ISSUE: Very low variance - data may not be real EEG');
    }
    
    if (Math.abs(avg) > 2000) {
      console.log('⚠️  ISSUE: Average value is very high - possible parsing/scaling issue');
    }
  }
  
  // Check processing results
  if (processingResult) {
    const totalPower = processingResult.bandPowers.delta + processingResult.bandPowers.theta + 
                      processingResult.bandPowers.alpha + processingResult.bandPowers.beta + 
                      processingResult.bandPowers.gamma;
    
    console.log('\n🧠 Processing Result Analysis:');
    const deltaPercent = (processingResult.bandPowers.delta / totalPower) * 100;
    const thetaPercent = (processingResult.bandPowers.theta / totalPower) * 100;
    
    if (deltaPercent > 80) {
      console.log('⚠️  ISSUE: Delta power dominates (>80%) - may indicate DC offset or very low frequency content');
    }
    
    if (thetaPercent < 5) {
      console.log('⚠️  ISSUE: Theta power very low (<5%) - may indicate processing or data quality issue');
    }
    
    if (processingResult.bandPowers.delta > 1000000) {
      console.log('⚠️  ISSUE: Extremely high delta power - likely indicates DC offset or parsing issue');
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 BrainLink Data Flow Debug Tool');
  console.log('==================================');
  
  try {
    // Step 1: Create test packets
    const testPackets = createTestPackets();
    
    // Step 2: Test packet parsing
    const parsedResults = testPacketParsing(testPackets);
    
    // Step 3: Test EEG processing
    const processingResult = testEEGProcessing(parsedResults);
    
    // Step 4: Analyze issues
    analyzeIssues(parsedResults, processingResult);
    
    // Step 5: Recommendations
    console.log('\n💡 === Recommendations ===');
    
    const validCount = parsedResults.filter(r => r.value !== null).length;
    if (validCount === 0) {
      console.log('1. ❌ Packet parsing is completely broken - check BrainLink protocol documentation');
      console.log('2. 🔧 Verify the correct byte order and data format for your specific BrainLink model');
    } else {
      console.log(`1. ✅ Packet parsing works (${validCount}/${parsedResults.length} packets parsed)`);
    }
    
    if (processingResult) {
      const deltaPercent = (processingResult.bandPowers.delta / (processingResult.bandPowers.delta + processingResult.bandPowers.theta + processingResult.bandPowers.alpha + processingResult.bandPowers.beta + processingResult.bandPowers.gamma)) * 100;
      
      if (deltaPercent > 80) {
        console.log('2. 🔧 High delta dominance suggests:');
        console.log('   - Check for DC offset in EEG data');
        console.log('   - Verify EEG amplifier is properly connected');
        console.log('   - Consider high-pass filtering to remove DC component');
      } else {
        console.log('2. ✅ Band power distribution looks reasonable');
      }
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Run this debug on a live BLE connection to see actual device data');
    console.log('2. Add logging to BluetoothService.parseBrainLinkPacket() to see real packets');
    console.log('3. Verify BrainLink device is sending valid EEG data (not dummy/test data)');
    console.log('4. Check if device needs initialization commands to start real EEG streaming');
    
  } catch (error) {
    console.error('❌ Debug tool failed:', error);
    process.exit(1);
  }
}

// Run the debug tool
if (require.main === module) {
  main();
}

module.exports = {
  parseBrainLinkPacket,
  createTestPackets,
  testPacketParsing,
  testEEGProcessing
};
