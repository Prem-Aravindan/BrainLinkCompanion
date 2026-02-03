# BrainLink Analyzer - Application Architecture Documentation

**Purpose**: Complete technical documentation of the BrainLink pipeline architecture, class hierarchies, and integration guidelines for developers.

**Date**: February 3, 2026  
**Version**: 3.0 (Sequential Integrated with Enhanced Features)

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [File Hierarchy](#file-hierarchy)
4. [Class Inheritance Chain](#class-inheritance-chain)
5. [Detailed Component Breakdown](#detailed-component-breakdown)
6. [Data Flow Pipeline](#data-flow-pipeline)
7. [Key Functions & Methods](#key-functions--methods)
8. [Integration Guide for ANT Neuro](#integration-guide-for-ant-neuro)
9. [Build & Deployment](#build--deployment)

---

## 🚀 Quick Start

### Running the Application Locally

**IMPORTANT**: Always run this file only:

```powershell
python BrainLinkAnalyzer_GUI_Sequential_Integrated.py
```

**Do NOT run**:
- ❌ `BrainLinkAnalyzer_GUI.py` (base/parent class only)
- ❌ `BrainLinkAnalyzer_GUI_Enhanced.py` (child class only)

---

## 🏗️ Architecture Overview

### Three-Tier Inheritance Structure

```
┌─────────────────────────────────────────────────────────────┐
│  BrainLinkAnalyzer_GUI_Sequential_Integrated.py             │
│  (Main Application - Run This)                              │
│                                                              │
│  • Sequential workflow UI                                   │
│  • Step-by-step guided interface                           │
│  • Popup dialogs for each phase                            │
│  • User-friendly experience                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ inherits from
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  BrainLinkAnalyzer_GUI_Enhanced.py                          │
│  (Enhanced Features - Child Class)                          │
│                                                              │
│  • Advanced signal processing                               │
│  • Eyes-closed baseline protocol                           │
│  • Artifact detection & rejection                          │
│  • Statistical significance testing                        │
│  • Normalized feature analysis                             │
│  • Cosine similarity scoring                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ inherits from
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  BrainLinkAnalyzer_GUI.py                                   │
│  (Base Implementation - Parent Class)                       │
│                                                              │
│  • Core EEG streaming                                       │
│  • Device connection management                            │
│  • BrainLink SDK integration                               │
│  • Basic signal processing                                 │
│  • Authentication system                                   │
│  • Data recording & export                                 │
└─────────────────────────────────────────────────────────────┘
```

### Why This Structure?

1. **Separation of Concerns**: Each layer adds specific functionality
2. **Maintainability**: Changes to base don't break enhancements
3. **Testability**: Each layer can be tested independently
4. **Flexibility**: Easy to add new UI paradigms (like sequential workflow)

---

## 📁 File Hierarchy

### BrainLinkAnalyzer_GUI.py (BASE/PARENT)
**Location**: `M:\CODEBASE\BrainLinkCompanion\BrainLinkAnalyzer_GUI.py`  
**Lines**: ~4,091  
**Role**: Foundation of the entire system

#### Key Components:

**1. Import & Configuration (Lines 1-90)**
- BrainLink SDK integration via `BrainLinkParser`
- PySide6/Qt6 GUI framework
- PyQtGraph for real-time plotting
- SciPy for signal processing
- Authentication backend URLs

**2. Signal Processing Functions (Lines 463-570)**
```python
def butter_lowpass_filter(data, cutoff, fs, order=2)
def bandpass_filter(data, lowcut=1.0, highcut=45.0, fs=512, order=2)
def notch_filter(data, fs, notch_freq=60.0, quality_factor=30.0)
def compute_psd(data, fs)
def bandpower(psd, freqs, band)
def remove_eye_blink_artifacts(data, window=10)
def check_signal_legitimacy(data_window, ...)
def is_signal_noisy(data_window, fs=512, ...)
```

**3. Device Detection (Lines 571-618)**
```python
def detect_brainlink()
# Returns: list of (port, description) tuples
# Scans for BrainLink devices on COM/tty ports
```

**4. BrainLink Thread Functions (Lines 619-799)**
```python
def onRaw(raw)          # Raw ADC value callback
def onEEG(data)         # Single EEG sample callback
def onExtendEEG(data)   # Extended EEG data callback
def onGyro(x, y, z)     # Gyroscope callback
def onRR(rr1, rr2, rr3) # RR interval callback
def run_brainlink(serial_obj)  # Main BrainLink thread
```

**5. Dialog Classes (Lines 800-990)**
```python
class OSSelectionDialog(QDialog)
# Select operating system (windows/mac/linux/local)

class LoginDialog(QDialog)
# User authentication dialog
```

**6. Feature Analysis Engine (Lines 991-1220)**
```python
class FeatureAnalysisEngine:
    def __init__(self, sampling_rate=512, window_seconds=2.0)
    def extract_features(self, eeg_segment)
    # Returns: Dict with 40+ features including:
    #   - Band powers (Delta, Theta, Alpha, Beta, Gamma)
    #   - Ratios (Alpha/Beta, Theta/Beta, etc.)
    #   - Statistical measures (mean, std, skewness, kurtosis)
    #   - Spectral features (peak frequency, spectral entropy)
```

**7. Main Application Class (Lines 1221-4091)**
```python
class BrainLinkAnalyzerWindow(QMainWindow):
    # Core Methods:
    def __init__(self, user_os, parent=None)
    def setup_ui(self)
    def connect_signals(self)
    def scan_devices(self)
    def connect_device(self)
    def start_streaming(self)
    def stop_streaming(self)
    def update_plot(self)
    def record_baseline(self)
    def analyze_task(self, task_name, duration)
    def export_data(self)
    
    # Key Attributes:
    self.eeg_data_buffer          # Real-time EEG data
    self.baseline_data            # Calibration baseline
    self.task_data                # Task session data
    self.feature_analysis_engine  # Feature extraction
    self.serial_obj               # Serial connection to device
    self.brainlink_thread         # Data acquisition thread
```

---

### BrainLinkAnalyzer_GUI_Enhanced.py (CHILD)
**Location**: `M:\CODEBASE\BrainLinkCompanion\BrainLinkAnalyzer_GUI_Enhanced.py`  
**Lines**: ~7,166  
**Role**: Adds advanced features and enhanced processing

#### Key Enhancements:

**1. Enhanced Configuration (Lines 261-437)**
```python
@dataclass
class EnhancedAnalyzerConfig:
    # Baseline Protocol
    eyes_closed_baseline: bool = True
    baseline_duration_sec: int = 120
    baseline_window_sec: int = 10
    baseline_overlap_sec: int = 5
    
    # Artifact Rejection
    reject_eye_artifacts: bool = True
    blink_threshold_std: float = 3.0
    
    # Normalization
    use_log_power: bool = True
    normalize_by_total_power: bool = False
    
    # Statistical Testing
    use_welch_ttest: bool = True
    fdr_alpha: float = 0.05
    
    # Feature Weighting
    use_feature_weights: bool = True
    
    # Video Integration
    allow_embedded_video: bool = True
```

**2. Crosshair Dialog (Lines 439-452)**
```python
class CrosshairDialog(QDialog):
    # Visual fixation point for eyes-closed baseline
    # Helps users maintain focus during calibration
```

**3. Enhanced Feature Analysis Engine (Lines 454-2750)**
```python
class EnhancedFeatureAnalysisEngine(BL.FeatureAnalysisEngine):
    # Extends base engine with:
    
    def __init__(self, config: EnhancedAnalyzerConfig)
    
    def extract_features(self, eeg_segment):
        # Enhanced feature extraction with:
        # - Log-power transformation
        # - Total power normalization
        # - Additional spectral features
        # - Improved artifact detection
    
    def compute_baseline_statistics(self, baseline_segments):
        # Statistical analysis of baseline windows:
        # - Mean and std per feature
        # - Outlier rejection
        # - Confidence intervals
    
    def compare_task_to_baseline(self, task_features, baseline_stats):
        # Statistical comparison using:
        # - Welch's t-test
        # - Effect size (Cohen's d)
        # - FDR correction
        # - Cosine similarity
    
    def compute_composite_score(self, comparison_results):
        # Aggregate score from:
        # - P-value summation
        # - Feature weights
        # - Cosine similarity
    
    def analyze_across_tasks(self, all_task_data):
        # Multi-task analysis:
        # - ANOVA for each feature
        # - Post-hoc pairwise tests
        # - FDR correction across all tests
```

**4. Enhanced Main Window (Lines 2751-7071)**
```python
class EnhancedBrainLinkAnalyzerWindow(BL.BrainLinkAnalyzerWindow):
    # Extends base window with:
    
    def __init__(self, user_os, parent=None, config=None)
    
    # Enhanced Baseline Recording
    def record_baseline_enhanced(self):
        # - Guided eyes-closed protocol
        # - Real-time quality assessment
        # - Automatic artifact rejection
        # - Multi-window averaging
    
    # Enhanced Task Analysis
    def analyze_task_enhanced(self, task_name, duration):
        # - Continuous quality monitoring
        # - Statistical significance testing
        # - Normalized feature comparison
        # - Detailed reporting
    
    # Battery Monitoring
    def update_battery_status(self, level, version):
        # Real-time battery level display
    
    # Enhanced UI Elements
    def setup_enhanced_ui(self):
        # - Battery status widget
        # - Quality indicator
        # - Statistical significance markers
        # - Enhanced export options
```

**5. Audio Feedback System (Lines 7072-7166)**
```python
class AudioFeedback:
    # Cross-platform audio beeps
    # Task start/end notifications
    # Quality alerts
```

---

### BrainLinkAnalyzer_GUI_Sequential_Integrated.py (MAIN APPLICATION)
**Location**: `M:\CODEBASE\BrainLinkCompanion\BrainLinkAnalyzer_GUI_Sequential_Integrated.py`  
**Lines**: ~5,238  
**Role**: User-facing application with guided workflow

#### Key Features:

**1. Imports & Setup (Lines 1-110)**
```python
# Import the complete Enhanced GUI
from BrainLinkAnalyzer_GUI_Enhanced import (
    EnhancedBrainLinkAnalyzerWindow,
    EnhancedFeatureAnalysisEngine,
    EnhancedAnalyzerConfig,
    BL  # Base module reference
)

# Import signal quality functions
import BrainLinkAnalyzer_GUI as BaseGUI
```

**2. Signal Quality Assessment (Lines 113-360)**
```python
def assess_eeg_signal_quality(data_window, fs=512):
    # Professional multi-metric quality assessment
    # Returns: (quality_score: 0-100, status: str, details: dict)
    
    # Key Checks:
    # - Alpha band presence (8-12 Hz)
    # - Low-frequency dominance (1-8 Hz)
    # - Spectral slope (1/f characteristic)
    # - Amplitude validation
    # - Artifact detection
    # - "Not worn" detection
```

**3. Sequential Workflow Dialogs (Lines 361-5112)**

Multiple specialized dialog classes for each workflow step:

```python
class WelcomeDialog(QDialog)
    # Introduction and system overview
    # Prerequisites check
    # Start workflow button

class DeviceConnectionDialog(QDialog)
    # Auto-detect BrainLink devices
    # Manual device selection
    # Connection status
    # Signal quality check (real-time)

class AuthenticationDialog(QDialog)
    # OS selection
    # User login
    # Token management

class CalibrationInstructionsDialog(QDialog)
    # Baseline recording instructions
    # Eyes-closed protocol guidance
    # Duration and requirements

class CalibrationProgressDialog(QDialog)
    # Real-time baseline recording
    # Quality indicators per window
    # Progress tracking
    # Automatic completion

class TaskSelectionDialog(QDialog)
    # Available protocols list:
    #   - Eyes Open
    #   - Meditation
    #   - Music Listening
    #   - Math Problem
    #   - Reading
    #   - Custom tasks
    # Task configuration
    # Duration selection

class TaskExecutionDialog(QDialog)
    # Task instructions
    # Timer countdown
    # Real-time EEG streaming
    # Quality monitoring
    # Auto-completion

class ResultsDialog(QDialog)
    # Feature comparison to baseline
    # Statistical significance
    # Visualization (bar charts, heatmaps)
    # Composite score
    # Interpretation

class ExportDialog(QDialog)
    # Data export options:
    #   - Raw EEG (CSV)
    #   - Processed features (JSON)
    #   - Analysis report (TXT)
    #   - Plots (PNG)
    # File location selection
```

**4. Main Application Window (Lines 5113-5238)**
```python
class SequentialBrainLinkAnalyzerWindow(EnhancedBrainLinkAnalyzerWindow):
    # Orchestrates the sequential workflow
    
    def __init__(self, user_os, parent=None)
    
    def start_workflow(self):
        # Step 1: Welcome
        # Step 2: Device Connection
        # Step 3: Authentication
        # Step 4: Calibration
        # Step 5: Task Selection & Execution (loop)
        # Step 6: Results & Export
        # Step 7: End or Continue
    
    # Workflow State Management
    self.workflow_state = {
        'connected': False,
        'authenticated': False,
        'calibrated': False,
        'baseline_data': None,
        'task_history': [],
        'current_task': None
    }
```

---

## 🔗 Class Inheritance Chain

### Visual Hierarchy

```python
QMainWindow  (Qt Framework)
    ↓
BrainLinkAnalyzerWindow  (Base - BrainLinkAnalyzer_GUI.py)
    ↓
EnhancedBrainLinkAnalyzerWindow  (Enhanced - BrainLinkAnalyzer_GUI_Enhanced.py)
    ↓
SequentialBrainLinkAnalyzerWindow  (Sequential - BrainLinkAnalyzer_GUI_Sequential_Integrated.py)
```

### Feature Analysis Engine Hierarchy

```python
FeatureAnalysisEngine  (Base - BrainLinkAnalyzer_GUI.py)
    ↓
EnhancedFeatureAnalysisEngine  (Enhanced - BrainLinkAnalyzer_GUI_Enhanced.py)
```

### Method Override Chain

When a method is called on `SequentialBrainLinkAnalyzerWindow`:

1. **Check Sequential class** - Uses its own implementation if exists
2. **Check Enhanced class** - Falls back to enhanced version if overridden
3. **Check Base class** - Falls back to base implementation
4. **Check QMainWindow** - Falls back to Qt framework

Example:
```python
sequential_window.start_streaming()
# Calls: BrainLinkAnalyzerWindow.start_streaming() (Base implementation)
# Because neither Sequential nor Enhanced override it

sequential_window.extract_features(data)
# Calls: EnhancedFeatureAnalysisEngine.extract_features() (Enhanced)
# Because Enhanced overrides the base implementation

sequential_window.show_welcome_dialog()
# Calls: SequentialBrainLinkAnalyzerWindow.show_welcome_dialog()
# Unique to Sequential - not in parent classes
```

---

## 🔄 Data Flow Pipeline

### 1. Device Connection Phase

```
User Action
    ↓
Sequential GUI: DeviceConnectionDialog
    ↓
Base: detect_brainlink() → Scans COM/tty ports
    ↓
Base: connect_device(port) → Opens serial connection
    ↓
Base: run_brainlink(serial_obj) → Starts thread
    ↓
BrainLinkParser callbacks:
    - onRaw(raw_value)
    - onEEG(eeg_sample)
    - onExtendEEG(extended_data)
    ↓
Base: eeg_data_buffer.append(eeg_sample)
```

### 2. Baseline Calibration Phase

```
Sequential GUI: CalibrationInstructionsDialog
    ↓
Sequential GUI: CalibrationProgressDialog
    ↓
Enhanced: record_baseline_enhanced()
    ↓
Loop for N windows (e.g., 12 windows × 10 sec = 120 sec):
    ↓
    Base: Collect 10 seconds of EEG data
        ↓
    Enhanced: assess_eeg_signal_quality(window_data)
        ↓
    If quality OK:
        ↓
        Enhanced: extract_features(window_data)
            ↓
        Enhanced: Store features in baseline_segments[]
    ↓
    If quality BAD:
        ↓
        Skip window / request re-recording
    ↓
Enhanced: compute_baseline_statistics(baseline_segments)
    ↓
Store: baseline_stats (mean, std per feature)
```

### 3. Task Execution Phase

```
Sequential GUI: TaskSelectionDialog
    ↓
User selects task (e.g., "Meditation")
    ↓
Sequential GUI: TaskExecutionDialog
    ↓
Enhanced: analyze_task_enhanced(task_name, duration)
    ↓
Loop for task duration (e.g., 60 seconds):
    ↓
    Base: Collect EEG data in real-time
        ↓
    Every 2 seconds:
        ↓
        Enhanced: extract_features(window_data)
            ↓
        Enhanced: Store in task_segments[]
        ↓
        Enhanced: Update real-time plot
    ↓
Enhanced: Aggregate task_segments into task_features
    ↓
Enhanced: compare_task_to_baseline(task_features, baseline_stats)
    ↓
Returns: {
    feature_name: {
        't_statistic': float,
        'p_value': float,
        'effect_size': float,
        'significant': bool,
        'task_mean': float,
        'baseline_mean': float
    },
    ...
}
    ↓
Enhanced: compute_composite_score(comparison_results)
    ↓
Returns: composite_score (0-100)
```

### 4. Results & Export Phase

```
Sequential GUI: ResultsDialog
    ↓
Display:
    - Feature comparison table
    - Significant features (p < 0.05)
    - Bar charts (task vs baseline)
    - Composite score
    - Interpretation text
    ↓
Sequential GUI: ExportDialog
    ↓
Export options:
    ↓
    Raw EEG → CSV file
    ↓
    Features → JSON file
    ↓
    Report → TXT file
    ↓
    Plots → PNG files
```

---

## 🔧 Key Functions & Methods

### Device Management

| Function | Location | Purpose |
|----------|----------|---------|
| `detect_brainlink()` | Base (line 571) | Scan for BrainLink devices |
| `connect_device(port)` | Base (line ~1500) | Establish serial connection |
| `run_brainlink(serial_obj)` | Base (line 770) | Main data acquisition thread |
| `disconnect_device()` | Base (line ~1600) | Close connection safely |

### Signal Processing

| Function | Location | Purpose |
|----------|----------|---------|
| `butter_lowpass_filter()` | Base (line 463) | Low-pass filter (remove high-freq noise) |
| `bandpass_filter()` | Base (line 469) | Band-pass filter (1-45 Hz typical) |
| `notch_filter()` | Base (line 474) | Remove 50/60 Hz power line noise |
| `compute_psd()` | Base (line 479) | Power spectral density (Welch method) |
| `bandpower()` | Base (line 483) | Calculate power in frequency band |
| `remove_eye_blink_artifacts()` | Base (line 488) | Detect and remove blinks |

### Feature Extraction

| Method | Location | Purpose |
|--------|----------|---------|
| `FeatureAnalysisEngine.extract_features()` | Base (line ~1050) | Extract 40+ features from EEG segment |
| `EnhancedFeatureAnalysisEngine.extract_features()` | Enhanced (line ~500) | Enhanced extraction with normalization |
| `compute_baseline_statistics()` | Enhanced (line ~800) | Statistical summary of baseline |
| `compare_task_to_baseline()` | Enhanced (line ~1200) | Welch's t-test comparison |
| `compute_composite_score()` | Enhanced (line ~1500) | Aggregate significance score |

### Quality Assessment

| Function | Location | Purpose |
|----------|----------|---------|
| `check_signal_legitimacy()` | Base (line 504) | Detect flatline/constant signals |
| `is_signal_noisy()` | Base (line 540) | Detect high-frequency noise |
| `assess_eeg_signal_quality()` | Sequential (line 113) | Comprehensive quality metrics |

### User Interface

| Method | Location | Purpose |
|--------|----------|---------|
| `setup_ui()` | Base (line ~1300) | Build main window UI |
| `update_plot()` | Base (line ~2000) | Real-time EEG plot update |
| `show_welcome_dialog()` | Sequential (line ~400) | Welcome screen |
| `show_device_connection_dialog()` | Sequential (line ~800) | Device connection UI |
| `show_calibration_dialog()` | Sequential (line ~1500) | Baseline recording UI |
| `show_task_dialog()` | Sequential (line ~3000) | Task execution UI |
| `show_results_dialog()` | Sequential (line ~4000) | Results display |

---

## 🔌 Integration Guide for ANT Neuro

### Strategy: Parallel Independent System

**Do NOT modify the existing BrainLink pipeline.** Instead, create a parallel system:

```
BrainLinkCompanion/
├── BrainLinkAnalyzer_GUI_Sequential_Integrated.py  ← BrainLink (1-channel)
│
└── antNeuro/
    ├── AntNeuroAnalyzer_GUI.py  ← NEW: ANT Neuro main app (64-channel)
    ├── antneuro_data_acquisition.py  ← Device interface
    └── antneuro_feature_engine.py  ← NEW: 64-channel feature extraction
```

### Step 1: Create ANT Neuro Main Application

Create `antNeuro/AntNeuroAnalyzer_GUI.py` by copying the structure from Sequential, but:

**Replace Device Layer:**
```python
# DON'T USE:
from BrainLinkParser.BrainLinkParser import BrainLinkParser

# USE INSTEAD:
from antneuro_data_acquisition import AntNeuroDevice
```

**Replace Connection Logic:**
```python
# BrainLink (OLD):
def connect_device(self, port):
    self.serial_obj = CushySerial(port, 115200)
    self.brainlink_thread = threading.Thread(
        target=run_brainlink, 
        args=(self.serial_obj,)
    )
    self.brainlink_thread.start()

# ANT Neuro (NEW):
def connect_device(self, amplifier_serial=None):
    self.antneuro_device = AntNeuroDevice()
    amplifiers = self.antneuro_device.discover_amplifiers()
    self.antneuro_device.connect(amplifier_serial)
    self.antneuro_device.start_streaming(sample_rate=500)
    
    # Start data reading thread
    self.data_thread = threading.Thread(
        target=self.read_antneuro_data
    )
    self.data_thread.start()

def read_antneuro_data(self):
    while self.streaming:
        data = self.antneuro_device.read_samples(250)  # 0.5 sec at 500Hz
        if data is not None:
            # data shape: (samples, 64 channels)
            for sample in data:
                # sample is array of 64 values
                self.eeg_data_buffer.append(sample)
```

### Step 2: Adapt Feature Extraction for 64 Channels

Create `antNeuro/antneuro_feature_engine.py`:

```python
class AntNeuroFeatureEngine:
    """Feature extraction for 64-channel EEG"""
    
    def __init__(self, sampling_rate=500, num_channels=64):
        self.fs = sampling_rate
        self.num_channels = num_channels
    
    def extract_features(self, eeg_segment):
        """
        Extract features from 64-channel segment
        
        Args:
            eeg_segment: np.array of shape (samples, 64)
        
        Returns:
            Dict with features per channel + spatial features
        """
        features = {}
        
        # Per-channel features (same as BrainLink)
        for ch in range(self.num_channels):
            channel_data = eeg_segment[:, ch]
            ch_features = self._extract_channel_features(channel_data)
            features[f'ch{ch+1}'] = ch_features
        
        # Spatial features (new for multi-channel)
        features['spatial'] = self._extract_spatial_features(eeg_segment)
        
        return features
    
    def _extract_channel_features(self, channel_data):
        """Same as BrainLink single-channel extraction"""
        # Copy logic from FeatureAnalysisEngine.extract_features()
        # Returns: band powers, ratios, statistics
        pass
    
    def _extract_spatial_features(self, multi_channel_data):
        """New spatial features for 64 channels"""
        return {
            'channel_coherence': self._compute_coherence(multi_channel_data),
            'spatial_variance': self._compute_spatial_variance(multi_channel_data),
            'asymmetry_indices': self._compute_asymmetry(multi_channel_data),
            'laplacian_features': self._compute_laplacian(multi_channel_data)
        }
```

### Step 3: Modify UI for 64-Channel Visualization

Replace single-channel plot with multi-channel grid:

```python
# BrainLink (1 channel):
def setup_plot(self):
    self.plot_widget = pg.PlotWidget()
    self.plot_curve = self.plot_widget.plot(pen='y')

# ANT Neuro (64 channels):
def setup_plot(self):
    # Create 8x8 grid for 64 channels
    self.plot_grid = QGridLayout()
    self.channel_plots = []
    
    for i in range(64):
        row = i // 8
        col = i % 8
        
        plot = pg.PlotWidget()
        plot.setTitle(f'Ch {i+1}')
        plot.setMaximumHeight(100)
        curve = plot.plot(pen='y')
        
        self.channel_plots.append((plot, curve))
        self.plot_grid.addWidget(plot, row, col)
```

### Step 4: Keep Shared Analysis Logic

**REUSE** these components without modification:
- Signal processing functions (filters, PSD, bandpower)
- Statistical testing (Welch's t-test, FDR correction)
- Sequential workflow dialogs (modify only data source)
- Export functionality (adapt for multi-channel format)

### Step 5: Build Separate Executable

Create `build_scripts/build_antneuro.ps1`:

```powershell
# Build ANT Neuro Analyzer separately
pyinstaller `
    --name="AntNeuroAnalyzer" `
    --onefile `
    --windowed `
    --icon="assets/antneuro_icon.ico" `
    --add-data "antNeuro;antNeuro" `
    --add-data "eego_sdk_toolbox;eego_sdk_toolbox" `
    --hidden-import="eego_sdk" `
    antNeuro/AntNeuroAnalyzer_GUI.py
```

### File Structure After Integration

```
BrainLinkCompanion/
│
├── BrainLinkAnalyzer_GUI.py                 ← BrainLink Base
├── BrainLinkAnalyzer_GUI_Enhanced.py        ← BrainLink Enhanced
├── BrainLinkAnalyzer_GUI_Sequential_Integrated.py  ← BrainLink Main
│
├── antNeuro/
│   ├── AntNeuroAnalyzer_GUI.py              ← NEW: ANT Neuro Main
│   ├── antneuro_data_acquisition.py         ← Device interface
│   ├── antneuro_feature_engine.py           ← NEW: Feature extraction
│   ├── antneuro_visualization.py            ← NEW: Multi-channel plots
│   └── antneuro_sequential_workflow.py      ← NEW: Sequential UI
│
├── build_scripts/
│   ├── build_brainlink.ps1                  ← BrainLink build
│   └── build_antneuro.ps1                   ← NEW: ANT Neuro build
│
└── shared/  ← NEW: Shared utilities
    ├── signal_processing.py                 ← Filters, PSD, bandpower
    ├── statistical_tests.py                 ← T-tests, FDR, etc.
    └── export_utilities.py                  ← Data export functions
```

---

## 📦 Build & Deployment

### Building BrainLink Executable

```powershell
cd build_scripts
.\build_brainlink.ps1
```

Output: `dist/BrainLinkAnalyzer.exe` (~150 MB)

### Building ANT Neuro Executable (Future)

```powershell
cd build_scripts
.\build_antneuro.ps1
```

Output: `dist/AntNeuroAnalyzer.exe` (~200 MB due to SDK)

### PyInstaller Spec File Structure

**BrainLinkAnalyzer.spec** (existing):
```python
a = Analysis(
    ['BrainLinkAnalyzer_GUI_Sequential_Integrated.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('assets', 'assets'),
        ('BrainLinkParser', 'BrainLinkParser'),
    ],
    hiddenimports=[
        'BrainLinkAnalyzer_GUI',
        'BrainLinkAnalyzer_GUI_Enhanced',
        'cushy_serial',
        'serial.tools.list_ports',
    ],
    ...
)
```

**AntNeuroAnalyzer.spec** (to create):
```python
a = Analysis(
    ['antNeuro/AntNeuroAnalyzer_GUI.py'],
    pathex=[],
    binaries=[
        ('eego_sdk_toolbox/*.dll', 'eego_sdk_toolbox'),
        ('eego_sdk_toolbox/*.pyd', 'eego_sdk_toolbox'),
    ],
    datas=[
        ('assets', 'assets'),
        ('eego_sdk_toolbox', 'eego_sdk_toolbox'),
        ('antNeuro', 'antNeuro'),
    ],
    hiddenimports=[
        'eego_sdk',
        'numpy',
        'scipy',
    ],
    ...
)
```

---

## 📊 Summary Table

| Aspect | BrainLink System | ANT Neuro System (To Build) |
|--------|------------------|----------------------------|
| **Hardware** | 1-channel BrainLink headset | 64-channel ANT Neuro eego |
| **Connection** | Bluetooth (COM port) | USB/Network |
| **Sampling Rate** | 512 Hz | 500-2000 Hz |
| **Main File** | `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` | `antNeuro/AntNeuroAnalyzer_GUI.py` |
| **Device Interface** | `BrainLinkParser` | `antneuro_data_acquisition.py` |
| **Feature Engine** | `FeatureAnalysisEngine` (base) | `AntNeuroFeatureEngine` (new) |
| **Visualization** | Single channel plot | 64-channel grid |
| **Executable** | `BrainLinkAnalyzer.exe` | `AntNeuroAnalyzer.exe` |
| **SDK Required** | BrainLink SDK (embedded) | ANT Neuro SDK (eego_sdk.pyd) |
| **Python Version** | 3.9-3.12 | 3.13+ (SDK requirement) |

---

## 🎯 Key Takeaways for Developers

1. **Always run** `BrainLinkAnalyzer_GUI_Sequential_Integrated.py` - it's the entry point
2. **Inheritance chain**: Sequential → Enhanced → Base → QMainWindow
3. **Data flows** through: Device → Thread → Buffer → Processing → UI
4. **For ANT Neuro**: Create parallel system, don't modify BrainLink files
5. **Reuse** signal processing and statistical code across both systems
6. **Separate builds** for each device type (different executables)

---

## 📝 Development Checklist

When working on this codebase:

- [ ] Understand the three-file hierarchy
- [ ] Know which file to run (Sequential Integrated)
- [ ] Identify which class/method needs modification
- [ ] Check inheritance chain to find actual implementation
- [ ] Test changes at each layer independently
- [ ] For ANT Neuro: Create new files, don't modify existing
- [ ] Document any new classes or major methods
- [ ] Update this documentation when architecture changes

---

**Document Version**: 1.0  
**Last Updated**: February 3, 2026  
**Maintained By**: Development Team  
**Next Review**: When ANT Neuro integration begins
