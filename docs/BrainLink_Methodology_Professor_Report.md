# BrainLink Single-Channel EEG Analysis – IMPLEMENTED METHODS ONLY

> Audience: Academic review (implementation audit)  
> Scope: What is **currently implemented in code**
> Hardware: Single frontal channel (Fp1–Fp2 derivation)  

---
## 1. Scope & Purpose (Implemented)
The system ingests a continuous single-channel frontal EEG stream, segments it into overlapping windows, computes power spectral density (PSD) per window, extracts a fixed set of spectral features, forms baseline statistics, and performs **per-task** and **multi-task** (inter-task) statistical comparisons using baseline-normalized window distributions.

---
## 2. Hardware & Constraints (Implemented)
| Property | Specification | Implication |
|----------|---------------|-------------|
| Channels | 1 (Fp1–Fp2 derivation or frontal reference variant) | No spatial separation / connectivity metrics |
| Sampling | 512 Hz (effective processing at 256 Hz for PSD) | Adequate for 0.5–45 Hz bands |
| Reference | Internal / device-defined | Cannot compute hemispheric asymmetry robustly |
| SNR | Consumer-grade | Requires artifact rejection + relative normalization |
| Electrode Region | Frontal polar | Biased toward executive / attentional networks |

Mitigation actually implemented:
1. Use of relative powers & ratios to reduce amplitude scaling effects.  
2. MAD-based blink window rejection during eyes-closed baseline (in enhanced engine).  
3. Optional PSD normalization hook (method selectable; defaults present).  

Not implemented: multi-channel spatial analysis, source localization, connectivity, trial-locked ERP averaging.

---
## 3. Tasks & Paradigms (Implemented Definitions)
Task metadata (IDs, durations, phase structures, media references) are defined as dictionaries (`AVAILABLE_TASKS`). Enhanced GUI preserves/extends these and groups protocol tasks. Only what is explicitly present in the task dictionaries is considered.

### 3.1 Baselines (Implemented)
| ID | Name | Duration | Purpose | Notes |
|----|------|----------|---------|-------|
| eyes_closed | Eyes Closed Rest | 60 s | High alpha/theta SNR calibration | Blink window rejection enabled |
| eyes_open | Eyes Open Rest | 60 s | Secondary baseline (may be used conditionally) | Collected if invoked |

### 3.2 Cognitive Micro Tasks (Implemented)
| ID | Cognitive Process Emphasis | Description |
|----|---------------------------|-------------|
| mental_math | Working memory / executive load | Serial subtraction (100 – 7 …) |
| working_memory | Manipulation & updating | Hold digits; transform (e.g., add +2) |
| cognitive_load | Dual-task composite | Combined arithmetic + visualization |
| attention_focus | Sustained attentional control | Breath counting 1–10 cycles |
| language_processing | Verbal fluency / lexical retrieval | Generate words by initial letter |
| visual_imagery | Internal scene construction | Vivid first-person imagery |
| motor_imagery | Kinesthetic simulation | Alternating imagined throwing |

### 3.3 Structured Protocol Tasks (Implemented)
| ID | Process Domain | Phase Pattern (Recording Phases) | Total Duration |
|----|---------------|----------------------------------|----------------|
| emotion_face (eyes open) | Affective appraisal / labeling | (cue → viewing) × 6 (all record) | 114 s |
| diverse_thinking (eyes closed) | Divergent creative ideation | (get_ready, cue, thinking*) × 2 | 96 s |
| reappraisal (eyes closed) | Cognitive emotion regulation | (get_ready, cue, thinking*) × 2 | 96 s |
| curiosity (eyes open) | Anticipatory engagement | get_ready → cue → wait* → video* | 45 s |
(* indicates recording phase.)

