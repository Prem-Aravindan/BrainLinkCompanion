# BrainLink EEG Task Analysis – Cohesive Implementation Guide & Q&A

> Scope: Precisely what the current code implements (no speculative additions).  
> Goal: Provide a logically connected narrative so each metric and section flows into the next, with every method explained at first mention.

---
## 1. End-to-End Processing Narrative (Big Picture)
The pipeline transforms a continuous single frontal EEG channel into interpretable task-level statistical summaries:

1. Acquisition: Raw 512 Hz frontal samples stream in.  
2. Segmentation: Data is buffered into overlapping analysis windows (≈1 s; 512 samples; 128-sample shift).  
3. Preprocessing: Each window is detrended, filtered (notch + bandpass 1–45 Hz), optionally downsampled for PSD efficiency, then passed to feature extraction.  
4. Feature Extraction: Per-window spectral features (band powers, relative powers, peaks, ratios, total power) are computed.  
5. Baseline Formation: Eyes-closed (EC) window features are collected (blink-contaminated windows rejected via a robust MAD-based rule); statistics (mean, std, percentiles) are stored per feature. Eyes-open (EO) may also be collected but EC is the default baseline.  
6. Task Accumulation: For each cognitive or protocol task, its window feature vectors are stored without blink rejection (implemented behavior).  
7. Per-Task Statistical Comparison: Each feature’s task distribution is contrasted against baseline using Welch’s t-test.  
8. Multiple Comparison Control: Raw p-values are adjusted using Benjamini–Hochberg False Discovery Rate (BH-FDR), producing adjusted p-values ("q").  
9. Aggregate Metrics: Several combined indicators (summed p-value, Fisher’s method p-value, composite score = Σ -log10(q)) and counts of significant features are derived.  
10. Reporting: Per-feature statistics + aggregate header metrics + (optionally) cosine similarity baseline vs task mean vectors are exposed for interpretation.

Each subsequent section unpacks one layer of the above narrative.

---
## 2. Task Inventory and Why Baseline Matters
Tasks define the contexts whose spectral distributions we compare to a resting reference. Implemented tasks:

| Class | IDs |
|-------|-----|
| Baselines | `eyes_closed` (primary), `eyes_open` (secondary) |
| Cognitive 60 s | `mental_math`, `working_memory`, `cognitive_load`, `attention_focus`, `language_processing`, `visual_imagery`, `motor_imagery` |
| Phase / Protocol | `emotion_face`, `diverse_thinking`, `reappraisal`, `curiosity` |

Rationale for EC baseline preference: higher signal-to-noise for alpha/theta and more stable reference variance. EO baseline can be substituted conditionally (code branch) but if absent the system reverts to EC.

Transition: Once baseline windows are established, we need robust feature measures—explained next.

---
## 3. Per-Window Feature Set (What We Measure Before Testing)
All inferential statistics depend on the integrity of the per-window feature vectors:

| Family | Examples | First-use Explanation |
|--------|----------|-----------------------|
| Absolute Band Power | delta_power … gamma_power | Integrated PSD energy inside canonical band (Simpson’s rule integration over Welch PSD). |
| Relative Band Power | alpha_relative, etc. | Absolute band power divided by total (0.5–45 Hz) power to reduce amplitude scaling sensitivity. |
| Peak Frequency | alpha_peak_freq | Frequency (within band limits) where PSD attains local maximum. |
| Peak Amplitude | alpha_peak_amp | PSD value at peak frequency (band-limited). |
| Ratios | alpha_theta_ratio, beta_alpha_ratio | Direct physiological indices (e.g., engagement vs relaxation). |
| Extended (Enhanced) | theta1/theta2, beta1/beta2 splits + ratios | Refinement of broad bands (executed only in enhanced engine). |
| Total Power | total_power | Variance proxy (broadband activity after preprocessing). |

Only features present in a task’s collected windows and in baseline statistics participate in statistical tests. Missing features are silently skipped.

