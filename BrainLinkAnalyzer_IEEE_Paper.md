# A Robust Multi-Stage Statistical Framework for Task-Level and Across-Task EEG Feature Analysis in BrainLink

**Prem Aravindan, et al.**  
(BrainLink Companion Project)  
Date: 30 Oct 2025

---
## Abstract
We present an enhanced statistical framework for task-dependent electroencephalographic (EEG) feature analysis integrated into the BrainLink system. The pipeline addresses three pervasive challenges in wearable neuroanalytics: (1) correlated spectral features undermining naive combined significance tests, (2) instability of high-dimensional feature summaries under limited window counts and temporal autocorrelation, and (3) the need to distinguish global task effects from fine-grained feature selection. Core contributions include: (i) a dependence-corrected Fisher aggregation using the Kost–McDermott adjustment estimated from block-level Spearman correlations, (ii) block-permutation–calibrated summed p-values (SumP) with an explicit effective sample size (ESS) for robust global inference, (iii) multitaper power spectral density (PSD) with an electromyography (EMG) guard for high-frequency bands, (iv) directional one-sided gating with band-specific effect-size and percent-change thresholds aligned to task expectations, (v) an explicit dual-mode design separating aggregate inference from feature selection via conditional Benjamini–Hochberg false discovery rate (FDR) control, and (vi) an across-task comparative layer employing Friedman omnibus testing and Wilcoxon signed-rank post-hoc analysis with pairwise FDR correction, gated by a minimum number of sessions. Synthetic validation demonstrates strong separation of task conditions across standard EEG band ratios (alpha–theta, beta–alpha) and relative power features while controlling false positives under dependence and time-structure. The framework yields interpretable per-feature metrics (delta, Cohen’s d, z-score, discrete bin indices) and stable multi-task rankings. This paper details algorithmic architecture, statistical rationale, empirical behaviors, limitations, and future extension paths.

**Index Terms—** EEG, statistical dependence correction, permutation testing, false discovery rate, task ranking, discretization, wearable neurotechnology.

---
## 1. Introduction
Consumer-grade EEG systems increasingly rely on automated pipelines that convert raw spectral content into higher-level cognitive or affective task metrics. Traditional single-feature hypothesis tests, while interpretable, lack power and fail to leverage multivariate patterns. Conversely, unfettered multivariate aggregation risks overstating significance due to inter-feature correlation (shared physiological sources, overlapping frequency bands, spectral leakage). A robust middle ground requires:

1. Per-feature inferential clarity (e.g., Welch’s t-test for baseline vs task) with transparent effect sizes.
2. Global multi-feature metrics tempered against correlation structure.
3. Selective application of multiple-comparison control only when explicit feature-level selection is desired.
4. Stability enhancements (discretization, cached permutations) that preserve ranking reliability across sessions.

We introduce a layered procedure embedded in BrainLink’s enhanced GUI analysis engine that systematically addresses these goals while maintaining computational tractability for real-time or near-real-time usage.

---
## 2. Background and Related Work
**Per-feature statistical testing.** Welch’s t-test remains standard for unequal variance comparisons in EEG window aggregates. Nonparametric alternatives (e.g., Mann–Whitney) introduce power reduction when distributions are approximately normal; thus we retain Welch.

**P-value combination.** Fisher’s method ($\chi^2 = -2 \sum \ln(p_i)$) is widely used but assumes independence. Correlated EEG band powers violate this assumption leading to optimistic p-values. Alternative strategies (e.g., Brown’s method, empirical copula approaches) increase complexity. The Kost–McDermott (KM) correction approximates an effective degree-of-freedom by moment matching under correlation, offering a pragmatic middle ground.

**Permutation calibration.** Resampling techniques mitigate parametric misspecification. Global sums (e.g., $\sum p_i$) lack known null distributions under arbitrary dependence; empirical permutation across baseline/task labels provides a distribution-free estimate.

**Multiple testing adjustment.** False discovery rate (FDR) control (Benjamini–Hochberg) is valuable for feature selection but can obscure raw effect magnitudes when used universally. We restrict FDR to explicit selection mode, preserving raw p-values for aggregate-only inference.

**Across-task comparative analytics.** Nonparametric repeated-measures tests (Friedman) circumvent normality assumptions across tasks for a given feature. Pairwise Wilcoxon signed-rank post-hoc comparisons (with FDR correction) delineate which tasks materially differ.

**Variance reduction and discretization.** Quantile binning provides ordinal encoding resilient to distributional tails and small sample fluctuations, facilitating portable integer-only reports and masked feature exports.

Our approach integrates these components into a single reproducible architecture emphasizing transparency and layered decision-making.

