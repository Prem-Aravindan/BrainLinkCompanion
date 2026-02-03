# User Feedback Analysis & Fix Planning

**Date:** November 17, 2025  
**Branch:** dev/unit-consistency-fixes  
**Feedback ID:** #1

---

## User Feedback #1: Signal Instability & Session State Persistence

### Issue Description
1. **Signal Instability:** After few seconds of green light, receives "high noise detected" message despite trying different strategies
2. **Session State Persistence:** After disconnecting (switching device off/on), previous session data is still visible when reconnecting

---

## Code Analysis by Component

### 1. Signal Quality Detection (Processing Component)

**Location:** `BrainLinkAnalyzer_GUI.py`

#### Function: `is_signal_noisy()` (Lines 519-547)
```python
def is_signal_noisy(data_window, fs=512, high_freq_threshold=30.0, high_freq_ratio_thresh=0.5):
```

**Purpose:** Detects high-frequency noise in EEG signal  
**Current Threshold:** 50% of power above 30Hz = noisy signal

**Problem Identified:**
- ⚠️ **Threshold too aggressive (0.5 or 50%)**
- Real-world EEG often has >30Hz components even with good contact
- Muscle artifacts, eye movements naturally produce high-frequency content
- **Current setting causes false positives**

**Recommendation:**
```python
# Current:
high_freq_ratio_thresh=0.5  # 50% - TOO STRICT

# Proposed:
high_freq_ratio_thresh=0.7  # 70% - More lenient
# OR make it configurable per user
```

---

#### Function: `check_signal_legitimacy()` (Lines 483-517)
```python
def check_signal_legitimacy(data_window, min_variance=0.05, max_diff_std=0.1, max_identical_fraction=0.02):
```

**Purpose:** Detects flat/disconnected/artifactual signals  
**Checks:**
- Low variance (flatline)
- High consecutive differences (spikes)
- Identical consecutive values (device error)

**Problem Identified:**
- ✅ This function seems reasonable
- But combined with `is_signal_noisy()`, creates double jeopardy

---

#### Function: `onRaw()` (Lines 597-708)
**Location:** Signal processing callback

**Code Section (Lines 681-688):**
```python
legitimacy = check_signal_legitimacy(recent_window)
noisy, noise_details = is_signal_noisy(recent_window, fs=512)
onRaw._last_check = {'legitimacy': legitimacy, 'is_noisy': noisy, 'noise_details': noise_details}
# Print concise warnings so users see issues in console
if legitimacy['messages']:
    print("SIGNAL WARNING:", "; ".join(legitimacy['messages']))
if noisy:
    print(f"SIGNAL WARNING: High-frequency noise detected (ratio={noise_details.get('high_freq_ratio',0):.2f})")
```

**Problem Identified:**
- ⚠️ **Warnings printed but not affecting UI state consistently**
- Console warnings may not be visible to end users
- No adaptive recovery mechanism

---

### 2. UI Signal Quality Display (UX Component)

**Location:** `BrainLinkAnalyzer_GUI_Sequential_Integrated.py`

#### LiveEEGDialog: `update_plot()` (Lines 1770-1783)
```python
def update_plot(self):
    if len(BL.live_data_buffer) >= 500:
        data = np.array(BL.live_data_buffer[-500:])
        self.curve.setData(data)
        
        # Update status based on signal quality
        if np.std(data) > 100:  # ⚠️ HARDCODED THRESHOLD
            self.info_label.setText("⚠ High noise detected | Check electrode contact")
            self.info_label.setStyleSheet("color: #f59e0b; font-size: 13px; padding: 8px;")
        else:
            self.info_label.setText("Signal quality: Good | Data flowing normally")
```

**Problem Identified:**
- ⚠️ **Hardcoded threshold: `std > 100`**
- This is DIFFERENT from the processing layer's noise detection
- Standard deviation of 100 µV is actually reasonable for EEG
- **Threshold too sensitive for real-world signals**

**Recommendation:**
```python
# Current:
if np.std(data) > 100:  # TOO STRICT

# Proposed:
if np.std(data) > 200:  # More realistic for frontal EEG
# AND/OR use the actual processing layer's noise detection
```

---

### 3. Session State Management (Connection Component)

**Location:** `BrainLinkAnalyzer_GUI.py`

#### Function: `on_disconnect_clicked()` (Lines 3262-3283)
```python
def on_disconnect_clicked(self):
    """Disconnect from MindLink device"""
    global stop_thread_flag
    stop_thread_flag = True
    
    if self.serial_obj and self.serial_obj.is_open:
        self.serial_obj.close()
    
    if self.brainlink_thread and self.brainlink_thread.is_alive():
        self.brainlink_thread.join(timeout=2)
    
    self.connect_button.setEnabled(True)
    self.disconnect_button.setEnabled(False)
    
    # Disable calibration buttons
    self.eyes_closed_button.setEnabled(False)
    self.eyes_open_button.setEnabled(False)
    self.task_button.setEnabled(False)
    self.stop_button.setEnabled(False)
    self._set_feature_status("Idle", "idle")
    self._reset_workflow_progress()
    
    self.log_message("✓ Disconnected from MindLink device")
```

