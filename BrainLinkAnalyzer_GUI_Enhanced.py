#!/usr/bin/env python3
"""
Enhanced BrainLink Feature Analysis GUI
Implements targeted recommendations with the following changes:
- Eyes-closed-only baseline protocol for calibration
- Blink/ocular artifact-aware baseline window rejection
- Spectral normalization hooks (configurable)
- Per-feature significance via Welch's t-test (no Mann-Whitney)
- P-value summation composite score across features
- Cosine similarity between baseline and task feature vectors

This module subclasses the original GUI to minimize intrusive changes.
"""
from collections import deque
import numpy as np
import pandas as pd
import time
import threading
import platform
import os
# Select a usable Qt binding and configure pyqtgraph accordingly
import os as _os

def _select_qt_api():
    for name in ("PySide6", "PyQt6", "PyQt5"):
        try:
            __import__(name)
            return name
        except Exception:
            continue
    return None

_qt_api = _select_qt_api()
if _qt_api:
    _os.environ.setdefault('PYQTGRAPH_QT_LIB', _qt_api)
# Import pyqtgraph after setting the env var; use its Qt shim for widgets/core
import pyqtgraph as pg
from pyqtgraph.Qt import QtCore, QtWidgets
try:
    # Optional: enable painter antialiasing at widget level
    from pyqtgraph.Qt import QtGui as _QtGui
except Exception:
    _QtGui = None

# Hard-set pyqtgraph visibility and performance options to match the stable legacy setup
try:
    pg.setConfigOption('useOpenGL', False)
    pg.setConfigOption('antialias', True)
    pg.setConfigOption('background', 'k')   # black background
    pg.setConfigOption('foreground', 'w')   # white axes/text
    pg.setConfigOption('crashWarning', True)
    pg.setConfigOption('imageAxisOrder', 'row-major')
except Exception:
    pass

# Optional SciPy stats import; fall back to lightweight implementations if unavailable
try:
    from scipy.stats import ttest_ind as _scipy_ttest_ind  # type: ignore
    from scipy.stats import chi2 as _scipy_chi2  # type: ignore
except Exception:
    _scipy_ttest_ind = None
    _scipy_chi2 = None

# Import original application as a module
import BrainLinkAnalyzer_GUI as BL

# Binding-agnostic Qt references via pyqtgraph's shim
QDialog = QtWidgets.QDialog
QLabel = QtWidgets.QLabel
QVBoxLayout = QtWidgets.QVBoxLayout
QPushButton = QtWidgets.QPushButton
QTextEdit = QtWidgets.QTextEdit
QWidget = QtWidgets.QWidget
Qt = QtCore.Qt
QTimer = QtCore.QTimer