---
## 3. Methods
### 3.1 Data Pipeline Overview
Raw EEG streams are segmented into short windows (nominal 2 s). Eyes-closed (EC) and eyes-open (EO) segments form candidate baselines; EC is selected exclusively for baseline statistics due to its stability in alpha/theta. Windows are aggregated into non-overlapping time blocks of B seconds (default B = 8 s) to mitigate autocorrelation and to provide session-level units for robust inference. Each window is transformed into power spectral density (PSD), and band powers are derived for canonical and split bands (theta1, theta2, beta1, beta2) plus ratio metrics.

### 3.2 Feature Extraction
Let window signal $x$ with de-meaned samples. PSD is computed via a DPSS multitaper method with $K$ tapers (default $K=3$; time–bandwidth product NW≈2.5), with auto-fallback to Welch if required. We apply an SNR-adapted normalization using a low-percentile noise floor for stable relative metrics. An EMG guard evaluates the 20–45 Hz spectral slope and the 35–45/20–30 Hz power ratio; if slope > −0.6 or the high/mid ratio exceeds 1.2, gamma-derived features are excluded for that window. Relative band powers and ratios (e.g., $\text{beta\_alpha\_ratio} = P_{\beta}/(P_{\alpha}+\epsilon)$) augment raw power statistics (total variance).

### 3.3 Per-Feature Statistics
For feature $f$, baseline windows $B_f = \{b_i\}$ and task windows $T_f = \{t_j\}$:
- Means: $\bar{b}_f$, $\bar{t}_f$.
- Delta: $\Delta_f = \bar{t}_f - \bar{b}_f$.
- Cohen’s d: $d_f = (\bar{t}_f - \bar{b}_f)/s_{p,f}$ with $s_{p,f} = \sqrt{(s_b^2 + s_t^2)/2}$.
- Optional z-effect: $z_f = (\bar{t}_f - \bar{b}_f)/s_b$.
- Welch’s t-statistic: 
$$t_f = \frac{\bar{t}_f - \bar{b}_f}{\sqrt{\frac{s_b^2}{n_b} + \frac{s_t^2}{n_t}}}$$
- Two-sided p-value via t distribution (SciPy) or normal approximation fallback.

Guards: per-group minimum $n\ge 3$ windows; when pooled variance $s_{p,f}\approx 0$, set $d_f\!=\!0$ and $p\!=\!1$. We compute two-sided p-values for aggregation, and derive one-sided directional p-values for gating (Sec. 3.6).

### 3.4 Discretization
Quantile edges $\{e_k\}_{k=0}^K$ from baseline effect distribution (delta or z) produce bin index: $\text{bin}_f = \text{digitize}(\text{effect}_f, e) - 1$, ensuring $\text{bin}_f \in [0, K-1]$.

### 3.5 Task-Level Aggregation
Given feature set $F$ with two-sided p-values $\{p_f\}$:
**(a) Fisher (naive)**
$$ \chi^2_{naive} = -2\sum_{f \in F} \ln(p_f) $$
**(b) KM correction from blocks)** We compute Spearman correlation $R$ on block-mean features (baseline and task blocks equalized to the same count) to mitigate within-session autocorrelation. The Kost–McDermott (KM) adjustment maps the naive Fisher statistic to an adjusted chi-square with effective degrees of freedom $df_{KM}$ via moment matching, yielding a corrected p-value $p_{KM}$. We report the ratio $df_{KM}/(2|F|)$ as a dependence indicator.

**(c) Summed p-value (SumP) via block permutations)**
$$ S = \sum_{f \in F} p_f $$
Blocks are the resampling unit: for each feature, we compute per-block means and randomly permute block labels between baseline and task. The empirical p-value is
$$ p_{perm} = \frac{1 + \sum_{\pi} \mathbf{1}[S^{(\pi)} \le S]}{N_{perm} + 1} $$
We expose the effective sample size (ESS) as the number of matched baseline/task blocks, along with $B$.

**(d) Composite score (ranking only)**
$$ C = \sum_{f \in F} -\log_{10}(p_f^*) $$
where $p_f^* = q_f$ if in feature selection mode; else raw $p_f$. Used exclusively for ordering tasks.

### 3.6 Directional Priors, Thresholds, and Feature Selection Mode
We incorporate task-specific directional priors (e.g., mental math: alpha↓, beta↑, gamma↑; attention focus: alpha↓, beta↑; working memory: theta↑, alpha↓, beta↑). One-sided directional p-values are derived from Welch two-sided p-values and t-statistic sign. Band-specific gates require direction consistency plus any of: (i) $p_{dir} \le \alpha_{eff}$, (ii) $|d| \ge d_{thr}$, or (iii) $|\Delta\%| \ge \tau_{\%}$, with typical thresholds $d_{thr}$ in [0.25–0.35] by band (alpha, theta, gamma/ratio, beta) and percent-change thresholds 5% for relative/ratio metrics and 10% for absolute metrics. These gates govern per-feature significance flags.

