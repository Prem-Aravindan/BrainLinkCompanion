# BrainLink EEG Processing Architecture
## Comprehensive Pipeline Documentation for Presentation

**Document Version:** 1.0  
**Date:** December 18, 2025  
**Purpose:** Technical presentation reference for processing pipeline layers

---

## Executive Summary

The BrainLink system implements a **dual-stage processing architecture** consisting of:
- **5 Live Processing Layers** (real-time signal handling at 512 Hz)
- **6 Post-Processing Layers** (offline statistical analysis and reporting)

Total: **11 distinct processing layers** from raw sensor data to final task reports.

---

## PART 1: LIVE PROCESSING LAYERS (Real-Time)

These layers execute continuously during EEG data acquisition at 512 Hz sampling rate, processing data in ~2-second windows (1024 samples).

### Layer 1: Raw Data Acquisition
**Location:** `onRaw(raw)` callback in BrainLinkAnalyzer_GUI.py (line 619)

**Function:** Serial data ingestion from BrainLink hardware
- **Input:** Single raw µV value from serial port (COM3 @ 115200 baud)
- **Parser:** BrainLinkParser.BrainLinkParser (proprietary format)
- **Rate:** 512 Hz (one sample every ~1.95 ms)
- **Validation:** Dummy data detection via pattern analysis
- **Output:** Single floating-point µV value

**Key Operations:**
```python
def onRaw(raw):
    live_data_buffer.append(raw)
```

---

### Layer 2: Buffer Management & Trimming
**Location:** `onRaw(raw)` callback (line 642)

**Function:** In-place circular buffer maintenance
- **Input:** Unbounded incoming data stream
- **Buffer Size:** 1024 samples (2 seconds @ 512 Hz)
- **Mechanism:** In-place deletion to prevent memory growth
- **Critical Fix:** `del live_data_buffer[:-1024]` (modifies in-place)
- **Output:** Fixed-size sliding window buffer

**Performance Note:** This layer was recently fixed to prevent 20-30 second delays caused by unbounded buffer growth.

---

### Layer 3: Real-Time Feature Extraction
**Location:** `FeatureAnalysisEngine.extract_features()` (line 1075)

**Function:** Window-level spectral and statistical feature computation
- **Input:** 1024-sample EEG window (2 seconds)
- **Preprocessing:**
  - DC offset removal (de-meaning)
  - Notch filter: 50 Hz ± 1.67 Hz (Q=30)
  - Bandpass filter: 1-45 Hz (2nd order Butterworth)
  - Blink artifact removal (for baseline only)

- **PSD Computation:**
  - Method: DPSS Multitaper (K=3 tapers, NW≈2.5)
  - Fallback: Welch's method (256-sample segments, 50% overlap)
  - SNR-adapted normalization (10th percentile noise floor)

- **Band Power Extraction:**
  - **Standard Bands:** Delta (0.5-4 Hz), Theta (4-8 Hz), Alpha (8-13 Hz), Beta (13-30 Hz), Gamma (30-45 Hz)
  - **Split Bands:** Theta1 (4-6 Hz), Theta2 (6-8 Hz), Beta1 (13-20 Hz), Beta2 (20-30 Hz)
  - **Metrics per Band:**
    - Absolute power (µV²)
    - Relative power (% of total)
    - Peak frequency (Hz)
    - Peak amplitude (µV²/Hz)
    - Relative prominence
    - Spectral entropy (bits)

- **Cross-Band Ratios:**
  - Alpha/Theta ratio
  - Beta/Alpha ratio
  - Beta2/Beta1 ratio
  - Theta2/Theta1 ratio

- **EMG Guard (Gamma Band):**
  - High/mid power ratio: R = P₃₅₋₄₅Hz / P₂₀₋₃₀Hz
  - Spectral slope (20-45 Hz log-log fit)
  - **Rejection Criteria:** R > 1.2 OR slope > -0.6
  - **Purpose:** Prevent muscle contamination of gamma features

**Output:** Feature dictionary (45+ features per window)

---

### Layer 4: Signal Quality Assessment
**Location:** `assess_eeg_signal_quality()` in BrainLinkAnalyzer_GUI_Sequential_Integrated.py (line 114)

**Function:** Multi-metric "headset worn" detection and quality scoring
- **Input:** 512-1024 sample window from live_data_buffer
- **Update Rate:** Every 500 ms

**Detection Metrics:**

