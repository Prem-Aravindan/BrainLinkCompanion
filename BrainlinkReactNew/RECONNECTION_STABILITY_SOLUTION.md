# BrainLink Reconnection Stability Solution

## Problem Analysis
On reconnection, the device connects but shows unrelated/fake signal data and disconnects after a few seconds. This indicates:

1. **Data Validation Issues**: App accepting invalid/cached data during reconnection
2. **Connection State Management**: Poor handling of connection transitions
3. **Event Listener Conflicts**: Stale event listeners causing data conflicts
4. **Native Module State**: Connection state inconsistency between JS and native layers

## Root Cause
The app is not properly validating incoming data during reconnection, allowing:
- Cached/demo data to be plotted
- Invalid data patterns to be accepted
- Connection state mismatches between JS and native

## Solution: Enhanced Data Validation & Connection Management

### 1. Strict Data Validation (CRITICAL)
```javascript
// Enhanced data validation in handleEEGData
const handleEEGData = useCallback((rawData) => {
  // CRITICAL: Only process data when truly connected
  if (connectionStatus !== 'connected') {
    console.log('🛑 BLOCKING data - not connected:', connectionStatus);
    return;
  }
  
  // ENHANCED: Reject demo/test/fake data
  if (rawData.isDemo || rawData.isDemoMode || rawData.demo === true ||
      rawData.testMode || rawData.isFakeData || rawData.isTestData) {
    console.log('🚫 Rejecting demo/test data during reconnection');
    return;
  }
  
  // ENHANCED: Detect repetitive patterns (cached data)
  const recentValues = rawBufferRef.current.slice(-10);
  if (recentValues.length >= 5) {
    const isConstant = recentValues.every(val => val === rawData.rawValue);
    const isRepeating = recentValues.filter(val => val === rawData.rawValue).length >= 8;
    
    if (isConstant || isRepeating) {
      console.log('🚫 Rejecting repetitive/cached data pattern:', rawData.rawValue);
      return;
    }
  }
  
  // Continue with normal processing...
}, [connectionStatus]);
```

### 2. Connection State Management
```javascript
// Enhanced connection event handler
const connectionListener = DeviceEventEmitter.addListener('BrainLinkConnection', (status) => {
  // Block events during manual disconnect
  if (manualDisconnectFlag.current || userDisconnectedIntentionally.current) {
    console.log('🚫 BLOCKING connection event - manual disconnect active');
    return;
  }
  
  // Enhanced debouncing (500ms instead of 100ms)
  const now = Date.now();
  const timeSinceLastEvent = now - (window.lastConnectionEventTime || 0);
  if (timeSinceLastEvent < 500) {
    console.log('🚫 Ignoring rapid connection event');
    return;
  }
  window.lastConnectionEventTime = now;
  
  if (status.isConnected === true || status.status === 'connected') {
    // Wait for connection stabilization before accepting
    setTimeout(() => {
      if (!manualDisconnectFlag.current && !userDisconnectedIntentionally.current) {
        setConnectionStatus('connected');
        clearAllData(); // Clear stale data for fresh connection
        console.log('✅ Connection validated and data cleared');
      }
    }, 1000); // 1 second stabilization
  }
});
```

### 3. Enhanced Disconnect Process
```javascript
const stableDisconnect = async () => {
  // Immediate protection
  manualDisconnectFlag.current = true;
  userDisconnectedIntentionally.current = true;
  setConnectionStatus('disconnecting');
  
  // Clear all data immediately
  clearAllData();
  removeEventListeners();
  
  // Native disconnect sequence
  try {
    if (BrainLinkModule?.stopEEGDataCollection) {
      await BrainLinkModule.stopEEGDataCollection();
    }
    if (BrainLinkModule?.emergencyDisconnect) {
      await BrainLinkModule.emergencyDisconnect();
    }
    if (BrainLinkModule?.unpairCurrentDevice) {
      await BrainLinkModule.unpairCurrentDevice();
    }
  } catch (error) {
    console.log('Disconnect error (may be expected):', error.message);
  }
  
  // Extended stabilization before allowing reconnection
  setTimeout(() => {
    manualDisconnectFlag.current = false;
    restoreEventListeners();
  }, 3000);
  
  setTimeout(() => {
    userDisconnectedIntentionally.current = false;
  }, 5000);
};
```

## Implementation Steps

1. **Fix Syntax Errors** - Clean up broken code structure first
2. **Implement Enhanced Data Validation** - Add strict validation to handleEEGData
3. **Upgrade Connection Management** - Enhance connection event handling
4. **Add Connection Stabilization** - Wait for stable connection before accepting data
5. **Implement Stable Disconnect** - Proper disconnect sequence with extended delays

## Expected Results

After implementation:
- No more fake/cached data during reconnection
- Stable connections without premature disconnection
- Clean data flow with proper validation
- Improved connection stability during reconnection scenarios

## Testing Protocol

1. Connect device and verify real data
2. Disconnect manually 
3. Reconnect and verify:
   - No fake/cached data appears
   - Real EEG data starts immediately
   - Connection remains stable (no auto-disconnect)
   - Data validation logs show rejections of invalid data

This solution addresses the core reconnection stability issues while maintaining the 512Hz data processing capability.