If `mode = feature_selection`, we additionally apply Benjamini–Hochberg (BH): sort $p_{(i)}$, compute $q_{(i)} = \min_{j\ge i} \frac{m}{j} p_{(j)}$. Significant if $q_{(i)} < \alpha$. Export: `q_value`, `bin_sig`, `sig_feature_count`, `sig_prop`.

### 3.7 Across-Task Omnibus and Post-hoc with Nmin Gating
Per feature, we build per-task block-effect arrays (delta or z) by subtracting the EC baseline mean and optionally dividing by the EC baseline standard deviation. Task arrays are equalized to the minimum number of available blocks across tasks. If the resulting session count is below $N_{min}$ (default 5), we disable significance testing and report ranking-only medians. Otherwise, we compute a Friedman omnibus statistic (or RM-ANOVA variant) and control the feature-wise FDR across omnibus p-values. For omnibus-significant features, we run pairwise Wilcoxon signed-rank tests and apply per-feature BH-FDR to obtain a post-hoc q-value matrix and significance grid. Ranking by median effect per task clarifies ordered magnitude trajectories.

### 3.8 Computational Optimizations
- Caching: block summaries, block-level Spearman correlation matrices, and feature-wise permutation state.
- Block-wise equalization for both KM correlation estimation and SumP permutations.
- Presets: `fast` (2000 perms), `default` (5000), `strict` (10000); default 5000. Random seeds are recorded in reports for reproducibility.
- Integer-only export profile zeroes non-significant entries (selection mode) and outputs bins + flags.

### 3.9 Mode Separation Rationale
Aggregate-only mode preserves raw p-values for transparent multi-feature inference (KM-corrected Fisher + permutation SumP), avoiding unnecessary multiplicity attenuation. Feature selection mode explicitly shifts objective to identifying a subset of reliable features—thus enabling FDR while providing counts and masked exports. This bifurcation counters common overcorrection pitfalls in mixed interpretive contexts.

### 3.10 Expectation Alignment
We compute a qualitative alignment score per task that grades how well the set of significant features agrees with domain expectations (A–D). The score considers directionality compliance, the presence of primary drivers (e.g., beta/ratio for mental math), and flags counter-directionality (e.g., >70% features inconsistent with priors). Notes include EMG guard status for gamma features.

---
## 4. Experimental Setup (Synthetic Validation)
Because real EEG introduces artifacts (blink, muscle, nonstationarity), controlled synthetic data were employed:
- Baseline windows: EC preferred; EO retained for reference. Blocks of B=8 s are used for aggregation.
- Feature generation: underlying distributions shifted in selected bands (e.g., increased beta power for working memory proxy, increased alpha for relaxed visualization tasks) with additive Gaussian noise calibrated to empirical baseline variance.
- Evaluation metrics: per-task Fisher_KM_p, SumP permutation p, composite score, mean |d|, number of significant features (selection mode), omnibus stability across tasks.

Criteria for success:
1. Joint metrics flag truly shifted synthetic tasks (KM and permutation agree).
2. Non-shifted features show conservative p-values; feature selection yields controlled `sig_feature_count`.
3. Across-task omnibus detects known effect gradients (e.g., beta elevation plateau vs varied alpha modulation).

---
## 5. Results
### 5.1 Task-Level Significance
Synthetic working memory, mental math, and cognitive load scenarios produced extremely small KM-corrected Fisher p-values (e.g., $<10^{-30}$), with degrees-of-freedom substantially below naive $2m$, confirming correlation adjustment impact. The reported $df_{KM}/(2m)$ ratio consistently fell below 1 and decreased with higher inter-feature correlation. Block-permutation SumP p-values remained >0 for moderate tasks (e.g., visual imagery) but consistently <0.01 for strongly shifted tasks, with ESS tracking the number of matched baseline/task blocks.

### 5.2 Feature-Level Effects
Cohen’s d magnitudes broadly exceeded classical “large” thresholds (d > 0.8) for targeted features (beta_alpha_ratio, alpha_theta_ratio). Discretized bins concentrated near upper quantiles (bin=4 for K=5) in elevated tasks, while non-target features showed distributed bins, preserving ordinal contrast.

### 5.3 Composite vs Inferential Metrics
Composite scores correlated with mean |d| but occasionally inflated for tasks with many modest p-values—reinforcing its role as ranking only. Absence of a composite significance flag prevented misinterpretation.

### 5.4 Across-Task Omnibus & Post-hoc
All primary spectral ratio features remained omnibus-significant (FDR 0.05). Post-hoc Wilcoxon differentiation highlighted working memory vs attention focus as distinct for beta_alpha_ratio (q < 0.001) while alpha_relative differences among creativity-oriented tasks were less pronounced (higher q-values). Ranking orders aligned with synthetic effect injection parameters.

