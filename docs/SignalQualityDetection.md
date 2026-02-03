# Signal Quality Detection and Noise Detection - Code Documentation

## Overview

This document provides a detailed walkthrough of the signal quality detection and noise detection code used in the BrainLink/MindLink EEG analyzer. These functions are critical for providing real-time user feedback about headset contact quality and data reliability.

**Last Updated:** December 10, 2025

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

**Location:** `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` (lines 114-318)

This is the main signal quality assessment function that performs a **multi-metric analysis** to determine if the EEG headset is properly worn and providing valid data.

### Key Innovation: Spectral-Based "Not Worn" Detection

The critical insight is that when the headset is **not worn but still transmitting**, it picks up environmental electrical noise (~50-100 µV) that can look like a valid EEG signal based on amplitude alone. However, real EEG and environmental noise have fundamentally different **frequency characteristics**:

| Characteristic | Real EEG (Worn) | Environmental Noise (Not Worn) |
|----------------|-----------------|-------------------------------|
| Power Spectrum | Strong 1/f characteristic | Relatively flat |
| Spectral Slope | -1 to -2 (steep negative) | Near 0 (flat) |
| Low-Freq Power | >40% in delta+theta (0.5-8 Hz) | Evenly distributed |
| High-Freq Power | <30% above 30 Hz | Often >50% |

### Complete Function Code

