# MacrotellectLink SDK Integration Guide

This document provides a complete step-by-step guide for integrating the MacrotellectLink SDK with the BrainLink React Native app.

## Current Status

✅ **COMPLETED:**
- Native module scaffolding (BrainLinkModule.java)
- React Native bridge service (BrainLinkNativeService.js)
- React hook for native integration (useBrainLinkNative.js)
- Demo dashboard screen (NativeDashboardScreen.js)
- Expo config plugin for proper module registration

🔄 **PENDING:**
- MacrotellectLink SDK JAR integration
- Actual SDK method calls (currently commented out)
- Testing on real devices

## Prerequisites

1. **MacrotellectLink SDK JAR file** (required from Macrotellect)
2. **SDK Documentation/JavaDoc** (helpful for proper implementation)
3. **Android development environment** (Android Studio, SDK)
4. **Expo Dev Client** (for native module support)

## Step 1: Obtain the MacrotellectLink SDK

Contact Macrotellect to obtain:
- `macrotellect-link-sdk.jar` (or similar)
- API documentation
- Sample Android integration code
- Any required dependencies

## Step 2: Add SDK to Android Project

1. Create the libs directory:
```bash
mkdir -p android/app/libs
```

2. Copy the SDK JAR file:
```bash
cp path/to/macrotellect-link-sdk.jar android/app/libs/
```

3. Update `android/app/build.gradle`:
```gradle
dependencies {
    implementation files('libs/macrotellect-link-sdk.jar')
    // Add any other SDK dependencies here
}
```

## Step 3: Update Native Module

Edit `android/app/src/main/java/com/brainlinkcompanion/BrainLinkModule.java`:

1. **Uncomment SDK imports** (lines 12-16):
```java
import com.macrotellect.domain.model.multi.EEGData;
import com.macrotellect.domain.model.multi.EEGPowerData;
import com.macrotellect.link.LinkManager;
import com.macrotellect.link.listener.OnLinkDataListener;
import com.macrotellect.link.listener.OnMultiEEGPowerDataListener;
```

2. **Uncomment SDK initialization** (lines 45-47 in initializeSDK method):
```java
LinkManager.init(reactContext);
LinkManager.setWhiteList("BrainLink_pro,BrainLink_Lite");
```

3. **Uncomment SDK method calls** throughout the file:
   - `LinkManager.startScan()` in startScan method
   - `LinkManager.stopScan()` in stopScan method
   - `LinkManager.connectDevice(deviceMac)` in connectToDevice method
   - `LinkManager.disconnectDevice()` in disconnectDevice method

4. **Uncomment data listeners** (lines 130-200 in setupDataListeners method):
   - OnLinkDataListener for attention, meditation, raw data, signal quality, heart rate
   - OnMultiEEGPowerDataListener for EEG band powers

## Step 4: Add Required Permissions

Update `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## Step 5: Build Development Client

1. **Install dependencies:**
```bash
npm install
```

2. **Create development build:**
```bash
# For Android
eas build --platform android --profile development

# Or local build (requires Android Studio)
npx expo run:android
```

## Step 6: Test Integration

1. **Test app with NativeDashboardScreen:**
```javascript
// Add to your navigation or replace existing dashboard
import { NativeDashboardScreen } from './screens/NativeDashboardScreen';

// Use in your app
<NativeDashboardScreen />
```

2. **Monitor logs:**
```bash
# React Native logs
npx expo start

