# BrainLink Companion React Native App - Development Guide

## Current Status

✅ **Completed Features:**
- React Native Expo project setup
- User authentication with environment selection (EN/NL/Local)
- Bluetooth service for BrainLink device communication
- Real-time EEG data processing and visualization
- Dashboard with device connection management
- Frequency band power analysis
- Modular component architecture

## Project Structure

```
BrainlinkReact/
├── App.js                     # Main app entry point
├── components/                # Reusable UI components
│   ├── EEGChart.js            # Real-time EEG signal chart
│   ├── BandPowerDisplay.js    # Frequency band visualization
│   └── DeviceListModal.js     # Bluetooth device selection
├── screens/                   # Main application screens
│   ├── LoginScreen.js         # Authentication interface
│   └── DashboardScreen.js     # Device monitoring dashboard
├── services/                  # External integrations
│   ├── ApiService.js          # Backend API communication
│   └── BluetoothService.js    # Bluetooth device management
├── utils/                     # Utility functions
│   └── EEGProcessor.js        # EEG signal processing
└── constants/                 # Configuration
    └── index.js              # App constants and settings
```

## Node.js Version Issue

⚠️ **Current Issue:** The project requires Node.js 18+ but the current environment has Node.js 16.13.0.

### Solutions:

#### Option 1: Update Node.js (Recommended)
1. Download and install Node.js 18+ from https://nodejs.org/
2. Restart your terminal/VS Code
3. Run: `npm install`
4. Start development server: `npx expo start`

#### Option 2: Use Node Version Manager (Windows)
```powershell
# Install nvm-windows from https://github.com/coreybutler/nvm-windows
nvm install 18
nvm use 18
cd m:\CODEBASE\brainlink_companion_app\BrainlinkReact
npm install
npx expo start
```

#### Option 3: Use Compatible Versions
If you must use Node.js 16, downgrade some dependencies:
```powershell
npm install expo@49 react-native@0.72 --save
npm install
npx expo start
```

## Development Commands

```powershell
# Install dependencies
npm install

# Start development server
npx expo start

# Run on Android emulator
npx expo start --android

# Run on iOS simulator (macOS only)
npx expo start --ios

# Build for production
npx expo build:android
npx expo build:ios
```

## Key Features Implemented

### 1. Authentication System
- Environment selection (EN/NL/Local APIs)
- JWT token management
- Session persistence
- User validation

### 2. Bluetooth Integration
- Device discovery and pairing
- BrainLink device filtering
- Connection management
- Data streaming

### 3. EEG Processing
- Real-time signal filtering
- Frequency band analysis (Delta, Theta, Alpha, Beta, Gamma)
- Artifact detection
- Signal quality monitoring

### 4. Data Visualization
- Live EEG waveform charts
- Frequency band power bars
- Connection status indicators
- Recording controls

### 5. Cross-Platform Support
- iOS and Android compatibility
- Responsive design
- Platform-specific permissions

## Testing the Application

### 1. Authentication Flow
1. Select API environment (EN/NL/Local)
2. Enter test credentials
3. Verify successful login and token storage

### 2. Bluetooth Connection
1. Turn on BrainLink device
2. Enable Bluetooth on mobile device
3. Tap "Connect Device"
4. Select device from discovery list
5. Verify connection status

### 3. Data Visualization
1. Connect to BrainLink device
2. Start recording session
3. Observe real-time EEG chart
4. Monitor frequency band powers
5. Test recording start/stop

## Next Steps

### Immediate (After Node.js Update)
1. Start development server: `npx expo start`
2. Test on device/simulator using Expo Go app
3. Verify all components render correctly
4. Test authentication flow

### Testing Phase
1. Test with actual BrainLink hardware
2. Validate EEG data processing accuracy
3. Test Bluetooth connectivity on different devices
4. Performance optimization for real-time data

### Production Deployment
1. Configure app signing for iOS/Android
2. Set up build pipeline with EAS Build
3. Submit to app stores
4. Set up analytics and crash reporting

## Troubleshooting

### Common Issues
1. **Node Version Error**: Update to Node.js 18+
2. **Bluetooth Permissions**: Check Android permissions
3. **Chart Not Rendering**: Verify react-native-svg installation
4. **API Connection**: Check environment configuration

### Debug Mode
1. Open Expo development menu (shake device)
2. Enable "Debug JS Remotely"
3. Check browser console for errors
4. Use React Native Debugger for advanced debugging

## Configuration Notes

### API Endpoints
- **EN_PROD**: Production English environment
- **NL_PROD**: Production Dutch environment  
- **LOCAL**: Development server (127.0.0.1:5000)

### EEG Settings
- **Sampling Rate**: 256 Hz
- **Window Size**: 256 samples (1 second)
- **Frequency Bands**: Delta (0.5-4Hz), Theta (4-8Hz), Alpha (8-12Hz), Beta (12-30Hz), Gamma (30-100Hz)

### Bluetooth Configuration
- **Device Names**: ["brainlink", "BrainLink", "BL"]
- **Connection Timeout**: 10 seconds
- **Auto-reconnect**: Enabled

This React Native conversion provides a solid foundation for the BrainLink Companion app with cross-platform mobile support, real-time EEG visualization, and comprehensive device management capabilities.
