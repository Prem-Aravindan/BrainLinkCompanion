# 📱 Device Testing Instructions

## ✅ Build Status
- **Android APK**: Successfully built ✅ 
- **Native Module**: BrainLinkModule integrated ✅
- **Bluetooth Permissions**: Configured ✅
- **Dependencies**: All installed ✅

## 📦 APK Location
The app has been built as: `android\app\build\outputs\apk\debug\app-debug.apk`
Size: ~58 MB

## 🔧 Installation Steps

### Option 1: Manual Installation (Recommended)
1. **Enable Developer Options** on your Android device:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings > Developer Options
   - Enable "USB Debugging"

2. **Install APK**:
   - Copy `app-debug.apk` to your device
   - Open file manager and tap the APK file
   - Allow installation from unknown sources if prompted
   - Install the app

### Option 2: Using ADB (if configured)
```bash
# If you have ADB configured:
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

## 📡 Testing Bluetooth Functionality

### 1. **App Launch**
- The app should start with a login screen
- You can skip login for testing (check the app flow)

### 2. **Bluetooth Permissions**
The app will request these permissions:
- ✅ Bluetooth access
- ✅ Location access (required for BLE scanning)
- ✅ Bluetooth scan/connect (Android 12+)

### 3. **Device Detection**
- Navigate to the BrainLink dashboard
- Look for a "Connect Device" or "Scan" button
- The app should be able to scan for Bluetooth devices
- Your BrainLink device should appear in the list

### 4. **Connection Test**
- Select your BrainLink device from the list
- The app should attempt to connect using the MacrotellectLink SDK
- Check for connection status indicators

## 🔍 Testing Checklist

### Basic App Functionality:
- [ ] App launches successfully
- [ ] No crashes on startup
- [ ] Navigation between screens works
- [ ] UI elements render correctly

### Bluetooth Functionality:
- [ ] App requests Bluetooth permissions
- [ ] Bluetooth scanning works
- [ ] Devices appear in the device list
- [ ] Can attempt connection to BrainLink device
- [ ] Connection status updates properly

### Native Module Integration:
- [ ] No "Native module not found" errors
- [ ] MacrotellectLink SDK methods are callable
- [ ] Event emitters work for real-time data

## 🐛 Troubleshooting

### Common Issues:
1. **"App not installed"**: Enable installation from unknown sources
2. **Bluetooth permission denied**: Grant all requested permissions
3. **No devices found**: Ensure Bluetooth is enabled and device is in pairing mode
4. **Connection fails**: Check if device is already connected to another app

### Debug Steps:
1. Check device logs for any error messages
2. Verify BrainLink device is in pairing/discoverable mode
3. Ensure location services are enabled (required for BLE)
4. Try restarting Bluetooth on the device

## 📊 Expected Functionality

With a successful connection, you should be able to:
- View real-time EEG data
- See brainwave analysis (Alpha, Beta, Theta, Delta)
- Access device status and battery info
- View data visualization charts
- Use the various test screens for different functionalities

## 🔬 Advanced Testing

For deeper testing, try these features:
1. **Dashboard Screen**: Real-time EEG monitoring
2. **Test Screens**: Various BrainLink functionality tests
3. **Native Integration Screen**: Direct native module testing
4. **Real Data Test**: Live EEG data processing

The app includes comprehensive logging, so watch for console outputs that indicate:
- Native module availability
- Bluetooth scanning results
- Connection attempts and status
- Data reception from the BrainLink device
