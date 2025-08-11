# Implementation Report: Eyes-Closed Baseline + Welch's t-test Only

This report documents targeted changes made to the enhanced analyzer to use an eyes-closed-only baseline and simplify the significance testing pipeline to Welch's t-test, aligning with the latest requirements.

## Scope
- Baseline protocol: Eyes-closed only (EC)
- Artifact handling: Blink/ocular artifact-aware rejection during EC baseline collection
- Significance testing: Welch's t-test only (no Mann-Whitney)
- Composite metrics: Summed p-value across features, Bonferroni-like threshold, cosine similarity summary
- Non-breaking: Implemented via a new module that subclasses the original GUI/engine

## Files
- `BrainLinkAnalyzer_GUI_Enhanced.py`: New enhanced analyzer/window (non-intrusive)
- `BrainLink_Implementation_Report_EyesClosed_Baseline.md`: This report

## Key Changes

### 1) Eyes-Closed-Only Baseline
- Method: `EnhancedFeatureAnalysisEngine.compute_baseline_statistics()`
- Logic:
  - If EC features exist: compute baseline stats from EC only
  - Else: fallback to original behavior (combine phases) to avoid blocking
- Rationale: Aligns with request to use EC as the sole baseline reference

### 2) Artifact-Aware Baseline Collection (EC)
- Method: `EnhancedFeatureAnalysisEngine.add_data()`
- When in `current_state == 'eyes_closed'` and a full window is present:
  - Detect blink/ocular artifacts via amplitude threshold (μ + 3σ on |x|)
  - If artifact detected, remove the last appended EC feature/timestamp (window rejection)
- Rationale: Reduce contamination of EC baseline with ocular artifacts

### 3) PSD Normalization Hooks (Optional)
- Method: `_normalize_psd(psd, method)` with options `total_power`, `snr_based`, `z_transform`, `robust_scaling`
- Used to compute normalized descriptors (peak prominence, entropy) while keeping absolute powers for bandpower integrals

### 4) Feature Extraction Enrichments
- Adds per-band:
  - `*_peak_rel_amp` (relative prominence within band)
  - `*_entropy` (spectral entropy within band)
- Maintains existing powers, relatives, peak freq/amp, and cross-band ratios

### 5) Welch's t-test Only (No Mann-Whitney)
- Method: `EnhancedFeatureAnalysisEngine.analyze_task_data()`
- For each feature:
  - Compute baseline mean/std (from EC), task mean/std
  - Z-score based on baseline std, Cohen's d (pooled), percent change
  - Welch's t-test `ttest_ind(..., equal_var=False)` → `p_value_welch`
  - Enhanced gate: `|Z|>1.5 & |d|>0.3 & |Δ%|>10`
- Composite:
  - Sum of p-values across features, count p<0.05, Bonferroni-like threshold = 0.05*k
  - Cosine similarity/distance of mean feature vectors with light permutation p-value

## Data Flow Overview
1. Raw EEG → window (1s, 512 samples)
2. DC removal + notch filter (50 Hz)
3. PSD via Welch; normalized PSD for descriptors (optional)
4. Feature vector (per window)
5. Calibration collection by phase
6. Baseline computation (EC only)
7. Task analysis vs baseline (Welch's t-test only) + composite metrics

## UI/UX
- Enhanced window class uses the enhanced engine
- EC baseline requires no fixation cue; dialog code retained but unused for EC
- Results tab displays per-feature stats; composite summary appended after analysis

## Considerations
- EC-only baseline may produce higher alpha power compared to EO; this is intended by request
- If EC data are absent, fallback prevents user-facing dead ends
- Blink detection is amplitude-based and conservative; could be tuned per device

## Next Steps (Optional)
- Add a toggle to switch between EC-only and EO-only baselines for experiments
- Parameterize blink_sigma and normalization_method in the UI
- Persist composite metrics to CSV for batch analysis

## Validation
- Code paths mirror original analyzer structure; imports use existing helpers/constants
- No changes made to the original `BrainLinkAnalyzer_GUI.py`