Transition: With features computed, we build baseline statistics to enable normalization and hypothesis testing.

---
## 4. Baseline Statistics (Reference Distributions)
For each feature f in accepted baseline windows we store:

| Stored Quantity | Use |
|-----------------|-----|
| mean (μ_f) | Center for difference tests & potential z-scoring |
| std (σ_f) | Denominator in t-test variance terms & conceptual normalization |
| median / percentiles | Robust inspection (not directly used in test formula) |

Blink Rejection (EC only): A window is discarded if (a) the maximum absolute deviation exceeds a high threshold (≈8 × MAD-based scale) AND (b) a non-trivial fraction of samples exceed a lower deviation threshold. This preserves clean resting reference distributions. No artifact rejection is applied to task windows (implemented limitation).

Transition: With baseline distributions defined we can compare task vs baseline using appropriate tests.

---
## 5. Per-Feature Statistical Test (Welch’s t-test)
First mention explanation: **Welch’s t-test** compares the means of two groups (baseline windows vs task windows) allowing unequal variances and unequal sample sizes. It is computed as:

t_f = (μ_task,f − μ_base,f) / sqrt( s_task,f² / n_task + s_base,f² / n_base )

where s_task,f² and s_base,f² are sample variances; degrees of freedom are approximated via the Welch–Satterthwaite formula (handled internally by SciPy / implementation helper). This choice avoids the equal-variance assumption of Student’s t-test.

Result per feature:
| Field | Definition |
|-------|-----------|
| baseline_mean | μ_base,f |
| task_mean | μ_task,f |
| mean_diff | task_mean − baseline_mean |
| p_raw | Two-sided Welch p-value |

Transition: Multiple features inflate false positives, so we adjust p-values next.

---
## 6. Multiple Comparison Control (Benjamini–Hochberg FDR)
First mention explanation: **Benjamini–Hochberg (BH) FDR** controls the expected proportion of false discoveries (type I errors) among the rejected hypotheses. Given m raw p-values, they are sorted ascending; a p_i is declared significant if p_i ≤ (i/m)·q where q=0.05 (configured) and i is its rank. The implementation produces adjusted values often labeled p_adj or **q**. In this system:

| Term | Meaning |
|------|---------|
| p_raw | Original Welch test p-value |
| p_adj (q) | BH-adjusted p-value (FDR) |
| significant | True if (by code path) p_adj < 0.05 (or sometimes p_raw < 0.05 in raw significance count) |

Transition: After adjusting, we aggregate evidential strength across features.

---
## 7. Aggregate / Header Metrics (First-Use Explanations)
The header summarizing a task’s overall modulation includes multiple composite indicators—each serves a different descriptive purpose:

| Metric | First Explanation | Implementation Note |
|--------|-------------------|---------------------|
| Summed p-value | Σ p_raw across selected features (descriptive magnitude; smaller sum indicates collectively small p-values) | Not an inferential statistic; no distributional threshold. |
| Fisher p-value | Combined significance via **Fisher’s method**: χ² = −2 Σ ln(p_raw). Under null & independence: χ² ~ χ²(df=2k). | Extremely small values may underflow to 0.0 in print. |
| chi2 | The χ² statistic from Fisher combination prior to p-value calculation. | Degrees of freedom = 2k where k = count of combined features. |
| Mean effect size (d) | Mean of per-feature standardized differences (if effect size path executed). | May be absent or partial if some features skip effect computation. |
| Significant features (p<0.05) | Count where p_raw < 0.05 (pre-FDR). | Purely descriptive. |
| FDR@0.05 | Count where p_adj < 0.05. | Controls expected false discovery proportion. |
| Threshold (0.05*k) | Heuristic: 0.05 × number_of_significant_features. Used to contextualize summed p-value. | Non-standard; internal heuristic only. |
| Composite score | Σ -log10(p_adj) over preferred subset (ratios + relative powers or all). | Larger = stronger multi-feature deviation. |
| Composite significant | Boolean heuristic combining counts + aggregate criteria. | Implementation logic clusters multiple checks. |
| Cosine similarity | Cosine between baseline and task mean feature vectors. Value near 1 = similar profile. | Captures directionality alignment ignoring absolute scale difference. |

