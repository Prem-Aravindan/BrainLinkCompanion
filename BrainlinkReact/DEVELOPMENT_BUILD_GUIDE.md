# BrainLink React Native - Development Build Guide

## Option 1: EAS Development Build (Recommended for testing Bluetooth)

### Build Development APK
```bash
npx eas build --platform android --profile development
```

This will create a development build that includes:
- Native Bluetooth modules (react-native-ble-plx)
- Debug capabilities
- Development client for Expo dev tools

### Install the Development Client
1. Download the APK from EAS dashboard
2. Install on Android device: `adb install path/to/your-app.apk`
3. Run `npx expo start --dev-client` to connect

## Option 2: Local Android Development (Requires Android Studio)

### Prerequisites
1. **Install Android Studio**
   - Download from https://developer.android.com/studio
   - Install Android SDK and tools
   - Set up environment variables (ANDROID_HOME, PATH)

2. **Install Java Development Kit (JDK)**
   - Download JDK 11 or higher
   - Set JAVA_HOME environment variable

### Build Process
```bash
# 1. Prebuild native Android project
npx expo prebuild --platform android --clean

# 2. Build APK using Expo CLI
npx expo run:android

# Or build using Gradle directly
cd android
./gradlew assembleDebug
```

## Testing Bluetooth Functionality

### Real Device Testing
1. Enable Developer Options on Android device
2. Enable USB Debugging
3. Connect device via USB
4. Install and run the development build
5. Test Bluetooth scanning and connection to BrainLink device

### Simulation Testing
- The app includes simulation mode when Bluetooth is unavailable
- Useful for UI testing and development without hardware

## Build Configuration

### Key Files
- `app.json`: App configuration, permissions, plugins
- `eas.json`: EAS build profiles
- `package.json`: Dependencies and scripts

### Bluetooth Permissions (Android)
- `BLUETOOTH` - Basic Bluetooth operations
- `BLUETOOTH_ADMIN` - Bluetooth discovery and pairing
- `BLUETOOTH_CONNECT` - Connect to Bluetooth devices (Android 12+)
- `BLUETOOTH_SCAN` - Scan for Bluetooth devices (Android 12+)
- `ACCESS_COARSE_LOCATION` - Required for Bluetooth discovery
- `ACCESS_FINE_LOCATION` - Precise location for Bluetooth

## Troubleshooting

### Common Issues
1. **Bluetooth not working in Expo Go**: Native modules not available
2. **Permission denied**: Ensure all Bluetooth permissions are granted
3. **Build failures**: Check native dependencies and Android SDK version

### Solutions
- Use development build instead of Expo Go for native features
- Test on real Android device (Bluetooth simulator limitations)
- Check Android API level compatibility (minimum API 21)

## Next Steps
1. Build development APK with EAS
2. Test Bluetooth functionality on real device
3. Debug any remaining issues
4. Create production build when ready
