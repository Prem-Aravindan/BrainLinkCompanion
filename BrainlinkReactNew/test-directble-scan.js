/**
 * Test script for DirectBLE scanning functionality
 * Helps debug why BrainLink devices aren't being detected
 */

// Mock React Native BLE manager for testing
class MockBleManager {
    startDeviceScan(serviceUUIDs, options, callback) {
        console.log('🔍 Mock BLE scan started with options:', options);
        
        // Simulate discovering various devices including BrainLink
        const mockDevices = [
            { id: 'AA:BB:CC:DD:EE:FF', name: 'Samsung Galaxy', rssi: -45 },
            { id: 'BB:CC:DD:EE:FF:00', name: null, rssi: -67 },
            { id: 'CC:36:16:34:69:38', name: 'BrainLink_Pro', rssi: -58 }, // Your device
            { id: 'DD:EE:FF:00:11:22', name: 'Unknown Device', rssi: -80 },
            { id: 'EE:FF:00:11:22:33', name: 'BL-12345', rssi: -72 },
            { id: 'FF:00:11:22:33:44', name: 'MacroTellect_EEG', rssi: -65 }
        ];
        
        // Simulate device discovery over time
        mockDevices.forEach((device, index) => {
            setTimeout(() => {
                callback(null, device);
            }, (index + 1) * 500); // Stagger discoveries every 500ms
        });
        
        return {
            remove: () => console.log('🛑 Mock scan stopped')
        };
    }
}

// Mock the DirectBLE scanner core functionality
class MockDirectBLEScanner {
    constructor() {
        this.foundDevices = new Map();
        this.authorizedHWIDs = ['69:38'];
        this.bleManager = new MockBleManager();
    }
    
    isBrainLinkDevice(device) {
        if (!device) return false;

        const name = device.name || '';
        const id = device.id || '';

        // Common BrainLink device patterns
        const brainlinkPatterns = [
            /brainlink/i,
            /brain.?link/i,
            /macrotellect/i,
            /BL-/i,
            /BrainLink_Pro/i,
            /BrainLink_Lite/i
        ];

        const isBrainLink = brainlinkPatterns.some(pattern => 
            pattern.test(name) || pattern.test(id)
        );

        if (!isBrainLink) {
            // Debug: Log details for devices that don't match patterns
            if (name || id) {
                console.log(`🔍 Device doesn't match BrainLink patterns: "${name}" (${id})`);
            }
            return false;
        }

        // Check HWID authorization (last 5 digits of MAC address)
        const isAuthorized = this.isAuthorizedHWID(id);
        
        if (isAuthorized) {
            console.log('✅ Authorized BrainLink device:', { id, name });
        } else {
            console.log('⚠️ Unauthorized BrainLink device detected:', { id, name });
            console.log('🔐 Device HWID not in authorized list');
            // TEMPORARILY ALLOW UNAUTHORIZED DEVICES FOR DEBUGGING
            console.log('🔧 Debug mode: Allowing unauthorized device for testing');
        }

        // Return true for any BrainLink device (authorized or not) for debugging
        return isBrainLink;
    }
    
    isAuthorizedHWID(deviceId) {
        if (!deviceId) return false;
        
        const last5Digits = deviceId.slice(-5); // Get last 5 characters (XX:XX)
        const isAuthorized = this.authorizedHWIDs.includes(last5Digits);
        
        console.log(`🔐 HWID Check: ${deviceId} -> ${last5Digits} -> ${isAuthorized ? 'AUTHORIZED' : 'UNAUTHORIZED'}`);
        
        return isAuthorized;
    }
    
    async testScan() {
        console.log('🧪 Testing DirectBLE Scanner Device Detection');
        console.log('=============================================');
        
        let devicesFound = 0;
        let brainLinkDevicesFound = 0;
        
        return new Promise((resolve) => {
            const subscription = this.bleManager.startDeviceScan(
                null,
                { allowDuplicates: true, scanMode: 'lowLatency' },
                (error, device) => {
                    if (error) {
                        console.error('❌ Scan error:', error);
                        return;
                    }
                    
                    if (device) {
                        devicesFound++;
                        console.log(`📱 Device ${devicesFound}: "${device.name || 'Unknown'}" (${device.id}) RSSI: ${device.rssi}`);
                        
                        if (this.isBrainLinkDevice(device)) {
                            brainLinkDevicesFound++;
                            console.log(`🧠 BrainLink device #${brainLinkDevicesFound} detected!`);
                            
                            if (!this.foundDevices.has(device.id)) {
                                this.foundDevices.set(device.id, device);
                                console.log(`✅ Added to found devices: ${device.name || 'Unknown'}`);
                            }
                        }
                    }
                }
            );
            
            // Stop scan after 5 seconds
            setTimeout(() => {
                subscription.remove();
                
                console.log('');
                console.log('🎯 Scan Results Summary:');
                console.log('========================');
                console.log(`Total devices discovered: ${devicesFound}`);
                console.log(`BrainLink devices found: ${brainLinkDevicesFound}`);
                console.log(`Devices in found list: ${this.foundDevices.size}`);
                
                if (brainLinkDevicesFound > 0) {
                    console.log('');
                    console.log('✅ SUCCESS: BrainLink devices detected');
                    console.log('Found devices:');
                    this.foundDevices.forEach((device, id) => {
                        console.log(`  - ${device.name || 'Unknown'} (${id})`);
                    });
                } else {
                    console.log('');
                    console.log('❌ ISSUE: No BrainLink devices detected');
                    console.log('');
                    console.log('🔧 Troubleshooting suggestions:');
                    console.log('1. Ensure BrainLink device is powered on');
                    console.log('2. Check device name patterns in isBrainLinkDevice()');
                    console.log('3. Verify HWID authorization list');
                    console.log('4. Check Bluetooth permissions');
                }
                
                resolve({
                    totalDevices: devicesFound,
                    brainLinkDevices: brainLinkDevicesFound,
                    foundDevices: Array.from(this.foundDevices.values())
                });
            }, 5000);
        });
    }
}

async function testDirectBLEScanning() {
    const scanner = new MockDirectBLEScanner();
    const results = await scanner.testScan();
    
    console.log('');
    console.log('🔍 Analysis:');
    console.log('===========');
    
    if (results.brainLinkDevices === 0) {
        console.log('⚠️  No BrainLink devices found in simulation');
        console.log('    This suggests either:');
        console.log('    a) Device name patterns need updating');
        console.log('    b) HWID authorization is too restrictive');
        console.log('    c) Real device isn\'t broadcasting correctly');
    } else {
        console.log('✅ BrainLink detection logic is working');
        console.log('    If real scan fails, check:');
        console.log('    - Bluetooth permissions');
        console.log('    - Device power state');
        console.log('    - BLE manager initialization');
    }
}

// Run the test
if (require.main === module) {
    testDirectBLEScanning().catch(console.error);
}

module.exports = { testDirectBLEScanning };
