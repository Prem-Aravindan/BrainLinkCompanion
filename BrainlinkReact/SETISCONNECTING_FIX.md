# Fix for setIsConnecting ReferenceError

## Problem
```
ReferenceError: Property 'setIsConnecting' doesn't exist, js engine: hermes
```

## Root Cause
The error was caused by a mismatch between import/export declarations and leftover state management code from the old implementation.

### Issues Fixed:

1. **Export/Import Mismatch**: 
   - `useBrainLinkRealData.js` was using `export default`
   - `DashboardScreen.js` was importing as named export `{ useBrainLinkRealData }`

2. **Old State Management Code**: 
   - DashboardScreen still had old `useEffect` code trying to manage connection state manually
   - This was interfering with the new hook-based state management

## Solution

### 1. Fixed Export Declaration
**File**: `hooks/useBrainLinkRealData.js`
```javascript
// Before (causing import issue)
export default useBrainLinkRealData;

// After (matches named import)
export { useBrainLinkRealData };
```

### 2. Cleaned Up Old State Management
**File**: `screens/DashboardScreen.js`

**Removed**:
- Old connection status listener
- Manual `setIsConnecting(false)` calls
- Old data listener setup
- Periodic button state reset timer
- Manual state management in `useEffect`

**Kept**:
- Bluetooth service initialization
- Basic UI state management (bluetooth availability, disconnecting states)

### 3. Simplified useEffect
```javascript
useEffect(() => {
  // Only handle Bluetooth service initialization
  const initializeBluetooth = async () => {
    try {
      setBluetoothStatus('Initializing...');
      const initialized = await BluetoothService.initialize();
      if (!initialized) {
        console.warn('Bluetooth service failed to initialize');
        setBluetoothAvailable(false);
        setBluetoothStatus('Not Available');
      } else {
        setBluetoothAvailable(true);
        setBluetoothStatus('Ready');
      }
    } catch (error) {
      console.error('Bluetooth initialization failed:', error);
      setBluetoothAvailable(false);
      setBluetoothStatus(`Error: ${error.message}`);
    }
  };
  
  initializeBluetooth();

  // Cleanup is handled by the useBrainLinkRealData hook
}, []);
```

## Why This Fixes the Issue

1. **Correct Import/Export**: The hook can now be properly imported and its state variables accessed
2. **Single Source of Truth**: Connection state is now managed entirely by the `useBrainLinkRealData` hook
3. **No State Conflicts**: Removed duplicate state management that was trying to modify non-existent setters

## Hook State Management
The `useBrainLinkRealData` hook now handles:
- `isConnected` - connection status
- `isConnecting` - connection attempt in progress  
- `deviceName` - connected device name
- `connectionError` - any connection errors
- `eegData` - live EEG data from TGAM parser
- `dataQuality` - signal quality metrics

## Files Modified
- ✅ `hooks/useBrainLinkRealData.js` - Fixed export declaration
- ✅ `screens/DashboardScreen.js` - Removed old state management code
- ✅ `hooks/index.js` - Export matches the new declaration

## Result
The `setIsConnecting` error is resolved and the app should now properly:
- Connect to BrainLink devices
- Display connection status
- Show real TGAM EEG data
- Handle disconnections gracefully

The state management is now properly centralized in the hook with no conflicts.