1. **Spectral Slope Analysis (1/f characteristic)**
   - Log-log linear fit on 1-40 Hz
   - Real EEG slope: -1 to -2 (steep negative)
   - Environmental noise: > -0.3 (too flat)
   - **Threshold:** slope > -0.3 → NOT WORN

2. **Low-Frequency Dominance**
   - Delta + Theta power (0.5-8 Hz)
   - Real EEG: >40% of total power
   - **Threshold:** <30% → NOT WORN

3. **High-Frequency Ratio**
   - Power above 30 Hz
   - Real EEG: <30% of total
   - **Threshold:** >50% → NOT WORN

4. **Amplitude Checks**
   - Standard deviation <2.0 µV → flatline (not worn)
   - Standard deviation >500 µV → severe artifacts
   - Max amplitude >500 µV → amplitude artifacts

5. **Baseline Drift**
   - Quartile mean standard deviation
   - **Threshold:** >50 µV → poor contact

6. **Motion Artifacts (Kurtosis)**
   - Fisher kurtosis of amplitude distribution
   - **Threshold:** |kurt| >15 → motion artifacts

7. **Line Noise (50/60 Hz)**
   - Power at line frequency / total power
   - **Threshold:** >10% → excessive noise

**Output:** 
- Quality score: 0-100
- Status: "good", "acceptable", "poor", "not_worn", etc.
- Details dictionary (all metrics)

---

### Layer 5: UI Update & User Feedback
**Location:** `MindLinkStatusBar.update_status()` (line 547) and `LiveEEGDialog.update_plot()` (line 328)

**Function:** Real-time visual feedback and plot rendering
- **Update Rate:** 50 ms (20 Hz for plot), 500 ms (2 Hz for status)

**Components:**