**Problem Identified:**
- ❌ **`live_data_buffer` is NOT cleared!**
- ❌ **Feature engine data is NOT reset!**
- ❌ **Plot displays are NOT cleared!**
- ❌ **Session state persists across disconnect/reconnect**

**Global Variable:** `live_data_buffer = []` (Line 179)
- Used in: `onRaw()`, `update_plot()`, multiple dialogs
- **Never explicitly cleared on disconnect**

---

### 4. Feature Analysis Engine State (Processing Component)

**Location:** `BrainLinkAnalyzer_GUI.py` → `FeatureAnalysisEngine` class

**Methods for state management:**
```python
def add_data(self, new_data):
    # Accumulates data in self.buffer, self.baseline_features, self.task_features
    
def compute_baseline_statistics(self):
    # Analyzes self.baseline_features
```

**Problem Identified:**
- ❌ **No `reset()` or `clear_session()` method**
- State accumulates indefinitely
- Disconnecting doesn't clear accumulated features

---

## Root Cause Summary

### Issue 1: "High noise detected" (Too Frequent)

**Root Causes:**
1. **Aggressive noise threshold** in `is_signal_noisy()` (50% ratio)
2. **Separate hardcoded threshold** in UI (std > 100)
3. **No grace period** - single noisy window triggers warning
4. **No adaptive learning** - doesn't adjust to user's baseline

**Affected Files:**
- `BrainLinkAnalyzer_GUI.py` (lines 519-547, 681-688)
- `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` (lines 1777-1783)

---

### Issue 2: Session State Persists After Disconnect

**Root Causes:**
1. **`live_data_buffer` not cleared** on disconnect
2. **Feature engine not reset** on disconnect
3. **Plot displays not cleared** on disconnect
4. **No session boundary management**

**Affected Files:**
- `BrainLinkAnalyzer_GUI.py` (lines 179, 597-708, 3262-3283)
- `BrainLinkAnalyzer_GUI_Enhanced.py` (inherits issue)
- `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` (uses shared buffer)

---

## Proposed Fixes

### Fix 1: Adjust Noise Detection Thresholds

**Priority:** HIGH  
**Complexity:** LOW  
**Impact:** Immediate reduction in false positives

**Changes Required:**

1. **`BrainLinkAnalyzer_GUI.py` - Line 519**
```python
# OLD:
def is_signal_noisy(data_window, fs=512, high_freq_threshold=30.0, high_freq_ratio_thresh=0.5):

# NEW:
def is_signal_noisy(data_window, fs=512, high_freq_threshold=30.0, high_freq_ratio_thresh=0.7):
```

2. **`BrainLinkAnalyzer_GUI_Sequential_Integrated.py` - Line 1777**
```python
# OLD:
if np.std(data) > 100:

# NEW:
if np.std(data) > 200:  # More realistic threshold
```

3. **Add grace period logic** (prevent single-window false alarms)

---

### Fix 2: Implement Proper Session Reset

**Priority:** CRITICAL  
**Complexity:** MEDIUM  
**Impact:** Fixes data persistence issue completely

**Changes Required:**

1. **Add global buffer clear in `on_disconnect_clicked()`**

**File:** `BrainLinkAnalyzer_GUI.py` (after line 3264)
```python
def on_disconnect_clicked(self):
    """Disconnect from MindLink device"""
    global stop_thread_flag, live_data_buffer
    stop_thread_flag = True
    
    # CLEAR SESSION DATA
    live_data_buffer.clear()  # ✅ NEW
    
    if self.serial_obj and self.serial_obj.is_open:
        self.serial_obj.close()
```

2. **Add feature engine reset method**

**File:** `BrainLinkAnalyzer_GUI.py` - Add to FeatureAnalysisEngine class
```python
def reset_session(self):
    """Clear all accumulated data for new session"""
    self.buffer.clear()
    self.baseline_features.clear()
    self.task_features.clear()
    self.baseline_stats = {}
    self.task_results = {}
    self.all_task_results.clear()
    self.current_state = 'idle'
```

3. **Call reset in disconnect handler**
```python
def on_disconnect_clicked(self):
    # ... existing code ...
    
    # Reset feature engine
    if hasattr(self, 'feature_engine'):
        self.feature_engine.reset_session()  # ✅ NEW
```

4. **Clear plot displays**
```python
def on_disconnect_clicked(self):
    # ... existing code ...
    
    # Clear plots
    if hasattr(self, 'plot_widget') and self.plot_widget:
        self.plot_widget.clear()  # ✅ NEW
```