Why Fisher’s method here: It provides a theoretically grounded combined p-value. Caveat: spectral features are correlated → independence assumption violated → Fisher p-value may be anti-conservative.

Transition: Different aggregators tell complementary stories (strength, breadth, direction). We contrast them next.

---
## 8. Comparing Aggregators
| Aggregator | Purpose | Limitation |
|------------|---------|------------|
| Fisher p-value | Formal combined hypothesis test | Correlation inflates apparent significance |
| Composite score Σ -log10(p_adj) | Emphasizes very small adjusted p-values; ranking tasks | No calibrated null distribution provided |
| Summed p-value Σ p_raw | Rough overall magnitude check | Dependent on number of features; no statistical threshold |

Interpretation Guidance: Use Fisher p-value for canonical “is there multi-feature deviation?”, composite score for relative ranking across tasks within a session, and per-feature FDR results for granular interpretation.

Transition: Having defined metrics, we now clarify supporting calculations and related constructs.

---
## 9. Ratios, Z-Scores, and Effect Sizes (Contextual Metrics)
| Metric | Definition (First Explanation) | Implementation Use |
|--------|--------------------------------|--------------------|
| Ratio Features | Direct physical ratios (e.g., beta_alpha_ratio = β_power / α_power) capturing relative spectral balance. | Included in feature set; subject to same tests. |
| Z-score (conceptual) | (x − μ_baseline)/σ_baseline; standardizing a sample by baseline parameters. | Used conceptually (not always output explicitly) to interpret deviations. |
| Effect size d | (μ_task − μ_base)/s_pooled (or variant) indicating standardized magnitude of difference. | Mean of available d’s printed; not critical to downstream logic. |

Transition: Statistical assumptions matter; we expose them to frame limitations.

---
## 10. Statistical Assumptions & Dependencies
| Aspect | Implemented Behavior | Consequence |
|--------|---------------------|-------------|
| Window Independence | Overlapping windows treated as independent | Potential p-value inflation |
| Variance Equality | Not assumed (Welch test) | Appropriate for unequal sample sizes/variances |
| Multiple Testing | BH-FDR | Controls expected false discoveries |
| Feature Correlation | Ignored in Fisher & composite | Combined metrics may overstate evidence |
| Baseline Quality | Blink rejection EC only | Task artifacts pass through |

Transition: Before Q&A, we define artifact handling clearly.

---
## 11. Artifact Handling (Implemented Only)
| Context | Mechanism | Scope |
|---------|----------|-------|
| Eyes-Closed Baseline | MAD-based spike + proportion rule | Reject + do not include in stats |
| Tasks | All windows retained |
| EMG / Motion | None | Possible contamination in high beta / gamma | Might be useful as well

Transition: With all pieces described, glossary + example anchor interpretation.

---
## 12. Glossary of Output Fields
| Field | Meaning |
|-------|--------|
| baseline_mean | Mean baseline feature value |
| task_mean | Mean task feature value |
| mean_diff | task_mean − baseline_mean |
| p_raw | Welch test p-value |
| p_adj / q | BH-FDR adjusted p-value |
| significant | True if (implementation rule) significance threshold passed |
| composite | Σ -log10(p_adj) selected feature set |
| Summed p-value | Σ p_raw (heuristic) |
| Fisher p-value | Combined p from Fisher’s method |
| chi2 | Fisher combination χ² statistic |
| cosine_similarity | Alignment of mean feature vectors |