class CrosshairDialog(QDialog):
    """Instructional cue dialog (kept minimal; not used for EC)."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Fixation Cross - Keep Eyes Open and Relaxed")
        self.setModal(False)
        self.setAttribute(Qt.WA_TranslucentBackground, False)
        layout = QVBoxLayout(self)
        label = QLabel("+", self)
        label.setAlignment(Qt.AlignCenter)
        label.setStyleSheet("font: 72pt 'Arial'; color: #FF3333;")
        layout.addWidget(label)
        self.setMinimumSize(200, 200)


class EnhancedFeatureAnalysisEngine(BL.FeatureAnalysisEngine):
    def __init__(self, normalization_method: str = 'snr_based', blink_sigma: float = 3.0):
        super().__init__()
        # Configuration
        self.normalization_method = normalization_method
        self.blink_sigma = blink_sigma
        # Mains frequency heuristic (Windows: 60Hz, others default 50Hz)
        try:
            self.mains_hz = 60.0 if platform.system() == 'Windows' else 50.0
        except Exception:
            self.mains_hz = 50.0
        # Prefer 2-second windows for processing
        try:
            if hasattr(self, 'window_seconds'):
                self.window_seconds = 2.0
            if hasattr(self, 'fs') and hasattr(self, 'window_samples'):
                self.window_samples = int(self.fs * getattr(self, 'window_seconds', 2.0))
            # Recompute step size if overlap fields are available
            if hasattr(self, 'window_overlap') and hasattr(self, 'window_samples') and hasattr(self, 'step_samples'):
                self.step_samples = max(1, int(self.window_samples * (1.0 - float(self.window_overlap))))
        except Exception:
            pass
        # Buffers for blink detection statistics over recent raw samples
        self.recent_window_envelopes = deque(maxlen=60)
        # Per-task storage in addition to aggregate 'task'
        if 'tasks' not in self.calibration_data:
            self.calibration_data['tasks'] = {}
        # Diagnostics counters for EC windows
        self.baseline_kept = 0
        self.baseline_rejected = 0

    # --- Minimal statistical helpers (SciPy optional) ---
    @staticmethod
    def _welch_ttest(x: np.ndarray, y: np.ndarray):
        """Return (t_stat, p_value) for Welch's t-test. Uses SciPy if available; otherwise a normal approximation."""
        # Prefer SciPy if present
        if _scipy_ttest_ind is not None:
            try:
                return _scipy_ttest_ind(x, y, equal_var=False)
            except Exception:
                pass
        # Fallback: compute t-stat and p-value using normal approximation (reasonable for df>30)
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        nx = max(1, x.size)
        ny = max(1, y.size)
        mx = float(np.mean(x))
        my = float(np.mean(y))
        vx = float(np.var(x, ddof=1)) if nx > 1 else 0.0
        vy = float(np.var(y, ddof=1)) if ny > 1 else 0.0
        denom = np.sqrt((vx / max(nx, 1)) + (vy / max(ny, 1)) + 1e-18)
        t_stat = 0.0 if denom == 0 else (mx - my) / denom
        # Welch–Satterthwaite df
        with np.errstate(divide='ignore', invalid='ignore'):
            num = (vx / nx + vy / ny) ** 2
            den = ((vx**2) / (nx**2 * max(nx - 1, 1))) + ((vy**2) / (ny**2 * max(ny - 1, 1)))
            df = float(num / den) if den > 0 else float(nx + ny - 2)
        # Two-tailed normal approximation for p-value
        try:
            from math import erfc, sqrt
            z = abs(t_stat)
            p = float(erfc(z / sqrt(2.0)))  # 2*(1-Phi(|z|))
        except Exception:
            p = 1.0
        return t_stat, p

    @staticmethod
    def _chi2_sf(stat: float, df: int) -> float:
        """Survival function (1-CDF) for chi-square. Uses SciPy if available; else normal approx."""
        if _scipy_chi2 is not None:
            try:
                return float(_scipy_chi2.sf(stat, df))
            except Exception:
                pass
        # Normal approximation: chi2_k ~ N(k, 2k)
        try:
            from math import erfc, sqrt
            if df <= 0:
                return 1.0
            mean = float(df)
            std = float(np.sqrt(2.0 * df))
            z = (stat - mean) / (std + 1e-18)
            return float(0.5 * erfc(z / np.sqrt(2.0)))
        except Exception:
            return 1.0

    # --- Multiple testing and p-value combination helpers ---
    @staticmethod
    def _bh_fdr(p_values, alpha=0.05):
        """Benjamini–Hochberg FDR procedure.
        Returns (rejected_mask, p_adjusted_list).
        """
        if not p_values:
            return [], []
        # Pair p-values with their original indices
        m = len(p_values)
        pairs = sorted([(max(min(float(p), 1.0), 1e-300), i) for i, p in enumerate(p_values)], key=lambda x: x[0])
        p_sorted = [p for p, _ in pairs]
        idx_sorted = [i for _, i in pairs]
        # Compute adjusted p-values (BH step-up)
        q = [0.0] * m
        prev = 1.0
        for k in range(m - 1, -1, -1):
            val = (m / (k + 1.0)) * p_sorted[k]
            prev = min(prev, val)
            q[k] = prev
        # Re-map to original order
        p_adj = [0.0] * m
        for pos, orig_idx in enumerate(idx_sorted):
            p_adj[orig_idx] = min(q[pos], 1.0)
        rejected = [pa <= alpha for pa in p_adj]
        return rejected, p_adj

    @staticmethod
    def _fishers_method(p_values):
        """Fisher's method for combining independent p-values."""
        if not p_values:
            return None, None
        # Clip p-values to avoid log(0)
        clipped = [max(min(float(p), 1.0), 1e-300) for p in p_values]
        stat = -2.0 * float(np.sum(np.log(clipped)))
        df = 2 * len(clipped)
    # Use our chi-square survival function (SciPy if available)
        p_comb = float(EnhancedFeatureAnalysisEngine._chi2_sf(stat, df))
        return stat, p_comb

    # --- Utility: simple blink detection on a window ---
    def _is_blinky_window(self, x: np.ndarray) -> bool:
        """Conservative blink heuristic using robust dispersion (MAD) and proportion.
        Flags as blink only if both a very large deviation exists AND a small
        fraction of samples exceed a lower threshold, to avoid rejecting normal EC.
        """
        x = np.asarray(x, dtype=float)
        med = float(np.median(x))
        dev = np.abs(x - med)
        mad = float(np.median(dev)) + 1e-12
        scale = 1.4826 * mad  # approx std for normally distributed data
        # Very high spike threshold and a lower threshold for proportion check
        hi_thr = 8.0 * scale
        lo_thr = 5.0 * scale
        if scale <= 1e-9:
            return False
        has_spike = bool(np.max(dev) > hi_thr)
        frac_hi = float(np.mean(dev > lo_thr))
        return has_spike and (frac_hi > 0.01)

    # --- Optional PSD normalization hook ---
    def _normalize_psd(self, psd: np.ndarray, method: str):
        if method == 'total_power':
            denom = np.sum(psd) + 1e-12
            return psd / denom
        elif method == 'snr_based':
            noise_floor = np.percentile(psd, 10)
            nf = max(noise_floor, 1e-12)
            return (psd - nf) / nf
        elif method == 'z_transform':
            mu, sd = np.mean(psd), np.std(psd) + 1e-12
            return (psd - mu) / sd
        elif method == 'robust_scaling':
            med = np.median(psd)
            mad = np.median(np.abs(psd - med))
            scale = 1.4826 * (mad + 1e-12)
            return (psd - med) / scale
        return psd

    def extract_features(self, window_data):
        # Override to add PSD normalization and robust peak descriptors
        x = np.asarray(window_data, dtype=float)
        x = x - np.mean(x)
        try:
            x = BL.notch_filter(x, self.fs, notch_freq=self.mains_hz)
        except Exception:
            pass
        freqs, psd = BL.compute_psd(x, self.fs)

        # Global noise floor for SNR-adapted band powers
        try:
            noise_floor = np.percentile(psd, 10)
        except Exception:
            noise_floor = float(np.min(psd)) if psd.size else 0.0
        snr_psd = np.maximum(psd - noise_floor, 0.0)

        # Keep a normalized PSD only for peak descriptors
        psd_norm = self._normalize_psd(psd, self.normalization_method)

        total_power = np.var(x)
        features = {}
        band_powers = {}

        # Use extended bands: include theta1/theta2 and beta1/beta2
        extended_bands = dict(getattr(BL, 'EEG_BANDS', {}))
        # Fill in common defaults if base is missing
        if not extended_bands:
            extended_bands = {
                'delta': (0.5, 4),
                'theta': (4, 8),
                'alpha': (8, 13),
                'beta': (13, 30),
                'gamma': (30, 45),
            }
        # Add splits
        extended_bands.update({
            'theta1': (4, 6),
            'theta2': (6, 8),
            'beta1': (13, 20),
            'beta2': (20, 30),
        })

        # Precompute total SNR power across spectrum for relative metrics
        try:
            total_snr_power_spectrum = float(np.trapezoid(snr_psd, freqs)) if psd.size else 0.0
        except Exception:
            total_snr_power_spectrum = float(np.sum(snr_psd))

        for band_name, (low, high) in extended_bands.items():
            mask = (freqs >= low) & (freqs <= high)
            if np.any(mask):
                band_freqs = freqs[mask]
                band_psd = psd[mask]
                band_snr_psd = snr_psd[mask]
                band_psd_norm = psd_norm[mask]

                # Absolute and relative power
                try:
                    # Raw power (for reference)
                    raw_power = float(np.trapezoid(band_psd, band_freqs))
                except Exception:
                    raw_power = float(np.sum(band_psd))
                try:
                    # SNR-adapted power (preferred)
                    snr_power = float(np.trapezoid(band_snr_psd, band_freqs))
                except Exception:
                    snr_power = float(np.sum(band_snr_psd))

                band_powers[band_name] = snr_power
                features[f'{band_name}_power'] = snr_power
                features[f'{band_name}_power_raw'] = raw_power

                # Prefer relative metrics based on SNR-adapted totals
                denom = total_snr_power_spectrum if total_snr_power_spectrum > 0 else (total_power + 1e-12)
                rel_power = snr_power / (denom + 1e-12)
                features[f'{band_name}_relative'] = rel_power

                # Robust peak descriptors from normalized PSD
                if len(band_psd_norm) > 0:
                    peak_idx = int(np.argmax(band_psd_norm))
                    peak_amp = float(band_psd_norm[peak_idx])
                    peak_freq = float(band_freqs[peak_idx])
                    features[f'{band_name}_peak_freq'] = peak_freq
                    features[f'{band_name}_peak_amp'] = float(band_psd[peak_idx])
                    # Relative prominence within band
                    mean_band = np.mean(band_psd_norm) + 1e-12
                    features[f'{band_name}_peak_rel_amp'] = peak_amp / mean_band
                    # Spectral entropy within band
                    p = band_psd_norm / (np.sum(band_psd_norm) + 1e-12)
                    features[f'{band_name}_entropy'] = float(-np.sum(p * np.log2(p + 1e-12)))
                else:
                    mid = (low + high) / 2
                    features[f'{band_name}_peak_freq'] = mid
                    features[f'{band_name}_peak_amp'] = 0.0
                    features[f'{band_name}_peak_rel_amp'] = 0.0
                    features[f'{band_name}_entropy'] = 0.0
            else:
                mid = (low + high) / 2
                for suf, val in [('peak_freq', mid), ('peak_amp', 0.0), ('peak_rel_amp', 0.0), ('entropy', 0.0)]:
                    features[f'{band_name}_{suf}'] = val
                features[f'{band_name}_power'] = 0.0
                features[f'{band_name}_power_raw'] = 0.0
                features[f'{band_name}_relative'] = 0.0

        # Cross-band ratios
        alpha = band_powers.get('alpha', 0.0)
        theta = band_powers.get('theta', 0.0)
        beta = band_powers.get('beta', 0.0)
        theta1 = band_powers.get('theta1', 0.0)
        theta2 = band_powers.get('theta2', 0.0)
        beta1 = band_powers.get('beta1', 0.0)
        beta2 = band_powers.get('beta2', 0.0)
        features['alpha_theta_ratio'] = alpha / (theta + 1e-10)
        features['beta_alpha_ratio'] = beta / (alpha + 1e-10)
        # New split-band ratios
        features['beta2_beta1_ratio'] = beta2 / (beta1 + 1e-10)
        features['theta2_theta1_ratio'] = theta2 / (theta1 + 1e-10)
        features['total_power'] = total_power

        return features

    def add_data(self, new_data):
        # Same windowing as base, but reject only extreme blink artifacts for baseline accumulation
        features = super().add_data(new_data)
        if features is None:
            return None
        # If currently collecting eyes_closed baseline, check for extreme artifacts only
        if self.current_state == 'eyes_closed' and len(self.raw_buffer) >= self.window_samples:
            x = np.array(list(self.raw_buffer)[-self.window_samples:])
            # Initialize counters if missing
            if not hasattr(self, 'baseline_rejected'):
                self.baseline_rejected = 0
            if not hasattr(self, 'baseline_kept'):
                self.baseline_kept = 0
            
            # Use a much more lenient blink detection for eyes-closed baseline
            # Only reject windows with extreme artifacts (>10 sigma from median)
            med = float(np.median(x))
            mad = float(np.median(np.abs(x - med))) + 1e-12
            scale = 1.4826 * mad
            extreme_threshold = 10.0 * scale  # Very lenient threshold
            
            # Only reject if there are extreme outliers (>20 sigma) AND many of them
            extreme_outliers = np.abs(x - med) > (20.0 * scale)
            is_extreme_artifact = np.sum(extreme_outliers) > (len(x) * 0.05)  # >5% extreme outliers
            
            if is_extreme_artifact and scale > 10.0:  # Also require significant variance
                # Remove last appended feature if it was added to calibration store
                if len(self.calibration_data['eyes_closed']['features']) > 0:
                    self.calibration_data['eyes_closed']['features'].pop()
                    self.calibration_data['eyes_closed']['timestamps'].pop()
                self.baseline_rejected += 1
                print(f"❌ Rejected EC window: extreme artifacts detected (scale={scale:.1f}, outliers={np.sum(extreme_outliers)})")
            else:
                self.baseline_kept += 1
                # More frequent logging to show progress
                if self.baseline_kept % 5 == 0:  # Log every 5 kept windows instead of 10
                    print(f"✅ EC Progress: {self.baseline_kept} windows kept, {self.baseline_rejected} rejected (median={med:.1f}, scale={scale:.1f})")
                elif self.baseline_kept == 1:  # Always show first window
                    print(f"✅ First EC window accepted (median={med:.1f}, scale={scale:.1f})")
        
        # While in a task, also store into a per-task bucket
        if self.current_state == 'task' and self.current_task and features is not None:
            tasks = self.calibration_data.setdefault('tasks', {})
            bucket = tasks.setdefault(self.current_task, {'features': [], 'timestamps': []})
            bucket['features'].append(features)
            bucket['timestamps'].append(time.time())
        return features

    def compute_baseline_statistics(self):
        """Use eyes-closed-only baseline as requested."""
        ec_features = self.calibration_data['eyes_closed']['features']
        eo_features = self.calibration_data['eyes_open']['features']
        
        print(f"\n=== COMPUTING BASELINE STATISTICS ===")
        print(f"Available EC features: {len(ec_features)}")
        print(f"Available EO features: {len(eo_features)}")
        
        if len(ec_features) == 0:
            print("⚠️  WARNING: No eyes-closed features available, falling back to base behavior")
            # Fallback to base behavior if EC absent
            result = super().compute_baseline_statistics()
            if result:
                print(f"✅ Fallback baseline computed with {len(self.baseline_stats)} features")
            return result
            
        df = pd.DataFrame(ec_features)
        self.baseline_stats = {}
        
        print(f"Eyes-closed DataFrame shape: {df.shape}")
        print(f"Available feature columns: {list(df.columns)}")
        
        for feature in df.columns:
            values = df[feature].values
            self.baseline_stats[feature] = {
                'mean': float(np.mean(values)),
                'std': float(np.std(values) + 1e-12),
                'min': float(np.min(values)),
                'max': float(np.max(values)),
                'median': float(np.median(values)),
                'q25': float(np.percentile(values, 25)),
                'q75': float(np.percentile(values, 75)),
            }
        
        print(f"✅ Eyes-closed-only baseline computed successfully!")
        print(f"✅ {len(self.baseline_stats)} feature statistics computed from {len(ec_features)} windows")
        
        # Show sample statistics for key features
        key_features = ['alpha_relative', 'theta_relative', 'beta_relative', 'alpha_theta_ratio']
        for feat in key_features:
            if feat in self.baseline_stats:
                stats = self.baseline_stats[feat]
                print(f"   {feat}: mean={stats['mean']:.3f} ± {stats['std']:.3f}")
        
        return self.baseline_stats

    def analyze_task_data(self):
        # Ensure baseline is available; attempt to compute if missing
        if not self.baseline_stats:
            try:
                self.compute_baseline_statistics()
            except Exception:
                pass
            if not self.baseline_stats:
                print("❌ ERROR: No baseline statistics available!")
                print("❌ Make sure you recorded eyes-closed baseline data first")
                return None
        
        # Detailed baseline reporting
        ec_features = self.calibration_data['eyes_closed']['features']
        eo_features = self.calibration_data['eyes_open']['features']  
        task_features = self.calibration_data['task']['features']
        
        print(f"\n=== BASELINE DATA ANALYSIS ===")
        print(f"Eyes-Closed (EC) windows: {len(ec_features)}")
        print(f"Eyes-Open (EO) windows: {len(eo_features)}")
        print(f"Task windows: {len(task_features)}")
        print(f"Total baseline features computed: {len(self.baseline_stats)}")
        
        # Show baseline collection stats if available
        if hasattr(self, 'baseline_kept') and hasattr(self, 'baseline_rejected'):
            total_ec = self.baseline_kept + self.baseline_rejected
            if total_ec > 0:
                keep_rate = (self.baseline_kept / total_ec) * 100
                print(f"EC Quality Control: {self.baseline_kept} kept, {self.baseline_rejected} rejected ({keep_rate:.1f}% keep rate)")
        
        if len(task_features) == 0:
            print("❌ ERROR: No task data available for analysis!")
            return None
            
        task_df = pd.DataFrame(task_features)

        self.analysis_results = {}
        p_values = []
        effect_sizes = []
        available_features = [f for f in task_df.columns if f in self.baseline_stats]
        # Prefer relative and ratio features for significance assessment
        preferred_features = [
            f for f in available_features
            if f.endswith('_relative') or ('ratio' in f)
        ] or available_features

        for feature in available_features:
            task_vals = task_df[feature].values
            # Construct baseline vector from stored snapshots for this feature (eyes-closed only)
            baseline_pool = self.calibration_data['eyes_closed']['features']
            baseline_df = pd.DataFrame(baseline_pool) if len(baseline_pool) > 0 else None
            if baseline_df is None or feature not in baseline_df.columns:
                continue
            base_vals = baseline_df[feature].values

            b_mean = float(self.baseline_stats[feature]['mean'])
            b_std = float(self.baseline_stats[feature]['std'])
            t_mean = float(np.mean(task_vals))
            t_std = float(np.std(task_vals) + 1e-12)

            # Z-score based on baseline dispersion
            z = (t_mean - b_mean) / (b_std + 1e-12)

            # Effect size: Cohen's d (pooled std) and a baseline-scaled variant
            pooled = np.sqrt(((np.var(task_vals, ddof=1) + np.var(base_vals, ddof=1)) / 2.0) + 1e-12)
            d = (t_mean - b_mean) / pooled
            effect_sizes.append(abs(d))

            # Percent change relative to baseline magnitude
            pct = ((t_mean - b_mean) / (abs(b_mean) + 1e-12)) * 100.0

            # Parametric test (Welch's t-test only)
            # Welch's t-test (SciPy or fallback)
            try:
                _, p_t = self._welch_ttest(task_vals, base_vals)
            except Exception:
                p_t = 1.0
            p_values.append(p_t)

            # Baseline-to-task ratio (prefer relative metrics)
            ratio = (t_mean / (abs(b_mean) + 1e-12)) if b_mean != 0 else np.inf
            log2_ratio = float(np.log2(abs(ratio) + 1e-12))

            # Enhanced significance decision: prefer ratio/relative metrics
            ratio_hit = (ratio >= 1.2) or (ratio <= (1/1.2))
            is_sig = (feature in preferred_features and ratio_hit) or ((abs(z) > 1.5) and (abs(d) > 0.3))

            self.analysis_results[feature] = {
                'task_mean': t_mean,
                'task_std': t_std,
                'baseline_mean': b_mean,
                'baseline_std': b_std,
                'z_score': z,
                'effect_size_d': d,
                'percent_change': pct,
                'p_value_welch': p_t,
                'p_value': p_t,
                'baseline_task_ratio': ratio,
                'log2_ratio': log2_ratio,
                'significant_change': is_sig,
            }

        # Composite statistics across preferred features
        if len(p_values) > 0:
            # Prefer operating on preferred features for combined stats
            p_for_combo = [self.analysis_results[f]['p_value'] for f in preferred_features if f in self.analysis_results]
            if not p_for_combo:
                p_for_combo = p_values

            # Fisher's method
            chi2_stat, fisher_p = self._fishers_method(p_for_combo)

            # FDR (BH)
            fdr_rej, _ = self._bh_fdr(p_for_combo, alpha=0.05)
            fdr_sig_count = int(np.sum(np.array(fdr_rej, dtype=bool)))

            summed_p = float(np.sum(p_for_combo))
            mean_d = float(np.mean(effect_sizes)) if effect_sizes else 0.0
            sig_count_plain = int(np.sum(np.array(p_for_combo) < 0.05))
            k = len(p_for_combo)
            # Mean absolute log2 ratio across preferred features
            try:
                mean_abs_log2_ratio = float(np.mean([
                    abs(self.analysis_results[f]['log2_ratio']) for f in preferred_features if f in self.analysis_results
                ]))
            except Exception:
                mean_abs_log2_ratio = None
            composite = {
                'summed_p_value': summed_p,
                'mean_effect_size_d': mean_d,
                'significant_features': sig_count_plain,
                'bonferroni_like_threshold': 0.05 * k,
                'composite_significant': summed_p < 0.05 * k,
                'mean_abs_log2_ratio': mean_abs_log2_ratio,
                'fisher_chi2': chi2_stat,
                'fisher_p_value': fisher_p,
                'fdr_alpha': 0.05,
                'fdr_significant_features': fdr_sig_count,
            }
        else:
            composite = {
                'summed_p_value': None,
                'mean_effect_size_d': None,
                'significant_features': 0,
                'bonferroni_like_threshold': None,
                'composite_significant': False,
                'mean_abs_log2_ratio': None,
                'fisher_chi2': None,
                'fisher_p_value': None,
                'fdr_alpha': 0.05,
                'fdr_significant_features': 0,
            }

        # Cosine similarity between baseline and task mean feature vectors
        try:
            base_means = []
            task_means = []
            for f in available_features:
                base_means.append(self.baseline_stats[f]['mean'])
                task_means.append(self.analysis_results[f]['task_mean'])
            base_vec = np.array(base_means, dtype=float)
            task_vec = np.array(task_means, dtype=float)
            # Normalize to unit vectors
            base_norm = base_vec / (np.linalg.norm(base_vec) + 1e-12)
            task_norm = task_vec / (np.linalg.norm(task_vec) + 1e-12)
            cosine_sim = float(np.dot(base_norm, task_norm))
            cosine_dist = float(1.0 - cosine_sim)

            # Light-weight permutation baseline for p-value
            rng = np.random.default_rng(42)
            perms = 200
            greater = 0
            for _ in range(perms):
                shuf = rng.permutation(base_vec)
                shuf_norm = shuf / (np.linalg.norm(shuf) + 1e-12)
                sim = np.dot(task_norm, shuf_norm)
                if (1.0 - sim) >= cosine_dist:
                    greater += 1
            p_cos = (greater / perms) if perms > 0 else 1.0
        except Exception:
            cosine_sim, cosine_dist, p_cos = None, None, None

        self.composite_summary = {
            'composite': composite,
            'cosine_similarity': cosine_sim,
            'cosine_distance': cosine_dist,
            'cosine_p_value': p_cos,
        }

        return self.analysis_results

    def analyze_all_tasks_data(self):
        """Analyze each recorded task separately and also combined across all tasks."""
        # Try to compute baseline if not present, but proceed regardless
        if not getattr(self, 'baseline_stats', None) or not self.baseline_stats:
            try:
                self.compute_baseline_statistics()
            except Exception:
                pass

        tasks = self.calibration_data.get('tasks', {})
        per_task_results = {}

        # Gather baseline feature arrays from eyes-closed baseline if available
        baseline_pool = self.calibration_data.get('eyes_closed', {}).get('features', [])
        baseline_df = pd.DataFrame(baseline_pool) if baseline_pool else None

        def analyze_feature_list(feature_list):
            if not feature_list:
                return {}
            task_df = pd.DataFrame(feature_list)
            results = {}
            p_values = []
            effect_sizes = []
            preferred = [
                f for f in task_df.columns if f in self.baseline_stats and (f.endswith('_relative') or 'ratio' in f)
            ]
            feature_iter = preferred or [f for f in task_df.columns if f in self.baseline_stats]
            for feature in feature_iter:
                # Clean numeric arrays (drop NaN/inf)
                task_vals = np.asarray(task_df[feature].values, dtype=float)
                task_vals = task_vals[np.isfinite(task_vals)]
                b_mean = float(self.baseline_stats[feature]['mean'])
                b_std = float(self.baseline_stats[feature]['std'])
                t_mean = float(np.mean(task_vals))
                t_std = float(np.std(task_vals) + 1e-12)
                # Ratios for interpretability
                ratio = (t_mean / (abs(b_mean) + 1e-12)) if b_mean != 0 else np.inf
                log2_ratio = float(np.log2(abs(ratio) + 1e-12))
                # Prefer baseline sample distribution for stats when available
                if baseline_df is not None and feature in baseline_df.columns:
                    base_vals = np.asarray(baseline_df[feature].values, dtype=float)
                    base_vals = base_vals[np.isfinite(base_vals)]
                    pooled = np.sqrt(((np.var(task_vals, ddof=1) + np.var(base_vals, ddof=1)) / 2.0) + 1e-12)
                    d = (t_mean - b_mean) / pooled
                    try:
                        _, p_t = self._welch_ttest(task_vals, base_vals)
                    except Exception:
                        p_t = 1.0
                else:
                    # Fallback: use baseline summary only
                    pooled = np.sqrt(((np.var(task_vals, ddof=1) + (b_std**2)) / 2.0) + 1e-12)
                    d = (t_mean - b_mean) / pooled
                    try:
                        # Compare against baseline mean vector as constant; fallback uses normal approx
                        _, p_t = self._welch_ttest(task_vals, np.full_like(task_vals, b_mean))
                    except Exception:
                        p_t = 1.0
                p_values.append(p_t)
                effect_sizes.append(abs(d))
                z = (t_mean - b_mean) / (b_std + 1e-12)
                pct = ((t_mean - b_mean) / (abs(b_mean) + 1e-12)) * 100.0
                results[feature] = {
                    'task_mean': t_mean,
                    'task_std': t_std,
                    'baseline_mean': b_mean,
                    'baseline_std': b_std,
                    'z_score': z,
                    'effect_size_d': d,
                    'percent_change': pct,
                    'baseline_task_ratio': ratio,
                    'log2_ratio': log2_ratio,
                    'p_value_welch': p_t,
                    'p_value': p_t,
                    'significant_change': (abs(z) > 1.5) and (abs(d) > 0.3) and (abs(pct) > 10.0),
                }
            composite = None
            if p_values:
                # Prefer operating on preferred features for combined stats
                p_for_combo = [results[f]['p_value'] for f in feature_iter if f in results]
                # Filter invalid p-values
                p_for_combo = [float(p) for p in p_for_combo if isinstance(p, (int, float)) and np.isfinite(p) and 0.0 <= float(p) <= 1.0]
                if not p_for_combo:
                    p_for_combo = [1.0]
                chi2_stat, fisher_p = EnhancedFeatureAnalysisEngine._fishers_method(p_for_combo)
                fdr_rej, _ = EnhancedFeatureAnalysisEngine._bh_fdr(p_for_combo, alpha=0.05)
                k = len(p_for_combo)
                composite = {
                    'summed_p_value': float(np.sum(p_for_combo)),
                    'mean_effect_size_d': float(np.mean(effect_sizes)) if effect_sizes else 0.0,
                    'significant_features': int(np.sum(np.array(p_for_combo) < 0.05)),
                    'bonferroni_like_threshold': 0.05 * k,
                    'composite_significant': float(np.sum(p_for_combo)) < 0.05 * k,
                    'fisher_chi2': chi2_stat,
                    'fisher_p_value': fisher_p,
                    'fdr_alpha': 0.05,
                    'fdr_significant_features': int(np.sum(np.array(fdr_rej, dtype=bool))),
                }
            return {'features': results, 'composite': composite}

        # Per-task
        for task_name, data in tasks.items():
            per_task_results[task_name] = analyze_feature_list(data.get('features', []))

        # Combined across all tasks
        combined_features = []
        for data in tasks.values():
            combined_features.extend(data.get('features', []))
        combined_result = analyze_feature_list(combined_features)

        self.multi_task_results = {
            'per_task': per_task_results,
            'combined': combined_result,
        }
        return self.multi_task_results


