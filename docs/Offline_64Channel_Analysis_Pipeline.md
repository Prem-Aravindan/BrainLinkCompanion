# Offline 64-Channel EEG Analysis Pipeline
## Technical Documentation

**System**: BrainLink Companion - ANT Neuro Integration  
**Version**: 2.0 (Offline Analysis)  
**Date**: February 2026  
**Author**: BrainLink Companion Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1: Real-Time Data Recording](#phase-1-real-time-data-recording)
4. [Phase 2: Offline Feature Extraction](#phase-2-offline-feature-extraction)
5. [Feature Types and Calculations](#feature-types-and-calculations)
6. [Statistical Analysis Pipeline](#statistical-analysis-pipeline)
7. [File Formats and Storage](#file-formats-and-storage)
8. [Performance Characteristics](#performance-characteristics)
9. [Advantages Over Live Processing](#advantages-over-live-processing)

---

## Overview

### Purpose
The Offline 64-Channel EEG Analysis Pipeline is designed to separate **data acquisition** from **feature extraction and analysis**. This approach eliminates computational overhead during EEG streaming, preserves raw data for reanalysis, and allows for comprehensive multi-channel feature extraction without time pressure.

### Key Principle
**Record Everything, Process Later**

During streaming sessions, the system records all 64 channels of raw EEG data to disk with precise timestamps. Feature extraction and statistical analysis are performed offline when the user clicks "Analyze," allowing for sophisticated processing without risking data loss or streaming interruptions.

---

## Architecture

### Two-Phase Design

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1: RECORDING                       │
│                    (During Streaming)                       │
├─────────────────────────────────────────────────────────────┤
│  EEG Stream (500 Hz) → Raw Data Buffer → CSV File          │
│                                                             │
│  User Actions → Phase Markers → Timestamp Recording        │
│                                                             │
│  Computational Load: MINIMAL (file I/O only)               │
└─────────────────────────────────────────────────────────────┘

                            ↓

┌─────────────────────────────────────────────────────────────┐
│                    PHASE 2: ANALYSIS                        │
│                    (When "Analyze" Clicked)                 │
├─────────────────────────────────────────────────────────────┤
│  Load Raw Data → Segment by Phase → Extract Features       │
│                                                             │
│  1,400+ Features/Window → Statistical Analysis             │
│                                                             │
│  Computational Load: HIGH (but not time-critical)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Real-Time Data Recording

### 1.1 Data Acquisition

**Hardware**: ANT Neuro eego™ amplifier (64 channels, 500 Hz sampling rate)

**Transmission**: 
- EDI2 gRPC API streams data in batches (typically 50-100 samples per callback)
- Data arrives in Volts, converted to microvolts (µV) immediately
- Original precision: 24-bit ADC resolution

**Buffer Management**:
- In-memory circular buffer: 10 seconds (5,000 samples × 64 channels)
- Continuous write to disk via CSV file handle
- Thread-safe writing with mutex locks

### 1.2 Channel Configuration

**64-Channel Layout** (NA-265 waveguard cap):

- **Connector 1** (Channels 0-31):
  - Frontal: Fp1, Fp2, F9, F7, F3, Fz, F4, F8, F10
  - Fronto-Central: FC5, FC1, FC2, FC6
  - Temporal: T9, T7, T10
  - Central: C3, C4
  - Centro-Parietal: CP5, CP1, CP2, CP6
  - Parietal: P9, P7, P3, Pz, P4, P8, P10
  - Occipital: O1, O2

- **Connector 2** (Channels 32-63):
  - Anterior Frontal: AF7, AF3, AF4, AF8
  - Frontal: F5, F1, F2, F6
  - Fronto-Central: FC3, FCz, FC4
  - Central: C5, C1, C2, C6
  - Centro-Parietal: CP3, CP4
  - Parietal: P5, P1, P2, P6
  - Parieto-Occipital: PO5, PO3, PO4, PO6, PO7, PO8, POz
  - Fronto-Temporal: FT7, FT8
  - Temporo-Parietal: TP7, TP8

### 1.3 Phase Marking System

**Purpose**: Mark specific time intervals for different experimental conditions

**Phases Tracked**:
1. **Eyes-Closed Baseline** (typically 30 seconds)
   - Purpose: Establish resting-state baseline with minimal visual input
   - Used for: Baseline normalization, alpha rhythm assessment

2. **Eyes-Open Baseline** (typically 30 seconds)
   - Purpose: Assess alpha suppression, active resting state
   - Used for: Comparative baseline, arousal assessment

3. **Task Execution** (typically 60 seconds per task)
   - Purpose: Record task-specific brain activity
   - Task types: Visual imagery, attention focus, motor imagery, etc.
   - Multiple tasks supported in single session

**Marker Data Structure**:
- Phase name (string): "eyes_closed", "eyes_open", "task"
- Task type (string or null): Task identifier for task phases
- Start timestamp (float): Seconds from recording start
- End timestamp (float): Seconds from recording start

**Timing Precision**: 
- Timestamps accurate to ±1ms
- Synchronized with sample indices for exact sample-level alignment

### 1.4 File Writing

**CSV Structure**:
- **Header Row**: `timestamp,sample_index,Fp1,Fp2,...,POz`
- **Data Rows**: One row per sample (500 rows/second)
- **Format**: Comma-separated values, 6 decimal places for precision

**Write Strategy**:
- Batch writes (50-100 samples at once) for efficiency
- Immediate flush to disk for data safety
- Mutex-protected for thread safety

**Storage Location**: 
- Default: `~/BrainLink_Recordings/` (user home directory)
- Configurable via engine initialization

**File Naming**: 
- Pattern: `session_YYYYMMDD_HHMMSS.csv`
- Example: `session_20260206_150540.csv`

---

## Phase 2: Offline Feature Extraction

### 2.1 Data Loading and Segmentation

**Loading Process**:
1. Read phase markers from JSON file
2. Load raw data from CSV (or use in-memory buffer if available)
3. Convert to NumPy array: shape (n_samples, 64)
4. Extract timestamp column for temporal alignment

**Segmentation**:
- For each phase marker:
  - Extract samples where `timestamp >= start AND timestamp <= end`
  - Validate minimum data length (at least 256 samples for FFT)
  - Store as separate phase-specific dataset

**Example Segmentation**:
```
Full Recording: 90,033 samples (180.07 seconds @ 500 Hz)

Segment 1 (eyes_closed): samples 0-14,824 (29.65 seconds)
Segment 2 (eyes_open): samples 21,667-36,664 (30.00 seconds)
Segment 3 (task - visual_imagery): samples 39,890-69,921 (60.06 seconds)
Segment 4 (task - attention_focus): samples 84,047-114,086 (60.08 seconds)
```

### 2.2 Windowing Strategy

**Window Parameters**:
- **Window Size**: 2.0 seconds (1,000 samples @ 500 Hz)
- **Overlap**: 50% (500 samples)
- **Step Size**: 1.0 second (500 samples)

**Rationale**:
- 2 seconds provides adequate frequency resolution (0.5 Hz bins)
- 50% overlap captures transient events more reliably
- Balances temporal resolution with statistical power

**Window Count Calculation**:
```
Number of Windows = floor((n_samples - window_size) / step_size) + 1

Example for 30-second baseline:
n_samples = 15,000 (30s × 500 Hz)
window_size = 1,000
step_size = 500
Number of Windows = floor((15,000 - 1,000) / 500) + 1 = 29 windows
```

### 2.3 Preprocessing Per Window

**Step 1: DC Offset Removal**
- Compute mean across time dimension for each channel
- Subtract channel-wise mean from all samples
- Purpose: Remove baseline drift and amplifier offset

**Step 2: Notch Filtering**
- **Filter Type**: IIR Notch Filter (Butterworth)
- **Target Frequency**: 60 Hz (50 Hz for European systems)
- **Bandwidth (Q factor)**: 30
- **Purpose**: Remove electrical line noise
- **Implementation**: Applied independently to all 64 channels using vectorized operations

**Step 3: Power Spectral Density (PSD) Computation**
- **Method**: Welch's method (scipy.signal.welch)
- **Segment Length**: 256 samples (nperseg parameter)
- **Window Function**: Hann window (default)
- **Overlap**: 50% (128 samples)
- **Output**: Frequency bins from 0-250 Hz, power in µV²/Hz
- **Efficiency**: Computed for all 64 channels simultaneously

---

## Feature Types and Calculations

### 3.1 Frequency Band Definitions

**Standard EEG Bands**:
| Band | Frequency Range | Associated States |
|------|-----------------|-------------------|
| Delta (δ) | 0.5 - 4 Hz | Deep sleep, unconscious processes |
| Theta (θ) | 4 - 8 Hz | Drowsiness, meditation, memory encoding |
| Alpha (α) | 8 - 13 Hz | Relaxed wakefulness, eyes closed |
| Beta (β) | 13 - 30 Hz | Active thinking, focus, anxiety |
| Gamma (γ) | 30 - 45 Hz | Cognitive processing, binding |

**Implementation Note**: Band edges chosen to avoid overlap, enabling independent power calculations.

### 3.2 Per-Channel Features (64 channels × 17 features = 1,088 features)

For **each of 64 channels**, the following features are extracted:

#### 3.2.1 Band Power Features (5 bands × 3 metrics = 15)

**Absolute Power** (5 features):
- Sum of PSD values within each frequency band
- Units: µV²
- Interpretation: Total energy in that frequency range
- Calculation: `power = sum(PSD[freq >= low & freq <= high])`

**Relative Power** (5 features):
- Band power normalized by total power across all frequencies
- Units: Ratio (0-1)
- Interpretation: Proportion of total energy in that band
- Calculation: `relative = band_power / (sum(PSD) + epsilon)`
- Purpose: Compensates for individual differences in overall EEG amplitude

**Peak Frequency** (5 features):
- Frequency with maximum power within each band
- Units: Hz
- Interpretation: Dominant oscillation frequency in that band
- Example: Individual alpha frequency (IAF) typically 9-11 Hz
- Calculation: `peak_freq = freq[argmax(PSD[band_mask])]`

#### 3.2.2 Cross-Band Ratio Features (2 features)

**Alpha/Theta Ratio**:
- Ratio of alpha power to theta power
- Interpretation: 
  - High ratio: Alert, focused state
  - Low ratio: Drowsy, unfocused state
- Clinical relevance: ADHD biomarker, meditation depth

**Beta/Alpha Ratio**:
- Ratio of beta power to alpha power
- Interpretation:
  - High ratio: Active cognitive processing, potential anxiety
  - Low ratio: Relaxed mental state
- Clinical relevance: Stress, anxiety assessment

**Total Channel Power** (1 feature):
- Sum of PSD across all frequencies
- Units: µV²
- Purpose: Overall signal strength per channel

### 3.3 Regional Features (5 regions × 12 features = 60 features)

**Brain Regions Defined**:

1. **Frontal Region** (17 channels):
   - Channels: Fp1, Fp2, F7, F3, Fz, F4, F8, F9, F10, AF7, AF3, AF4, AF8, F5, F1, F2, F6
   - Functions: Executive control, decision making, working memory

2. **Central Region** (13 channels):
   - Channels: FC5, FC1, FC2, FC6, C3, C4, FC3, FCz, FC4, C5, C1, C2, C6
   - Functions: Motor control, sensorimotor integration

3. **Temporal Region** (8 channels):
   - Channels: T7, T8, T9, T10, FT7, FT8, TP7, TP8
   - Functions: Auditory processing, language, memory

4. **Parietal Region** (17 channels):
   - Channels: CP5, CP1, CP2, CP6, P7, P3, Pz, P4, P8, P9, P10, CP3, CP4, P5, P1, P2, P6
   - Functions: Spatial processing, attention, sensory integration

5. **Occipital Region** (9 channels):
   - Channels: O1, O2, PO5, PO3, PO4, PO6, PO7, PO8, POz
   - Functions: Visual processing, visual imagery

**Regional Feature Calculation**:
- Average PSD computed across all channels in region
- Same 12 features extracted as per-channel (5 band powers, 5 relative powers, 2 ratios)
- Reduces noise by spatial averaging
- Provides region-level functional assessment

### 3.4 Spatial Features (135-165 features)

#### 3.4.1 Hemispheric Asymmetry (27 pairs × 5 bands = 135 features)

**Electrode Pairs**:
- Frontal: Fp1-Fp2, F7-F8, F3-F4, F5-F6, F1-F2, AF7-AF8, AF3-AF4
- Central: FC5-FC6, FC1-FC2, FC3-FC4, C5-C6, C1-C2, C3-C4
- Temporal: T7-T8, FT7-FT8, TP7-TP8
- Parietal: CP5-CP6, CP1-CP2, CP3-CP4, P7-P8, P3-P4, P5-P6, P1-P2
- Occipital: O1-O2, PO7-PO8, PO5-PO6, PO3-PO4

**Asymmetry Index Calculation** (Davidson Method):
```
Asymmetry Index = ln(Right Power) - ln(Left Power)
```
- **Positive values**: Right hemisphere dominance
- **Negative values**: Left hemisphere dominance
- **Zero**: Balanced bilateral activity

**Per Pair, Per Band**:
- Computed for all 5 frequency bands
- Total: 27 pairs × 5 bands = 135 asymmetry indices

**Clinical Significance**:
- **Frontal Alpha Asymmetry (F3-F4)**:
  - Right > Left: Approach motivation, positive affect
  - Left > Right: Withdrawal motivation, negative affect
  - Key biomarker for depression, emotional processing

- **Parietal Asymmetry**:
  - Relates to spatial attention, hemispatial neglect

#### 3.4.2 Frontal Alpha Asymmetry (FAA) (1 feature)

**Special Feature**:
- Specifically computed for F3-F4 electrode pair in alpha band (8-13 Hz)
- Most extensively studied EEG asymmetry measure
- Calculation: `FAA = ln(F4_alpha) - ln(F3_alpha)`

**Interpretation**:
- FAA > 0: Right frontal dominance → withdrawal, negative emotion
- FAA < 0: Left frontal dominance → approach, positive emotion

**Research Applications**:
- Depression screening
- Emotion regulation assessment
- Therapeutic response prediction

#### 3.4.3 Inter-Regional Coherence (5 pairs × 5 bands = 25 features)

**Region Pairs Analyzed**:
1. Frontal ↔ Parietal (working memory, attention networks)
2. Frontal ↔ Occipital (top-down visual control)
3. Central ↔ Parietal (sensorimotor integration)
4. Temporal ↔ Parietal (language-spatial integration)
5. Frontal ↔ Temporal (executive-memory networks)

**Coherence Calculation**:
- Method: Magnitude-squared coherence (scipy.signal.coherence)
- Segment length: 128 samples (0.256 seconds)
- Output: Coherence values 0-1 per frequency bin
- Per band: Average coherence across frequencies in that band

**Interpretation**:
- **High Coherence (0.7-1.0)**: Strong functional connectivity, synchronized activity
- **Medium Coherence (0.3-0.7)**: Moderate coupling
- **Low Coherence (0-0.3)**: Independent activity, poor communication

**Functional Significance**:
- Frontal-Parietal coherence: Attention network integrity
- Frontal-Occipital coherence: Visual attention control
- Inter-hemispheric coherence: Corpus callosum integrity

#### 3.4.4 Global Field Power (GFP) (3 features)

**Definition**: 
Standard deviation of voltage across all channels at each time point

**Calculation**:
```
For each time point t:
  GFP(t) = std(voltages across 64 channels at time t)
```

**Features Extracted**:
1. **Mean GFP**: Average spatial voltage variation over the window
2. **Std GFP**: Variability of spatial patterns over time
3. **Max GFP**: Peak spatial voltage difference (event detection)

**Interpretation**:
- High GFP: Strong, spatially distributed brain activity (e.g., evoked potentials)
- Low GFP: Weak or spatially localized activity
- GFP peaks: Microstate transitions, event-related activity

**Applications**:
- Microstate analysis
- Global brain state assessment
- Event detection without channel selection bias

### 3.5 Global Summary Features (15 features)

**Global Band Powers** (5 features):
- Average PSD across all 64 channels
- Then compute band power from averaged PSD
- Represents whole-brain activity in each band

**Global Relative Powers** (5 features):
- Global band power / global total power
- Overall spectral distribution

**Global Ratios** (2 features):
- Global alpha/theta ratio
- Global beta/alpha ratio

**Quality Metrics** (3 features):
1. **Number of Good Channels**: Channels with power above 10th percentile
   - Identifies channels with poor contact or artifacts
   - Typically expect 60-64 good channels

2. **Number of Features Extracted**: Total feature count for this window
   - Varies slightly based on NaN/invalid values
   - Typically 1,400-1,500 features

3. **Global Total Power**: Sum of all frequencies, all channels
   - Overall signal strength metric

---

## Statistical Analysis Pipeline

### 4.1 Baseline Computation

**Purpose**: Establish individual-specific reference values for feature normalization

**Baseline Source**: Eyes-closed resting state (typically 28-30 windows)

**Statistics Computed Per Feature**:
1. **Mean**: Central tendency
2. **Standard Deviation**: Variability (with epsilon = 1e-12 to prevent division by zero)
3. **Median**: Robust central tendency

**Storage**: Dictionary mapping feature names to statistics

**Usage**: Z-score normalization during task analysis

### 4.2 Task Feature Collection

**Process**:
- Features extracted from task windows (typically 58 windows per 60s task)
- Stored separately per task type
- No normalization applied during extraction (raw values preserved)

**Data Structure**:
- Task name → List of feature dictionaries
- Each dictionary: 1,400+ key-value pairs (feature name: value)

### 4.3 Multi-Task Comparison Analysis

**Objective**: Determine which features significantly differ between tasks

**Analysis Steps**:

#### Step 1: Feature Alignment
- Collect all feature names from all tasks
- Create feature matrix: rows = windows, columns = features
- Handle missing features (rare) with NaN imputation

#### Step 2: Z-Score Normalization
```
For each feature:
  z_score = (task_value - baseline_mean) / (baseline_std + epsilon)
```
- Removes individual differences
- Makes features comparable across different scales
- Enables cross-feature statistical testing

#### Step 3: Fisher's Method for P-Value Combination

**Purpose**: Combine evidence across multiple permutation blocks

**Formula**:
```
χ² = -2 × Σ ln(p_i)
Degrees of freedom = 2k (where k = number of p-values)
```

**Application**:
- Combines p-values from block-wise permutation tests
- More sensitive to weak but consistent effects
- Chi-squared distribution for significance testing

#### Step 4: Kost-McDermott Correction

**Purpose**: Adjust for correlation between features

**Problem**: 
- Traditional Bonferroni correction assumes independent tests
- EEG features are highly correlated (e.g., adjacent channels, related bands)
- Bonferroni is overly conservative

**Solution**:
- Estimate effective number of independent tests
- Based on correlation matrix of features
- Adjusted degrees of freedom: `df_KM = df_original / (1 + mean_correlation)`

**Benefits**:
- More powerful than Bonferroni
- Still controls family-wise error rate
- Accounts for feature dependency structure

#### Step 5: Statistical Testing (Fast Mode vs Full Mode)

The system supports two analysis modes to balance speed and rigor:

**Fast Mode (Default for 64-Channel)**:
- Uses Welch's t-test for per-feature significance
- Uses Fisher's method with chi-square approximation for combined p-values
- FDR (Benjamini-Hochberg) correction for multiple comparisons
- **Speed**: ~30 seconds for full 1,400-feature analysis
- **Use case**: Interactive analysis, immediate feedback

**Full Mode (Research-Grade)**:
- Block permutation testing with 500-1000 permutations
- Kost-McDermott correction for feature correlation
- More conservative, better for publication
- **Speed**: 10-20 minutes for full analysis
- **Use case**: Final analysis, publication-ready results

**Fast Mode Details**:
1. For each feature: Welch's t-test (task vs baseline)
2. Collect all p-values across features
3. Apply FDR correction (controls false discovery rate)
4. For omnibus testing: Fisher's method with chi-square approximation
   ```
   χ² = -2 × Σ ln(p_i)
   p_combined = 1 - CDF_chi2(χ², df=2k)
   ```

**Why Fast Mode is Statistically Valid**:
- Welch's t-test is robust to unequal variances
- FDR correction is widely accepted in neuroscience
- Chi-square approximation of Fisher's method is accurate for k > 20 features
- With 1,400+ features, approximation error is negligible

**Output**:
- List of significant features ranked by p-value
- Effect sizes (mean difference between tasks)
- Confidence intervals

---

## File Formats and Storage

### 5.1 Raw Data CSV

**File**: `session_YYYYMMDD_HHMMSS.csv`

**Structure**:
```
timestamp,sample_index,Fp1,Fp2,F9,F7,...,POz
0.000998,0,-54.587880,-27.007840,...,-55.503400
0.002998,1,-51.040240,-24.032400,...,-57.220000
...
```

**Specifications**:
- **Delimiter**: Comma
- **Precision**: 6 decimal places
- **Timestamp**: Seconds from recording start (float)
- **Sample Index**: Integer counter (0-based)
- **Voltage Columns**: 64 channels in µV (float)

**File Size Estimates**:
- 60 seconds: ~20 MB
- 180 seconds (full session): ~60 MB
- Compression potential: ~80% with gzip

### 5.2 Phase Markers JSON

**File**: `markers_YYYYMMDD_HHMMSS.json`

**Structure**:
```json
{
  "session_id": "20260206_150540",
  "sample_rate": 500,
  "channel_count": 64,
  "channel_names": ["Fp1", "Fp2", ..., "POz"],
  "recording_file": "C:\\Users\\...\\session_20260206_150540.csv",
  "phase_markers": [
    {
      "phase": "eyes_closed",
      "task": null,
      "start": -0.366,
      "end": 29.648
    },
    ...
  ]
}
```

**Fields**:
- **session_id**: Unique identifier matching CSV filename
- **sample_rate**: Sampling frequency (Hz)
- **channel_count**: Number of channels recorded
- **channel_names**: Ordered list of electrode names
- **recording_file**: Absolute path to associated CSV file
- **phase_markers**: Array of phase objects
  - **phase**: Phase type string
  - **task**: Task identifier (null for baselines)
  - **start**: Start timestamp (seconds, float)
  - **end**: End timestamp (seconds, float)

### 5.3 Feature Export (Optional)

**File**: `features_YYYYMMDD_HHMMSS.xlsx`

**Structure**: Multi-sheet Excel workbook

**Sheets**:
1. **Eyes_Closed**: Baseline features (28+ rows × 1,400+ columns)
2. **Eyes_Open**: Eyes-open baseline features
3. **Task**: Combined task features
4. **Baseline_Stats**: Mean, std, median per feature

**Format**:
- One row per window
- One column per feature
- Feature names as column headers

**Use Cases**:
- External analysis (MATLAB, R, Python)
- Archival storage
- Publication supplementary materials

---

## Performance Characteristics

### 6.1 Computational Complexity

**Recording Phase** (Real-Time):
- **CPU**: <5% on modern processors
- **Memory**: ~500 MB RAM (buffer + file handles)
- **Disk I/O**: ~10 MB/minute write speed
- **Latency**: <10ms per batch write

**Feature Extraction Phase** (Offline):
- **PSD Computation**: O(n log n) per channel via FFT
- **64 Channels**: Parallelized, ~1-2 seconds for 1,000-sample window
- **Total for 180s recording**: 5-15 seconds
- **Memory**: ~1-2 GB peak (full dataset in memory)

**Statistical Analysis Phase**:
- **Permutation Testing**: O(n_permutations × n_features × n_windows)
- **1,000 permutations × 1,400 features × 100 windows**: 3-5 minutes
- **Bottleneck**: Permutation testing, not feature extraction
- **Parallelization potential**: Can reduce to 30-60 seconds with multiprocessing

### 6.2 Timing Breakdown (Example 180s Session)

**Fast Mode (Default)**:
| Phase | Duration | Percentage |
|-------|----------|------------|
| Recording | 180s (real-time) | N/A |
| Data loading | 1-2s | 3% |
| Feature extraction | 5-15s | 30% |
| Baseline computation | <1s | 2% |
| Statistical testing | 15-30s | 60% |
| Report generation | 1-2s | 5% |
| **Total offline time** | **~30 seconds** | **100%** |

**Full Mode (Research-Grade)**:
| Phase | Duration | Percentage |
|-------|----------|------------|
| Recording | 180s (real-time) | N/A |
| Data loading | 1-2s | <1% |
| Feature extraction | 5-15s | 3-5% |
| Baseline computation | <1s | <1% |
| Permutation testing | 600-1200s | 90-95% |
| Report generation | 1-2s | <1% |
| **Total offline time** | **10-20 minutes** | **100%** |

### 6.3 Storage Requirements

**Per Session** (180 seconds):
- Raw CSV: ~60 MB
- Markers JSON: ~2 KB
- Features Excel: ~10 MB (optional)
- **Total**: ~70 MB per session

**Retention Recommendations**:
- Raw CSV: Indefinite (enables reanalysis)
- Markers JSON: Indefinite (essential metadata)
- Features Excel: Optional (can regenerate from raw)

---

## Advantages Over Live Processing

### 7.1 Data Integrity

**Live Processing Risks**:
- Buffer overflow if processing lags behind streaming
- Lost samples during CPU spikes
- No recovery from processing errors

**Offline Advantages**:
- All raw data preserved to disk
- Can restart analysis if interrupted
- Multiple reanalysis attempts with different parameters
- No data loss even with system instability

### 7.2 Processing Flexibility

**Live Processing Limitations**:
- Must complete feature extraction within ~500ms to avoid buffer overflow
- Limited to computationally light features
- Cannot apply sophisticated artifact rejection
- Difficult to implement adaptive algorithms

**Offline Advantages**:
- No time pressure - can take minutes per window if needed
- Full 1,400+ feature set extractable
- Can apply iterative artifact detection and removal
- Can experiment with different frequency bands, window sizes
- Can implement machine learning feature selection

### 7.3 Reanalysis Capabilities

**What Can Be Reanalyzed**:
1. **Different Window Sizes**: Test 1s, 2s, 4s windows
2. **Different Overlaps**: Compare 0%, 50%, 75% overlap
3. **Different Frequency Bands**: Alpha sub-bands (low alpha 8-10 Hz, high alpha 10-13 Hz)
4. **Different Filters**: Compare different notch filter Q factors, bandpass ranges
5. **Different Features**: Add new feature types without re-recording
6. **Different Baselines**: Try eyes-open vs eyes-closed as baseline
7. **Artifact Rejection**: Apply automated or manual artifact removal post-hoc

**Research Applications**:
- Parameter optimization studies
- Method comparison (e.g., Welch vs multitaper PSD)
- Feature engineering experiments
- Validation studies (compare manual vs automated processing)

### 7.4 Debugging and Quality Control

**Live Processing**:
- Difficult to identify source of errors
- Cannot inspect intermediate processing steps
- Hard to validate feature calculations

**Offline Processing**:
- Can inspect raw data at any time point
- Can visualize intermediate processing stages
- Can validate each feature calculation step-by-step
- Can compare outputs across different analysis pipelines
- Enables comprehensive quality control reports

### 7.5 Scalability

**Live Processing**:
- Limited by real-time constraint (500 Hz × 64 channels = 32,000 values/second)
- Feature count ceiling (~100-200 features maximum)
- Difficult to add new features without performance testing

**Offline Processing**:
- No hard limit on feature count
- Can process 1,400+ features comfortably
- Can add features without impacting data acquisition
- Enables exploratory analysis with 10,000+ features if desired

---

## Summary

The Offline 64-Channel EEG Analysis Pipeline represents a paradigm shift from real-time feature extraction to a two-phase architecture that prioritizes **data preservation** and **analytical flexibility**. By separating acquisition from processing, the system achieves:

1. **Robustness**: No data loss even under computational stress
2. **Comprehensiveness**: 1,400+ features per window vs ~70 in live mode
3. **Reproducibility**: Raw data enables exact replication of analyses
4. **Flexibility**: Same dataset can be analyzed with different parameters
5. **Research-Grade Quality**: Meets standards for publication-quality EEG research

The system successfully records 64-channel EEG at 500 Hz with <5% CPU usage, stores complete raw data to disk, and performs comprehensive offline feature extraction in seconds. Statistical analysis via permutation testing provides robust, correction-adjusted p-values for multi-task comparisons.

This architecture is particularly well-suited for:
- Research studies requiring archival data
- Clinical applications needing reanalysis capabilities
- Multi-task paradigms with complex statistical requirements
- High-density EEG systems (64+ channels)
- Exploratory analysis and method development

---

**End of Documentation**

For technical support or feature requests, contact the BrainLink Companion development team.
