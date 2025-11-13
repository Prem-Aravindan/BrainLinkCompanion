# Signal checks and demo detection

This document collects the streaming callback and the signal legitimacy/noise checks used by the GUI.

## onRaw (streaming callback)

# Signal checks, demo detection, GUI wiring, and tests

This document collects the streaming callback that runs when the device is connected, the heuristics used to detect demo/artificial data and noisy signals, and actionable wiring and tests you can add to the GUI.

It includes:
- the `onRaw` callback (where streaming enters the app)
- helper functions used to determine signal legitimacy and noise
- suggested GUI wiring to present warnings and make thresholds configurable
- a small pytest test suite and how to run it

---

## 1) The streaming callback: onRaw

This function receives raw EEG samples (single sample values) from the serial parser. It performs three important roles:
- detect simple demo / synthetic data patterns (very regular increments or repeated values)
- buffer the live signal for short-term windowed analysis
- every 50 samples (and when at least 512 samples are available) run a short analysis pipeline which includes artifact removal, filtering, PSD calculation, and the new signal checks

Copy of the function (exact behavior from the application):

```python
def onRaw(raw):
    global live_data_buffer
    
    # CRITICAL VALIDATION: Detect if we're getting dummy data patterns
    # Check for suspicious patterns that indicate dummy data generation
    if hasattr(onRaw, '_last_values'):
        onRaw._last_values.append(raw)
        if len(onRaw._last_values) > 10:
            onRaw._last_values = onRaw._last_values[-10:]
            
        # Check for unrealistic patterns (like perfect sine waves from dummy generator)
        if len(onRaw._last_values) >= 10:
            values = np.array(onRaw._last_values)
            # Check for suspiciously regular patterns
            diffs = np.diff(values)
            if np.std(diffs) < 0.1 or np.all(np.abs(diffs) < 0.01):
                print("WARNING: Detected potentially artificial/dummy data patterns!")
                print("Please ensure you're connected to a REAL MindLink device!")
    else:
        onRaw._last_values = [raw]
    
    live_data_buffer.append(raw)
    if len(live_data_buffer) > 1000:
        live_data_buffer = live_data_buffer[-1000:]
    
    # Also feed data to feature engine if GUI is running
    if hasattr(onRaw, 'feature_engine') and onRaw.feature_engine:
        onRaw.feature_engine.add_data(raw)
    
    # Show processed values in console every 50 samples (unless suppressed by enhanced GUI)
    if len(live_data_buffer) % 50 == 0 and not getattr(onRaw, '_suppress_console', False):
        # Process the data if we have enough samples
        if len(live_data_buffer) >= 512:
            try:
                # Get recent data for analysis
                data = np.array(live_data_buffer[-512:])
                
                # Apply artifact removal before filtering (matching BrainCompanion_updated.py)
                cleaned_data = remove_eye_blink_artifacts(data)
                
                # Apply filters with correct sampling rate
                data_notched = notch_filter(cleaned_data, 512, notch_freq=50.0, quality_factor=30.0)
                filtered = bandpass_filter(data_notched, lowcut=1.0, highcut=45.0, fs=512, order=2)
                
                # Compute power spectral density
                freqs, psd = compute_psd(filtered, 512)
                
                # Total EEG power via variance of the signal
                total_power = np.var(filtered)
                
                # Calculate band powers and ratios (alpha/theta, beta/alpha)
                # (omitted prints)

                # Run additional signal legitimacy and noise checks
                try:
                    recent_window = filtered[-512:] if len(filtered) >= 512 else filtered
                    legitimacy = check_signal_legitimacy(recent_window)
                    noisy, noise_details = is_signal_noisy(recent_window, fs=512)
                    onRaw._last_check = {'legitimacy': legitimacy, 'is_noisy': noisy, 'noise_details': noise_details}
                    # Print concise warnings so users see issues in console
                    if legitimacy['messages']:
                        print("SIGNAL WARNING:", "; ".join(legitimacy['messages']))
                    if noisy:
                        print(f"SIGNAL WARNING: High-frequency noise detected (ratio={noise_details.get('high_freq_ratio',0):.2f})")
                except Exception as e:
                    print(f"Signal checks failed: {e}")

            except Exception as e:
                print(f"Analysis error: {e}")
        else:
            print(f"Need {512 - len(live_data_buffer)} more samples for analysis")
            print("===================================\n")
```


---

## 2) Helper functions: heuristics for legitimacy & noise

Add these helpers into the same module (they were already added to the GUI source). They are small, self-contained, and fast.

### check_signal_legitimacy

Signature: `check_signal_legitimacy(data_window, min_variance=0.05, max_diff_std=0.1, max_identical_fraction=0.02)`

Heuristics:
- low_variance: variance below `min_variance` — likely flatline or disconnected electrode
- regular_steps: sample-to-sample differences very regular (std of diffs below `max_diff_std`) — likely synthetic/demo generator
- too_many_identical: a large fraction of exact-identical samples ( > `max_identical_fraction`) — clipping/artificial

Returns a dict with:
- flags: {low_variance, regular_steps, too_many_identical}
- metrics: {variance, std_of_diffs, identical_fraction}
- messages: human-readable warnings

### is_signal_noisy