# Android logs
adb logcat | grep BrainLinkModule
```

## Step 7: SDK Method Mapping

Based on typical MacrotellectLink SDK, here's the expected method mapping:

### Device Management
| React Native Method | SDK Method | Purpose |
|-------------------|------------|---------|
| `initializeSDK()` | `LinkManager.init()` | Initialize SDK |
| `startScan()` | `LinkManager.startScan()` | Scan for devices |
| `stopScan()` | `LinkManager.stopScan()` | Stop scanning |
| `connectToDevice()` | `LinkManager.connectDevice()` | Connect to device |
| `disconnectDevice()` | `LinkManager.disconnectDevice()` | Disconnect device |

### Data Listeners
| React Native Event | SDK Listener | Data Type |
|-------------------|-------------|-----------|
| `BrainLinkData` (type: 'brainwave') | `OnLinkDataListener.onBrainWavedata()` | Attention, Meditation |
| `BrainLinkData` (type: 'raw') | `OnLinkDataListener.onRawData()` | Raw EEG |
| `BrainLinkData` (type: 'signal') | `OnLinkDataListener.onSignalQuality()` | Signal quality |
| `BrainLinkData` (type: 'heartrate') | `OnLinkDataListener.onHeartRate()` | Heart rate |
| `BrainLinkData` (type: 'eegpower') | `OnMultiEEGPowerDataListener.onMultiEEGPowerData()` | Band powers |

## Step 8: Replace Legacy Code

Once the native integration is working:

1. **Update App.js or main navigation** to use `NativeDashboardScreen`
2. **Remove old TGAM/BLE dependencies:**
   - `services/BluetoothService.js` (legacy BLE)
   - `utils/TGAMParser.js` (legacy parser)
   - `hooks/useBrainLinkRealData.js` (legacy hook)
3. **Update imports** throughout the app

## Expected Data Format

The native module will emit events with this structure:

```javascript
// Attention/Meditation data
{
  type: 'brainwave',
  attention: 65,      // 0-100
  meditation: 45,     // 0-100
  timestamp: 1703123456789
}

// Raw EEG data
{
  type: 'raw',
  rawEEG: -1234,      // Raw EEG value
  timestamp: 1703123456789
}

// Signal quality
{
  type: 'signal',
  signalQuality: 25,  // 0 = best, 200 = worst
  timestamp: 1703123456789
}

// EEG Band Powers
{
  type: 'eegpower',
  delta: 12345.67,
  theta: 23456.78,
  alpha: 34567.89,
  beta: 45678.90,
  gamma: 56789.01,
  timestamp: 1703123456789
}
```

## Troubleshooting

### Common Issues

1. **"Native module not found"**
   - Ensure development build includes the native module
   - Check that BrainLinkPackage is registered in MainApplication.java

2. **"SDK initialization failed"**
   - Verify JAR file is in android/app/libs/
   - Check gradle dependencies
   - Ensure permissions are granted

3. **"No devices found"**
   - Check Bluetooth permissions
   - Ensure BrainLink device is in pairing mode
   - Verify device whitelist in SDK initialization

4. **"Connection fails"**
   - Check device MAC address format
   - Ensure device is not connected to another app
   - Verify device authorization (HWID if required)

### Debug Steps

1. **Check native module registration:**
```bash
adb shell am start -n com.mindspellerbv.brainlinkreact/.MainActivity -e "debug" "true"
```

2. **Monitor native logs:**
```bash
adb logcat | grep -E "(BrainLinkModule|MacrotellectLink|LinkManager)"
```

3. **Test SDK directly in Android:**
Create a simple Android test app to verify SDK functionality before React Native integration.

## Files Modified/Created

### New Files
- `android/app/src/main/java/com/brainlinkcompanion/BrainLinkModule.java`
- `android/app/src/main/java/com/brainlinkcompanion/BrainLinkPackage.java`
- `services/BrainLinkNativeService.js`
- `hooks/useBrainLinkNative.js`
- `screens/NativeDashboardScreen.js`
- `plugins/withBrainLinkModule.js`

### Modified Files
- `app.json` (added native module plugin)

## Next Steps

1. **Obtain MacrotellectLink SDK** from vendor
2. **Follow steps 1-5** to integrate SDK
3. **Test on Android device** with actual BrainLink hardware
4. **Replace legacy BLE/TGAM code** once native integration works
5. **Optimize data processing** and UI based on real device performance

## Benefits of Native Integration

✅ **Reliability:** Direct SDK integration eliminates BLE protocol issues
✅ **Performance:** Native code handles data processing efficiently  
✅ **Maintenance:** Single source of truth for device communication
✅ **Features:** Access to all SDK capabilities (firmware updates, diagnostics, etc.)
✅ **Stability:** No more connection drops or parsing errors