class EnhancedBrainLinkAnalyzerWindow(BL.BrainLinkAnalyzerWindow):
    def __init__(self, user_os, parent=None):
        # Initialize base window, then swap the engine
        super().__init__(user_os, parent)
        self.feature_engine = EnhancedFeatureAnalysisEngine()
        # Re-link onRaw to the new engine
        BL.onRaw.feature_engine = self.feature_engine
    # Task UI state
        self._task_dialog = None
        self._task_timer = None
        self._task_seconds_remaining = 0
        
        # Add Multi-Task Analysis tab (create unconditionally so it's always visible)
        try:
            multi_tab = QWidget()
            mt_layout = QVBoxLayout(multi_tab)
            self.analyze_all_button = QPushButton("Analyze All Tasks")
            self.analyze_all_button.setEnabled(True)
            self.analyze_all_button.clicked.connect(self.analyze_all_tasks)
            mt_layout.addWidget(self.analyze_all_button)
            # Add a Generate Report for All Tasks button
            self.generate_all_report_button = QPushButton("Generate Report (All Tasks)")
            self.generate_all_report_button.setEnabled(True)
            self.generate_all_report_button.clicked.connect(self.generate_report_all_tasks)
            mt_layout.addWidget(self.generate_all_report_button)
            self.multi_task_text = QTextEdit()
            self.multi_task_text.setReadOnly(True)
            mt_layout.addWidget(self.multi_task_text)
            # Add to tabs
            self.tabs.addTab(multi_tab, "Multi-Task")
        except Exception:
            pass
        
        # CRITICAL: Ensure we have a real BrainLink device connected
        if not BL.SERIAL_PORT:
            self.log_message("CRITICAL ERROR: No real BrainLink device found!")
            self.log_message("This enhanced analyzer requires real EEG data - dummy data is NOT acceptable!")
            self.log_message("Please connect your BrainLink device and restart the application.")
            # Keep UI visible but disable analysis-related controls until connected
            try:
                if hasattr(self, 'eyes_closed_button'):
                    self.eyes_closed_button.setEnabled(False)
                if hasattr(self, 'eyes_open_button'):
                    self.eyes_open_button.setEnabled(False)
                if hasattr(self, 'task_button'):
                    self.task_button.setEnabled(False)
                if hasattr(self, 'compute_baseline_button'):
                    self.compute_baseline_button.setEnabled(False)
                if hasattr(self, 'analyze_task_button'):
                    self.analyze_task_button.setEnabled(False)
                if hasattr(self, 'generate_report_button'):
                    self.generate_report_button.setEnabled(False)
            except Exception:
                pass
        else:
            self.log_message(f"SUCCESS: Connected to real BrainLink device: {BL.SERIAL_PORT}")
            self.log_message("Real EEG data acquisition is active - no dummy data allowed!")
        
        self._fixation_dialog = None
        self._audio = AudioFeedback()
        
        # FIX PLOTTING ISSUE: Replace standard curve with PlotCurveItem and strict ranges
        try:
            # First, remove any existing plot setup from base class
            if hasattr(self, 'live_curve') and self.live_curve is not None:
                try:
                    self.plot_widget.removeItem(self.live_curve)
                except Exception:
                    pass
            
            # Apply debug_plot.py EXACT working configuration
            self.plot_widget.setBackground('#000000')  # Black background like debug_plot
            
            # Get plot item directly (debug_plot approach)
            plot_item = self.plot_widget.getPlotItem()
            plot_item.showGrid(x=True, y=True, alpha=0.3)
            plot_item.setLabel('left', 'Amplitude (µV)')
            plot_item.setLabel('bottom', 'Sample Index')
            plot_item.setXRange(0, 1024, padding=0)
            plot_item.setYRange(-100, 100, padding=0)
            
            # Create a HIGH-CONTRAST pen (explicit QColor) to avoid any theme/aliasing invisibility
            try:
                from PySide6.QtGui import QColor as _QColor  # type: ignore
            except Exception:
                try:
                    from PyQt6.QtGui import QColor as _QColor  # type: ignore
                except Exception:
                    _QColor = None
            try:
                pen_color = _QColor(255, 255, 0) if _QColor else 'yellow'  # bright yellow
                # Non-cosmetic pen sometimes renders more reliably on some GPUs / scaling setups
                pen = pg.mkPen(color=pen_color, width=3, style=QtCore.Qt.PenStyle.SolidLine, cosmetic=False)
            except Exception:
                try:
                    pen = pg.mkPen(color='yellow', width=3)
                except Exception:
                    pen = pg.mkPen(width=3)
            
            # Create curve using plot item directly (debug_plot approach)  
            x_init = np.array([0, 512, 1024], dtype=float)
            y_init = np.array([0.0, 0.0, 0.0], dtype=float)
            self.live_curve = plot_item.plot(x_init, y_init, pen=pen)
            try:
                # Ensure on top of grid
                self.live_curve.setZValue(10)
            except Exception:
                pass
            
            # Disable autorange completely
            try:
                plot_item.enableAutoRange('x', False)
                plot_item.enableAutoRange('y', False)
                plot_item.setMouseEnabled(x=True, y=True)  # Keep zoom/pan enabled
                self.plot_widget.enableAutoRange(enable=False)
            except Exception:
                pass
                
            print("✅ Enhanced GUI plot setup complete using debug_plot.py approach")
            
        except Exception as e:
            print(f"❌ Enhanced GUI plot setup failed: {e}")
            # Keep the base plot if enhanced setup fails
            
            # Set fixed ranges like legacy code
            try:
                window_size = 1024
                if len(BL.live_data_buffer) >= 50:
                    # Always show the last 1024 samples (or fewer if not enough yet)
                    plot_size = min(window_size, len(BL.live_data_buffer))
                    data = np.array(BL.live_data_buffer[-plot_size:], dtype=np.float64)
                    # Pad with zeros if not enough data yet
                    if plot_size < window_size:
                        pad = np.zeros(window_size - plot_size)
                        data = np.concatenate([pad, data])
                    x_data = np.arange(window_size, dtype=float)
                    self.live_curve.setData(x_data, data)
                    # Set x range to always [0, 1024]
                    y_min, y_max = float(np.min(data)), float(np.max(data))
                    y_range = y_max - y_min
                    if y_range < 1e-6:
                        y_min -= 25.0
                        y_max += 25.0
                        y_range = y_max - y_min
                    padding = max(y_range * 0.1, 10.0)
                    try:
                        view_box = self.plot_widget.getPlotItem().vb
                        view_box.setRange(
                            xRange=[0, window_size],
                            yRange=[y_min - padding, y_max + padding],
                            padding=0,
                            update=True
                        )
                        self.plot_widget.setXRange(0, window_size, padding=0)
                        self.plot_widget.setYRange(y_min - padding, y_max + padding, padding=0)
                    except Exception:
                        try:
                            vb = self.plot_widget.getPlotItem().vb
                            vb.setYRange(y_min - padding, y_max + padding)
                            vb.setXRange(0, window_size)
                        except Exception:
                            pass
                    try:
                        if not self.plot_widget.isVisible():
                            self.plot_widget.setVisible(True)
                        if hasattr(self.live_curve, 'isVisible') and not self.live_curve.isVisible():
                            self.live_curve.setVisible(True)
                    except Exception:
                        pass
                    # Update status label
                    try:
                        self.status_label.setText(
                            f"Buffer: {len(BL.live_data_buffer)} samples | "
                            f"Latest: {data[-1]:.1f} µV")
                    except Exception:
                        pass
                else:
                    # Waiting for more data (following legacy pattern)
                    if len(BL.live_data_buffer) > 0:
                        self.status_label.setText(
                            f"Buffer: {len(BL.live_data_buffer)} samples | "
                            f"Latest: {BL.live_data_buffer[-1]:.1f} µV | "
                            f"Need {50 - len(BL.live_data_buffer)} more samples")
                    else:
                        self.status_label.setText("Waiting for data...")
            except Exception as e:
                try:
                    self.status_label.setText(f"Plot update issue: {e}")
                except Exception:
                    pass
            task_n = len(self.feature_engine.calibration_data.get('task', {}).get('features', []))
            ec_n = len(self.feature_engine.calibration_data.get('eyes_closed', {}).get('features', []))
            eo_n = len(self.feature_engine.calibration_data.get('eyes_open', {}).get('features', []))
            lines = []
            lines.append(f"Windows: EC={ec_n}, EO={eo_n}, Task={task_n}")
        except Exception:
            pass
        # Baseline summary
        if getattr(self.feature_engine, 'baseline_stats', None):
            lines.append("")
            lines.append("Baseline Summary (key features)")
            lines.append("-" * 60)
            # Show a compact subset for readability
            key_feats = [
                'alpha_relative','theta_relative','beta_relative','alpha_theta_ratio','beta_alpha_ratio','total_power'
            ]
            for f in key_feats:
                st = self.feature_engine.baseline_stats.get(f)
                if st:
                    lines.append(f"{f:22} mean={st['mean']:.6g}  std={st['std']:.6g}")
        # Composite summary
        comp = getattr(self.feature_engine, 'composite_summary', None)
        if comp and comp.get('composite'):
            c = comp['composite']
            lines.append("")
            lines.append("Composite Significance Summary")
            lines.append("-" * 60)
            lines.append(f"Summed p-value: {c.get('summed_p_value')}")
            lines.append(f"Fisher p-value: {c.get('fisher_p_value')} | chi2: {c.get('fisher_chi2')}")
            lines.append(f"Mean effect size (d): {c.get('mean_effect_size_d')}")
            lines.append(f"Significant features (p<0.05): {c.get('significant_features')} | FDR@{c.get('fdr_alpha')}: {c.get('fdr_significant_features')} ")
            lines.append(f"Threshold (0.05*k): {c.get('bonferroni_like_threshold')} | Composite significant: {c.get('composite_significant')}")
            lines.append(f"Cosine similarity: {comp.get('cosine_similarity')} | distance: {comp.get('cosine_distance')} | p (perm): {comp.get('cosine_p_value')}")
        # Per-feature details + FDR q-values
        results = getattr(self.feature_engine, 'analysis_results', {}) or {}
        if results:
            lines.append("")
            lines.append("Per-Feature Statistics")
            lines.append("-" * 60)
            # Preferred features for FDR
            feat_list = list(results.keys())
            preferred = [f for f in feat_list if f.endswith('_relative') or 'ratio' in f]
            pvals_for_fdr = [results[f].get('p_value', results[f].get('p_value_welch', 1.0)) for f in (preferred or feat_list)]
            try:
                rej, qvals = EnhancedFeatureAnalysisEngine._bh_fdr(pvals_for_fdr, alpha=0.05)
            except Exception:
                rej, qvals = [], []
            q_map = {}
            order = preferred or feat_list
            for i, f in enumerate(order):
                if i < len(qvals):
                    q_map[f] = qvals[i]
            # Sort by p-value then by |d|
            items = []
            for f, d in results.items():
                p = d.get('p_value', d.get('p_value_welch', 1.0))
                eff = float(abs(d.get('effect_size_d', 0.0)))
                items.append((p, -eff, f, d))
            items.sort(key=lambda t: (t[0], t[1]))
            for p, _ne, f, d in items:
                bm = d.get('baseline_mean')
                bs = d.get('baseline_std')
                tm = d.get('task_mean')
                tsd = d.get('task_std')
                pct = d.get('percent_change', None)
                ratio = d.get('baseline_task_ratio', None)
                log2r = d.get('log2_ratio', None)
                z = d.get('z_score', None)
                eff = d.get('effect_size_d', None)
                q = q_map.get(f)
                sig = d.get('significant_change', False)
                lines.append(
                    f"{f:24} task={tm:.6g}±{tsd:.6g} | base={bm:.6g}±{bs:.6g} | Δ%={(pct if pct is not None else 0):.3g} | "
                    f"ratio={(ratio if ratio is not None else 0):.3g} log2={(log2r if log2r is not None else 0):.3g} | z={(z if z is not None else 0):.3g} d={(eff if eff is not None else 0):.3g} | p={p:.3g} q={(q if q is not None else float('nan')):.3g} | sig={sig}"
                )
            text = "\n".join(lines)
        try:
            self.stats_text.setPlainText(text)
            self.log_message("✓ Report generated")
        except Exception:
            pass
        # NOTE: File save dialog removed from constructor - only show when user explicitly requests it

    def generate_report_all_tasks(self):
        """Generate a consolidated, detailed report across all recorded tasks with FDR per task."""
        res = self.feature_engine.analyze_all_tasks_data()
        lines = []
        # Header
        try:
            ts = time.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            ts = ''
        lines.append("BrainLink Enhanced Multi-Task Report")
        lines.append("=" * 60)
        lines.append(f"Timestamp: {ts}")
        # Window counts per bucket
        try:
            tasks = self.feature_engine.calibration_data.get('tasks', {})
            default_task_n = len(self.feature_engine.calibration_data.get('task', {}).get('features', []))
            lines.append(f"Task buckets: {len(tasks)} | Default task windows: {default_task_n}")
        except Exception:
            pass
        if not res:
            lines.append("")
            lines.append("No multi-task results available. Run 'Analyze All Tasks' after recording tasks.")
            text = "\n".join(lines)
            try:
                self.multi_task_text.setPlainText(text)
            except Exception:
                pass
            return
        # Per-task composites and detailed top features (with FDR q-values)
        per_task = res.get('per_task', {})
        for task_name, data in sorted(per_task.items()):
            comp = data.get('composite') or {}
            feats = data.get('features') or {}
            lines.append("")
            lines.append(f"Task: {task_name}")
            if comp:
                lines.append("  Composite Significance Summary")
                lines.append("  -" * 20)
                lines.append(f"  Summed p-value: {comp.get('summed_p_value')}")
                fisher_p = comp.get('fisher_p_value')
                lines.append(f"  Fisher p-value: {fisher_p} | chi2: {comp.get('fisher_chi2')}")
                lines.append(f"  Mean effect size (d): {comp.get('mean_effect_size_d')}")
                lines.append(f"  Significant features (p<0.05): {comp.get('significant_features', 0)} | FDR@{comp.get('fdr_alpha', 0.05)}: {comp.get('fdr_significant_features', 0)}")
                lines.append(f"  Threshold (0.05*k): {comp.get('bonferroni_like_threshold')} | Composite significant: {comp.get('composite_significant')}")
            # Compute per-task FDR q-values on preferred features
            if feats:
                feat_names = list(feats.keys())
                preferred = [f for f in feat_names if f.endswith('_relative') or 'ratio' in f]
                use_list = preferred or feat_names
                pvals = [feats[f].get('p_value', feats[f].get('p_value_welch', 1.0)) for f in use_list]
                try:
                    _, qvals = EnhancedFeatureAnalysisEngine._bh_fdr(pvals, alpha=0.05)
                except Exception:
                    qvals = [float('nan')] * len(use_list)
                q_map = {f: qvals[i] for i, f in enumerate(use_list)}
                # Sort by p-value
                items = []
                for f, d in feats.items():
                    p = d.get('p_value', d.get('p_value_welch', 1.0))
                    eff = abs(d.get('effect_size_d', 0.0))
                    items.append((p, -eff, f, d))
                items.sort(key=lambda t: (t[0], t[1]))
                # Filter to only significant features by q<=0.05 (fallback to p<0.05 when q is NaN)
                sig_items = []
                for p, ne, f, d in items:
                    qv = q_map.get(f, float('nan'))
                    if (isinstance(qv, float) and np.isfinite(qv) and qv <= 0.05) or (not np.isfinite(qv) and p < 0.05):
                        sig_items.append((p, ne, f, d, qv))
                lines.append("  Per-Feature Statistics (significant only)")
                lines.append("  -" * 20)
                if sig_items:
                    for i, (p, _ne, f, d, qv) in enumerate(sig_items[:20]):
                        bm = d.get('baseline_mean')
                        bs = d.get('baseline_std')
                        tm = d.get('task_mean')
                        tsd = d.get('task_std')
                        pct = d.get('percent_change', None)
                        ratio = d.get('baseline_task_ratio', None)
                        log2r = d.get('log2_ratio', None)
                        z = d.get('z_score', 0.0)
                        eff = abs(d.get('effect_size_d', 0.0))
                        lines.append(
                            f"    {i+1:2}. {f:22} task={tm:.6g}±{tsd:.6g} | base={bm:.6g}±{bs:.6g} | Δ%={(pct if pct is not None else 0):.3g} | "
                            f"ratio={(ratio if ratio is not None else 0):.3g} log2={(log2r if log2r is not None else 0):.3g} | z={abs(z):.2f} |d|={eff:.3f} | p={p:.3g} q={(qv if np.isfinite(qv) else float('nan')):.3g}"
                        )
                else:
                    lines.append("    (no significant features at q<=0.05)")
        # Combined
        comp_c = (res.get('combined') or {}).get('composite') or {}
        if comp_c:
            lines.append("")
            lines.append("All Tasks Combined:")
            lines.append(f"  Significant (p<0.05): {comp_c.get('significant_features', 0)} | FDR@0.05: {comp_c.get('fdr_significant_features', 0)}")
            spc = comp_c.get('summed_p_value')
            fisher_pc = comp_c.get('fisher_p_value')
            fisher_str_c = f" | Fisher p: {fisher_pc:.4g}" if isinstance(fisher_pc, float) else ""
            lines.append(f"  Summed p: {spc:.4f}{fisher_str_c} | Mean |d|: {comp_c.get('mean_effect_size_d', 0):.3f}")
        text = "\n".join(lines)
        try:
            self.multi_task_text.setPlainText(text)
            self.log_message("✓ Multi-task report generated")
        except Exception:
            pass
        # Save to a user-specified .txt file
        try:
            ts = time.strftime('%Y%m%d_%H%M%S')
            default_name = f"multi_task_report_{ts}.txt"
            path, _ = QtWidgets.QFileDialog.getSaveFileName(
                self,
                "Save Multi-Task Report",
                default_name,
                "Text Files (*.txt);;All Files (*)"
            )
            if path:
                if not path.lower().endswith('.txt'):
                    path = path + '.txt'
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(text)
                self.log_message(f"✓ Multi-task report saved: {path}")
        except Exception as e:
            try:
                self.log_message(f"Multi-task report save error: {e}")
            except Exception:
                pass

    # Prevent automatic serial connection before login to avoid COM port being held
    def auto_connect_brainlink(self):
        try:
            # Ensure feature engine remains linked for any incoming callbacks
            BL.onRaw.feature_engine = self.feature_engine
        except Exception:
            pass
        # Adjust UI: enable Connect & Login, disable analysis until connected
        try:
            if hasattr(self, 'connect_button'):
                self.connect_button.setEnabled(True)
            if hasattr(self, 'disconnect_button'):
                self.disconnect_button.setEnabled(False)
            if hasattr(self, 'eyes_closed_button'):
                self.eyes_closed_button.setEnabled(False)
            if hasattr(self, 'eyes_open_button'):
                self.eyes_open_button.setEnabled(False)
            if hasattr(self, 'task_button'):
                self.task_button.setEnabled(False)
            if hasattr(self, 'compute_baseline_button'):
                self.compute_baseline_button.setEnabled(False)
            if hasattr(self, 'analyze_task_button'):
                self.analyze_task_button.setEnabled(False)
            if hasattr(self, 'generate_report_button'):
                self.generate_report_button.setEnabled(False)
        except Exception:
            pass
        # Inform user
        try:
            self.log_message("Auto-connect disabled in enhanced mode. Please use 'Connect & Login'.")
        except Exception:
            pass

    def start_calibration(self, phase_name):
        # Play audio cue at the start of eyes-closed baseline
        if phase_name == 'eyes_closed':
            try:
                self._audio.play_start_calibration()
            except Exception:
                pass
            # Reset EC diagnostics counters at the start
            try:
                self.feature_engine.baseline_kept = 0
                self.feature_engine.baseline_rejected = 0
            except Exception:
                pass
        # No visual cue for eyes-closed baseline; just delegate to base
        super().start_calibration(phase_name)

    def stop_calibration(self):
        # Capture which phase is ending before delegating
        phase_ending = self.feature_engine.current_state
        super().stop_calibration()
        # Close fixation dialog if open
        try:
            if self._fixation_dialog is not None:
                self._fixation_dialog.close()
                self._fixation_dialog = None
        except Exception:
            pass
        # Auditory cues for end of calibration/task
        try:
            if phase_ending == 'eyes_closed':
                self._audio.play_end_calibration()
            elif phase_ending == 'task':
                self._audio.play_end_task()
        except Exception:
            pass

    def compute_baseline(self):
        # Use enhanced EC-only baseline computation
        self.feature_engine.compute_baseline_statistics()
        self.analyze_task_button.setEnabled(True)
        self.log_message("✓ Baseline (eyes-closed only) computed")

    def analyze_task(self):
        results = self.feature_engine.analyze_task_data()
        if results:
            self.update_results_display(results)
            # Append composite summary to stats area
            self._update_composite_summary_text()
            self.generate_report_button.setEnabled(True)
            self.log_message("✓ Enhanced task analysis completed")
        else:
            # Provide actionable diagnostics
            try:
                task_n = len(self.feature_engine.calibration_data.get('task', {}).get('features', []))
                ec_n = len(self.feature_engine.calibration_data.get('eyes_closed', {}).get('features', []))
                eo_n = len(self.feature_engine.calibration_data.get('eyes_open', {}).get('features', []))
                cur = getattr(self.feature_engine, 'current_state', None)
                ec_kept = getattr(self.feature_engine, 'baseline_kept', 0)
                ec_rej = getattr(self.feature_engine, 'baseline_rejected', 0)
                msg = [
                    "No task data to analyze yet.",
                    f"Task windows collected: {task_n}",
                    f"Eyes-closed windows: {ec_n}",
                    f"  EC kept: {ec_kept} | rejected (blink): {ec_rej}",
                    f"Eyes-open windows: {eo_n}",
                    f"Current state: {cur}",
                    "Tip: Start a task, let it run for at least a few windows (2s each), then press Stop before Analyze."
                ]
                self.stats_text.setPlainText("\n".join(msg))
                self.log_message("No task windows collected yet—record a task and press Stop.")
            except Exception:
                self.stats_text.setPlainText("No task data available.")

    def _update_composite_summary_text(self):
        comp = getattr(self.feature_engine, 'composite_summary', None)
        if not comp:
            return
        composite = comp.get('composite', {}) or {}
        text = self.stats_text.toPlainText()
        text += "\n\nComposite Significance Summary\n" + ("-" * 30) + "\n"
        text += f"Summed p-value: {composite.get('summed_p_value')}\n"
        text += f"Fisher p-value: {composite.get('fisher_p_value')} | chi2: {composite.get('fisher_chi2')}\n"
        text += f"Mean effect size (d): {composite.get('mean_effect_size_d')}\n"
        text += f"Significant features (p<0.05): {composite.get('significant_features')}\n"
        text += f"FDR (q={composite.get('fdr_alpha')}): {composite.get('fdr_significant_features')} significant\n"
        text += f"Threshold (0.05*k): {composite.get('bonferroni_like_threshold')}\n"
        text += f"Composite significant: {composite.get('composite_significant')}\n"
        text += f"Cosine similarity: {comp.get('cosine_similarity')}\n"
        text += f"Cosine distance: {comp.get('cosine_distance')}\n"
        text += f"Cosine p-value (permutation): {comp.get('cosine_p_value')}\n"
        self.stats_text.setPlainText(text)

    def analyze_all_tasks(self):
        """Run per-task and combined analysis, and show a compact summary."""
        res = self.feature_engine.analyze_all_tasks_data()
        if not res:
            # Fallback informative output
            try:
                t = self.feature_engine.calibration_data.get('tasks', {})
                task_n = len(self.feature_engine.calibration_data.get('task', {}).get('features', []))
                lines = [
                    "No task data available for multi-task analysis.",
                    f"Per-task buckets recorded: {len(t)}",
                    f"Task windows in default bucket: {task_n}",
                    "Tip: Start a task from the Tasks tab, wait at least a few seconds (2s per window), then Stop and Analyze."
                ]
                self.multi_task_text.setPlainText("\n".join(lines))
            except Exception:
                self.multi_task_text.setPlainText("No task data available for multi-task analysis.")
            return
        lines = ["Multi-Task Analysis Summary", "-" * 30]
        per_task = res.get('per_task', {})
        for task_name, data in sorted(per_task.items()):
            comp = data.get('composite') or {}
            lines.append(f"Task: {task_name}")
            lines.append(f"  Significant features: {comp.get('significant_features', 0)} (FDR@0.05: {comp.get('fdr_significant_features', 0)})")
            sp = comp.get('summed_p_value')
            if sp is not None:
                fisher_p = comp.get('fisher_p_value')
                fisher_str = f" | Fisher p: {fisher_p:.4g}" if isinstance(fisher_p, float) else ""
                lines.append(f"  Summed p: {sp:.4f}{fisher_str} | Mean |d|: {comp.get('mean_effect_size_d', 0):.3f} | Threshold: {comp.get('bonferroni_like_threshold', 0):.4f}")
            lines.append("")
        # Combined
        comp_c = (res.get('combined') or {}).get('composite') or {}
        lines.append("All Tasks Combined:")
        lines.append(f"  Significant features: {comp_c.get('significant_features', 0)} (FDR@0.05: {comp_c.get('fdr_significant_features', 0)})")
        spc = comp_c.get('summed_p_value')
        if spc is not None:
            fisher_pc = comp_c.get('fisher_p_value')
            fisher_str_c = f" | Fisher p: {fisher_pc:.4g}" if isinstance(fisher_pc, float) else ""
            lines.append(f"  Summed p: {spc:.4f}{fisher_str_c} | Mean |d|: {comp_c.get('mean_effect_size_d', 0):.3f} | Threshold: {comp_c.get('bonferroni_like_threshold', 0):.4f}")
        self.multi_task_text.setPlainText("\n".join(lines))

    # PyQtGraph-only plot updater following BrainLinkRawEEG_Plot.py fix pattern
    def update_live_plot(self):
        """Update the live EEG plot with robust visibility diagnostics.

        Adds safeguards:
        - Re-create / re-add curve if it became detached
        - Explicit finite / NaN filtering (NaNs make curve vanish)
        - High-contrast pen enforcement if data appears flat
        - Force repaint occasionally
        """
        try:
            window_size = 1024
            # Snapshot buffer (avoid mutation mid-copy)
            buf = list(BL.live_data_buffer)
            n = len(buf)
            if n == 0:
                self.status_label.setText("Waiting for data...")
                return

            plot_size = min(window_size, n)
            data = np.array(buf[-plot_size:], dtype=np.float64)

            # Replace inf with finite values & guard against all-NaN
            if not np.all(np.isfinite(data)):
                finite_mask = np.isfinite(data)
                if finite_mask.any():
                    # Simple forward fill fallback
                    last_val = 0.0
                    for i in range(data.size):
                        if finite_mask[i]:
                            last_val = data[i]
                        else:
                            data[i] = last_val
                else:
                    data[:] = 0.0

            # Left-pad to fixed window
            if plot_size < window_size:
                pad = np.zeros(window_size - plot_size, dtype=data.dtype)
                data = np.concatenate([pad, data])

            x_data = np.arange(window_size, dtype=float)

            # Ensure curve exists & attached
            plot_item = self.plot_widget.getPlotItem()
            if not hasattr(self, 'live_curve') or self.live_curve is None:
                # Recreate with guaranteed visible pen
                try:
                    pen = pg.mkPen(color='yellow', width=3)
                except Exception:
                    pen = None
                self.live_curve = plot_item.plot(x_data, data, pen=pen)
            else:
                if self.live_curve not in plot_item.listDataItems():
                    try:
                        plot_item.addItem(self.live_curve)
                    except Exception:
                        pass
                try:
                    self.live_curve.setData(x_data, data)
                except Exception as _e_set:
                    # Attempt recreation if update failed
                    try:
                        plot_item.removeItem(self.live_curve)
                    except Exception:
                        pass
                    try:
                        self.live_curve = plot_item.plot(x_data, data, pen=pg.mkPen(color='yellow', width=3))
                    except Exception:
                        return

            # Dynamic y-range adjustment every 10 samples
            if n % 10 == 0:
                try:
                    y_min = float(np.min(data))
                    y_max = float(np.max(data))
                    if not np.isfinite(y_min) or not np.isfinite(y_max):
                        y_min, y_max = -50.0, 50.0
                    if abs(y_max - y_min) < 1e-6:
                        # Flat signal -> widen artificially so line is away from axes
                        mid = 0.5 * (y_min + y_max)
                        y_min = mid - 25.0
                        y_max = mid + 25.0
                    else:
                        pad = max((y_max - y_min) * 0.1, 10.0)
                        y_min -= pad
                        y_max += pad
                    plot_item.setXRange(0, window_size, padding=0)
                    plot_item.setYRange(y_min, y_max, padding=0)
                except Exception:
                    pass

            # Force a repaint occasionally (some platforms need this to reveal curve)
            if n % 50 == 0:
                try:
                    self.plot_widget.repaint()
                except Exception:
                    pass

            # Diagnostics: if line still invisible, enforce pen
            if n % 100 == 0:
                try:
                    # Heuristic: if variance tiny & centered, recolor pen for contrast
                    if np.var(data) < 1e-6:
                        self.live_curve.setPen(pg.mkPen(color='red', width=3))
                except Exception:
                    pass

            # Status update (throttled)
            if n % 25 == 0:
                try:
                    finite_points = int(np.isfinite(data).sum())
                    self.status_label.setText(
                        f"Buffer: {n} samples | Latest: {data[-1]:.1f} µV | Finite: {finite_points} | Plot: ✅ visible")
                except Exception:
                    pass
        except Exception as e:
            try:
                self.status_label.setText(f"Plot update error: {e}")
            except Exception:
                pass

    # Override to add auditory cue at task start
    def start_task(self):
        try:
            self._audio.play_start_task()
        except Exception:
            pass
        return super().start_task()

    # --- Task GUI (instructions + 60s auto-stop) ---
    def show_task_interface(self, task_type):
        try:
            # Close any existing dialog first
            self.close_task_interface()
        except Exception:
            pass

        # Get task config from base module
        tasks = getattr(BL, 'AVAILABLE_TASKS', {})
        task_cfg = tasks.get(task_type, {})
        duration = int(task_cfg.get('duration', 60))
        instructions = task_cfg.get('instructions', 'Follow the on-screen instructions for this task.')
        title = task_cfg.get('name', task_type.replace('_', ' ').title())

        # Build a lightweight dialog
        dlg = QDialog(self)
        dlg.setWindowTitle(f"Task: {title}")
        layout = QVBoxLayout(dlg)

        instr = QLabel(instructions, dlg)
        instr.setWordWrap(True)
        instr.setAlignment(Qt.AlignLeft | Qt.AlignTop)
        instr.setStyleSheet("font-size: 14px; color: #ffffff;")
        layout.addWidget(instr)

        timer_label = QLabel("60", dlg)
        timer_label.setAlignment(Qt.AlignCenter)
        timer_label.setStyleSheet("font-size: 32px; font-weight: bold; color: #00FFAA;")
        layout.addWidget(timer_label)

        stop_btn = QPushButton("Stop Now", dlg)
        layout.addWidget(stop_btn)

        self._task_dialog = dlg
        self._task_seconds_remaining = duration
        timer_label.setText(str(self._task_seconds_remaining))

        # Timer to count down and auto-stop
        t = QTimer(self)
        t.setInterval(1000)

        def tick():
            try:
                if self._task_seconds_remaining <= 0:
                    t.stop()
                    # End the task automatically
                    try:
                        self._audio.play_end_task()
                    except Exception:
                        pass
                    self.stop_calibration()
                    return
                self._task_seconds_remaining -= 1
                timer_label.setText(str(self._task_seconds_remaining))
            except Exception:
                # Fail-safe stop
                try:
                    t.stop()
                    self.stop_calibration()
                except Exception:
                    pass

        t.timeout.connect(tick)
        self._task_timer = t
        self._task_timer.start()

        # Manual stop
        def manual_stop():
            try:
                self._task_timer.stop()
            except Exception:
                pass
            self.stop_calibration()

        stop_btn.clicked.connect(manual_stop)

        # Show modeless so app stays responsive
        try:
            dlg.setModal(False)
        except Exception:
            pass
        dlg.show()

    def close_task_interface(self):
        # Stop timer and close dialog if present
        try:
            if self._task_timer is not None:
                self._task_timer.stop()
        except Exception:
            pass
        finally:
            self._task_timer = None

        try:
            if self._task_dialog is not None:
                self._task_dialog.close()
        except Exception:
            pass
        finally:
            self._task_dialog = None

    # Guard: avoid reconnecting if already connected
    def on_connect_clicked(self):
        try:
            if getattr(self, 'serial_obj', None) and getattr(self.serial_obj, 'is_open', False):
                self.log_message("Already connected to device; skipping reconnect.")
                return
        except Exception:
            pass
        return super().on_connect_clicked()