```python
def assess_eeg_signal_quality(data_window, fs=512):
    """
    Professional multi-metric EEG signal quality assessment.
    
    Enhanced detection for "headset not worn" condition:
    - When not worn, device picks up environmental noise (~50-100 µV) that looks like signal
    - Real EEG has characteristic 1/f spectrum with strong low-frequency content
    - Not-worn noise lacks the alpha peak (8-12 Hz) and has flatter spectrum
    
    Key metrics:
    1. Alpha band presence (8-12 Hz) - absent when not worn
    2. Low-frequency dominance (1-8 Hz) - brain signals are low-freq dominant
    3. Spectral slope (1/f characteristic) - real EEG has negative slope
    4. Amplitude checks and artifact detection
    
    Returns: (quality_score: 0-100, status: str, details: dict)
    """
    arr = np.array(data_window)
    details = {}
    
    if arr.size < 256:
        return 0, "insufficient_data", {"reason": "need more samples"}
    
    # Basic amplitude metrics
    arr_std = np.std(arr)
    arr_mean = np.mean(arr)
    arr_max = np.max(np.abs(arr))
    
    details['std'] = float(arr_std)
    details['mean'] = float(arr_mean)
    details['max_amplitude'] = float(arr_max)
    
    # Very low variance = definitely not worn (flatline)
    if arr_std < 2.0:
        return 10, "not_worn", details
    
    # Extremely high variance = severe artifacts
    if arr_std > 500:
        return 15, "severe_artifacts", details
    
    # Extreme amplitude = artifacts
    if arr_max > 500:
        return 25, "amplitude_artifacts", details
    
    # ===================================================================
    # CRITICAL: Frequency-based "not worn" detection
    # Real EEG has strong low-frequency content and 1/f spectrum
    # Environmental noise when not worn is more uniform across frequencies
    # ===================================================================
    try:
        freqs, psd = compute_psd(arr, fs)
        total_power = np.sum(psd) + 1e-12
        
        # Band power calculations
        idx_delta = (freqs >= 0.5) & (freqs <= 4)    # Delta: 0.5-4 Hz
        idx_theta = (freqs >= 4) & (freqs <= 8)      # Theta: 4-8 Hz  
        idx_alpha = (freqs >= 8) & (freqs <= 13)     # Alpha: 8-13 Hz
        idx_beta = (freqs >= 13) & (freqs <= 30)     # Beta: 13-30 Hz
        idx_low_freq = (freqs >= 0.5) & (freqs <= 8) # Low freq: 0.5-8 Hz
        idx_high_freq = freqs >= 30                   # High freq: >30 Hz
        
        delta_power = np.sum(psd[idx_delta])
        theta_power = np.sum(psd[idx_theta])
        alpha_power = np.sum(psd[idx_alpha])
        beta_power = np.sum(psd[idx_beta])
        low_freq_power = np.sum(psd[idx_low_freq])
        high_freq_power = np.sum(psd[idx_high_freq])
        
        # Relative powers
        delta_ratio = delta_power / total_power
        theta_ratio = theta_power / total_power
        alpha_ratio = alpha_power / total_power
        low_freq_ratio = low_freq_power / total_power
        high_freq_ratio = high_freq_power / total_power
        
        details['delta_ratio'] = float(delta_ratio)
        details['theta_ratio'] = float(theta_ratio)
        details['alpha_ratio'] = float(alpha_ratio)
        details['low_freq_ratio'] = float(low_freq_ratio)
        details['high_freq_ratio'] = float(high_freq_ratio)
        
        # ===================================================================
        # KEY DETECTION: Real EEG is dominated by low frequencies (delta+theta)
        # When not worn, power is more evenly distributed (flat spectrum)
        # ===================================================================
        
        # Metric 1: Low-frequency dominance (delta + theta should be > 40% for real EEG)
        low_freq_dominance = delta_ratio + theta_ratio
        details['low_freq_dominance'] = float(low_freq_dominance)
        
        # Metric 2: Calculate spectral slope (1/f characteristic)
        # Real EEG has negative slope (more power at low frequencies)
        # Flat noise has slope near 0
        try:
            # Use log-log fit for spectral slope (avoid DC and very high freq)
            valid_idx = (freqs >= 1) & (freqs <= 40) & (psd > 0)
            if np.sum(valid_idx) > 10:
                log_freqs = np.log10(freqs[valid_idx])
                log_psd = np.log10(psd[valid_idx])
                slope, _ = np.polyfit(log_freqs, log_psd, 1)
                details['spectral_slope'] = float(slope)
            else:
                slope = 0
                details['spectral_slope'] = 0.0
        except Exception:
            slope = 0
            details['spectral_slope'] = 0.0
        
        # ===================================================================
        # NOT WORN DETECTION LOGIC
        # ===================================================================
        
        # Condition 1: Low-frequency power too weak (< 30% in delta+theta)
        # Real EEG has strong delta/theta even during alertness
        if low_freq_dominance < 0.30:
            details['not_worn_reason'] = 'low_freq_too_weak'
            return 20, "not_worn", details
        
        # Condition 2: Spectral slope too flat (> -0.3)
        # Real EEG typically has slope between -1 and -2 (1/f characteristic)
        # Environmental noise is flatter (slope closer to 0)
        if slope > -0.3:
            details['not_worn_reason'] = 'flat_spectrum'
            return 25, "not_worn", details
        
        # Condition 3: High-frequency noise dominates (> 50%)
        if high_freq_ratio > 0.50:
            details['not_worn_reason'] = 'high_freq_dominant'
            return 30, "not_worn", details
        
        # Check line noise (50/60 Hz)
        idx_50hz = np.argmin(np.abs(freqs - 50))
        idx_60hz = np.argmin(np.abs(freqs - 60))
        line_noise_50 = psd[idx_50hz] if idx_50hz < len(psd) else 0
        line_noise_60 = psd[idx_60hz] if idx_60hz < len(psd) else 0
        line_noise = max(line_noise_50, line_noise_60)
        line_noise_ratio = line_noise / total_power
        details['line_noise_ratio'] = float(line_noise_ratio)
        
    except Exception as e:
        details['psd_error'] = str(e)
        # If PSD fails, fall back to basic checks - be conservative
        return 40, "analysis_error", details
    
    # Baseline stability check
    quarter_size = len(arr) // 4
    quarters_means = [np.mean(arr[i*quarter_size:(i+1)*quarter_size]) for i in range(4)]
    baseline_drift = np.std(quarters_means)
    details['baseline_drift'] = float(baseline_drift)
    
    if baseline_drift > 50:
        return 35, "poor_contact", details
    
    # Motion artifacts via kurtosis
    from scipy.stats import kurtosis
    kurt = kurtosis(arr, fisher=True)
    details['kurtosis'] = float(kurt)
    
    if abs(kurt) > 15:
        return 40, "motion_artifacts", details
    
    # ===================================================================
    # Calculate overall quality score for "worn" signals
    # ===================================================================
    quality_score = 100
    
    # Penalize weak low-frequency content (but not enough to flag as not worn)
    if low_freq_dominance < 0.40:
        quality_score -= 15
    
    # Penalize flat spectrum
    if slope > -0.5:
        quality_score -= 10
    
    # Penalize high-frequency noise
    if high_freq_ratio > 0.30:
        quality_score -= 15
    
    # Penalize baseline drift
    if baseline_drift > 20:
        quality_score -= 10
    
    # Penalize high kurtosis (artifacts)
    if abs(kurt) > 5:
        quality_score -= 10
    
    # Penalize line noise
    if line_noise_ratio > 0.1:
        quality_score -= 10
    
    # Bonus for good alpha presence (relaxed state indicator)
    if alpha_ratio > 0.15:
        quality_score += 5
    
    quality_score = max(0, min(100, quality_score))
    
    # Determine status
    if quality_score >= 70:
        status = "good"
    elif quality_score >= 50:
        status = "acceptable"
    else:
        status = "poor"
    
    return quality_score, status, details
```