1. **Status Bar Indicators:**
   - EEG Connection: "✓ Connected" / "✗ No Signal"
   - Signal Quality: "✓ Good" / "⚠ Not Worn" / "○ Fair"
   - Color coding: Green (#10b981), Red (#ef4444), Yellow (#eab308)
   - Debug output every 5 seconds (console)

2. **Live EEG Plot (PyQtGraph):**
   - Rolling 2-second display window
   - Auto-scaling Y-axis based on signal amplitude
   - Grid overlay with 50 µV divisions
   - Real-time curve update (10-50 Hz)

3. **Audio Feedback (Optional):**
   - Pygame sound alerts for state changes
   - Configurable volume and pitch

**Output:** User perception of system state in <100 ms latency

---

## PART 2: POST-PROCESSING LAYERS (Offline Analysis)

These layers execute after data collection completes, processing stored windows in batch mode for statistical inference and reporting.

### Layer 6: Window Aggregation & Block Formation
**Location:** `_compute_block_summaries()` in BrainLinkAnalyzer_GUI_Enhanced.py (line 1300)

**Function:** Temporal downsampling to mitigate autocorrelation
- **Input:** N individual 2-second windows (features × windows matrix)
- **Block Size:** 8 seconds (configurable via `block_seconds` parameter)
- **Windows per Block:** 4 windows (8s / 2s)
- **Aggregation Method:** Mean of window features within block
- **Purpose:** Create independent statistical units for permutation tests

**Output:** Block-level feature matrix (features × blocks)

**Example:**
- 60-second task → 30 windows → 7 blocks (8s each, remainder discarded)
- Effective sample size (ESS) = number of blocks, not windows

---

### Layer 7: Baseline Statistics & Quality Control
**Location:** `compute_baseline_statistics()` (line 1147)

**Function:** Establish reference distribution for comparison
- **Input:** Eyes-closed (EC) baseline windows (preferred) OR eyes-open (EO) fallback
- **Artifact Rejection (EC only):**
  - Median Absolute Deviation (MAD) based outlier detection
  - Reject if: >5% of samples exceed 20σ AND scale >10 µV
  - Conservative approach to preserve normal EC variance

**Computed Statistics per Feature:**
- Mean, standard deviation
- Min, max, median
- 25th percentile (Q1), 75th percentile (Q3)

**Output:** Baseline reference distribution (45+ features)

**Tracking:**
- `baseline_kept`: accepted windows
- `baseline_rejected`: rejected windows
- Keep rate typically >95% for good recordings

---

### Layer 8: Per-Feature Hypothesis Testing
**Location:** `analyze_task_data()` (line 1841)

**Function:** Individual feature significance assessment
- **Input:** Task blocks vs. baseline blocks (equalized count)
- **Test Method:** Welch's t-test (unequal variance)
- **Minimum Sample Size:** 3 blocks per group

**Computed Metrics per Feature:**

1. **Effect Measures:**
   - Delta: Δ = μ_task - μ_baseline
   - Cohen's d: d = Δ / σ_pooled
   - Z-score: z = Δ / σ_baseline
   - Percent change: % = (Δ / |μ_baseline|) × 100

2. **Statistical Tests:**
   - Two-sided p-value (Welch t-test)
   - One-sided directional p-value (task-specific expectations)
   - Welch-Satterthwaite degrees of freedom

3. **Discretization:**
   - Quantile binning (default: 5 bins)
   - Effect magnitude → discrete index [0-4]
   - Baseline effect distribution as reference

**Directional Priors by Task:**
- Mental Math: alpha↓, beta↑, gamma↑, beta_alpha_ratio↑
- Attention Focus: alpha↓, beta↑, theta↓
- Working Memory: theta↑, alpha↓, beta↑
- Visual Imagery: alpha↑, alpha_theta_ratio↑

**Output:** Per-feature statistics dictionary (200+ metrics)

---

### Layer 9: Multi-Feature Aggregation & Dependence Correction
**Location:** `analyze_task_data()` statistical aggregation section (line 2100+)

**Function:** Global task-level significance with correlation adjustment
- **Input:** Per-feature p-values + block-level correlation matrix

**Methods:**

1. **Kost-McDermott Corrected Fisher Combination:**
   - Naïve statistic: χ²_naive = -2 Σ ln(p_i), df = 2m
   - Correlation estimation: Spearman ρ on equalized blocks
   - Covariance approximation: Cov(X_i, X_j) ≈ 3.263ρ + 0.710ρ² + 0.027ρ³
   - Adjusted variance: σ²_KM = 4m + 2Σ Cov_ij
   - Effective df: df_KM = 8m² / σ²_KM
   - Scaling: χ²_adj = χ²_naive × (2μ / σ²_KM)
   - P-value: χ²(df_KM) distribution

2. **Block-Permutation Summed P-value (SumP):**
   - Observed sum: S_obs = Σ p_i
   - Permutation unit: 8-second blocks (not individual windows)
   - Per iteration:
     - Shuffle task/baseline block labels
     - Recompute Welch t-test for all features (vectorized)
     - Sum permuted p-values → S_perm
   - Empirical p-value: p_perm = (1 + Σ[S_perm ≤ S_obs]) / (N_perm + 1)
   - Default: 1000 permutations (~10 seconds compute time)

3. **Cosine Similarity:**
   - Baseline vector: **b** = [μ_b1, μ_b2, ..., μ_bk]
   - Task vector: **t** = [μ_t1, μ_t2, ..., μ_tk]
   - Similarity: cos(θ) = (**b** · **t**) / (||**b**|| ||**t**||)
   - Distance: d_cos = 1 - cos(θ)
   - Permutation-calibrated p-value for distance

4. **Composite Score (Ranking Only):**
   - C = Σ -log₁₀(p_i)
   - No significance threshold
   - Used only for task ordering

**Output:** Task-level aggregated metrics

---

### Layer 10: Feature Selection & Multiple Testing Control
**Location:** Conditional FDR application (line 2200+)

**Function:** Identify statistically reliable feature subset
- **Mode-Dependent:** Only active in "feature_selection" mode
- **Input:** Per-feature p-values + task-specific directional priors

**Significance Gating Criteria (ALL conditions):**

1. **Directional Consistency:**
   - Observed direction matches task expectation
   - Example: Mental math expects alpha↓, observed Δ_alpha < 0

2. **Statistical Threshold (ANY of):**
   - p_directional ≤ α_eff (default: 0.05 × correlation_guard_factor)
   - |Cohen's d| ≥ d_threshold (band-specific: 0.25-0.35)
   - |Percent change| ≥ τ% (5-10% depending on band)

3. **Correlation Guard Adjustment:**
   - Effective feature count: Σ min(max(λ_i, 0), 1) from eigenvalue decomposition
   - Factor = eff_count / total_count, clipped to [0.05, 1.0]
   - α_eff = α × factor

**Benjamini-Hochberg FDR Control (if feature_selection mode):**
1. Sort p-values: p_(1) ≤ p_(2) ≤ ... ≤ p_(m)
2. Adjusted q-values: q_(i) = min_{j≥i} (m/j) × p_(j)
3. Reject if q_(i) < α_FDR (default: 0.05)

**Output:**
- `significant_change`: boolean per feature
- `q_value`: FDR-adjusted p-value
- `bh_rejected`: Benjamini-Hochberg rejection flag
- `sig_feature_count`: total significant features
- `pass_rule`: 'p', 'd', or 'pct' (which threshold triggered)

**Expectation Alignment Grading (A-D):**
- Grade A: All key features pass with correct direction
- Grade B: Core features pass
- Grade C: ≥2 features pass
- Grade D: Insufficient matches
- `counter_directional` flag if ≥70% features oppose expectations

---

### Layer 11: Across-Task Comparative Analysis
**Location:** `perform_across_task_analysis()` (line 3500+)

**Function:** Statistical ranking and pairwise differentiation across tasks
- **Input:** Per-task block-level effects for all completed tasks
- **Minimum Sessions Gate:** N_min ≥ 2 (default) required for significance testing

**Analysis Pipeline:**

1. **Per-Feature Effect Arrays:**
   - Compute task effect relative to EC baseline for each feature
   - Effect = Δ (delta) or z-score (configurable)
   - Equalize block counts across tasks (downsample to minimum)

2. **Friedman Omnibus Test (per feature):**
   - Nonparametric repeated-measures ANOVA
   - Null hypothesis: All tasks have same median effect
   - Test statistic: χ²_F = (12n)/(k(k+1)) × [Σ R_j² - k(k+1)²/4]
   - Feature-wise FDR correction on omnibus p-values

3. **Post-hoc Pairwise Wilcoxon Signed-Rank:**
   - For omnibus-significant features only
   - All pairwise task comparisons
   - Per-feature BH-FDR correction → q-value matrix
   - Fallback: Sign test for small samples

4. **Median Effect Ranking:**
   - Sort tasks by median effect magnitude per feature
   - Provides ordinal trajectory independent of significance

**Output:**
- `friedman_p`: omnibus p-value per feature
- `friedman_q`: FDR-adjusted q-value
- `pairwise_p`: m×m matrix of pairwise p-values
- `pairwise_q`: m×m matrix of pairwise q-values (FDR-corrected)
- `median_effects`: sorted task list by effect magnitude

**Session Count Handling:**
- If N < N_min: Return ranking-only (no p-values)
- If N ≥ N_min: Full statistical inference

---

## SUMMARY TABLE

| Layer | Type | Location | Input | Output | Update Rate | Unit |
|-------|------|----------|-------|--------|-------------|------|
| 1. Raw Acquisition | Live | onRaw() | Serial data | µV value | 512 Hz | Sample |
| 2. Buffer Management | Live | onRaw() | Stream | 2s buffer | 512 Hz | Sample |
| 3. Feature Extraction | Live | extract_features() | 2s window | 45+ features | ~0.5 Hz | Window |
| 4. Signal Quality | Live | assess_eeg_signal_quality() | 1-2s data | Quality score | 2 Hz | Window |
| 5. UI Update | Live | update_status/plot() | Features + Quality | Visual feedback | 2-20 Hz | Display |
| 6. Block Aggregation | Post | _compute_block_summaries() | N windows | N/4 blocks | On-demand | Block |
| 7. Baseline Stats | Post | compute_baseline_statistics() | EC/EO windows | Reference dist | Once | Session |
| 8. Per-Feature Tests | Post | analyze_task_data() | Task vs baseline | t-test results | Once | Feature |
| 9. Multi-Feature Agg | Post | analyze_task_data() | p-values + corr | Global p-values | Once | Task |
| 10. Feature Selection | Post | analyze_task_data() | p-values + FDR | Significant subset | Once | Task |
| 11. Across-Task | Post | perform_across_task_analysis() | All task effects | Friedman + pairs | Once | Session |

---

## COMPUTATIONAL COMPLEXITY

### Live Processing (Per Second):
- Layer 1-2: O(1) per sample = **512 operations/sec**
- Layer 3: O(N log N) FFT = **~10,000 operations per 2s** → 5K/sec amortized
- Layer 4: O(N log N) PSD + O(M) metrics = **~5,000 operations per 0.5s** → 10K/sec
- Layer 5: O(1) status + O(N) plot = **2,000 operations per 0.05s** → 40K/sec
- **Total Live:** ~55K operations/sec (easily handled by modern CPU single-threaded)

### Post-Processing (One-Time):
- Layer 6: O(NW) block aggregation ≈ **100ms** for 60s task
- Layer 7: O(NW×F) baseline stats ≈ **50ms**
- Layer 8: O(F×B) Welch t-tests ≈ **200ms** (45 features × 7 blocks)
- Layer 9: O(F²) correlation + O(F×N_perm) permutation ≈ **10 seconds** (1000 perm)
- Layer 10: O(F log F) FDR sorting ≈ **5ms**
- Layer 11: O(T²×F) pairwise tests ≈ **500ms** (T=5 tasks, F=45)
- **Total Post:** ~11 seconds per task analysis

---

## KEY DESIGN DECISIONS

### 1. Why Block-Based Permutation?
**Problem:** Window-level data is temporally autocorrelated (ρ ≈ 0.3-0.6 between adjacent windows).  
**Solution:** Aggregate 4 windows → 8-second blocks before permutation.  
**Impact:** Effective sample size (ESS) = blocks, not windows. More conservative but valid inference.

### 2. Why Two Aggregation Methods (Fisher + SumP)?
**Complementarity:**
- **Fisher KM:** Parametric, sensitive to strong effects in few features
- **SumP:** Distribution-free, robust to heteroskedasticity and complex correlation
- **Agreement:** Both p < 0.05 → high confidence

### 3. Why Mode Separation (Aggregate vs. Feature Selection)?
**Rationale:** Aggregate-only mode preserves raw effect magnitudes for transparent task-level inference. Feature selection mode applies FDR for subset identification. Prevents universal overcorrection that obscures interpretability.

### 4. Why Directional Priors?
**Neuroscience Basis:** Established EEG signatures for cognitive states (e.g., alpha desynchronization during mental effort). One-sided tests increase statistical power for expected effects while guarding against spurious opposite-direction findings.

### 5. Why EMG Guard for Gamma?
**Contamination Issue:** Muscle artifacts (jaw clenching, facial tension) produce high-frequency power indistinguishable from neural gamma by amplitude alone. Spectral slope criterion (1/f vs. flat) provides orthogonal validation.

---

## LATENCY BUDGET (Live Processing)

| Stage | Latency | Cumulative |
|-------|---------|------------|
| Serial acquisition | 1.95 ms | 1.95 ms |
| Buffer append | 0.01 ms | 1.96 ms |
| Feature extraction (triggered every 2s) | 50 ms | 51.96 ms |
| Signal quality (every 0.5s) | 20 ms | 71.96 ms |
| UI update (plot: 50ms, status: 500ms) | 50 ms | 121.96 ms |
| **Total user-perceived latency** | | **~120 ms** |

*Note: UI updates are asynchronous (Qt timers) and do not block data acquisition.*

---

## DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                    LIVE PROCESSING (Real-Time)                   │
└─────────────────────────────────────────────────────────────────┘
                              512 Hz
                                ↓
┌────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  BrainLink │ →  │ Layer 1: onRaw() │ →  │ Layer 2: Buffer  │
│  Hardware  │    │  Raw Acquisition │    │   Management     │
└────────────┘    └──────────────────┘    └──────────────────┘
                                                    ↓
                        ┌───────────────────────────┴─────────────────┐
                        ↓                                             ↓
            ┌─────────────────────────┐              ┌────────────────────────┐
            │ Layer 3: Feature Engine │              │ Layer 4: Signal Quality│
            │   - PSD (Multitaper)    │              │   - Spectral Slope     │
            │   - Band Powers         │              │   - Low-Freq Dominance │
            │   - Cross-Band Ratios   │              │   - Amplitude Checks   │
            │   - Peak Descriptors    │              │   - Kurtosis           │
            │   - EMG Guard (gamma)   │              └────────────────────────┘
            └─────────────────────────┘                          ↓
                        ↓                              ┌──────────────────────┐
            ┌─────────────────────────┐                │ Layer 5: UI Update   │
            │  Store in calibration   │ ←──────────────│   - Status Bar       │
            │  data arrays            │                │   - Live Plot        │
            │  (eyes_closed/task)     │                │   - Audio Feedback   │
            └─────────────────────────┘                └──────────────────────┘
                        ↓
                   [User stops task]
                        ↓
┌─────────────────────────────────────────────────────────────────┐
│                  POST-PROCESSING (Batch Analysis)                │
└─────────────────────────────────────────────────────────────────┘
                        ↓
            ┌─────────────────────────┐
            │ Layer 6: Block          │
            │   Aggregation           │
            │   (4 windows → 1 block) │
            └─────────────────────────┘
                        ↓
            ┌─────────────────────────┐
            │ Layer 7: Baseline       │
            │   Statistics            │
            │   (EC artifact reject)  │
            └─────────────────────────┘
                        ↓
            ┌─────────────────────────┐
            │ Layer 8: Per-Feature    │
            │   Hypothesis Tests      │
            │   - Welch t-test        │
            │   - Effect sizes        │
            │   - Directional p-vals  │
            └─────────────────────────┘
                        ↓
            ┌─────────────────────────┐
            │ Layer 9: Multi-Feature  │
            │   Aggregation           │
            │   - Fisher KM           │
            │   - SumP Permutation    │
            │   - Cosine Similarity   │
            └─────────────────────────┘
                        ↓
            ┌─────────────────────────┐
            │ Layer 10: Feature       │
            │   Selection (optional)  │
            │   - Directional gating  │
            │   - BH FDR correction   │
            │   - Expectation grading │
            └─────────────────────────┘
                        ↓
            ┌─────────────────────────┐
            │ Layer 11: Across-Task   │
            │   Analysis              │
            │   - Friedman omnibus    │
            │   - Wilcoxon pairwise   │
            │   - Effect ranking      │
            └─────────────────────────┘
                        ↓
            ┌─────────────────────────┐
            │   Task Analysis Report  │
            │   (JSON/DataFrame/UI)   │
            └─────────────────────────┘
```

---

## VALIDATION & QUALITY METRICS

### Live Processing Quality Indicators:
- **Buffer Health:** Size maintained at 1024 samples (no growth)
- **Signal Quality Score:** 0-100 (target: >70 for "good")
- **Spectral Slope:** -1.0 to -2.0 (real EEG signature)
- **Low-Freq Dominance:** >40% (delta + theta)
- **EMG Guard Activation:** <10% of gamma windows flagged

### Post-Processing Quality Indicators:
- **Baseline Keep Rate:** >95% of EC windows retained
- **Effective Sample Size:** ≥5 blocks per condition
- **Feature Coverage:** All 45+ features computable (no NaN)
- **KM df Ratio:** 0.4-0.8 (indicates moderate correlation)
- **Permutation Stability:** p-value ± 0.02 across different seeds

---

## REPRODUCIBILITY NOTES

### Deterministic Elements:
- Feature extraction (given same input window)
- Per-feature t-tests (deterministic statistics)
- FDR correction (deterministic for fixed p-values)

### Stochastic Elements:
- Block equalization (random subsampling) → **seeded RNG**
- Permutation tests (random shuffles) → **seeded RNG**
- Bootstrap confidence intervals (future) → **seeded RNG**

**Reproducibility Guarantee:** Setting `seed` parameter in `EnhancedAnalyzerConfig` ensures identical results across runs for same input data.

---

## FUTURE EXTENSIONS

### Live Processing:
- **Adaptive Block Sizing:** AR(1) autocorrelation estimation → dynamic block length
- **Real-Time Artifact Rejection:** Online ICA or ASR for blink/muscle removal
- **Multi-Channel Support:** Extend to 4-channel BrainLink Pro (spatial filtering)

### Post-Processing:
- **Bayesian Hierarchical Models:** Cross-session effect borrowing
- **Machine Learning Integration:** Gradient boosting on feature × task predictions
- **Dynamic Protocol Adaptation:** Early stopping when omnibus significance reached

---

## REFERENCES

1. **Multitaper Spectral Estimation:** Thomson, D.J. (1982). *IEEE Proceedings*, 70(9), 1055-1096.
2. **Welch's t-test:** Welch, B.L. (1947). *Biometrika*, 34(1/2), 28-35.
3. **Kost-McDermott Correction:** Kost, J.T. & McDermott, M.P. (2002). *J. Applied Statistics*, 29(1), 225-240.
4. **Benjamini-Hochberg FDR:** Benjamini, Y. & Hochberg, Y. (1995). *J. Royal Stat. Soc. B*, 57(1), 289-300.
5. **Friedman Test:** Friedman, M. (1937). *J. American Statistical Association*, 32(200), 675-701.
6. **Permutation Tests in EEG:** Maris, E. & Oostenveld, R. (2007). *J. Neuroscience Methods*, 164(1), 177-190.

---

## CONTACT & CONTRIBUTION

**Authors:** Prem Aravindan, et al.  
**Project:** BrainLink Companion  
**Repository:** m:\CODEBASE\BrainLinkCompanion  
**Documentation Date:** December 18, 2025

For technical questions or contributions, please refer to the IEEE paper (*BrainLinkAnalyzer_IEEE_Paper.md*) and signal quality documentation (*SignalQualityDetection.md*).

---

*End of Processing Architecture Documentation*
