# Metro Connection Troubleshooting Guide

## ✅ Metro Connection Setup Complete!

Your BrainLink app should now be properly connected to Metro bundler.

### 🔧 What was done:
1. ✅ Metro bundler started on port 8081
2. ✅ ADB reverse port forwarding set up: `adb reverse tcp:8081 tcp:8081`
3. ✅ Device connected: Pixel 9 Pro (4C101FDAP0013S)
4. ✅ App installed and running

### 🎯 How to use:

#### To reload the app:
1. **From Metro terminal**: Press `r` 
2. **From device**: Shake the device and tap "Reload"
3. **From developer menu**: Press Menu key (or `adb shell input keyevent 82`)

#### To open developer menu:
- **Physical**: Shake the device
- **ADB**: `adb shell input keyevent 82`

### 🚨 If connection issues persist:

#### 1. Check Metro is running:
```powershell
netstat -ano | findstr ":8081.*LISTENING"
```

#### 2. Re-setup port forwarding:
```powershell
C:\Users\conta\AppData\Local\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
```

#### 3. Check device connection:
```powershell
C:\Users\conta\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
```

#### 4. Restart Metro with cache reset:
```powershell
npx react-native start --reset-cache
```

#### 5. Use the automated script:
```powershell
.\connect-metro.ps1
```

### 📱 App Features Ready:
- ✅ Python-aligned signal processing (24 features)
- ✅ Advanced EEG analysis with theta contribution tracking
- ✅ Real-time BrainLink device scanning and connection
- ✅ Comprehensive BLE reset mechanisms
- ✅ Live dashboard with raw and computed brain wave data

### 🧠 BrainLink Integration:
Your app includes sophisticated EEG processing that matches the Python implementation:
- DC removal and artifact filtering
- Notch filtering for power line interference
- Butterworth bandpass filtering with zero-phase
- Welch's method for power spectral density
- Simpson's rule integration for band powers
- Exponential smoothing for all 24 features

### 🎮 Next Steps:
1. Open the app on your Pixel 9 Pro
2. Turn on your BrainLink device
3. Tap "Start Scan" to connect
4. Watch real-time EEG data and analysis!

Happy coding! 🚀