---
## 13. Worked Mini Example
Given three features with p_raw = [0.001, 0.02, 0.10]:
1. BH-FDR adjustment (m=3) → p_adj ≈ [0.003, 0.03, 0.10].  
2. Fisher χ² = -2(ln 0.001 + ln 0.02 + ln 0.10) ≈ 25.24 (df=6) → Fisher p ≈ 0.0003.  
3. Composite = -log10(0.003)+ -log10(0.03)+ -log10(0.10) ≈ 2.52 + 1.52 + 1.00 = 5.04.  
4. Summed p-value = 0.121 (descriptive only).

---
## 14. Direct Answers to Your Submitted Questions
| Question | Answer |
|----------|--------|
| “Baseline = eyes open?” | Actual primary baseline is eyes-closed; eyes-open used only if logic explicitly selects it and data exists. |
| “Ratio meaning?” | Domain spectral ratio (e.g., beta/alpha). Not a statistical ratio test. |
| “Z-score?” | Conceptual normalization relative to baseline mean/std; not always printed per window. |
| “p-value source?” | Welch’s t-test comparing baseline vs task window feature distributions. |
| “q = Cochran’s test?” | No. q = BH-FDR adjusted p-value. Cochran’s Q is not implemented. |
| “Mean effect size (d)?” | Average of available per-feature standardized differences. |
| “Summed p-value rationale?” | Heuristic aggregate (Σ p_raw). Not a hypothesis test. |
| “Fisher p-value & chi2?” | Fisher’s method combining raw p-values → χ² statistic, then p-value under χ²(df=2k). |
| “Why Fisher p = 0.0?” | Numerical underflow for extremely small values (<<1e-308). |
| “Threshold (0.05*k)?” | Internal heuristic: if Σ p_raw smaller than this, supports composite significance flag. |
| “Composite significant = True?” | Heuristic satisfied: enough significant features + aggregate thresholds. |
| “Direction of effect?” | Sign of mean_diff (positive = increase). |
| “No ERP?” | Continuous tasks; no repeated time-locked trials → ERP not implemented. |

---
## 15. Anticipated Discussion Questions & Prepared Implementation Answers
| Potential Question | Answer (Implementation-Focused) |
|--------------------|---------------------------------|
| Window size rationale? | 1 s offers balance between temporal responsiveness and spectral stability. |
| Why overlap 128 samples? | Reduces latency while creating partially independent estimates. |
| Independence assumption issues? | Acknowledge correlation; not corrected; interpret cautiously. |
| Why no permutation tests? | Not implemented for runtime simplicity. |
| How to externally verify? | Export per-window features; rerun Welch + BH-FDR offline. |
| Which features drive composite most? | Those with the smallest adjusted p-values (largest -log10). |
| Cosine similarity purpose? | Measures shape similarity of mean spectral feature profile, independent of magnitude. |
| Handling low-variance features? | If variance collapses, test may skip or produce non-informative p. |
| Gamma reliability? | Kept but not artifact-classified; interpret only cautiously. |
| Could Fisher & composite disagree? | Yes—Fisher sensitive to many modest p’s; composite emphasizes a few very small p_adj. |

---
## 16. Limitations (Explicit)
1. Overlapping windows inflate nominal degrees of freedom; no correction.  
2. Feature correlations violate independence assumptions in Fisher and heuristic sums.  
3. Task artifacts unfiltered.  
4. Single-channel prevents spatial or connectivity analyses.  
5. No null calibration for composite score.  
6. Summed p-value and 0.05*k threshold are descriptive heuristics.  

---
## 17. Quick Reference (Talking Points)
Pipeline summary: window → PSD (Welch) → features → baseline stats → Welch tests → BH-FDR → Fisher + composite aggregates → report.

Interpretation principle: emphasize **consistency across several low adjusted p-values** instead of any single extreme value; cross-check cosine similarity for overall profile change.

---
## 18. Validation Status (Implemented Scope Only)
The current code outputs statistical comparisons but does **not** implement: permutation testing, reliability (ICC) computation, asymmetry metrics, or effective sample size adjustment. External validation should re-run statistics with dependency-aware methods if required.

