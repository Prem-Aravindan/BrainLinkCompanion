# Filtered EEG Streaming Pipeline (React Native)

This document explains how the app ingests raw EEG samples from the BrainLink device, filters them in a streaming pipeline, and renders a smooth, rate-accurate filtered plot alongside the raw EEG.

## Overview

- Source: Native BLE events deliver raw samples at ~512 Hz.
- Ingestion: Raw samples are fed to a background DSP manager unthrottled to avoid starvation.
- DSP: A Python-inspired chain removes artifacts, applies a 50 Hz notch, then a 1–45 Hz bandpass.
- Streaming: Results are queued and micro-streamed at display-frame cadence with accurate pacing and caps.
- UI: A throttled UI pipeline coalesces updates (~20 fps) and passes chunks to the Filtered EEG view.

High-level flow:

1) DeviceEventEmitter events → handleEEGData/raw listeners
2) backgroundDSPManager.addSample(rawValue) [no throttling]
3) streamingDSP ring buffer → batch process when threshold met
4) processPythonStyle(data): artifact removal → notch → bandpass
5) backgroundDSP scheduleUIUpdate(enqueue chunks)
6) Micro-streamer drains queue at ~60 fps (rate-accurate)
7) window.dspUICallback(result) (set in Dashboard)
8) Dashboard throttles UI (50 ms) → setFilteredEEGData(mergedChunk)
9) FilteredEEGDisplay manages rolling buffer and renders

## Inputs

- Native event names observed:
  - BrainLinkData
  - EEGRawData
  - EEGDataStream
  - EEGPowerData (metrics; may not include rawValue)
- Expected raw samples:
  - Each event may have `rawValue` (Number). If undefined, sample is skipped for filtering.
- Sampling rate (FS): 512 Hz.

Listeners are installed on mount in `MacrotellectLinkDashboard` and removed on unmount. Regardless of UI throttling, raw samples are fed into the DSP manager immediately.

## Background DSP manager (utils/backgroundDSP.js)

- Purpose: Collect samples, run DSP in batches, and stream filtered output smoothly to the UI.
- Ingestion: `addSample(value)` pushes raw samples into an internal queue. Do not throttle this.
- Processing cadence: ~250 ms batch cycle (configurable). Internally uses `streamingDSP` to process available data.
- Micro-streaming:
  - Emits small chunks at display-rate (~60 fps).
  - Uses a fractional accumulator to match the actual sample rate across frames to avoid drift.
  - Enforces a max-queue cap (~3 seconds of samples) to prevent unbounded backlog in long runs.
- UI callback: The manager calls a UI callback with `{ filteredData, stats }` objects.

Start/Stop:
- `backgroundDSPManager.start(uiCallback)`
- `backgroundDSPManager.stop()`

The UI callback is installed from the Dashboard and stored on `window.dspUICallback` for easy wiring.

## Core streaming DSP (utils/streamingDSP.js)

- Ring buffer receives raw samples and exposes `processAvailableData()`.
- Minimum batch size: 64 samples (tuned to avoid “need 64 have 23” starvation messages).
- Logging is suppressed to reduce JS thread pressure.

Processing chain (Python-inspired):
1) Artifact removal (eye blink removal)
   - Compute mean and std; detect |x| > mean + 3*std.
   - Replace artifacts with local-window median; fallback to global median if needed.
2) 50 Hz notch (iirnotch approximation)
   - Moving-average based attenuation around the notch frequency with a quality factor.
3) 1–45 Hz bandpass (Butterworth+filtfilt approximation)
   - Two-pass smoothing: forward high-pass (remove DC/low), forward low-pass (remove high),
     then apply the same backward and average (zero-phase-like result).

Stats (example): `averageProcessingTime`, `bufferUtilization`, `samplesProcessed`, `samplingRate`.

## UI integration (screens/MacrotellectLinkDashboard.js)