### Walkthrough of Each Metric

#### Metric 1: Amplitude Range Check (Basic "Not Worn" Detector)

```python
arr_std = np.std(arr)

if arr_std < 2.0:
    return 10, "not_worn", details
```

**Purpose:** Detects complete absence of signal (flatline).

**How it works:**
- When electrodes have zero contact, signal has virtually no variation
- **Threshold:** `std < 2.0` microvolts → headset definitely not worn

**Note:** This catches only extreme cases. Environmental noise when "not worn" typically produces 50-100 µV signals that pass this check.

---

#### Metric 2: Spectral Slope (1/f Characteristic) - KEY DETECTION

```python
# Use log-log fit for spectral slope
valid_idx = (freqs >= 1) & (freqs <= 40) & (psd > 0)
log_freqs = np.log10(freqs[valid_idx])
log_psd = np.log10(psd[valid_idx])
slope, _ = np.polyfit(log_freqs, log_psd, 1)

if slope > -0.3:
    details['not_worn_reason'] = 'flat_spectrum'
    return 25, "not_worn", details
```

**Purpose:** Detects the characteristic 1/f power spectrum of real brain activity.

**How it works:**
- Real EEG follows a 1/f power law: $P(f) \propto \frac{1}{f^\beta}$
- In log-log space, this appears as a straight line with negative slope
- Typical EEG slope: -1 to -2 (steep decline)
- Environmental noise: slope near 0 (flat spectrum)

**Threshold:** Slope > -0.3 → too flat, not real EEG

**Mathematical basis:**
$$\log(P) = -\beta \cdot \log(f) + c$$

Where $\beta$ is the spectral exponent (typically 1-2 for real EEG).

---

#### Metric 3: Low-Frequency Dominance (Delta + Theta Power)

```python
low_freq_dominance = delta_ratio + theta_ratio  # Power in 0.5-8 Hz

if low_freq_dominance < 0.30:
    details['not_worn_reason'] = 'low_freq_too_weak'
    return 20, "not_worn", details
```

**Purpose:** Real brain signals are dominated by low frequencies.

**How it works:**
- Delta (0.5-4 Hz) and Theta (4-8 Hz) comprise most of real EEG power
- Even during alert states, these bands typically represent >40% of power
- Environmental noise is more evenly distributed across frequencies

**Threshold:** Delta+Theta < 30% of total power → not real EEG

---

#### Metric 4: High-Frequency Power Check

```python
high_freq_ratio = high_freq_power / total_power  # Power above 30 Hz

if high_freq_ratio > 0.50:
    details['not_worn_reason'] = 'high_freq_dominant'
    return 30, "not_worn", details
```

**Purpose:** Excessive high-frequency content indicates noise, not brain activity.

**How it works:**
- Brain signals are mostly below 30 Hz
- If >50% of power is above 30 Hz, likely environmental/electrical noise

---

#### Metric 5: Line Noise Detection (50/60 Hz)

```python
line_50_mask = (freqs >= 48) & (freqs <= 52)  # EU power line
line_60_mask = (freqs >= 58) & (freqs <= 62)  # US power line

line_noise_ratio = (line_50_power + line_60_power) / total_power

if line_noise_ratio > 0.1:
    quality_score -= 10
```

**Purpose:** Detects electrical interference from power lines.

---

#### Metric 6: Baseline Drift Detection

```python
quarter_size = len(arr) // 4
quarters_means = [np.mean(arr[i*quarter_size:(i+1)*quarter_size]) for i in range(4)]
baseline_drift = np.std(quarters_means)

if baseline_drift > 50:
    return 35, "poor_contact", details
```

**Purpose:** Detects slow signal drifts from movement or electrode settling.

---

#### Metric 7: Motion Artifact Detection (Kurtosis)

```python
from scipy.stats import kurtosis
kurt = kurtosis(arr, fisher=True)

if abs(kurt) > 15:
    return 40, "motion_artifacts", details
```

**Purpose:** Detects sharp spikes from movement or muscle artifacts.

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