---
## 4. Data Acquisition & Preprocessing (Implemented)
| Stage | Method | Parameters | Rationale |
|-------|--------|-----------|-----------|
| Buffering | Rolling stream | 1–2 s windows, 50% overlap | Low latency; more samples |
| Downsampling | Decimate | 512 → 256 Hz | Efficiency with spectral integrity |
| Notch Filter | IIR Notch | 50 or 60 Hz (region heuristic) | Mains suppression |
| Bandpass | 2nd-order Butterworth (zero-phase) | 1–45 Hz | Remove DC & HF noise |
| Detrend | Mean removal | Per window | Stabilize PSD & blink detection |
| Artifact Rejection (Baseline EC) | MAD-based spike + proportion gate | hi_thr = 8×MAD scaled | Preserve clean alpha |
| PSD | Welch (Hann) | nperseg = window length | Variance-reduced spectral estimate |
| PSD Normalization (Enhanced) | Optional (total_power / SNR / robust) | Configurable | Cross-session comparability |

Blink rejection (enhanced engine): window excluded from baseline accumulation if spike + proportion criteria satisfied (MAD-based thresholds; code shows dual condition). No adaptive reprocessing after rejection.

---
## 5. Feature Set (Implemented)
Each accepted analysis window yields a feature vector. Base engine: 23 features (band powers, relative, peaks, ratios, total power). Enhanced engine: adds theta1/theta2, beta1/beta2 and derived ratios plus SNR-adjusted band computation (subtract noise floor; floor at zero).

### 5.1 Base Feature Families
- Absolute Band Powers: delta, theta, alpha, beta, gamma
- Relative Band Powers: each band / total (0.5–45 Hz)
- Band Peak Frequency & Peak Amplitude: within band-limited PSD
- Ratios: alpha/theta, beta/alpha
- Total Power: Variance surrogate (broadband)

### 5.2 Enhanced Extensions (Implemented)
| Added | Bands / Ratios | Purpose |
|-------|----------------|---------|
| theta1 / theta2 | (4–6) / (6–8) Hz | Finer WM vs drowsiness segregation |
| beta1 / beta2 | (13–20) / (20–30) Hz | Distinguish low vs high beta arousal |
| beta2_beta1_ratio | beta2 / beta1 | Elevated fast beta proportion |
| theta2_theta1_ratio | theta2 / theta1 | Shift toward higher theta peak |
| SNR-Adjusted Band Powers | max(psd - noise_floor, 0) | Attenuate broad uplift noise |

---
## 6. Statistical Framework (Implemented)
| Step | Input | Output | Notes |
|------|-------|--------|-------|
| Baseline Distribution | Accepted baseline feature vectors | μ_f, σ_f (or robust σ̂_f) | Stored per feature |
| Normalization | Task window features | z_f per window | z = (x - μ_f)/σ_f |
| Per-Feature Test | Baseline vs Task window sets | Welch t, p_raw_f, Δ_f | Heteroscedastic tolerant |
| Multiple Comparisons | {p_raw_f} | p_adj_f via BH-FDR | q = 0.05 |
| Effect Size | (May be computed; code path not guaranteed) | If present, numeric diff metrics stored | Treat as auxiliary |
| Composite | Post-FDR p-values (subset) | Sum -log10(p_adj) | Implemented in enhanced engine |
| Similarity | Cosine similarity baseline vs task mean | cosine_sim, distance | Implemented |

Overlapping windows: no correction for autocorrelation (implemented behavior). No permutation tests. No ERP averaging.

## 7. Per-Task Analysis (Implemented Logic)
When a task is analyzed (enhanced engine `analyze_task_data`):
1. Ensure baseline statistics exist (compute if absent using collected baseline windows).  
2. Select baseline pool: logic prefers eyes-closed baseline; may select eyes-open for certain protocol tasks (conditional code present).  
3. Convert task feature list into DataFrame.  
4. For each feature present in both task and baseline statistics:
   - Collect baseline window values and task window values.
   - Compute mean difference (task − baseline mean).
   - Compute Welch t-test (implemented helper) → raw p-value.
   - Accumulate p-values (+ optional effect metrics if code path executed).
5. Apply Benjamini–Hochberg FDR to p-value list (implemented `_bh_fdr`).  
6. Mark each feature with adjusted p, significance flag, direction (increase/decrease).  
7. Compute composite score: sum of -log10(adjusted p) over preferred subset (relative + ratio features if available, else all).  
8. Compute cosine similarity and distance between baseline mean feature vector and task mean vector (feature intersection).  
9. Store results in `analysis_results` (per-feature dict) and `composite_summary` (composite, similarity metrics).  

