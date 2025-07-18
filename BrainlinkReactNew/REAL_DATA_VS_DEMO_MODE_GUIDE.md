# Real Data vs Demo Mode - Complete Guide

## Overview

The BrainLink app has two distinct data modes:

1. **REAL DATA MODE** - Uses MacrotellectLink SDK (like Python BrainLinkParser)
2. **DEMO MODE** - Uses DirectBLE fallback (bypasses SDK)

## Key Differences

### REAL DATA MODE (MacrotellectLink SDK)
- **Connection Method**: Uses `LinkManager.init()` from MacrotellectLink SDK
- **Data Quality**: Real EEG data from BrainLink device
- **Band Power Values**: Realistic ranges (thousands to millions)
- **Battery Detection**: Accurate battery percentage (1-99% for real devices)
- **Contact Quality**: Proper signal quality monitoring
- **Exits Demo Mode**: Device automatically exits demo mode when SDK connects

### DEMO MODE (DirectBLE Fallback)
- **Connection Method**: Uses `react-native-ble-plx` directly
- **Data Quality**: Fake/random demo data
- **Band Power Values**: Unrealistic small values (3%, 16%, etc.)
- **Battery Detection**: Shows 0% or 100% (demo indicators)
- **Contact Quality**: Simulated
- **Stays in Demo Mode**: Device remains in demo mode

## Why DirectBLE is Demo Mode

When you connect to a BrainLink device using DirectBLE (bypassing the SDK), the device stays in demo mode because:

1. **No SDK Authentication**: The MacrotellectLink SDK contains authentication logic
2. **Missing Initialization**: The SDK sends specific commands to exit demo mode
3. **Protocol Differences**: DirectBLE uses raw BLE characteristics, not the SDK protocol

## Current Implementation Status

### MacrotellectLink SDK Integration ✅
- Native Android module properly implemented
- Uses actual JAR API methods verified from MacrotellectLink_V1.4.3.jar
- Proper LinkManager initialization with `LinkManager.init(context)`
- Correct listener interfaces (EEGPowerDataListener, OnConnectListener)
- Real BrainWave data fields: signal, att, med, delta, theta, etc.

### Issue: SDK Service Initialization
The SDK sometimes fails to initialize due to:
- Android Bluetooth service not ready
- Native service binding issues
- Timing problems with EventEmitter listeners

When this happens, the app falls back to DirectBLE, which connects in demo mode.

## How to Ensure Real Data Mode

### 1. Check Connection Mode in UI
The dashboard now shows:
- 🟢 **REAL EEG DATA** - MacrotellectLink SDK active
- 🟠 **DEMO MODE** - DirectBLE fallback active
- ⚪ **NOT INITIALIZED** - Service not ready

### 2. Force SDK Initialization
If you see "DEMO MODE", tap the **"Force Real Data Mode"** button to:
- Reset SDK initialization
- Retry with longer timeouts
- Skip DirectBLE fallback

### 3. App Restart
If force initialization fails:
1. Ensure BrainLink device is turned on and nearby
2. Restart the app completely
3. Allow up to 10 seconds for SDK initialization

### 4. Battery Level Verification
Real devices show battery levels between 1-99%:
- ✅ **56%** = Real device
- ❌ **0%** or **100%** = Demo mode

## Technical Details

### MacrotellectLink SDK API (Verified from JAR)
```java
// Initialization
LinkManager linkManager = LinkManager.init(context);
linkManager.setDebug(true);
linkManager.setMaxConnectSize(1);
linkManager.setWhiteList("BrainLink_pro,BrainLink_Lite");

// Data listener
linkManager.setMultiEEGPowerDataListener(new EEGPowerDataListener() {
    @Override
    public void onBrainWavedata(String mac, BrainWave brainWave) {
        // Real EEG data with actual fields:
        // signal, att, med, delta, theta, lowAlpha, highAlpha, etc.
    }
});

// Start scanning and auto-connect
linkManager.startScan();
```

### DirectBLE Implementation (Demo Mode)
```javascript
// Direct BLE connection (bypasses SDK)
const device = await bleManager.connectToDevice(deviceId);
// Device stays in demo mode, sends fake data
```

## Troubleshooting

### If Stuck in Demo Mode
1. **Check device power**: Ensure BrainLink device is on
2. **Restart app**: Force-close and restart
3. **Check logs**: Look for "MacrotellectLink SDK service ready timeout"
4. **Battery check**: Real devices show 1-99% battery

### If Band Powers Look Wrong
- **Real data**: Values in thousands (e.g., 45000, 23000)
- **Demo data**: Small percentages (e.g., 3%, 16%)
- **Check connection mode**: Should show "REAL EEG DATA"

## Expected Behavior

### Startup Sequence (Real Data Mode)
1. ✅ MacrotellectLink SDK initializes
2. ✅ Native service ready event received
3. ✅ Device scanning starts via SDK
4. ✅ BrainLink device auto-connects
5. ✅ Real EEG data streaming begins
6. ✅ Battery shows actual level (e.g., 56%)

### Fallback Sequence (Demo Mode)
1. ❌ MacrotellectLink SDK initialization timeout
2. ⚠️ Falling back to DirectBLE
3. ⚠️ Device connects in demo mode
4. ⚠️ Fake EEG data streaming
5. ⚠️ Battery shows 0% or 100%

## Conclusion

The key to getting real EEG data is ensuring the MacrotellectLink SDK initializes properly. When it fails, the app falls back to DirectBLE, which connects devices in demo mode with fake data.

Always check the connection mode indicator in the UI and use the force initialization button if needed.
