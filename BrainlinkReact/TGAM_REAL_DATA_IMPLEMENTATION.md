# BrainLink TGAM Real Data Implementation

## Overview

This implementation adds proper TGAM (ThinkGear Application Module) protocol support to get **real EEG data** from BrainLink devices instead of dummy/demo data.

## Key Components Added

### 1. TGAM Protocol Constants (`constants/index.js`)

```javascript
// BLE Service and Characteristics UUIDs for BrainLink/NeuroSky TGAM
SERVICE_UUID: '0000ffe0-0000-1000-8000-00805f9b34fb',
DATA_CHARACTERISTIC_UUID: '0000ffe1-0000-1000-8000-00805f9b34fb',
CONTROL_CHARACTERISTIC_UUID: '0000ffe1-0000-1000-8000-00805f9b34fb',

// TGAM Protocol Commands
COMMANDS: {
  // Demo mode exit commands (critical for getting real data)
  EXIT_DEMO: Buffer.from([0xAA, 0xAA, 0x02, 0xC0, 0x00, 0x3E]),
  DISABLE_DEMO: Buffer.from([0xAA, 0xAA, 0x03, 0xC0, 0x01, 0x00, 0x3D]),
  STOP_DEMO_DATA: Buffer.from([0xAA, 0xAA, 0x02, 0xC1, 0x00, 0x3D]),
  
  // Real data streaming commands
  START_STREAM: Buffer.from([0xAA, 0xAA, 0x02, 0xC2, 0x00, 0x3C]),
  ENABLE_RAW: Buffer.from([0xAA, 0xAA, 0x02, 0xC3, 0x00, 0x3B]),
  NORMAL_MODE: Buffer.from([0xAA, 0xAA, 0x02, 0xC4, 0x00, 0x3A]),
}
```

### 2. TGAM Frame Parser (`utils/TGAMParser.js`)

**Features:**
- Parses TGAM frames with proper sync byte detection (0xAA 0xAA)
- Validates checksums to ensure data integrity
- Extracts structured data from binary packets:
  - Attention and Meditation levels (0-100)
  - Raw EEG samples (16-bit signed values)
  - EEG Power bands (Delta, Theta, Alpha, Beta, Gamma)
  - Heart rate and signal quality metrics
- Provides statistics on frame processing success/failure

**Usage:**
```javascript
const parser = new TGAMParser();
parser.onFrame((frameData) => {
  const eegData = TGAMParser.convertToEEGFormat(frameData);
  // Use real EEG data: attention, meditation, rawEEG, bandPowers, etc.
});
parser.addData(rawBluetoothData); // Feed raw BLE data
```

### 3. Real Data Hook (`hooks/useBrainLinkRealData.js`)

**React Hook Interface:**
```javascript
const {
  // Connection state
  isConnected, isConnecting, deviceName, connectionError,
  
  // Real-time EEG data
  attention, meditation, delta, theta, alpha, beta, gamma, 
  rawEEG, heartRate, poorSignal,
  
  // Data quality metrics
  signalStrength, framesPerSecond, lastUpdateTime,
  
  // Control methods
  connect, disconnect, scanForDevices
} = useBrainLinkRealData();
```

**Key Features:**
- Automatic demo mode exit on connection
- Real-time data quality monitoring
- FPS calculation for data throughput
- Signal strength assessment
- Automatic cleanup on unmount

### 4. Enhanced BluetoothService (`services/BluetoothService.js`)

**New Methods:**
- `exitDemoMode()`: Sends binary commands to exit demo/test mode
- `startRealDataStreaming()`: Initiates TGAM real data streaming
- `handleIncomingTGAMData()`: Processes raw TGAM frames
- Updated characteristic setup for proper TGAM UUIDs

**Demo Exit Sequence:**
1. Connect to device using correct TGAM service UUID
2. Send EXIT_DEMO, DISABLE_DEMO, STOP_DEMO_DATA commands
3. Send START_STREAM, ENABLE_RAW, NORMAL_MODE commands
4. Monitor for real TGAM frames instead of dummy data

### 5. Test Interface (`screens/RealDataTestScreen.js`)

**Real-time Display:**
- Connection status with visual indicators
- Signal quality assessment (Poor/Good/Excellent)
- Live mental states (Attention, Meditation, Heart Rate)
- EEG power band values (Delta through Gamma)
- TGAM parser statistics and frame rate
- Connect/Disconnect controls

## Critical Differences from Previous Implementation

### Before (Demo Mode Issue):
```
Device sends: -3499.00 µV constantly (dummy data)
Parser tries: Text-based command parsing
Result: Fake/test data that never changes
```

### After (Real TGAM Data):
```
Device setup: Binary TGAM protocol commands
Device sends: Real TGAM frames with sync bytes (0xAA 0xAA)
Parser extracts: Attention, Meditation, Raw EEG, Power Bands
Result: Live, changing EEG data reflecting real brain activity
```

## Usage Instructions

### Basic Implementation:
```javascript
import { useBrainLinkRealData } from './hooks/useBrainLinkRealData';

function MyEEGComponent() {
  const { attention, meditation, connect, isConnected } = useBrainLinkRealData();
  
  return (
    <View>
      <Button title="Connect" onPress={() => connect()} disabled={isConnected} />
      <Text>Attention: {attention}%</Text>
      <Text>Meditation: {meditation}%</Text>
    </View>
  );
}
```

### Advanced Usage:
```javascript
const {
  rawEEG, delta, theta, alpha, beta, gamma,
  signalStrength, framesPerSecond
} = useBrainLinkRealData();

// Real-time brain wave analysis
useEffect(() => {
  if (theta > alpha && attention > 60) {
    console.log('High focus detected!');
  }
}, [theta, alpha, attention]);
```

## Testing Real Data

1. **Connect to BrainLink device**
2. **Verify demo exit**: Check logs for "📤 Sending demo exit command"
3. **Monitor TGAM frames**: Look for "📦 === TGAM Packet #" in logs
4. **Validate changing values**: Attention/Meditation should vary with mental state
5. **Check signal quality**: Values should improve when device is properly positioned

## Expected Behavior

### Real Data Indicators:
- ✅ Attention values change with focus level (0-100)
- ✅ Meditation values change with relaxation (0-100) 
- ✅ Raw EEG values vary continuously (not constant -3499)
- ✅ Poor signal decreases when device positioned correctly
- ✅ Power bands show realistic EEG frequency content
- ✅ Frame rate >10 FPS indicates good data flow

### Troubleshooting:
- If still getting constant data: Device may need firmware update
- If no frames received: Check BLE characteristic UUIDs
- If connection drops: Ensure proper power management
- If poor signal: Adjust device positioning on forehead

This implementation provides the foundation for real-time EEG applications using authentic brain data from BrainLink devices.