Outputs (implemented keys per feature): `baseline_mean`, `task_mean`, `mean_diff`, `p_raw`, `p_adj` (after FDR), `significant` (bool), possibly ratio or relative flags where applicable.

Guard Conditions: If task has zero windows, early exit with log. If baseline empty, attempt compute; if still empty, analysis cannot proceed.

Rejection Handling: During baseline accumulation eyes-closed windows flagged as blink are excluded (counters: `baseline_kept`, `baseline_rejected`). This influences available baseline window count for statistics; no retroactive re-weighting.

No temporal trend modeling: All task windows treated exchangeably.

## 8. Inter-Task / Multi-Task Analysis (Implemented Logic)
Enhanced engine method `analyze_all_tasks_data` performs:
1. Access `calibration_data['tasks']` (per-task collected window feature lists populated during recording).  
2. (Optional) Compute baseline if not yet available.  
3. Build a baseline DataFrame (eyes-closed baseline feature windows).  
4. For each recorded task:
   - Run internal helper (loop) to compute per-feature summary across that task's windows (same statistics pattern as single task: baseline mean, task mean, diff, p-value, adjusted p, significance).  
   - Store under `per_task[task_name]`.
5. Combine all task features (concatenate window lists) into a single aggregated set, analyze against baseline as a "combined" condition.  
6. Store structure:
```jsonc
{
  "per_task": { <task_id>: { "features": { feature_name: {...} }, "composite": <num> , ... } , ... },
  "combined": { ... aggregate analysis ... }
}
```

Composite calculation inside per-task loop uses same FDR + sum(-log10 p_adj) approach. No clustering, no dimensionality reduction, no permutation tests implemented. Cosine similarity is applied only in single-task analysis path (not necessarily repeated in multi-task summary unless reused externally).

No direct pairwise task vs task statistical testing is implemented (i.e., no A vs B t-test). Inter-task comparison is indirect via baseline-normalized results and per-task composite scores.

## 9. Additional Implemented Components
| Component | Implemented | Description |
|-----------|-------------|-------------|
| Baseline stats cache | Yes | `baseline_stats` dict keyed by feature storing mean, std, percentiles (in enhanced engine). |
| Blink counters | Yes (enhanced) | `baseline_kept`, `baseline_rejected` for EC baseline QC. |
| Task feature accumulation | Yes | Stored in `calibration_data['tasks'][task_id]['features']`. |
| Combined multi-task analysis | Yes | Aggregated across all tasks (see Section 8). |
| Cosine similarity (baseline vs single task) | Yes | Stored in `composite_summary`. |
| FDR control (BH) | Yes | Implemented helper `_bh_fdr`. |
| Fisher or other p-value meta methods | Not confirmed | Only sum(-log10 p_adj) composite visibly used. |
| Effect size (Hedge/Cohen) | Not guaranteed | Variable name placeholder; treat as optional. |
| GUI live plot | Yes | PyQtGraph continuous update; not part of statistical layer. |
| Window rejection outside EC baseline | Limited | Blink rejection logic primarily applied during eyes-closed baseline collection. |
| ERP / trial averaging | No | Not implemented. |
| Pairwise task-vs-task stats | No | Not implemented. |
| Permutation / bootstrap | No | Not implemented. |
| Asymmetry metrics | No | Single channel only. |

## 10. Composite Score (Implemented)
Formula in code: `composite = sum(-log10(p_adj_f))` over a preferred feature subset (relative powers & ratio features if present; else all tested features). No weighting, no scaling, no percentile calibration. Cosine similarity is stored separately (not folded into composite).