class AudioFeedback:
    """Simple auditory cues using winsound on Windows; no-op elsewhere."""
    def __init__(self):
        self.is_windows = (platform.system() == 'Windows')
        if self.is_windows:
            try:
                import winsound  # noqa: F401
                self._winsound_available = True
            except Exception:
                self._winsound_available = False
        else:
            self._winsound_available = False

    def _beep(self, pattern):
        if not self._winsound_available:
            return
        import winsound
        def _run():
            for freq, dur in pattern:
                try:
                    winsound.Beep(int(freq), int(dur))
                except Exception:
                    time.sleep(dur / 1000.0)
        t = threading.Thread(target=_run, daemon=True)
        t.start()

    # Public cues
    def play_start_calibration(self):
        # Two quick ascending beeps
        self._beep([(800, 150), (1000, 150)])

    def play_end_calibration(self):
        # One longer low beep
        self._beep([(600, 350)])

    def play_start_task(self):
        # Triple quick beeps
        self._beep([(800, 150), (1000, 150)])

    def play_end_task(self):
        # Descending two beeps
        self._beep([(600, 350)])


if __name__ == "__main__":
    import sys
    app = QtWidgets.QApplication(sys.argv)
    app.setStyle('Fusion')

    os_dialog = BL.OSSelectionDialog()
    if os_dialog.exec() == QtWidgets.QDialog.Accepted:
        selected_os = os_dialog.get_selected_os()
        window = EnhancedBrainLinkAnalyzerWindow(selected_os)
        window.show()
        sys.exit(app.exec())
    else:
        sys.exit(0)
