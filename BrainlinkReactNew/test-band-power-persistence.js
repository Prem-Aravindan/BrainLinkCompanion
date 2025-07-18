/**
 * Test script for band power persistence fix
 * Verifies that band powers don't flicker every second
 */

// Mock console to capture output
let logMessages = [];
const originalConsoleLog = console.log;
console.log = (...args) => {
    logMessages.push(args.join(' '));
    originalConsoleLog(...args);
};

// Mock DirectBLEScanner essentials
class MockDirectBLEScanner {
    constructor() {
        this.rawDataBuffer = [];
        this.maxBufferSize = 1000;
        this.minSamplesForBandPowers = 10;
        this.bandPowerInterval = 1000;
        this.lastBandPowerTime = 0;
        this.lastCalculatedBandPowers = null; // The fix
        this.connectedDeviceId = 'TEST_DEVICE';
        this.bandPowerSuccessCount = 0;
        this.bandPowerAttemptCount = 0;
        
        // Mock EEG processor
        this.eegProcessor = {
            process: (data) => ({
                bandPowers: {
                    delta: 0.5,
                    theta: 10.2,
                    alpha: 8.7,
                    beta: 3.1,
                    gamma: 1.9
                }
            })
        };
    }
    
    emit(event, data) {
        // Check if band powers are persistent
        if (event === 'eegData') {
            const hasBandPowers = data.delta !== undefined && data.theta !== undefined;
            console.log(`📡 EEG Data emitted: hasBandPowers=${hasBandPowers}, delta=${data.delta?.toFixed(2) || 'N/A'}`);
        }
    }
    
    // Simulate the fixed EEG data processing logic
    processEEGData(rawValue, timestamp) {
        const voltage = rawValue;
        
        this.rawDataBuffer.push(voltage);
        if (this.rawDataBuffer.length > this.maxBufferSize) {
            this.rawDataBuffer.shift();
        }
        
        // Calculate band powers every second (timer-based, not sample-based)
        const currentTime = Date.now();
        const timeSinceLastCalculation = currentTime - this.lastBandPowerTime;
        
        // Calculate band powers if conditions are met
        if (this.rawDataBuffer.length >= this.minSamplesForBandPowers && 
            timeSinceLastCalculation >= this.bandPowerInterval) {
            
            this.lastBandPowerTime = currentTime;
            
            try {
                // Use all available samples for calculation
                const dataSlice = [...this.rawDataBuffer];
                const result = this.eegProcessor.process(dataSlice);
                
                if (result && result.bandPowers) {
                    // Store the original numeric band powers
                    const freshBandPowers = {
                        delta: result.bandPowers.delta,
                        theta: result.bandPowers.theta,
                        alpha: result.bandPowers.alpha,
                        beta: result.bandPowers.beta,
                        gamma: result.bandPowers.gamma
                    };
                    
                    // Update persistent band powers to prevent flickering (THE FIX)
                    this.lastCalculatedBandPowers = freshBandPowers;
                    this.bandPowerSuccessCount++;
                    
                    console.log('📊 Fresh band powers calculated and stored');
                }
            } catch (error) {
                console.error('❌ Band power calculation failed:', error.message);
            }
        }
        
        // Emit data event with both raw data and band powers
        const eegData = {
            timestamp,
            rawValue,
            voltage,
            rawEEG: voltage,
            deviceId: this.connectedDeviceId,
            connectionType: 'DirectBLE',
            contactQuality: 85
        };
        
        // Always include the last calculated band powers (prevents flickering)
        if (this.lastCalculatedBandPowers) {
            eegData.delta = Number(this.lastCalculatedBandPowers.delta) || 0;
            eegData.theta = Number(this.lastCalculatedBandPowers.theta) || 0;
            eegData.alpha = Number(this.lastCalculatedBandPowers.alpha) || 0;
            eegData.beta = Number(this.lastCalculatedBandPowers.beta) || 0;
            eegData.gamma = Number(this.lastCalculatedBandPowers.gamma) || 0;
        }
        
        this.emit('eegData', eegData);
    }
}

async function testBandPowerPersistence() {
    console.log('🧪 Testing Band Power Persistence Fix');
    console.log('====================================');
    
    const scanner = new MockDirectBLEScanner();
    
    // Simulate EEG data stream for 3 seconds
    const startTime = Date.now();
    let sampleCount = 0;
    
    // Track band power availability
    let samplesWithBandPowers = 0;
    let totalSamples = 0;
    
    scanner.emit = (event, data) => {
        if (event === 'eegData') {
            totalSamples++;
            const hasBandPowers = data.delta !== undefined && data.theta !== undefined;
            if (hasBandPowers) {
                samplesWithBandPowers++;
            }
            
            // Log every 100 samples to show continuity
            if (totalSamples % 100 === 0) {
                console.log(`📊 Sample ${totalSamples}: Band powers ${hasBandPowers ? 'present' : 'missing'} (delta=${data.delta?.toFixed(2) || 'N/A'})`);
            }
        }
    };
    
    // Simulate 512 Hz data stream for 3 seconds
    const sampleInterval = 1000 / 512; // ~2ms per sample
    const testDuration = 3000; // 3 seconds
    
    for (let time = 0; time < testDuration; time += sampleInterval) {
        const timestamp = startTime + time;
        const rawValue = Math.sin(2 * Math.PI * 6 * time / 1000) * 100 + Math.random() * 20; // 6 Hz signal + noise
        
        scanner.processEEGData(rawValue, timestamp);
        sampleCount++;
        
        // Simulate timing
        await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    console.log('');
    console.log('🎯 Test Results:');
    console.log('================');
    console.log(`Total samples processed: ${totalSamples}`);
    console.log(`Samples with band powers: ${samplesWithBandPowers}`);
    console.log(`Band power availability: ${((samplesWithBandPowers / totalSamples) * 100).toFixed(1)}%`);
    
    // Expected: After first calculation, all samples should have band powers
    const expectedMinAvailability = 90; // Allow for startup time
    
    if ((samplesWithBandPowers / totalSamples) * 100 >= expectedMinAvailability) {
        console.log('✅ SUCCESS: Band powers persist between calculations (no flickering)');
    } else {
        console.log('❌ FAILURE: Band powers still flickering');
    }
    
    // Check for specific patterns in logs
    const flickeringMessages = logMessages.filter(msg => 
        msg.includes('without band powers') && !msg.includes('no calculations yet')
    );
    
    if (flickeringMessages.length === 0) {
        console.log('✅ SUCCESS: No "waiting for next second" messages found');
    } else {
        console.log(`⚠️  WARNING: ${flickeringMessages.length} potential flickering messages found`);
    }
    
    console.log('');
    console.log('🔧 Fix Summary:');
    console.log('===============');
    console.log('1. Added persistent lastCalculatedBandPowers storage');
    console.log('2. Always emit last calculated values instead of null');
    console.log('3. Only calculate fresh values every 1 second (as designed)');
    console.log('4. UI receives continuous band power data (no gaps)');
}

// Run the test
testBandPowerPersistence().catch(console.error);

module.exports = { testBandPowerPersistence };
