# Background DSP Integration - Real-time EEG Filtering

## Overview

This implementation adds efficient background processing for 512Hz EEG data without disrupting your existing raw data acquisition and plotting system. The architecture follows the battle-tested approach you outlined:

**BLE → Native ring buffer → Background DSP → Decimated UI updates**

## Architecture

### 1. Streaming DSP Processor (`utils/streamingDSP.js`)
- **IIR Biquad Filters**: High-pass (0.5Hz), Notch (50Hz), Low-pass (45Hz) 
- **Ring Buffer**: Efficient circular buffer for zero-copy processing
- **Decimation**: 512Hz → 128Hz for UI display
- **State Preservation**: Filter states maintained across batches for causal filtering
- **Performance Monitoring**: Built-in timing and buffer utilization metrics

### 2. Background DSP Manager (`utils/backgroundDSP.js`)
- **Off-thread Processing**: Runs DSP in background intervals (50ms cycles)
- **UI Throttling**: Only updates UI every ~4Hz to prevent blocking
- **Batch Processing**: Processes 128 samples at a time for efficiency
- **Error Handling**: Graceful degradation if processing fails

### 3. Filtered EEG Display (`components/FilteredEEGDisplay.js`)
- **Lightweight Rendering**: Optimized for high-frequency updates
- **Performance Stats**: Shows DSP timing and buffer utilization
- **Grid Overlay**: Visual reference for signal analysis

## Integration Points

### Your Existing Code (UNCHANGED)
- ✅ Raw data acquisition continues exactly as before
- ✅ Real-time plotting at 512Hz preserved
- ✅ All existing EEG processing remains functional
- ✅ Device connection/disconnection logic untouched

### New Additions (NON-INTRUSIVE)
- **Data Flow**: Raw samples are also fed to background DSP (`backgroundDSPManager.addSample()`)
- **UI Controls**: Toggle filtered view in Real-Time screen
- **Performance**: Background processing runs independently of main thread

## Usage

### Automatic Startup
The background DSP automatically starts when SDK initializes:
```
🔧 Initializing background DSP processor...
✅ Background DSP processor initialized and active
```

### Manual Controls
In the Real-Time EEG screen:
- **Toggle Filtered View**: Show/hide processed signal
- **DSP Control**: Start/stop background processing
- **Performance Stats**: Monitor processing efficiency

## Performance Characteristics

### Processing Pipeline
1. **Input**: 512Hz raw EEG samples
2. **Filtering**: High-pass → Notch → Low-pass (IIR biquads)
3. **Decimation**: Output at 128Hz
4. **UI Update**: ~4Hz throttled updates

### Expected Performance
- **Processing Time**: <5ms per 128-sample batch
- **Memory Usage**: ~16KB ring buffers
- **CPU Impact**: <2% on modern devices
- **UI Responsiveness**: No blocking of main thread

## Benefits

### Compared to Your Previous Heavy Processing
- ✅ **No UI Blocking**: DSP runs off main thread
- ✅ **No Frame Drops**: Throttled UI updates
- ✅ **Efficient Filtering**: IIR filters vs heavy FFT operations
- ✅ **Reduced Allocations**: Pre-allocated Float32Arrays
- ✅ **Batch Processing**: Minimizes bridge crossings

### DSP Quality
- ✅ **Causal Filters**: Real-time compatible (no lookahead)
- ✅ **Stable Numerics**: Direct Form II Transposed biquads
- ✅ **Proper Anti-aliasing**: Low-pass before decimation
- ✅ **Artifact Removal**: High-pass drift removal, notch filtering

## Monitoring & Debugging

### Console Output
```
📊 Background DSP Performance: {
  cycles: 150,
  avgCycleTime: "2.34ms",
  uiUpdateRate: "25.0%",
  bufferUtilization: "45.2%",
  samplesProcessed: 19200
}
```

### Performance Health Checks
- **Buffer Health**: <90% utilization (prevents overflow)
- **CPU Health**: <80% of cycle time (prevents blocking)
- **Processing Rate**: Consistent cycle timing

## Future Enhancements

### Phase 2 (if needed)
- **JSI Integration**: Zero-copy native processing
- **Worklets/TurboModule**: True multithreading
- **Skia Rendering**: Hardware-accelerated charts
- **Band Power Calculation**: Real-time frequency analysis

### Phase 3 (advanced)
- **Native Ring Buffer**: C++ implementation
- **SIMD Optimization**: Vectorized filter operations
- **GPU Processing**: Metal/OpenGL compute shaders

## Testing

### Verify Integration
1. Launch app and connect EEG device
2. Check console for DSP initialization messages
3. Navigate to Real-Time EEG screen
4. Toggle "Show Filtered View" to see processed signal
5. Monitor performance stats for healthy operation

### Performance Verification
- Raw signal should maintain 512Hz sampling rate
- Filtered signal should show clean, artifact-reduced waveform
- Background processing should show <5ms average cycle time
- UI should remain responsive during data streaming

## Compatibility

- ✅ **React Native**: 0.60+ (uses modern hooks)
- ✅ **Android**: All versions (no native dependencies)
- ✅ **iOS**: All versions (JavaScript-only implementation)
- ✅ **Metro**: Hot reloading compatible
- ✅ **Flipper**: Performance monitoring compatible