- The Dashboard sets `window.dspUICallback = handleFilteredData` during initialization.
- When the user toggles the “Background Filtering” button to ON, the DSP manager starts with that callback.
- The callback collects filtered chunks and the latest stats in a small queue.
- A lightweight flush runs every ~50 ms (≈20 fps):
  - Merges queued chunks into one array and calls `setFilteredEEGData(merged)`.
  - Publishes the latest stats via `setDspPerformanceStats`.
  - Resets the queue and timer.

Clear/reset:
- `clearAllData()` stops the DSP if needed, clears UI queues/timers, resets rolling buffers, and calls `streamingDSP.reset()`.

## Rendering

- Filtered plot: `FilteredEEGDisplay` consumes `filteredData` chunks and updates its rolling buffer (about the last second) to render a smooth line.
- Raw plot: `RealTimeEEGDisplay` and the Dashboard’s dual-plot section show the raw signal.
- Both Dashboard plots (raw and filtered) use:
  - A normalized `viewBox="0 0 100 100"` with `preserveAspectRatio="none"`.
  - A rolling window of recent samples mapped across X=[0..100], so the line fully fills the plot immediately.
  - Guards for very short buffers (<2 samples) to avoid rendering invalid point lists.

Recommended windows (tunable):
- Dashboard SVG plots: last ~2000 samples (~4s at 512 Hz) for good continuity.
- FilteredEEGDisplay: maintains its own smaller rolling buffer for low-latency feel.

## Controls and states

- Toggle: “Background Filtering” button starts/stops the DSP manager.
- Show/Hide: “Show Filtered View” toggles the filtered visualization.
- Stats: Performance stats (avg processing, buffer utilization, cumulative samples) are shown when available.

## Performance

- Unthrottled ingestion avoids DSP starvation and keeps latency stable.
- UI coalescing (50 ms) limits React state updates and reduces render churn.
- Micro-streaming and fractional pacing keep the filtered stream rate-accurate without drift.
- Queue capping prevents unbounded memory growth and long-run jank.
- Verbose logging is disabled in hot paths.

## Data shapes

- Ingestion events: `{ rawValue?: number, batteryLevel?: number, ... }`
- UI callback to Dashboard:
  ```ts
  type DSPResult = {
    filteredData: number[]; // small chunk
    stats?: {
      averageProcessingTime?: number;
      bufferUtilization?: number; // percent
      samplesProcessed?: number;
      samplingRate?: number; // Hz
      // ...additional fields as needed
    };
  };
  ```

## Step-by-step (end-to-end)

1) App mounts → Dashboard initializes SDK and listeners.
2) Device events flow in → `rawValue` pushed via `backgroundDSPManager.addSample()`.
3) Every ~250 ms, `streamingDSP.processAvailableData()` processes batches:
   - Artifact removal → 50 Hz notch → 1–45 Hz bandpass.
4) Filtered samples are enqueued; the micro-streamer drains them at ~60 fps using precise pacing.
5) Each micro-chunk triggers `window.dspUICallback({ filteredData, stats })`.
6) Dashboard coalesces to ~20 fps, merges chunks, sets `filteredEEGData`, and updates stats.
7) `FilteredEEGDisplay` updates its rolling buffer and redraws.
8) Raw and filtered plots on the Dashboard render immediately with a normalized viewBox and rolling windows.

## Troubleshooting

- Filtered plot lags over time:
  - Ensure background filtering is ACTIVE.
  - Slightly decrease UI flush interval (e.g., 50 → 33 ms) or increase micro-chunk size.
  - Check that logging is not re-enabled in hot paths.
- “Need N have M” starvation warnings:
  - Confirm ingestion is unthrottled and batch threshold is set to a small value (e.g., 64 samples).
- Plot appears empty or mirrored:
  - Verify viewBox and `preserveAspectRatio="none"`; ensure at least 2 samples before drawing.
- High CPU usage:
  - Keep UI coalescing; avoid large arrays passed through props by letting the child keep its own rolling buffer.

## Extensibility

- Swap the simplified notch/bandpass with a proper IIR/FIR implementation (e.g., platform-native or a vetted JS DSP lib).
- Adjust windows (UI and DSP) to match UX and latency requirements.
- Extend stats for deeper profiling and on-device monitoring.
