# Buffer Polyfill Fix for React Native/Expo

## Problem
The React Native JavaScript engine (Hermes) doesn't have Node.js's built-in `Buffer` API, which is required for the TGAM protocol implementation that handles binary data from BrainLink EEG devices.

**Error:** `ReferenceError: Property 'Buffer' doesn't exist`

## Solution
Implemented a global Buffer polyfill setup using the `buffer` npm package.

### Changes Made

1. **Added Buffer polyfill to entry point** (`index.js`):
   ```javascript
   // Set up Buffer polyfill globally before any other imports
   import { Buffer } from 'buffer';
   global.Buffer = Buffer;
   ```

2. **Updated Metro config** (`metro.config.js`):
   ```javascript
   // Add polyfills for Node.js modules
   config.resolver.alias = {
     ...config.resolver.alias,
     'buffer': require.resolve('buffer'),
   };
   ```

3. **Removed individual Buffer imports** from:
   - `services/BluetoothService.js`
   - `utils/TGAMParser.js`
   
   Since Buffer is now globally available.

4. **Dependencies** already installed:
   - `buffer: ^6.0.3` (in package.json)

### Key Benefits

- **Global availability**: Buffer is now available everywhere in the app without imports
- **Better compatibility**: Works with Hermes JavaScript engine
- **Cleaner code**: No need for individual Buffer imports in each file
- **TGAM protocol support**: Enables proper binary data handling for EEG processing

### Usage

After this fix, Buffer can be used anywhere in the app:

```javascript
// Create binary command for BLE
const command = Buffer.from([0x02, 0x00], 'binary');

// Parse incoming TGAM data
const data = Buffer.from(base64String, 'base64');
```

### Testing

To verify the fix:
1. Restart Expo development server with cleared cache: `npx expo start --clear`
2. Test BLE connection and data streaming
3. Verify no Buffer-related runtime errors

### Related Files

- **Entry point**: `index.js` (polyfill setup)
- **Metro config**: `metro.config.js` (resolver alias)
- **BLE service**: `services/BluetoothService.js` (binary commands)
- **TGAM parser**: `utils/TGAMParser.js` (frame parsing)
- **Constants**: `constants/index.js` (base64 commands)

This fix ensures the BrainLink EEG app can properly handle binary data communication with the TGAM protocol on React Native/Expo.