**Location:** `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` (lines 547-600)

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
            
            # Debug output - print every 5 seconds
            if not hasattr(self, '_debug_counter'):
                self._debug_counter = 0
            self._debug_counter += 1
            if self._debug_counter >= 10:
                self._debug_counter = 0
                print(f"[Signal Quality] score={quality_score:.0f}, status={status}")
                print(f"  std={details.get('std', 0):.1f}µV, slope={details.get('spectral_slope', 0):.2f}")
                print(f"  low_freq_dom={details.get('low_freq_dominance', 0):.2%}, high_freq={details.get('high_freq_ratio', 0):.2%}")
                if 'not_worn_reason' in details:
                    print(f"  NOT WORN reason: {details['not_worn_reason']}")
            
            # Show feedback based on status
            if status == "not_worn":
                self.signal_quality.setText("Signal: ⚠ Not Worn")
                self.signal_quality.setStyleSheet("color: #ef4444; font-weight: 700;")
            elif status in ["poor_contact", "motion_artifacts", "excessive_noise"]:
                self.signal_quality.setText(f"Signal: ⚠ {status.replace('_', ' ').title()}")
                self.signal_quality.setStyleSheet("color: #f59e0b; font-weight: 700;")
            elif quality_score >= 70:
                self.signal_quality.setText("Signal: ✓ Good")
                self.signal_quality.setStyleSheet("color: #10b981; font-weight: 700;")
            else:
                self.signal_quality.setText("Signal: ○ Fair")
                self.signal_quality.setStyleSheet("color: #eab308; font-weight: 700;")
        else:
            self.signal_quality.setText("Signal: Waiting...")
            self.signal_quality.setStyleSheet("color: #94a3b8; font-weight: 700;")
    except Exception as e:
        print(f"Warning: Error updating status: {e}")
```

### UI Color Coding

| Status | Color | Hex Code | Meaning |
|--------|-------|----------|---------|
| Good | Green | `#10b981` | Signal quality acceptable |
| Fair | Yellow | `#eab308` | Signal OK but not optimal |
| Warning | Amber | `#f59e0b` | Check headset contact |
| Not Worn | Red | `#ef4444` | Headset not on head |
| Waiting | Gray | `#94a3b8` | Collecting data |

---

## 5. Detection Thresholds Summary

### "Not Worn" Detection Criteria

| Metric | Threshold | Reason Code |
|--------|-----------|-------------|
| Standard Deviation | < 2.0 µV | (flatline) |
| Low-Freq Dominance | < 30% | `low_freq_too_weak` |
| Spectral Slope | > -0.3 | `flat_spectrum` |
| High-Freq Ratio | > 50% | `high_freq_dominant` |

### Quality Score Penalties

| Condition | Penalty |
|-----------|---------|
| Low-freq dominance < 40% | -15 points |
| Spectral slope > -0.5 | -10 points |
| High-freq ratio > 30% | -15 points |
| Baseline drift > 20 µV | -10 points |
| Kurtosis > 5 | -10 points |
| Line noise ratio > 10% | -10 points |
| Alpha ratio > 15% | +5 bonus |

### Quality Score Classification

| Score Range | Status | User Message |
|-------------|--------|--------------|
| 70-100 | Good | "Signal: ✓ Good" |
| 50-69 | Acceptable | "Signal: ○ Fair" |
| 0-49 | Poor | (with specific issue) |

### Status Values Returned

```python
status_values = [
    "good",              # Signal quality is good
    "acceptable",        # Signal quality is acceptable  
    "poor",              # Signal quality is poor
    "not_worn",          # Headset not making contact
    "severe_artifacts",  # Major signal disruption
    "amplitude_artifacts",  # High amplitude issues
    "poor_contact",      # Baseline drift indicates contact issues
    "motion_artifacts",  # Movement detected
    "excessive_noise",   # High-frequency noise
    "insufficient_data", # Not enough samples
    "analysis_error"     # PSD computation failed
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

# Check why headset might be flagged as not worn
if status == "not_worn":
    reason = details.get('not_worn_reason', 'unknown')
    if reason == 'flat_spectrum':
        print("Spectral slope too flat - no 1/f characteristic")
    elif reason == 'low_freq_too_weak':
        print("Not enough power in delta/theta bands")
    elif reason == 'high_freq_dominant':
        print("Too much high-frequency noise")

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

## Debugging

The status bar prints debug information every 5 seconds to the console:

```
[Signal Quality] score=25, status=not_worn
  std=52.3µV, slope=-0.12
  low_freq_dom=24.50%, high_freq=38.20%
  NOT WORN reason: flat_spectrum
```

This helps diagnose why the detection is triggering or not triggering.

---

## Notes

1. **Sampling Rate:** All functions assume 512 Hz sampling rate by default
2. **Window Size:** Minimum 256 samples required; 512 samples (1 second) recommended
3. **Update Frequency:** UI updates every 500ms for responsive feedback
4. **Debug Output:** Console prints every 5 seconds with detailed metrics
5. **Spectral Slope:** The key differentiator between real EEG and environmental noise
6. **Robustness:** All functions include try/except blocks to prevent crashes

