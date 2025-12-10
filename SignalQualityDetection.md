# Signal Quality Detection and Noise Detection - Code Documentation

## Overview

This document provides a detailed walkthrough of the signal quality detection and noise detection code used in the BrainLink/MindLink EEG analyzer. These functions are critical for providing real-time user feedback about headset contact quality and data reliability.

---

## Table of Contents

1. [Primary Signal Quality Assessment](#1-primary-signal-quality-assessment)
2. [High-Frequency Noise Detection](#2-high-frequency-noise-detection)
3. [Signal Legitimacy Checks](#3-signal-legitimacy-checks)
4. [UI Integration and User Feedback](#4-ui-integration-and-user-feedback)
5. [Detection Thresholds Summary](#5-detection-thresholds-summary)

---

## 1. Primary Signal Quality Assessment

### Function: `assess_eeg_signal_quality()`

**Location:** `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` (lines 114-250)

This is the main signal quality assessment function that performs a **multi-metric analysis** to determine if the EEG headset is properly worn and providing valid data.

### Complete Function Code

```python
def assess_eeg_signal_quality(data_window, fs=512):
    """
    Professional multi-metric signal quality assessment.
    
    This function evaluates EEG signal quality using multiple metrics
    to provide accurate feedback about headset contact and data quality.
    
    Parameters:
    -----------
    data_window : array-like
        Raw EEG data window (typically 512 samples = 1 second at 512 Hz)
    fs : int
        Sampling frequency in Hz (default: 512)
        
    Returns:
    --------
    tuple: (quality_score: float 0-100, status: str, details: dict)
        - quality_score: 0-100 overall quality rating
        - status: Human-readable status string
        - details: Dictionary with individual metric values
    """
    arr = np.array(data_window)
    details = {}
    quality_score = 100.0
    status = "good"
    
    if len(arr) < 64:
        return (0.0, "insufficient_data", {"reason": "need at least 64 samples"})
    
    # ===================================================================
    # METRIC 1: Amplitude Range Check (Primary "headset not worn" detector)
    # ===================================================================
    arr_std = np.std(arr)
    arr_range = np.max(arr) - np.min(arr)
    details['std'] = float(arr_std)
    details['range'] = float(arr_range)
    
    # Very low variance = headset not making contact with scalp
    if arr_std < 2.0:
        return (10.0, "not_worn", details)
    
    # Extremely high values = severe artifacts or disconnection
    if arr_std > 500 or arr_range > 2000:
        quality_score -= 40
        status = "severe_artifacts"
    elif arr_std > 200 or arr_range > 1000:
        quality_score -= 20
        status = "amplitude_artifacts"
    
    # ===================================================================
    # METRIC 2: Line Noise Detection (50/60 Hz interference)
    # ===================================================================
    try:
        freqs, psd = welch(arr, fs=fs, nperseg=min(256, len(arr)))
        
        # Check for 50 Hz (EU) and 60 Hz (US) line noise
        line_50_mask = (freqs >= 48) & (freqs <= 52)
        line_60_mask = (freqs >= 58) & (freqs <= 62)
        
        total_power = np.sum(psd)
        line_50_power = np.sum(psd[line_50_mask]) if np.any(line_50_mask) else 0
        line_60_power = np.sum(psd[line_60_mask]) if np.any(line_60_mask) else 0
        
        line_noise_ratio = (line_50_power + line_60_power) / (total_power + 1e-12)
        details['line_noise_ratio'] = float(line_noise_ratio)
        
        if line_noise_ratio > 0.3:
            quality_score -= 15
            if status == "good":
                status = "poor_contact"
    except Exception:
        pass
    
    # ===================================================================
    # METRIC 3: Baseline Drift Detection
    # ===================================================================
    try:
        # Divide signal into quarters and compare means
        quarter_len = len(arr) // 4
        if quarter_len > 0:
            quarters = [arr[i*quarter_len:(i+1)*quarter_len] for i in range(4)]
            quarter_means = [np.mean(q) for q in quarters]
            drift_range = max(quarter_means) - min(quarter_means)
            details['baseline_drift'] = float(drift_range)
            
            if drift_range > 100:
                quality_score -= 10
    except Exception:
        pass
    
    # ===================================================================
    # METRIC 4: Motion Artifact Detection (via kurtosis)
    # ===================================================================
    try:
        from scipy.stats import kurtosis
        kurt = kurtosis(arr)
        details['kurtosis'] = float(kurt)
        
        # High kurtosis indicates sharp spikes (motion artifacts)
        if kurt > 10:
            quality_score -= 15
            if status == "good":
                status = "motion_artifacts"
    except Exception:
        pass
    
    # ===================================================================
    # METRIC 5: EEG Frequency Content Check
    # ===================================================================
    try:
        # Calculate ratio of EEG band power (1-40 Hz) to total power
        eeg_mask = (freqs >= 1) & (freqs <= 40)
        eeg_power = np.sum(psd[eeg_mask]) if np.any(eeg_mask) else 0
        eeg_ratio = eeg_power / (total_power + 1e-12)
        details['eeg_band_ratio'] = float(eeg_ratio)
        
        # Very low EEG ratio suggests no brain signal
        if eeg_ratio < 0.2:
            quality_score -= 30
            if status in ["good", "acceptable"]:
                status = "not_worn"
    except Exception:
        pass
    
    # ===================================================================
    # METRIC 6: High Frequency Noise Detection
    # ===================================================================
    try:
        high_freq_mask = freqs > 40
        high_freq_power = np.sum(psd[high_freq_mask]) if np.any(high_freq_mask) else 0
        high_freq_ratio = high_freq_power / (total_power + 1e-12)
        details['high_freq_ratio'] = float(high_freq_ratio)
        
        # Excessive high frequency content = noise
        if high_freq_ratio > 0.6:
            quality_score -= 20
            if status == "good":
                status = "excessive_noise"
    except Exception:
        pass
    
    # ===================================================================
    # Final Quality Score Classification
    # ===================================================================
    quality_score = max(0, min(100, quality_score))
    details['quality_score'] = quality_score
    
    if quality_score >= 70 and status == "good":
        status = "good"
    elif quality_score >= 50 and status in ["good", "acceptable"]:
        status = "acceptable"
    elif quality_score < 50 and status == "good":
        status = "poor"
    
    return (quality_score, status, details)
```

### Walkthrough of Each Metric

#### Metric 1: Amplitude Range Check (Primary "Not Worn" Detector)

```python
arr_std = np.std(arr)
arr_range = np.max(arr) - np.min(arr)

if arr_std < 2.0:
    return (10.0, "not_worn", details)
```

**Purpose:** Detects if the headset is not making contact with the scalp.

**How it works:**
- Calculates the standard deviation of the EEG signal
- When electrodes are not touching skin, the signal has virtually no variation
- **Threshold:** `std < 2.0` microvolts → headset not worn

**Severe artifact detection:**
- `std > 500` or `range > 2000`: Severe artifacts (40 point penalty)
- `std > 200` or `range > 1000`: Amplitude artifacts (20 point penalty)

---

#### Metric 2: Line Noise Detection (50/60 Hz)

```python
line_50_mask = (freqs >= 48) & (freqs <= 52)  # EU power line
line_60_mask = (freqs >= 58) & (freqs <= 62)  # US power line

line_noise_ratio = (line_50_power + line_60_power) / (total_power + 1e-12)

if line_noise_ratio > 0.3:
    quality_score -= 15
    status = "poor_contact"
```

**Purpose:** Detects electrical interference from power lines.

**How it works:**
- Uses Welch's method to compute Power Spectral Density (PSD)
- Measures power in 48-52 Hz (EU) and 58-62 Hz (US) bands
- High line noise usually indicates poor electrode contact

**Threshold:** Line noise > 30% of total power → poor contact warning

---

#### Metric 3: Baseline Drift Detection

```python
quarter_len = len(arr) // 4
quarters = [arr[i*quarter_len:(i+1)*quarter_len] for i in range(4)]
quarter_means = [np.mean(q) for q in quarters]
drift_range = max(quarter_means) - min(quarter_means)

if drift_range > 100:
    quality_score -= 10
```

**Purpose:** Detects slow signal drifts caused by movement or electrode settling.

**How it works:**
- Divides the signal window into 4 equal parts
- Calculates the mean of each quarter
- If means differ significantly, baseline is drifting

**Threshold:** Drift > 100 µV between quarters → 10 point penalty

---

#### Metric 4: Motion Artifact Detection (Kurtosis)

```python
from scipy.stats import kurtosis
kurt = kurtosis(arr)

if kurt > 10:
    quality_score -= 15
    status = "motion_artifacts"
```

**Purpose:** Detects sharp spikes from movement or muscle artifacts.

**How it works:**
- Kurtosis measures "tailedness" of the distribution
- Normal EEG has moderate kurtosis (around 3 for Gaussian)
- Sharp spikes from motion cause very high kurtosis

**Threshold:** Kurtosis > 10 → motion artifacts detected

---

#### Metric 5: EEG Frequency Content Check

```python
eeg_mask = (freqs >= 1) & (freqs <= 40)
eeg_power = np.sum(psd[eeg_mask])
eeg_ratio = eeg_power / (total_power + 1e-12)

if eeg_ratio < 0.2:
    quality_score -= 30
    status = "not_worn"
```

**Purpose:** Verifies that the signal contains actual brain activity.

**How it works:**
- EEG brain waves occur in 1-40 Hz range (delta to gamma)
- Calculates what percentage of power is in this range
- Very low EEG ratio means mostly noise, no brain signal

**Threshold:** EEG ratio < 20% → likely not worn

---

#### Metric 6: High Frequency Noise Detection

```python
high_freq_mask = freqs > 40
high_freq_power = np.sum(psd[high_freq_mask])
high_freq_ratio = high_freq_power / (total_power + 1e-12)

if high_freq_ratio > 0.6:
    quality_score -= 20
    status = "excessive_noise"
```

**Purpose:** Detects excessive high-frequency noise contamination.

**How it works:**
- Brain signals are mostly below 40 Hz
- High power above 40 Hz indicates muscle artifacts, EMG, or electrical noise

**Threshold:** High-freq ratio > 60% → excessive noise

---

## 2. High-Frequency Noise Detection

### Function: `is_signal_noisy()`

**Location:** `BrainLinkAnalyzer_GUI.py` (lines 540-570)

A specialized function for detecting high-frequency noise contamination.

### Complete Function Code

```python
def is_signal_noisy(data_window, fs=512, high_freq_threshold=30.0, high_freq_ratio_thresh=0.7):
    """Estimate whether the window is dominated by high-frequency noise.

    Simple heuristic: compute PSD and compare power above `high_freq_threshold` 
    to total power.
    
    Parameters:
    -----------
    data_window : array-like
        Raw EEG data window
    fs : int
        Sampling frequency (default: 512 Hz)
    high_freq_threshold : float
        Frequency threshold in Hz (default: 30 Hz)
    high_freq_ratio_thresh : float
        Ratio threshold for noise classification (default: 0.7 = 70%)
        
    Returns:
    --------
    tuple: (is_noisy: bool, details: dict)
    
    Note: Threshold increased to 0.7 (70%) to reduce false positives 
    from normal EEG artifacts.
    """
    arr = np.array(data_window)
    details = {}
    
    if arr.size < 4:
        details['reason'] = 'too_short'
        details['high_freq_ratio'] = 0.0
        return False, details

    try:
        freqs, psd = compute_psd(arr, fs)
        total = np.trapz(psd, freqs) if psd.size > 0 else 0.0
        
        mask = freqs >= high_freq_threshold
        high_power = np.trapz(psd[mask], freqs[mask]) if np.any(mask) else 0.0
        
        ratio = float(high_power / (total + 1e-12))
        
        details['total_power'] = float(total)
        details['high_power'] = float(high_power)
        details['high_freq_ratio'] = ratio
        details['freq_max'] = float(freqs[np.argmax(psd)]) if psd.size > 0 else 0.0
        
        is_noisy = ratio > high_freq_ratio_thresh
        return is_noisy, details
        
    except Exception as e:
        details['error'] = str(e)
        return False, details
```

### Walkthrough

1. **Power Spectral Density Calculation:**
   - Uses `compute_psd()` which internally calls `scipy.signal.welch()`
   - Decomposes signal into frequency components

2. **Power Calculation:**
   - Uses trapezoidal integration (`np.trapz`) for accurate power estimation
   - Calculates total power and high-frequency power (>30 Hz)

3. **Ratio Comparison:**
   - If >70% of power is above 30 Hz, signal is classified as noisy
   - 70% threshold chosen to reduce false positives from normal blink artifacts

4. **Return Values:**
   - `is_noisy`: Boolean flag
   - `details`: Dictionary with diagnostic information

---

## 3. Signal Legitimacy Checks

### Function: `check_signal_legitimacy()`

**Location:** `BrainLinkAnalyzer_GUI.py` (lines 503-536)

Performs heuristic checks to detect synthetic, disconnected, or clipped signals.

### Complete Function Code

```python
def check_signal_legitimacy(data_window, min_variance=0.05, max_diff_std=0.1, 
                           max_identical_fraction=0.02):
    """Perform quick heuristic checks to determine if the incoming EEG 
    window looks legitimate.

    Returns a dict with flags and short messages. 
    
    Heuristics used:
      - low_variance: variance below min_variance (flatline / disconnected)
      - regular_steps: very low std of successive differences (synthetic/demo)
      - too_many_identical: many repeated identical values (clipping/synthetic)
    """
    metrics = {}
    arr = np.array(data_window)
    
    # Metric 1: Variance check
    metrics['variance'] = float(np.var(arr)) if arr.size > 0 else 0.0
    
    # Metric 2: Regularity of sample-to-sample changes
    metrics['std_of_diffs'] = float(np.std(np.diff(arr))) if arr.size > 1 else 0.0
    
    # Metric 3: Fraction of identical (repeated) samples
    if arr.size > 0:
        unique_count = len(np.unique(arr))
        metrics['identical_fraction'] = 1.0 - (unique_count / float(arr.size))
    else:
        metrics['identical_fraction'] = 1.0

    # Evaluate flags
    flags = {
        'low_variance': metrics['variance'] < min_variance,
        'regular_steps': metrics['std_of_diffs'] < max_diff_std,
        'too_many_identical': metrics['identical_fraction'] > max_identical_fraction
    }

    # Generate human-readable messages
    messages = []
    if flags['low_variance']:
        messages.append('Low variance - possible disconnected/flatline signal')
    if flags['regular_steps']:
        messages.append('Highly regular sample-to-sample steps - possible synthetic/demo data')
    if flags['too_many_identical']:
        messages.append('Many identical values - possible clipping or artificial data')

    return {'flags': flags, 'metrics': metrics, 'messages': messages}
```

### Detection Capabilities

| Flag | Condition | Indicates |
|------|-----------|-----------|
| `low_variance` | variance < 0.05 | Disconnected electrode, flatline |
| `regular_steps` | std(diff) < 0.1 | Synthetic/demo data |
| `too_many_identical` | identical > 2% | Signal clipping or artificial |

---

## 4. UI Integration and User Feedback

### MindLinkStatusBar Update

**Location:** `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` (lines 470-503)

```python
def update_status(self):
    """Update the status display - uses same logic as LiveEEGDialog"""
    try:
        # Check EEG connection status
        if BL.live_data_buffer and len(BL.live_data_buffer) > 0:
            self.eeg_status.setText("EEG: ✓ Connected")
            self.eeg_status.setStyleSheet("color: #10b981; font-weight: 700;")
        else:
            self.eeg_status.setText("EEG: ✗ No Signal")
            self.eeg_status.setStyleSheet("color: #fbbf24; font-weight: 700;")
        
        # Professional multi-metric signal quality assessment
        if len(BL.live_data_buffer) >= 512:
            recent_data = np.array(list(BL.live_data_buffer)[-512:])
            
            quality_score, status, details = assess_eeg_signal_quality(recent_data, fs=512)
            
            # Show "Noisy" if headset is not worn
            if status == "not_worn":
                self.signal_quality.setText("Signal: ⚠ Noisy")
                self.signal_quality.setStyleSheet("color: #f59e0b; font-weight: 700;")
            else:
                self.signal_quality.setText("Signal: ✓ Good")
                self.signal_quality.setStyleSheet("color: #10b981; font-weight: 700;")
        else:
            self.signal_quality.setText("Signal: Waiting...")
            self.signal_quality.setStyleSheet("color: #94a3b8; font-weight: 700;")
    except Exception as e:
        pass
```

### Task Dialog Signal Quality Display

**Location:** `BrainLinkAnalyzer_GUI.py` (lines 3884-3927)

```python
def update_signal_quality():
    try:
        if hasattr(self, 'live_data_buffer') and len(self.live_data_buffer) > 100:
            recent_data = list(self.live_data_buffer)[-100:]
            
            if self._is_signal_noisy(recent_data, threshold_std=200):
                signal_quality_label.setText("⚠ Signal: Check contact")
                signal_quality_label.setStyleSheet(
                    "font-size: 12px; padding: 8px 12px; border-radius: 6px; "
                    "background-color: #fef2f2; color: #dc2626; font-weight: 600;"
                )
            else:
                signal_quality_label.setText("✓ Signal: Good")
                signal_quality_label.setStyleSheet(
                    "font-size: 12px; padding: 8px 12px; border-radius: 6px; "
                    "background-color: #f0fdf4; color: #16a34a; font-weight: 600;"
                )
        else:
            signal_quality_label.setText("○ Signal: Waiting...")
            signal_quality_label.setStyleSheet(
                "font-size: 12px; padding: 8px 12px; border-radius: 6px; "
                "background-color: #f1f5f9; color: #64748b;"
            )
    except Exception:
        pass

# Timer updates every 500ms
signal_timer.timeout.connect(update_signal_quality)
signal_timer.start(500)
```

### UI Color Coding

| Status | Color | Hex Code | Meaning |
|--------|-------|----------|---------|
| Good | Green | `#10b981` / `#16a34a` | Signal quality acceptable |
| Noisy/Warning | Amber | `#f59e0b` / `#fbbf24` | Check headset contact |
| Poor/Error | Red | `#dc2626` | Immediate attention needed |
| Waiting | Gray | `#94a3b8` / `#64748b` | Collecting data |

---

## 5. Detection Thresholds Summary

### Primary Quality Metrics

| Metric | Threshold | Action |
|--------|-----------|--------|
| Standard Deviation | < 2.0 µV | **Not worn** - immediate feedback |
| Standard Deviation | > 500 µV | Severe artifacts (-40 points) |
| Amplitude Range | > 2000 µV | Severe artifacts (-40 points) |
| Line Noise Ratio | > 30% | Poor contact (-15 points) |
| Baseline Drift | > 100 µV | Drift warning (-10 points) |
| Kurtosis | > 10 | Motion artifacts (-15 points) |
| EEG Band Ratio | < 20% | Not worn (-30 points) |
| High-Freq Ratio | > 60% | Excessive noise (-20 points) |

### Quality Score Classification

| Score Range | Status | User Message |
|-------------|--------|--------------|
| 70-100 | Good | "Signal: ✓ Good" |
| 50-69 | Acceptable | Signal OK but not optimal |
| 0-49 | Poor | "Signal: ⚠ Noisy" |

### Status Values Returned

```python
status_values = [
    "good",              # Signal quality is good
    "acceptable",        # Signal quality is acceptable
    "poor",              # Signal quality is poor
    "not_worn",          # Headset not making contact
    "severe_artifacts",  # Major signal disruption
    "amplitude_artifacts",  # High amplitude issues
    "poor_contact",      # Line noise indicates contact issues
    "motion_artifacts",  # Movement detected
    "excessive_noise",   # High-frequency noise
    "insufficient_data"  # Not enough samples
]
```

---

## Usage Example

```python
import numpy as np

# Get 1 second of EEG data at 512 Hz
eeg_data = np.array(list(BL.live_data_buffer)[-512:])

# Assess signal quality
quality_score, status, details = assess_eeg_signal_quality(eeg_data, fs=512)

# Provide user feedback
if status == "not_worn":
    show_warning("Please ensure the headset is properly positioned on your head")
elif status == "poor_contact":
    show_warning("Adjust headset for better electrode contact")
elif status == "motion_artifacts":
    show_warning("Please remain still during recording")
elif quality_score >= 70:
    show_status("Signal quality: Good")
else:
    show_status(f"Signal quality: {quality_score:.0f}%")
```

---

## Notes

1. **Sampling Rate:** All functions assume 512 Hz sampling rate by default
2. **Window Size:** Minimum 64 samples required; 512 samples (1 second) recommended
3. **Update Frequency:** UI updates every 500ms for responsive feedback
4. **Threshold Tuning:** Thresholds have been tuned to reduce false positives while maintaining sensitivity to actual issues
5. **Robustness:** All functions include try/except blocks to prevent crashes from unexpected data