---

### Fix 3: Add Noise Detection Debouncing

**Priority:** MEDIUM  
**Complexity:** MEDIUM  
**Impact:** Smoother UX, fewer jarring warnings

**Add consecutive noise check:**
```python
class NoiseDetector:
    def __init__(self, threshold_count=3):
        self.threshold_count = threshold_count
        self.noisy_count = 0
        
    def check(self, is_noisy):
        if is_noisy:
            self.noisy_count += 1
        else:
            self.noisy_count = max(0, self.noisy_count - 1)
        
        return self.noisy_count >= self.threshold_count
    
    def reset(self):
        self.noisy_count = 0
```

---

### Fix 4: User-Visible Warning Improvements

**Priority:** LOW  
**Complexity:** LOW  
**Impact:** Better communication with user

**Add actionable troubleshooting hints:**
```python
# Instead of just "High noise detected"
if noisy:
    self.info_label.setText(
        "⚠ Signal quality warning\n"
        "Try: Moisten electrode | Adjust headband | Move away from electronics"
    )
```

---

## Implementation Priority

### Phase 1: Critical Fixes (Implement Immediately)
1. ✅ Clear `live_data_buffer` on disconnect
2. ✅ Add `reset_session()` to FeatureAnalysisEngine
3. ✅ Clear plots on disconnect

### Phase 2: Threshold Adjustments (Test & Deploy)
1. ✅ Increase `high_freq_ratio_thresh` to 0.7
2. ✅ Increase std threshold to 200
3. ✅ Add configurable thresholds in settings

### Phase 3: Enhanced UX (Nice to Have)
1. ⏳ Add noise detection debouncing
2. ⏳ Provide actionable troubleshooting hints
3. ⏳ Add "sensitivity" slider for noise detection

---

## Testing Checklist

### Test Case 1: Noise Detection
- [ ] Connect device with good contact
- [ ] Verify "green light" (good signal) is sustained
- [ ] Intentionally move electrode
- [ ] Verify noise warning appears
- [ ] Restore good contact
- [ ] Verify warning clears

### Test Case 2: Session State Reset
- [ ] Connect device and collect data
- [ ] Note buffer size and plot content
- [ ] Disconnect device (turn off)
- [ ] Verify all displays are cleared
- [ ] Reconnect device
- [ ] Verify fresh session (no old data visible)

### Test Case 3: Rapid Disconnect/Reconnect
- [ ] Connect device
- [ ] Immediately disconnect
- [ ] Reconnect
- [ ] Verify no errors, clean state

---

## Files Requiring Changes

### Primary Files:
1. ✅ `BrainLinkAnalyzer_GUI.py`
   - Lines 519-547: `is_signal_noisy()` threshold
   - Lines 966-1164: Add `reset_session()` to FeatureAnalysisEngine
   - Lines 3262-3283: Enhanced `on_disconnect_clicked()`

2. ✅ `BrainLinkAnalyzer_GUI_Enhanced.py`
   - Inherits from base, should get fixes automatically
   - May need override for `reset_session()` if extended

3. ✅ `BrainLinkAnalyzer_GUI_Sequential_Integrated.py`
   - Lines 1777-1783: UI noise threshold adjustment

### Configuration Files:
- Consider adding `config.json` for user-adjustable thresholds

---

## Backward Compatibility

All proposed changes are **backward compatible**:
- Threshold changes are internal
- New methods are additions, not replacements
- Existing functionality preserved

---

## Performance Impact

**Expected:** NEGLIGIBLE to POSITIVE
- Clearing buffers on disconnect: Reduces memory footprint
- Higher thresholds: Less CPU time on false alarm processing
- Debouncing: Slightly more state tracking (minimal)

---

## Related Issues to Monitor

1. **Battery indicator** - May need similar reset logic
2. **Task state** - Ensure tasks don't persist across sessions
3. **Authentication tokens** - Consider session timeout handling

---

## Next Steps

1. Create feature branch: `fix/signal-stability-and-session-reset`
2. Implement Phase 1 critical fixes
3. Write unit tests for `reset_session()`
4. Manual testing with real device
5. Deploy to test environment
6. Gather user feedback
7. Adjust thresholds if needed
8. Merge to main

---

## User Communication

**Email template for user:**
```
Thank you for your feedback! We've identified two issues:

1. Signal Stability: The noise detection was too sensitive. We've adjusted 
   the thresholds to be more realistic for real-world usage.

2. Session Persistence: Data was not being cleared when disconnecting. 
   We've implemented proper session reset functionality.

These fixes will be in the next release. In the meantime:
- Ensure electrode is moistened before use
- Try different headband positions
- Keep device away from other electronics

Please let us know if issues persist!
```