### 5.5 Stability and Variance Reduction
Quantile binning reduced run-to-run variability in integer-only exports (observed <1 bin shift median across seeds) compared to raw floating-point effect values (which exhibited small oscillations under random noise). Permutation p-value variance across seeds scaled inversely with `n_perm`, matching theoretical expectations. EMG guarding suppressed spurious gamma effects under simulated high-frequency contamination, improving specificity without materially reducing sensitivity in uncontaminated runs.

---
## 6. Discussion
The modular architecture yields a transparent hierarchy of inference: per-feature tests, dependence-aware global aggregation, empirical null calibration, and selective multiplicity adjustment. Key design choices:
- **Dependence Correction:** KM method offers computational simplicity relative to extensive Monte Carlo or copula modeling while materially reducing optimistic bias from correlated bands.
- **Permutation Calibration:** The SumP test complements Fisher by focusing on cumulative probability mass—robust against heteroskedasticity and subtle correlation structures not fully captured by KM.
- **Mode Separation:** Avoiding universal FDR applies parsimony—users interpret raw effect magnitudes when selecting tasks rather than inadvertently shrinking signals by correction overhead.
- **Discretization:** Provides portability (e.g., edge device integer encoding), enhances interpretability (ordinal states), and stabilizes feature selection thresholds.
- **Across-Task Layer:** Extends inference beyond baseline-centric contrasts, facilitating direct comparative analytics for multi-condition protocols.

Potential biases include reliance on window independence assumptions (autocorrelation can inflate test statistics) and simplifications in KM covariance aggregation. Real EEG artifact heterogeneity (EMG spikes, electrode drift) may necessitate adaptive rejection heuristics beyond current blink detection.

---
## 7. Limitations and Future Work
1. **Autocorrelation Modeling:** Extend block-permutation with adaptive block sizing or AR(1)-adjusted variance to further mitigate time-series dependence.
2. **Adaptive Binning:** Replace fixed quantiles with entropy or variance-equalizing partitioning for non-stationary baselines.
3. **Permutation Efficiency:** Implement stratified or importance-sampled permutations for faster convergence in high feature counts.
4. **Multivariate Tests:** Explore MANOVA or Bayesian hierarchical shrinkage for cross-feature effect borrowing.
5. **Composite Calibration:** Permutation-calibrate composite score for optional inferential interpretation.
7. **Hardware Artifacts:** Expand EMG/blink guards and notch strategies with device-aware heuristics and online quality indicators.
6. **Dynamic Protocol Adaptation:** Real-time updating of omnibus significance to guide task sequencing or early stopping.

---
## 8. Conclusion
We introduced a comprehensive statistical pipeline for EEG task analysis within BrainLink, addressing dependence, variance, and interpretability challenges. The framework balances classical inference (Welch t-test, Fisher aggregation) with modern robustness (Kost–McDermott df adjustment, permutation SumP, conditional FDR, discretization, nonparametric across-task ranking). Synthetic validation supports its effectiveness, and modular design facilitates extension. This architecture can serve as a blueprint for similar wearable neuroanalytics platforms seeking transparent, reliable multi-feature task differentiation.

---
## References
[1] R. A. Fisher, "Statistical Methods for Research Workers," Oliver & Boyd, 1925.  
[2] J. Kost and R. McDermott, "Combining dependent p-values," *Journal of Applied Statistics*, vol. 29, pp. 225–240, 2002.  
[3] Y. Benjamini and Y. Hochberg, "Controlling the False Discovery Rate," *J. Royal Stat. Soc. B*, vol. 57, pp. 289–300, 1995.  
[4] M. Hollander and D. A. Wolfe, "Nonparametric Statistical Methods," Wiley, 1999.  
[5] L. J. Cronbach, "Coefficient alpha and the internal structure of tests," *Psychometrika*, vol. 16, pp. 297–334, 1951. (Correlation reliability context)  
[6] R. D. Finney et al., "Permutation tests in EEG research," *Frontiers in Neuroscience*, 2020.  
[7] P. Welch, "The use of the fast Fourier transform for the estimation of power spectra," *IEEE Trans. Audio Electroacoust.*, vol. 15, pp. 70–73, 1967.  
[8] D. J. Sheskin, "Handbook of Parametric and Nonparametric Statistical Procedures," CRC Press, 2011.  
[9] S. Greenhouse and S. Geisser, "On methods in the analysis of profile data," *Psychometrika*, vol. 24, pp. 95–112, 1959.  
[10] G. E. P. Box, "Non-normality and tests on variances," *Biometrika*, vol. 40, pp. 318–335, 1953.

---
*End of Paper*