---
## 11. Data Structures (Implemented)
| Name | Level | Contents (examples) |
|------|-------|---------------------|
| `calibration_data['eyes_closed']['features']` | List | Window feature dicts (baseline) |
| `calibration_data['eyes_open']['features']` | List | Window feature dicts (secondary baseline) |
| `calibration_data['task']['features']` | List | Accumulated current task window features |
| `calibration_data['tasks'][task_id]['features']` | List | Per-task stored features across session |
| `baseline_stats[feature]` | Dict | mean, std, median, p25, p75 (as implemented) |
| `analysis_results[feature]` | Dict | baseline_mean, task_mean, mean_diff, p_raw, p_adj, significant |
| `composite_summary` | Dict | composite, cosine_similarity, cosine_distance, cosine_p_value (if computed) |
| `multi_task_results['per_task']` | Dict | Task keys → per-feature & composite stats |
| `multi_task_results['combined']` | Dict | Aggregate stats across all tasks |

## 12. Reproducibility Parameters (Implemented)
| Parameter | Value |
|-----------|-------|
| Window size (samples) | 512 (1 s @ 512 Hz) in base; enhanced may prefer 2 s (internal override) |
| Overlap size (samples) | 128 (base constant) |
| Sampling rate (raw) | 512 Hz |
| Effective processing rate | Downsample to 256 Hz inside PSD path (present in base code) |
| Filter band | 1–45 Hz (Butterworth, zero-phase) |
| Notch | 50 or 60 Hz (region heuristic) |
| PSD method | `welch()` (SciPy) |
| Relative power denominator | Sum of 0.5–45 Hz band powers (implemented) |
| Statistical test | Welch t-test helper |_bh_fdr for adjustment |
| Composite | Sum -log10(p_adj) |
| Blink rejection | Eyes-closed baseline only (MAD spike + proportion) |
| Cosine similarity | Baseline vs task mean feature vectors |

## 13. Limitations (Observed / Implemented State)
1. Single-channel: no spatial metrics, asymmetry, or connectivity.  
2. Overlapping windows: no effective sample size correction applied.  
3. Blink rejection limited to eyes-closed baseline; tasks not re-cleaned.  
4. No trial/event segmentation: continuous tasks only; no ERPs.  
5. Gamma band retained but not artifact-classified (muscle contamination possible).  
6. Composite score uncalibrated (no normative scaling or percentile mapping).  
7. No pairwise task statistical tests (only baseline-referenced).  

## 14. Explicitly NOT Implemented
| Item | Status |
|------|--------|
| ERP averaging | Not implemented |
| Connectivity / coherence | Not implemented |
| Source localization | Not applicable (single channel) |
| Pairwise task-vs-task stats | Not implemented |
| Permutation / bootstrap inference | Not implemented |
| Effective sample size correction | Not implemented |
| Aperiodic 1/f modeling | Not implemented |
| Automated EMG artifact classification | Not implemented |
| Dynamic re-baselining | Not implemented |

## 15. Usage Notes (Implemented Behavior)
| Scenario | Behavior |
|----------|----------|
| Start baseline (EC) | Windows collected; blink-filtered; stats later computed |
| Start baseline (EO) | Collected without blink rejection; may be used as alternative baseline |
| Start task | Feature windows appended to current task and task-specific bucket |
| Analyze current task | Generates `analysis_results` + `composite_summary` |
| Analyze all tasks | Populates `multi_task_results` (per-task + combined) |
| Missing baseline | Attempt compute; if still absent, analysis aborted gracefully |
| Insufficient windows | Feature absent or statistics may be skipped (guard clauses) |

## 16. Ethical / Interpretation Disclaimer (Implemented Wording Basis)
Outputs are **non-clinical** indicators derived from frontal spectral modulation. No diagnostic inference is performed or implied by the software.

---
## 17. Summary (Implemented)
Implemented system = single-channel frontal EEG → overlapping window segmentation → filtering + PSD → feature vector per window → baseline statistics → per-task Welch t-tests with FDR → composite score + cosine similarity → optional multi-task aggregation. No ERP, no connectivity, no pairwise task statistics beyond baseline-referenced comparisons. Data structures expose raw per-window features, per-feature statistics, and composite summaries for downstream academic inspection.

---
## 18. Contact
For clarification of implemented code paths or to export JSON results for external analysis, use the existing report generation hooks or request direct data extraction functions.