Signature: `is_signal_noisy(data_window, fs=512, high_freq_threshold=30.0, high_freq_ratio_thresh=0.5)`

Heuristic:
- compute PSD; measure fraction of total power above `high_freq_threshold`.
- If that ratio > `high_freq_ratio_thresh`, mark as noisy.

Returns: (is_noisy: bool, details: dict) where `details` contains `total_power`, `high_power`, `high_freq_ratio`, and `freq_max`.


---

## 3) Wiring into the GUI (recommended additions)

The code already stores `onRaw._last_check` after each analysis cycle. To surface this to the user, add one or more of the following patterns into `BrainLinkAnalyzerWindow`:

1) Bind the feature engine and ensure the `onRaw` callback has access to it:

```python
# after creating the FeatureAnalysisEngine instance in BrainLinkAnalyzerWindow.__init__
self.feature_engine = FeatureAnalysisEngine()
onRaw.feature_engine = self.feature_engine
```

2) Show the most recent check in the connection tab log area (example inside the `update_live_plot` or a new QTimer callback):

```python
if hasattr(onRaw, '_last_check'):
    chk = onRaw._last_check
    if chk and chk.get('legitimacy', {}).get('messages'):
        self.log_message(' | '.join(chk['legitimacy']['messages']))
    if chk and chk.get('is_noisy'):
        self.log_message(f"High-frequency noise (ratio={chk['noise_details'].get('high_freq_ratio',0):.2f})")
```

3) Emit a Qt Signal on warnings instead of printing to console. Add to `BrainLinkAnalyzerWindow`:

```python
signal_warning = Signal(str)
# connect to UI
self.signal_warning.connect(lambda s: self.log_message(s))
# in onRaw when warning occurs, if window active do:
if 'BrainLinkAnalyzerWindow' in globals():
    wref = getattr(BrainLinkAnalyzerWindow, '_active_window', None)
    if wref:
        win = wref()
        if win is not None:
            win.signal_warning.emit("...message...")
```

4) Make thresholds configurable via `QSettings` and small UI controls (spin boxes or sliders) on the Connection tab. Use keys such as `signal.min_variance`, `signal.max_diff_std`, etc.


---

## 4) Suggested thresholds and rationale

- `min_variance=0.05` — a very low variance suggests disconnection or constant signal.
- `max_diff_std=0.1` — if successive steps vary with std < 0.1 µV the signal is unnaturally regular.
- `max_identical_fraction=0.02` — if more than 2% of samples are exactly identical this may indicate clipping or artificial repetition.
- `high_freq_threshold=30.0 Hz` and `high_freq_ratio_thresh=0.5` — if over half the power is above 30 Hz the signal is likely dominated by noise (muscle/EMG or electrical noise).

These are conservative starting points — expose them to UI so technicians can adjust for real hardware conditions.


---

## 5) Unit tests (pytest)

Create a test file `tests/test_signal_checks.py` alongside the project root (or in your test folder). The tests below validate the heuristics on synthetic signals.

```python
import numpy as np
from BrainLinkAnalyzer_GUI import check_signal_legitimacy, is_signal_noisy


def test_flatline_detected():
    arr = np.zeros(512)
    res = check_signal_legitimacy(arr, min_variance=1e-6)
    assert res['flags']['low_variance']


def test_regular_steps_detected():
    # perfect ramp -> diffs constant
    arr = np.arange(512).astype(float)
    res = check_signal_legitimacy(arr, max_diff_std=1e-6)
    assert res['flags']['regular_steps']


def test_identical_fraction_detected():
    arr = np.zeros(512)
    arr[:10] = 1.0
    res = check_signal_legitimacy(arr, max_identical_fraction=0.9)
    assert res['flags']['too_many_identical']


def test_high_freq_noise():
    fs = 512
    # high-frequency sinusoid 100 Hz
    t = np.arange(0, 1.0, 1/fs)
    arr = 0.5 * np.sin(2 * np.pi * 100 * t)
    noisy, details = is_signal_noisy(arr, fs=fs, high_freq_threshold=30.0, high_freq_ratio_thresh=0.2)
    assert noisy
```

Run tests from the workspace root:

```powershell
# Windows PowerShell
python -m pytest -q
```


---

## 6) How to integrate and enable in the running app

- The helper functions are already added to the GUI source in this branch. To enable UI feedback:
  - ensure `onRaw.feature_engine` is bound to the window's `FeatureAnalysisEngine` instance as shown above.
  - add code to periodically read `onRaw._last_check` and update a status label or the log window.
  - add UI controls (spin boxes) to adjust thresholds and save them to `QSettings`.


---

## 7) Follow-ups and improvements

- Replace console prints with Qt Signals and a small visual indicator (red/yellow/green) in the connection tab.
- Use adaptive thresholds based on initial calibration recordings (eyes-open/eyes-closed baselines).
- Add a rolling quality score (0..100) that combines multiple heuristics and can be used to gate recording or task start.


---

If you want I can now:
- implement the UI wiring (status indicator and QSettings controls) directly into `BrainLinkAnalyzer_GUI.py`,
- convert console prints to `signal_warning` Qt Signal and show warnings in the log area,
- add the pytest file into the repo and run tests.

Tell me which of those you'd like next and I'll implement them. 
