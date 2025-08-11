#!/usr/bin/env python3
"""
BrainLink Feature Analysis GUI (Enhanced)
Implements professor's recommendations:
- 2s windows (50% overlap)
- Enhanced statistical significance (Welch, Mann-Whitney, p-sum, effect size)
- Cosine similarity analysis with bootstrap
- Eyes-open-only baseline with min-duration guidance
- Spectral normalization options and prominence-based peak detection
"""

import sys, os, time, threading, requests, random
import serial.tools.list_ports
from cushy_serial import CushySerial
import numpy as np
import pandas as pd
import json
from datetime import datetime
import platform
import ssl
import getpass
from collections import deque

try:
    from BrainLinkParser.BrainLinkParser import BrainLinkParser
except ImportError:
    print("BrainLinkParser not available. Some functionality will be limited.")
    
    import threading
    import time
    import random
    
    class BrainLinkParser:
        def __init__(self, onEEG, onExtendEEG, onGyro, onRR, onRaw):
            print("Using dummy BrainLinkParser for testing")
            self.onRaw = onRaw
            self.onEEG = onEEG
            self.running = False
            self.thread = None
            
        def parse(self, data):
            # Generate dummy data for testing
            if not self.running:
                self.running = True
                self.thread = threading.Thread(target=self._generate_dummy_data)
                self.thread.daemon = True
                self.thread.start()
                
        def _generate_dummy_data(self):
            """Generate dummy EEG-like data for testing"""
            while self.running:
                # Generate realistic EEG-like data
                dummy_raw = random.randint(-100, 100) + 50 * np.sin(time.time() * 2 * np.pi * 10)
                self.onRaw(dummy_raw)
                time.sleep(1/256)  # 256 Hz sampling rate

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QRadioButton, QButtonGroup, QDialog, QFormLayout, QLineEdit,
    QDialogButtonBox, QGroupBox, QCheckBox, QTextEdit, QMessageBox, QInputDialog,
    QTabWidget, QComboBox, QSpinBox, QDoubleSpinBox, QProgressBar, QTableWidget,
    QTableWidgetItem, QHeaderView, QSplitter, QFrame, QGridLayout
)
from PySide6.QtCore import QTimer, Qt, QSettings, QThread, Signal
from PySide6.QtGui import QIcon, QFont
import pyqtgraph as pg
from scipy.signal import butter, filtfilt, iirnotch, welch, decimate, hilbert, find_peaks
from scipy.integrate import simpson as simps
from scipy.stats import zscore
from scipy import stats  # for Welch t-test & Mann-Whitney

# Import winreg only on Windows
if platform.system() == 'Windows':
    import winreg

# Set up PyQtGraph for better display compatibility
pg.setConfigOption('useOpenGL', False)
pg.setConfigOption('antialias', True)
pg.setConfigOption('background', 'k')
pg.setConfigOption('foreground', 'w')
pg.setConfigOption('crashWarning', True)
pg.setConfigOption('imageAxisOrder', 'row-major')

# Authentication settings
BACKEND_URLS = {
    "en": "https://en.mindspeller.com/api/cas/brainlink_data",
    "nl": "https://stg-nl.mindspell.be/api/cas/brainlink_data", 
    "local": "http://127.0.0.1:5000/api/cas/brainlink_data"
}

LOGIN_URLS = {
    "en": "https://en.mindspeller.com/api/cas/token/login",
    "nl": "https://stg-nl.mindspell.be/api/cas/token/login",
    "local": "http://127.0.0.1:5000/api/cas/token/login"
}

# --- Helper to locate asset files ---
def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller."""
    base_path = getattr(sys, '_MEIPASS', os.path.abspath("."))
    return os.path.join(base_path, relative_path)

# Global variables
BACKEND_URL = None
SERIAL_PORT = None
SERIAL_BAUD = 115200
ALLOWED_HWIDS = []
stop_thread_flag = False
live_data_buffer = []

# Signal processing constants
FS = 512
# Professor: use 2-second windows with 50% overlap
WINDOW_SIZE = 2 * FS        # 1024 samples
OVERLAP_SIZE = 1 * FS       # 512 samples
EEG_BANDS = {
    'delta': (0.5, 4),
    'theta': (4, 8),
    'alpha': (8, 12),
    'beta': (12, 30),
    'gamma': (30, 45)
}

# Feature analysis constants
FEATURE_NAMES = [
    'delta_power', 'theta_power', 'alpha_power', 'beta_power', 'gamma_power',
    'delta_relative', 'theta_relative', 'alpha_relative', 'beta_relative', 'gamma_relative',
    'delta_peak_freq', 'theta_peak_freq', 'alpha_peak_freq', 'beta_peak_freq', 'gamma_peak_freq',
    'delta_peak_amp', 'theta_peak_amp', 'alpha_peak_amp', 'beta_peak_amp', 'gamma_peak_amp',
    'alpha_theta_ratio', 'beta_alpha_ratio', 'total_power', 'snr_alpha'  # +1 to reach 24 features typically
]

# Available cognitive tasks
AVAILABLE_TASKS = {
    'mental_math': {
        'name': 'Mental Math',
        'description': 'Perform mental arithmetic (e.g., count backwards from 100 by 7s)',
        'duration': 60,
        'instructions': 'Count backwards from 100 by 7s: 100, 93, 86, 79...'
    },
    'visual_imagery': {
        'name': 'Visual Imagery',
        'description': 'Visualize a familiar place or object in detail',
        'duration': 60,
        'instructions': 'Close your eyes and visualize walking through your home in detail'
    },
    'working_memory': {
        'name': 'Working Memory',
        'description': 'Remember and manipulate a sequence of numbers or letters',
        'duration': 60,
        'instructions': 'Remember this sequence: 3-8-2-9-5-1. Now add 2 to each number mentally.'
    },
    'attention_focus': {
        'name': 'Focused Attention',
        'description': 'Focus intensely on breathing or a single point',
        'duration': 60,
        'instructions': 'Focus all attention on your breathing. Count each breath from 1 to 10, repeat.'
    },
    'language_processing': {
        'name': 'Language Processing',
        'description': 'Generate words or sentences following specific rules',
        'duration': 60,
        'instructions': 'Think of as many words as possible that start with the letter "S"'
    },
    'motor_imagery': {
        'name': 'Motor Imagery',
        'description': 'Imagine performing physical movements without moving',
        'duration': 60,
        'instructions': 'Imagine throwing a ball with your right hand, then left hand, alternating'
    },
    'cognitive_load': {
        'name': 'Cognitive Load',
        'description': 'Perform multiple cognitive tasks simultaneously',
        'duration': 60,
        'instructions': 'Count backwards from 50 by 3s while visualizing the numbers in blue'
    }
}

# Signal processing functions
def butter_lowpass_filter(data, cutoff, fs, order=2):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    return filtfilt(b, a, data)

def bandpass_filter(data, lowcut=1.0, highcut=45.0, fs=512, order=2):
    nyq = 0.5 * fs
    b, a = butter(order, [lowcut/nyq, highcut/nyq], btype='band')
    return filtfilt(b, a, data)

def notch_filter(data, fs, notch_freq=60.0, quality_factor=30.0):
    freq = notch_freq/(fs/2)
    b, a = iirnotch(freq, quality_factor)
    return filtfilt(b, a, data)

def compute_psd(data, fs):
    freqs, psd = welch(data, fs=fs, nperseg=WINDOW_SIZE, noverlap=OVERLAP_SIZE)
    return freqs, psd

def bandpower(psd, freqs, band):
    low, high = EEG_BANDS[band]
    idx = (freqs >= low) & (freqs <= high)
    return simps(psd[idx], dx=freqs[1] - freqs[0]) if np.any(idx) else 0

def remove_eye_blink_artifacts(data, window=10):
    """Remove eye blink artifacts from EEG data (adaptive z-threshold)"""
    clean = data.copy()
    thr = np.mean(data) + 3 * np.std(data)
    idx = np.where(np.abs(data) > thr)[0]
    for i in idx:
        start = max(0, i - window)
        end = min(len(data), i + window)
        local_window = np.delete(data[start:end], np.where(np.abs(data[start:end]) > thr))
        if len(local_window) > 0:
            clean[i] = np.median(local_window)
        else:
            clean[i] = np.median(data)
    return clean

def detect_brainlink():
    """Device detection with enhanced logging"""
    ports = serial.tools.list_ports.comports()
    print(f"Scanning {len(ports)} available ports...")
    
    if ALLOWED_HWIDS:
        print(f"Looking for authorized HWIDs: {ALLOWED_HWIDS}")
        for port in ports:
            print(f"Checking port: {port.device} - {port.description}")
            if hasattr(port, 'hwid'):
                print(f"  HWID: {port.hwid}")
                if any(hw in port.hwid for hw in ALLOWED_HWIDS):
                    print(f"✓ Found authorized BrainLink device: {port.device}")
                    return port.device
            else:
                print(f"  No HWID attribute found")
    
    print("Falling back to platform-specific detection...")
    if platform.system() == 'Windows':
        BRAINLINK_SERIALS = ("5C361634682F", "5C3616327E59", "5C3616346938", "5C3616346838")
        for port in ports:
            if hasattr(port, 'hwid'):
                if any(hw in port.hwid for hw in BRAINLINK_SERIALS):
                    print(f"✓ Found BrainLink device by serial: {port.device}")
                    return port.device
    elif platform.system() == 'Darwin':
        for port in ports:
            if any(id in port.description.lower() for id in ["brainlink", "neurosky", "ftdi", "silabs", "ch340"]):
                print(f"✓ Found BrainLink device by description: {port.device}")
                return port.device
            if port.device.startswith("/dev/tty.usbserial"):
                print(f"✓ Found BrainLink device by device name: {port.device}")
                return port.device
            if port.device.startswith("/dev/tty.usbmodem"):
                print(f"✓ Found BrainLink device by device name: {port.device}")
                return port.device
    
    print("✗ No BrainLink device found")
    print("Available ports:")
    for port in ports:
        hwid_info = f" (HWID: {port.hwid})" if hasattr(port, 'hwid') else ""
        print(f"  - {port.device}: {port.description}{hwid_info}")
    
    return None

# Data collection callbacks
def onRaw(raw):
    global live_data_buffer
    live_data_buffer.append(raw)
    if len(live_data_buffer) > 2000:
        live_data_buffer = live_data_buffer[-2000:]
    
    # Also feed data to feature engine if GUI is running
    if hasattr(onRaw, 'feature_engine') and onRaw.feature_engine:
        onRaw.feature_engine.add_data(raw)
    
    # Show processed values in console every 50 samples
    if len(live_data_buffer) % 50 == 0:
        print(f"Buffer size: {len(live_data_buffer)} samples")
        print(f"Latest raw value: {raw:.1f} µV")
        
        if len(live_data_buffer) >= WINDOW_SIZE:
            try:
                data = np.array(live_data_buffer[-WINDOW_SIZE:])
                cleaned_data = remove_eye_blink_artifacts(data)
                data_notched = notch_filter(cleaned_data, FS, notch_freq=50.0, quality_factor=30.0)
                filtered = bandpass_filter(data_notched, lowcut=1.0, highcut=45.0, fs=FS, order=2)
                
                print(f"Filtered data range: {np.min(filtered):.1f} to {np.max(filtered):.1f} µV")
                print(f"Mean: {np.mean(filtered):.1f} µV, Std: {np.std(filtered):.1f} µV")
                
                freqs, psd = compute_psd(filtered, FS)
                total_power = np.var(filtered)
                
                print(f"EEG BAND POWERS:")
                for band_name, (low, high) in EEG_BANDS.items():
                    power = bandpower(psd, freqs, band_name)
                    relative = power / total_power if total_power > 0 else 0
                    print(f"  {band_name.upper():5}: {power:8.2f} µV² ({relative:6.1%})")
                
                alpha_power = bandpower(psd, freqs, 'alpha')
                theta_power = bandpower(psd, freqs, 'theta')
                beta_power = bandpower(psd, freqs, 'beta')
                
                alpha_theta_ratio = alpha_power / (theta_power + 1e-10)
                beta_alpha_ratio = beta_power / (alpha_power + 1e-10)
                
                print(f"RATIOS:")
                print(f"  Alpha/Theta: {alpha_theta_ratio:.2f}")
                print(f"  Beta/Alpha:  {beta_alpha_ratio:.2f}")
                print(f"  Total Power: {total_power:.2f} µV²")
                
                alpha_rel = alpha_power / total_power if total_power > 0 else 0
                theta_rel = theta_power / total_power if total_power > 0 else 0
                beta_rel = beta_power / total_power if total_power > 0 else 0
                
                print(f"MENTAL STATE INTERPRETATION:")
                if alpha_rel > 0.3:
                    print(f"  → High alpha activity - relaxed, eyes closed state")
                elif beta_rel > 0.3:
                    print(f"  → High beta activity - alert, focused state")
                elif theta_rel > 0.3:
                    print(f"  → High theta activity - drowsy or meditative state")
                else:
                    print(f"  → Mixed activity - transitional state")
                
                print(f"===================================\n")
                
            except Exception as e:
                print(f"Analysis error: {e}")
        else:
            print(f"Need {WINDOW_SIZE - len(live_data_buffer)} more samples for analysis")
            print(f"===================================\n")

def onEEG(data):
    print("EEG -> attention:", data.attention, "meditation:", data.meditation)

def onExtendEEG(data):
    print("Extended EEG -> battery:", data.battery, "version:", data.version)

def onGyro(x, y, z):
    print(f"Gyro -> x={x}, y={y}, z={z}")

def onRR(rr1, rr2, rr3):
    print(f"RR -> rr1={rr1}, rr2={rr2}, rr3={rr3}")

def run_brainlink(serial_obj):
    """BrainLink thread function"""
    global stop_thread_flag
    parser = BrainLinkParser(onEEG, onExtendEEG, onGyro, onRR, onRaw)
    
    print("BrainLink thread started")

    @serial_obj.on_message()
    def handle_serial_message(msg: bytes):
        print(f"Received message: {len(msg)} bytes")
        parser.parse(msg)

    try:
        serial_obj.open()
        print(f"Opened {SERIAL_PORT} at {SERIAL_BAUD} baud.")
    except Exception as e:
        print(f"Failed to open serial port: {e}")
        return
        
    try:
        while not stop_thread_flag:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Exiting BrainLink thread (KeyboardInterrupt).")
    finally:
        if serial_obj.is_open:
            serial_obj.close()
        print("Serial closed. Thread exiting.")

# --- OS Selection Dialog ---
class OSSelectionDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Select Your Operating System")
        self.setMinimumWidth(300)

        if sys.platform.startswith("win"):
            default_os = "Windows"
        elif sys.platform.startswith("darwin"):
            default_os = "macOS"
        else:
            default_os = "Windows"

        self.selected_os = default_os

        self.radio_windows = QRadioButton("Windows")
        self.radio_macos = QRadioButton("macOS")
        if default_os == "Windows":
            self.radio_windows.setChecked(True)
        else:
            self.radio_macos.setChecked(True)

        layout = QVBoxLayout()
        layout.addWidget(QLabel("Please select your operating system:"))
        layout.addWidget(self.radio_windows)
        layout.addWidget(self.radio_macos)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

        self.setLayout(layout)

    def get_selected_os(self):
        if self.radio_windows.isChecked():
            return "Windows"
        else:
            return "macOS"

# --- Login Dialog ---
class LoginDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Login")
        try:
            self.setWindowIcon(QIcon(resource_path("assets/favicon.ico")))
        except:
            pass
        self.setMinimumWidth(300)
        self.settings = QSettings("BrainLink", "FeatureAnalyzer")
        
        self.username_edit = QLineEdit()
        saved_username = self.settings.value("username", "")
        self.username_edit.setText(saved_username)
        
        self.password_edit = QLineEdit()
        saved_password = self.settings.value("password", "")
        self.password_edit.setText(saved_password)
        self.password_edit.setEchoMode(QLineEdit.Password)
        
        self.eye_visible = False
        try:
            self.eye_action = self.password_edit.addAction(QIcon(resource_path("assets/eye-off.png")), QLineEdit.TrailingPosition)
            self.eye_action.triggered.connect(self.toggle_password_visibility)
        except:
            pass
        
        self.remember_checkbox = QCheckBox("Remember Me")
        if saved_username:
            self.remember_checkbox.setChecked(True)
        
        form_layout = QFormLayout()
        form_layout.addRow("Username:", self.username_edit)
        form_layout.addRow("Password:", self.password_edit)
        form_layout.addRow("", self.remember_checkbox)
        
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        
        layout = QVBoxLayout()
        layout.addLayout(form_layout)
        layout.addWidget(buttons)
        self.setLayout(layout)
        
        self.setStyleSheet("""
            QLabel { font-size: 14px; }
            QLineEdit { font-size: 14px; padding: 4px; }
            QCheckBox { font-size: 14px; }
            QDialog { background-color: #7878e9; }
        """)
    
    def toggle_password_visibility(self):
        if self.eye_visible:
            self.password_edit.setEchoMode(QLineEdit.Password)
            try:
                self.eye_action.setIcon(QIcon(resource_path("assets/eye-off.png")))
            except:
                pass
            self.eye_visible = False
        else:
            self.password_edit.setEchoMode(QLineEdit.Normal)
            try:
                self.eye_action.setIcon(QIcon(resource_path("assets/eye.png")))
            except:
                pass
            self.eye_visible = True
    
    def get_credentials(self):
        if self.remember_checkbox.isChecked():
            self.settings.setValue("username", self.username_edit.text())
            self.settings.setValue("password", self.password_edit.text())
        else:
            self.settings.remove("username")
            self.settings.remove("password")
        return self.username_edit.text(), self.password_edit.text()

# --- Significance & Similarity Utilities ---
def comprehensive_significance_testing(task_features: np.ndarray, baseline_features: np.ndarray, feature_names=None):
    """
    Apply Welch t-test & Mann-Whitney per feature, sum p-values, compute effect sizes.
    task_features: (n_task_windows, n_features)
    baseline_features: (n_base_windows, n_features)
    """
    n_feat = task_features.shape[1]
    p_values = []
    effect_sizes = []
    for f in range(n_feat):
        t_stat, p_welch = stats.ttest_ind(
            task_features[:, f],
            baseline_features[:, f],
            equal_var=False,
            nan_policy='omit'
        )
        try:
            u_stat, p_mw = stats.mannwhitneyu(
                task_features[:, f],
                baseline_features[:, f],
                alternative='two-sided'
            )
        except ValueError:
            # Fallback if all values equal or sizes invalid
            p_mw = 1.0

        # Cohen's d (pooled)
        s1 = np.var(task_features[:, f], ddof=1)
        s2 = np.var(baseline_features[:, f], ddof=1)
        pooled_std = np.sqrt((s1 + s2) / 2.0 + 1e-12)
        cohens_d = (np.nanmean(task_features[:, f]) - np.nanmean(baseline_features[:, f])) / pooled_std

        p_values.append(min(p_welch if p_welch is not None else 1.0,
                            p_mw if p_mw is not None else 1.0))
        effect_sizes.append(abs(cohens_d))

    summed_p_value = float(np.nansum(p_values))
    mean_effect_size = float(np.nanmean(effect_sizes))
    significant_features_count = int(np.nansum(np.array(p_values) < 0.05))
    n = n_feat if feature_names is None else len(feature_names)
    out = {
        'individual_p_values': p_values,
        'summed_p_value': summed_p_value,
        'mean_effect_size': mean_effect_size,
        'significant_features': significant_features_count,
        'composite_significance': summed_p_value < (0.05 * n),  # Bonferroni-style
        'effect_magnitude': 'large' if mean_effect_size > 0.8 else
                            'medium' if mean_effect_size > 0.5 else 'small'
    }
    return out

def cosine_similarity_analysis(task_vector: np.ndarray, baseline_vector: np.ndarray, n_boot=1000):
    """
    Cosine similarity with bootstrap permutation on baseline_vector.
    Returns similarity, distance (1 - sim), bootstrap p-value.
    """
    def _safe_norm(v):
        n = np.linalg.norm(v)
        return v / (n + 1e-12)

    t_norm = _safe_norm(task_vector)
    b_norm = _safe_norm(baseline_vector)
    cosine_sim = float(np.dot(t_norm, b_norm))
    cosine_distance = float(1.0 - cosine_sim)

    bootstrap_distances = []
    for _ in range(n_boot):
        shuffled = np.random.permutation(baseline_vector)
        s_norm = _safe_norm(shuffled)
        bootstrap_sim = float(np.dot(t_norm, s_norm))
        bootstrap_distances.append(1.0 - bootstrap_sim)
    bootstrap_distances = np.asarray(bootstrap_distances)
    p_value_cosine = float(np.mean(bootstrap_distances >= cosine_distance))

    return {
        'cosine_similarity': cosine_sim,
        'cosine_distance': cosine_distance,
        'p_value': p_value_cosine,
        'interpretation': 'significant_change' if p_value_cosine < 0.05 else 'no_change'
    }

# --- Feature Analysis Engine ---
class FeatureAnalysisEngine:
    def __init__(self):
        self.fs = FS
        self.window_size = 2.0   # professor: 2s windows
        self.overlap = 0.5
        self.window_samples = int(self.window_size * self.fs)
        
        # Data buffers
        self.raw_buffer = deque(maxlen=self.fs * 20)
        self.filtered_buffers = {band: deque(maxlen=self.fs * 20) for band in EEG_BANDS}
        self.power_buffers = {band: deque(maxlen=self.fs * 20) for band in EEG_BANDS}
        
        # Calibration data storage
        self.calibration_data = {
            'eyes_closed': {'features': [], 'timestamps': []},
            'eyes_open': {'features': [], 'timestamps': []},
            'task': {'features': [], 'timestamps': []}
        }
        
        # Current state
        self.current_state = 'idle'
        self.current_task = None
        self.state_start_time = None
        
        # Analysis results
        self.baseline_stats = {}
        self.analysis_results = {}
        self.summary_results = {}

        # Real-time features
        self.latest_features = {}

        # Normalization mode for spectral features
        # options: 'none', 'snr', 'z', 'robust'
        self.normalization_mode = 'none'

    def _apply_normalization(self, band_powers, total_power, freqs, psd):
        """
        Extend features with additional normalized measures per professor's 'Spectral Normalization' suggestions.
        """
        features_extra = {}

        if self.normalization_mode == 'snr':
            # SNR(band) = P_band / (P_total - P_band)
            for b, p in band_powers.items():
                denom = max(total_power - p, 1e-12)
                features_extra[f'snr_{b}'] = p / denom
        elif self.normalization_mode == 'z':
            # Z-transform on PSD within each band (mean/std across the band)
            for b, (lo, hi) in EEG_BANDS.items():
                mask = (freqs >= lo) & (freqs <= hi)
                band_vals = psd[mask]
                if band_vals.size > 1 and np.std(band_vals) > 0:
                    zvals = (band_vals - np.mean(band_vals)) / (np.std(band_vals) + 1e-12)
                    features_extra[f'{b}_z_mean'] = float(np.mean(zvals))
                    features_extra[f'{b}_z_max'] = float(np.max(zvals))
                else:
                    features_extra[f'{b}_z_mean'] = 0.0
                    features_extra[f'{b}_z_max'] = 0.0
        elif self.normalization_mode == 'robust':
            # Robust scaling: (x - median)/IQR for PSD within band
            for b, (lo, hi) in EEG_BANDS.items():
                mask = (freqs >= lo) & (freqs <= hi)
                band_vals = psd[mask]
                if band_vals.size > 0:
                    med = np.median(band_vals)
                    q25 = np.percentile(band_vals, 25)
                    q75 = np.percentile(band_vals, 75)
                    iqr = max(q75 - q25, 1e-12)
                    robust_vals = (band_vals - med) / iqr
                    features_extra[f'{b}_robust_mean'] = float(np.mean(robust_vals))
                    features_extra[f'{b}_robust_max'] = float(np.max(robust_vals))
                else:
                    features_extra[f'{b}_robust_mean'] = 0.0
                    features_extra[f'{b}_robust_max'] = 0.0

        # Always include SNR(alpha) as a common feature (used to reach ~24 features)
        p_alpha = band_powers.get('alpha', 0.0)
        features_extra['snr_alpha'] = float(p_alpha / max(total_power - p_alpha, 1e-12))
        return features_extra

    def _band_peak_with_prominence(self, band_freqs, band_psd):
        """
        Relative peak detection using prominence measures.
        """
        if band_psd.size == 0:
            return None, 0.0
        prominence = max(float(np.max(band_psd)) * 0.1, 1e-12)
        peaks, props = find_peaks(band_psd, prominence=prominence)
        if peaks.size == 0:
            idx = int(np.argmax(band_psd))
            return float(band_freqs[idx]), float(band_psd[idx])
        # choose peak with highest prominence
        best = int(peaks[np.argmax(props['prominences'])])
        return float(band_freqs[best]), float(band_psd[best])

    def add_data(self, new_data):
        """Add new EEG data and process it"""
        if np.isscalar(new_data):
            new_data = np.array([new_data])
        else:
            new_data = np.array(new_data)
        
        self.raw_buffer.extend(new_data)
        
        if len(self.raw_buffer) >= self.window_samples:
            window_data = np.array(list(self.raw_buffer)[-self.window_samples:])
            features = self.extract_features(window_data)
            
            self.latest_features = features
            
            if self.current_state in ['eyes_closed', 'eyes_open', 'task']:
                self.calibration_data[self.current_state]['features'].append(features)
                self.calibration_data[self.current_state]['timestamps'].append(time.time())
            
            return features
        return None
    
    def extract_features(self, window_data):
        """Extract comprehensive features from EEG data"""
        features = {}
        
        window_data = window_data - np.mean(window_data)
        try:
            window_data = notch_filter(window_data, self.fs, notch_freq=50.0)
        except:
            pass
        
        freqs, psd = compute_psd(window_data, self.fs)
        total_power = np.var(window_data)
        
        band_powers = {}
        for band_name in EEG_BANDS:
            power = bandpower(psd, freqs, band_name)
            band_powers[band_name] = float(power)
            features[f'{band_name}_power'] = float(power)
            
            rel_power = float(power / total_power) if total_power > 0 else 0.0
            features[f'{band_name}_relative'] = rel_power
            
            low, high = EEG_BANDS[band_name]
            band_mask = (freqs >= low) & (freqs <= high)
            if np.any(band_mask):
                band_freqs = freqs[band_mask]
                band_psd = psd[band_mask]
                pk_f, pk_a = self._band_peak_with_prominence(band_freqs, band_psd)
                if pk_f is None:
                    features[f'{band_name}_peak_freq'] = float((low + high) / 2.0)
                    features[f'{band_name}_peak_amp'] = 0.0
                else:
                    features[f'{band_name}_peak_freq'] = pk_f
                    features[f'{band_name}_peak_amp'] = pk_a
            else:
                features[f'{band_name}_peak_freq'] = float((low + high) / 2.0)
                features[f'{band_name}_peak_amp'] = 0.0
        
        features['alpha_theta_ratio'] = float(band_powers.get('alpha', 0.0) / (band_powers.get('theta', 0.0) + 1e-10))
        features['beta_alpha_ratio'] = float(band_powers.get('beta', 0.0) / (band_powers.get('alpha', 0.0) + 1e-10))
        features['total_power'] = float(total_power)

        # Spectral normalization strategies
        features.update(self._apply_normalization(band_powers, total_power, freqs, psd))
        return features
    
    def start_calibration_phase(self, phase_name, task_type=None):
        """Start calibration phase"""
        self.current_state = phase_name
        self.current_task = task_type
        self.state_start_time = time.time()
        
        # Clear existing data
        self.calibration_data[phase_name]['features'] = []
        self.calibration_data[phase_name]['timestamps'] = []
        
        print(f"Started calibration phase: {phase_name}")
        if task_type:
            print(f"Task: {AVAILABLE_TASKS[task_type]['name']}")
            print(f"Instructions: {AVAILABLE_TASKS[task_type]['instructions']}")
    
    def stop_calibration_phase(self):
        """Stop calibration phase"""
        if self.current_state != 'idle':
            duration = time.time() - self.state_start_time
            num_features = len(self.calibration_data[self.current_state]['features'])
            
            print(f"Stopped calibration phase: {self.current_state}")
            print(f"Duration: {duration:.1f}s, Features collected: {num_features}")
            
            self.current_state = 'idle'
            self.current_task = None
            self.state_start_time = None
    
    def compute_baseline_statistics(self):
        """
        Compute baseline statistics using EYES-OPEN ONLY per professor.
        Soft guidance: warn if total eyes-open duration < 120s.
        """
        baseline_features = []
        baseline_features.extend(self.calibration_data['eyes_open']['features'])
        if len(baseline_features) == 0:
            print("No eyes-open baseline data available.")
            return
        
        # Check duration
        ts = self.calibration_data['eyes_open']['timestamps']
        if len(ts) > 1:
            duration = ts[-1] - ts[0]
            if duration < 120:
                print(f"Warning: Eyes-open baseline duration ~{duration:.1f}s (<120s recommended).")

        df = pd.DataFrame(baseline_features)
        self.baseline_stats = {}
        
        for feature in df.columns:
            values = df[feature].values
            self.baseline_stats[feature] = {
                'mean': float(np.nanmean(values)),
                'std': float(np.nanstd(values)),
                'min': float(np.nanmin(values)),
                'max': float(np.nanmax(values)),
                'median': float(np.nanmedian(values)),
                'q25': float(np.nanpercentile(values, 25)),
                'q75': float(np.nanpercentile(values, 75))
            }
        
        print(f"Baseline statistics computed for {len(self.baseline_stats)} features")
    
    def _dict_list_to_matrix(self, dict_list, feature_list):
        """Convert list[dict] -> np.ndarray (n_samples, n_features) with NaN fills where missing."""
        if len(dict_list) == 0 or len(feature_list) == 0:
            return np.zeros((0, 0))
        mat = np.zeros((len(dict_list), len(feature_list)), dtype=float)
        for i, d in enumerate(dict_list):
            for j, f in enumerate(feature_list):
                mat[i, j] = d.get(f, np.nan)
        return mat

    def analyze_task_data(self):
        """Analyze task data against baseline with enhanced statistics"""
        if not self.baseline_stats:
            print("Baseline stats not available. Compute baseline first.")
            return
        
        task_features = self.calibration_data['task']['features']
        if len(task_features) == 0:
            print("No task data available.")
            return
        
        task_df = pd.DataFrame(task_features)
        self.analysis_results = {}
        
        for feature in task_df.columns:
            if feature in self.baseline_stats:
                task_values = task_df[feature].values
                baseline_mean = self.baseline_stats[feature]['mean']
                baseline_std = self.baseline_stats[feature]['std']
                
                z_scores = (task_values - baseline_mean) / (baseline_std + 1e-10)
                outliers = np.abs(z_scores) > 2
                
                self.analysis_results[feature] = {
                    'task_mean': float(np.nanmean(task_values)),
                    'task_std': float(np.nanstd(task_values)),
                    'baseline_mean': float(baseline_mean),
                    'baseline_std': float(baseline_std),
                    'z_scores': z_scores,
                    'outliers': outliers,
                    'outlier_percentage': float(np.nansum(outliers) / max(len(outliers),1) * 100.0),
                    'significant_change': bool(abs(np.nanmean(task_values) - baseline_mean) > 2 * (baseline_std + 1e-12))
                }
        
        print(f"Task analysis completed for {len(self.analysis_results)} features")

        # ---- Phase 1: Multi-statistical significance + Cosine similarity ----
        feature_list = [f for f in FEATURE_NAMES if (f in task_df.columns and f in self.baseline_stats)]
        if not feature_list:
            feature_list = [f for f in task_df.columns if f in self.baseline_stats]  # fallback
        
        task_mat = self._dict_list_to_matrix(task_features, feature_list)
        base_mat = self._dict_list_to_matrix(self.calibration_data['eyes_open']['features'], feature_list)

        if task_mat.size > 0 and base_mat.size > 0:
            sig = comprehensive_significance_testing(task_mat, base_mat, feature_names=feature_list)
            task_vec = np.nanmean(task_mat, axis=0)
            base_vec = np.nanmean(base_mat, axis=0)
            cos = cosine_similarity_analysis(task_vec, base_vec, n_boot=1000)

            self.summary_results = {
                'features_used': feature_list,
                'significance': sig,
                'cosine': cos
            }
        else:
            self.summary_results = {'features_used': [], 'significance': None, 'cosine': None}

        return self.analysis_results

# --- Main Window ---
class BrainLinkAnalyzerWindow(QMainWindow):
    def __init__(self, user_os, parent=None):
        super().__init__(parent)
        self.user_os = user_os
        self.setWindowTitle(f"BrainLink Feature Analyzer - {self.user_os}")
        try:
            self.setWindowIcon(QIcon(resource_path("assets/favicon.ico")))
        except:
            pass
        
        self.jwt_token = None
        self.brainlink_thread = None
        self.serial_obj = None
        self.feature_engine = FeatureAnalysisEngine()
        
        self.setMinimumSize(1200, 800)
        self.setup_ui()
        self.setup_timers()
        
        # Check for device and auto-connect
        global SERIAL_PORT
        SERIAL_PORT = detect_brainlink()
        if SERIAL_PORT:
            self.log_message(f"Found BrainLink device: {SERIAL_PORT}")
            # Auto-connect for console output
            self.auto_connect_brainlink()
        else:
            self.log_message("No BrainLink device found!")
    
    def auto_connect_brainlink(self):
        """Auto-connect to BrainLink device for console output"""
        global SERIAL_PORT, stop_thread_flag
        
        try:
            self.log_message("Auto-connecting to BrainLink device...")
            
            # Link feature engine to onRaw callback
            onRaw.feature_engine = self.feature_engine
            
            # Create serial object
            self.serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)
            
            # Reset stop flag
            stop_thread_flag = False
            
            # Start BrainLink thread
            self.brainlink_thread = threading.Thread(target=run_brainlink, args=(self.serial_obj,))
            self.brainlink_thread.daemon = True
            self.brainlink_thread.start()
            
            # Enable calibration buttons for immediate testing
            self.eyes_closed_button.setEnabled(True)
            self.eyes_open_button.setEnabled(True)
            self.task_button.setEnabled(True)
            self.compute_baseline_button.setEnabled(True)
            self.analyze_task_button.setEnabled(True)
            self.generate_report_button.setEnabled(True)
            
            self.log_message("✓ BrainLink auto-connected! Check console for processed values.")
            print("\n" + "="*60)
            print("BRAINLINK ANALYZER STARTED")
            print("Real-time EEG analysis will appear in console every 50 samples")
            print("="*60)
            
        except Exception as e:
            self.log_message(f"Auto-connect failed: {e}")
            print(f"Auto-connect error: {e}")
            # Enable manual connection
            self.connect_button.setEnabled(True)
    
    def setup_ui(self):
        """Setup the user interface"""
        self.setStyleSheet("""
            QMainWindow { background: #7878e9; }
            QLabel { font-size: 12px; }
            QPushButton {
                background-color: #0A00FF;
                color: white;
                border-radius: 5px;
                padding: 8px;
                font-size: 12px;
            }
            QPushButton:disabled { background-color: #a0a0a0; }
            QRadioButton { font-size: 12px; }
            QGroupBox {
                margin-top: 10px;
                border: 1px solid #a0a0a0;
                border-radius: 5px;
                padding: 5px;
            }
            QLineEdit { font-size: 12px; padding: 4px; }
            QTextEdit { font-size: 12px; }
            QTabWidget::pane { border: 1px solid #a0a0a0; }
            QTabBar::tab { padding: 8px; }
        """)
        
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        
        # Header
        header = QLabel("BrainLink Feature Analyzer")
        header.setAlignment(Qt.AlignCenter)
        header.setStyleSheet("font-size: 20px; font-weight: bold;")
        main_layout.addWidget(header)
        
        # Tab widget
        self.tabs = QTabWidget()
        main_layout.addWidget(self.tabs)
        
        # Setup tabs
        self.setup_connection_tab()
        self.setup_analysis_tab()
        self.setup_results_tab()
        
        # Status bar
        self.status_label = QLabel("Ready")
        main_layout.addWidget(self.status_label)
    
    def setup_connection_tab(self):
        """Setup connection and authentication tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Environment selection
        env_group = QGroupBox("Environment")
        env_layout = QHBoxLayout()
        
        self.env_group = QButtonGroup(self)
        self.radio_en = QRadioButton("EN (Production)")
        self.radio_nl = QRadioButton("NL (Production)")
        self.radio_local = QRadioButton("Local (127.0.0.1:5000)")
        self.radio_en.setChecked(True)
        
        self.env_group.addButton(self.radio_en)
        self.env_group.addButton(self.radio_nl)
        self.env_group.addButton(self.radio_local)
        
        env_layout.addWidget(self.radio_en)
        env_layout.addWidget(self.radio_nl)
        env_layout.addWidget(self.radio_local)
        env_group.setLayout(env_layout)
        layout.addWidget(env_group)
        
        # Connection controls
        conn_group = QGroupBox("Connection")
        conn_layout = QHBoxLayout()
        
        self.connect_button = QPushButton("Connect & Login")
        self.connect_button.clicked.connect(self.on_connect_clicked)
        conn_layout.addWidget(self.connect_button)
        
        self.disconnect_button = QPushButton("Disconnect")
        self.disconnect_button.clicked.connect(self.on_disconnect_clicked)
        self.disconnect_button.setEnabled(False)
        conn_layout.addWidget(self.disconnect_button)
        
        conn_group.setLayout(conn_layout)
        layout.addWidget(conn_group)
        
        # Live EEG plot
        plot_group = QGroupBox("Live EEG Signal")
        plot_layout = QVBoxLayout()
        
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground("#000")
        self.plot_widget.setLabel('left', 'Amplitude (µV)')
        self.plot_widget.setLabel('bottom', 'Sample Index')
        self.plot_widget.setTitle('Raw EEG Signal (Real-time)')
        self.plot_widget.showGrid(x=True, y=True)
        try:
            pi = self.plot_widget.getPlotItem()
            vb_init = pi.getViewBox()
            vb_init.setRange(xRange=(0, 256), yRange=(-200, 200), padding=0)
            try:
                pi.enableAutoRange(x=False, y=False)
            except Exception:
                pass
            try:
                vb_init.enableAutoRange('xy', False)
            except Exception:
                try:
                    vb_init.enableAutoRange(x=False, y=False)
                except Exception:
                    pass
            try:
                pi.hideButtons()
            except Exception:
                pass
        except Exception:
            pass
        plot_layout.addWidget(self.plot_widget)
        
        pen = pg.mkPen(color=(0, 255, 0, 255), width=3, style=pg.QtCore.Qt.SolidLine)
        self.live_curve = self.plot_widget.plot([], [], pen=pen, symbol='o', symbolBrush=(0, 255, 0), symbolSize=2)
        try:
            self.live_curve.setZValue(10)
            self.live_curve.setVisible(True)
        except Exception:
            pass
        
        try:
            if hasattr(self, 'live_curve') and self.live_curve is not None:
                try:
                    self.live_curve.setClipToView(False)
                except Exception:
                    pass
                try:
                    if hasattr(self.live_curve, 'setDownsampling'):
                        self.live_curve.setDownsampling(auto=False)
                except Exception:
                    pass
                try:
                    if hasattr(self.live_curve, 'setAutoDownsample'):
                        self.live_curve.setAutoDownsample(False)
                except Exception:
                    pass
            try:
                self.plot_widget.getPlotItem().hideButtons()
            except Exception:
                pass
        except Exception:
            pass
        
        plot_group.setLayout(plot_layout)
        layout.addWidget(plot_group)
        
        # Log area
        log_group = QGroupBox("System Log")
        log_layout = QVBoxLayout()
        
        self.log_area = QTextEdit()
        self.log_area.setReadOnly(True)
        self.log_area.setMaximumHeight(150)
        log_layout.addWidget(self.log_area)
        
        log_group.setLayout(log_layout)
        layout.addWidget(log_group)
        
        self.tabs.addTab(tab, "Connection")
    
    def setup_analysis_tab(self):
        """Setup analysis and calibration tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Calibration controls
        cal_group = QGroupBox("Calibration Phases")
        cal_layout = QGridLayout()
        
        # Eyes closed
        self.eyes_closed_button = QPushButton("Start Eyes Closed")
        self.eyes_closed_button.clicked.connect(lambda: self.start_calibration('eyes_closed'))
        self.eyes_closed_button.setEnabled(False)
        cal_layout.addWidget(self.eyes_closed_button, 0, 0)
        
        self.eyes_closed_label = QLabel("Status: Not started")
        cal_layout.addWidget(self.eyes_closed_label, 0, 1)
        
        # Eyes open
        self.eyes_open_button = QPushButton("Start Eyes Open")
        self.eyes_open_button.clicked.connect(lambda: self.start_calibration('eyes_open'))
        self.eyes_open_button.setEnabled(False)
        cal_layout.addWidget(self.eyes_open_button, 1, 0)
        
        self.eyes_open_label = QLabel("Status: Not started (Use as baseline; aim for 2 minutes with fixation cross)")
        cal_layout.addWidget(self.eyes_open_label, 1, 1)
        
        # Task selection
        task_layout = QHBoxLayout()
        task_layout.addWidget(QLabel("Task:"))
        
        self.task_combo = QComboBox()
        self.task_combo.addItems(list(AVAILABLE_TASKS.keys()))
        task_layout.addWidget(self.task_combo)
        
        self.task_button = QPushButton("Start Task")
        self.task_button.clicked.connect(self.start_task)
        self.task_button.setEnabled(False)
        task_layout.addWidget(self.task_button)
        
        cal_layout.addLayout(task_layout, 2, 0, 1, 2)
        
        self.task_label = QLabel("Status: Not started")
        cal_layout.addWidget(self.task_label, 3, 0, 1, 2)
        
        # Stop button
        self.stop_button = QPushButton("Stop Current Phase")
        self.stop_button.clicked.connect(self.stop_calibration)
        self.stop_button.setEnabled(False)
        cal_layout.addWidget(self.stop_button, 4, 0, 1, 2)
        
        cal_group.setLayout(cal_layout)
        layout.addWidget(cal_group)

        # Normalization selector
        norm_group = QGroupBox("Spectral Normalization")
        norm_layout = QHBoxLayout()
        self.norm_combo = QComboBox()
        self.norm_combo.addItems(['none', 'snr', 'z', 'robust'])
        self.norm_combo.currentTextChanged.connect(lambda m: setattr(self.feature_engine, 'normalization_mode', m))
        norm_layout.addWidget(QLabel("Mode:"))
        norm_layout.addWidget(self.norm_combo)
        norm_group.setLayout(norm_layout)
        layout.addWidget(norm_group)
        
        # Analysis controls
        analysis_group = QGroupBox("Analysis")
        analysis_layout = QVBoxLayout()
        
        self.compute_baseline_button = QPushButton("Compute Baseline Statistics (Eyes-Open Only)")
        self.compute_baseline_button.clicked.connect(self.compute_baseline)
        self.compute_baseline_button.setEnabled(False)
        analysis_layout.addWidget(self.compute_baseline_button)
        
        self.analyze_task_button = QPushButton("Analyze Task Data")
        self.analyze_task_button.clicked.connect(self.analyze_task)
        self.analyze_task_button.setEnabled(False)
        analysis_layout.addWidget(self.analyze_task_button)
        
        self.generate_report_button = QPushButton("Generate Report")
        self.generate_report_button.clicked.connect(self.generate_report)
        self.generate_report_button.setEnabled(False)
        analysis_layout.addWidget(self.generate_report_button)
        
        analysis_group.setLayout(analysis_layout)
        layout.addWidget(analysis_group)
        
        # Real-time features display
        features_group = QGroupBox("Real-time Features")
        features_layout = QVBoxLayout()
        
        self.features_table = QTableWidget()
        self.features_table.setColumnCount(2)
        self.features_table.setHorizontalHeaderLabels(['Feature', 'Value'])
        self.features_table.horizontalHeader().setStretchLastSection(True)
        features_layout.addWidget(self.features_table)
        
        features_group.setLayout(features_layout)
        layout.addWidget(features_group)
        
        self.tabs.addTab(tab, "Analysis")
    
    def setup_results_tab(self):
        """Setup results and visualization tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Results display
        results_group = QGroupBox("Analysis Results")
        results_layout = QVBoxLayout()
        
        self.results_table = QTableWidget()
        self.results_table.setColumnCount(6)
        self.results_table.setHorizontalHeaderLabels([
            'Feature', 'Baseline Mean', 'Baseline Std', 'Task Mean', 'Task Std', 'Significant Change'
        ])
        self.results_table.horizontalHeader().setStretchLastSection(True)
        results_layout.addWidget(self.results_table)
        
        results_group.setLayout(results_layout)
        layout.addWidget(results_group)
        
        # Statistics summary
        stats_group = QGroupBox("Statistics Summary")
        stats_layout = QVBoxLayout()
        
        self.stats_text = QTextEdit()
        self.stats_text.setReadOnly(True)
        self.stats_text.setMaximumHeight(260)
        stats_layout.addWidget(self.stats_text)
        
        stats_group.setLayout(stats_layout)
        layout.addWidget(stats_group)
        
        self.tabs.addTab(tab, "Results")
    
    def setup_timers(self):
        """Setup update timers"""
        self.live_timer = QTimer(self)
        self.live_timer.timeout.connect(self.update_live_plot)
        self.live_timer.start(50)  # Update every 50ms
        
        self.features_timer = QTimer(self)
        self.features_timer.timeout.connect(self.update_features_display)
        self.features_timer.start(1000)  # Update every 1s
    
    def log_message(self, message):
        """Add timestamped message to log"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_area.append(f"[{timestamp}] {message}")
        self.status_label.setText(message)
    
    def update_live_plot(self):
        """Update live plot with EEG data"""
        global live_data_buffer
        
        if len(live_data_buffer) >= 50:
            try:
                plot_size = min(256, len(live_data_buffer))
                data = np.array(live_data_buffer[-plot_size:])
                x_data = np.arange(len(data))
                
                y = np.asarray(data, dtype=float)
                x = np.asarray(x_data, dtype=float)
                if not np.all(np.isfinite(y)):
                    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
                if not np.all(np.isfinite(x)):
                    x = np.nan_to_num(x, nan=0.0, posinf=0.0, neginf=0.0)
                
                try:
                    self.live_curve.setVisible(True)
                    if self.live_curve.opts['pen'] is None:
                        pen = pg.mkPen(color=(0, 255, 0, 255), width=5, style=pg.QtCore.Qt.SolidLine)
                        self.live_curve.setPen(pen)
                except Exception:
                    pass
                
                self.live_curve.setData(x, y, connect='all')
                
                if len(y) > 0:
                    y_min, y_max = float(np.min(y)), float(np.max(y))
                    y_range = y_max - y_min
                    padding = y_range * 0.1 if y_range > 0 else 50.0
                    
                    self.plot_widget.setYRange(y_min - padding, y_max + padding)
                    self.plot_widget.setXRange(0, int(len(x)))
                    
                    try:
                        pi = self.plot_widget.getPlotItem()
                        vb = pi.getViewBox()
                        vb.setRange(xRange=(0, int(len(x))), yRange=(y_min - padding, y_max + padding), padding=0)
                    except Exception:
                        pass
                
                if hasattr(self, 'status_label'):
                    self.status_label.setText(f"Buffer: {len(live_data_buffer)} samples | Latest: {live_data_buffer[-1]:.1f} µV | Range: {y_min:.1f} to {y_max:.1f} µV")
                
            except Exception as e:
                try:
                    if hasattr(self, 'status_label'):
                        self.status_label.setText("Plot update issue; continuing...")
                except Exception:
                    pass
                try:
                    self.plot_widget.getPlotItem().hideButtons()
                except Exception:
                    pass
                if hasattr(self, 'status_label') and len(live_data_buffer) > 0:
                    self.status_label.setText(f"Buffer: {len(live_data_buffer)} samples | Latest: {live_data_buffer[-1]:.1f} µV | Plot error: {e}")
        else:
            if hasattr(self, 'status_label'):
                if len(live_data_buffer) > 0:
                    self.status_label.setText(f"Buffer: {len(live_data_buffer)} samples | Latest: {live_data_buffer[-1]:.1f} µV | Need {50 - len(live_data_buffer)} more samples")
                else:
                    self.status_label.setText("Waiting for data...")
    
    def update_features_display(self):
        """Update real-time features display"""
        if not self.feature_engine.latest_features:
            return
        
        features = self.feature_engine.latest_features
        
        self.features_table.setRowCount(len(features))
        for i, (feature, value) in enumerate(sorted(features.items())):
            self.features_table.setItem(i, 0, QTableWidgetItem(feature))
            try:
                self.features_table.setItem(i, 1, QTableWidgetItem(f"{float(value):.6f}"))
            except Exception:
                self.features_table.setItem(i, 1, QTableWidgetItem(str(value)))
    
    def on_connect_clicked(self):
        """Connect to BrainLink device with authentication"""
        global BACKEND_URL, SERIAL_PORT, ALLOWED_HWIDS
        
        if self.radio_en.isChecked():
            BACKEND_URL = BACKEND_URLS["en"]
            login_url = LOGIN_URLS["en"]
            self.log_message("Using EN environment")
        elif self.radio_nl.isChecked():
            BACKEND_URL = BACKEND_URLS["nl"]
            login_url = LOGIN_URLS["nl"]
            self.log_message("Using NL environment")
        else:
            BACKEND_URL = BACKEND_URLS["local"]
            login_url = LOGIN_URLS["local"]
            self.log_message("Using local environment")
        
        login_dialog = LoginDialog(self)
        if login_dialog.exec() == QDialog.Accepted:
            username, password = login_dialog.get_credentials()
            
            login_payload = {"username": username, "password": password}
            try:
                self.log_message(f"Connecting to {login_url}")
                try:
                    login_response = requests.post(
                        login_url, 
                        json=login_payload,
                        headers={"Content-Type": "application/json"},
                        timeout=10,
                        verify=True
                    )
                except requests.exceptions.ProxyError as e:
                    self.log_message(f"Proxy error: {str(e)}. Retrying without proxy...")
                    direct_session = requests.Session()
                    direct_session.proxies = {}
                    login_response = direct_session.post(
                        login_url, 
                        json=login_payload,
                        headers={"Content-Type": "application/json"},
                        timeout=10,
                        verify=True
                    )
                
                if login_response.status_code == 200:
                    data = login_response.json()
                    self.jwt_token = data.get("x-jwt-access-token")
                    hwid = data.get("hwid")
                    
                    if self.jwt_token:
                        self.log_message("✓ Login successful. JWT token obtained.")
                        if hwid:
                            self.log_message(f"✓ Hardware ID received: {hwid}")
                            ALLOWED_HWIDS = [hwid]
                    else:
                        self.log_message("✗ Login response didn't contain expected token.")
                        return
                else:
                    self.log_message("Trying without SSL verification...")
                    login_response = requests.post(
                        login_url, 
                        json=login_payload,
                        headers={"Content-Type": "application/json"},
                        timeout=10,
                        verify=False
                    )
                    
                    if login_response.status_code == 200:
                        data = login_response.json()
                        self.jwt_token = data.get("x-jwt-access-token")
                        hwid = data.get("hwid")
                        
                        if self.jwt_token:
                            self.log_message("✓ Login successful (without SSL verification).")
                            if hwid:
                                self.log_message(f"✓ Hardware ID received: {hwid}")
                                ALLOWED_HWIDS = [hwid]
                        else:
                            self.log_message("✗ Login failed.")
                            return
                    else:
                        self.log_message(f"✗ Login failed: {login_response.status_code}")
                        return
                        
            except Exception as e:
                self.log_message(f"Login error: {str(e)}")
                return
        else:
            self.log_message("Login cancelled.")
            return
        
        api_base = BACKEND_URL.replace("/brainlink_data", "")
        try:
            hwids_url = f"{api_base}/users/hwids"
            self.log_message(f"Fetching authorized device IDs from {hwids_url}")
            hwid_response = requests.get(
                hwids_url,
                headers = {"X-Authorization": f"Bearer {self.jwt_token}"},
                timeout=5
            )
            if hwid_response.status_code == 200:
                raw_hwids = hwid_response.json().get("brainlink_hwid", [])
                if isinstance(raw_hwids, str):
                    ALLOWED_HWIDS = [raw_hwids]
                elif isinstance(raw_hwids, list):
                    ALLOWED_HWIDS = raw_hwids
                else:
                    ALLOWED_HWIDS = []
                self.log_message(f"✓ Fetched {len(ALLOWED_HWIDS)} authorized device IDs")
                if ALLOWED_HWIDS:
                    self.log_message(f"✓ Authorized HWIDs: {ALLOWED_HWIDS}")
            else:
                self.log_message(f"✗ Failed to fetch HWIDs ({hwid_response.status_code}); using default detection")
        except Exception as e:
            self.log_message(f"Error fetching HWIDs: {e}")
        
        SERIAL_PORT = detect_brainlink()
        if not SERIAL_PORT:
            self.log_message("✗ No BrainLink device found!")
            return
        
        self.log_message(f"✓ Found BrainLink device: {SERIAL_PORT}")
        
        try:
            self.serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)
            self.log_message("Starting BrainLink thread...")
            
            global stop_thread_flag
            stop_thread_flag = False
            
            self.brainlink_thread = threading.Thread(target=run_brainlink, args=(self.serial_obj,))
            self.brainlink_thread.daemon = True
            self.brainlink_thread.start()
            
            self.connect_button.setEnabled(False)
            self.disconnect_button.setEnabled(True)
            
            self.eyes_closed_button.setEnabled(True)
            self.eyes_open_button.setEnabled(True)
            self.task_button.setEnabled(True)
            
            self.compute_baseline_button.setEnabled(True)
            self.analyze_task_button.setEnabled(True)
            self.generate_report_button.setEnabled(True)
            
            self.log_message("✓ BrainLink connected successfully!")
            
        except Exception as e:
            self.log_message(f"✗ Failed to connect: {str(e)}")
    
    def on_disconnect_clicked(self):
        """Disconnect from BrainLink device"""
        global stop_thread_flag
        stop_thread_flag = True
        
        if self.serial_obj and self.serial_obj.is_open:
            self.serial_obj.close()
        
        if self.brainlink_thread and self.brainlink_thread.is_alive():
            self.brainlink_thread.join(timeout=2)
        
        self.connect_button.setEnabled(True)
        self.disconnect_button.setEnabled(False)
        
        self.eyes_closed_button.setEnabled(False)
        self.eyes_open_button.setEnabled(False)
        self.task_button.setEnabled(False)
        self.stop_button.setEnabled(False)
        
        self.log_message("✓ Disconnected from BrainLink device")
    
    def start_calibration(self, phase_name):
        """Start calibration phase"""
        if self.feature_engine.current_state != 'idle':
            self.log_message("Please stop current phase first")
            return
        
        self.feature_engine.start_calibration_phase(phase_name)
        self.stop_button.setEnabled(True)
        
        if phase_name == 'eyes_closed':
            self.eyes_closed_label.setText("Status: Recording...")
            self.eyes_closed_button.setEnabled(False)
        elif phase_name == 'eyes_open':
            self.eyes_open_label.setText("Status: Recording (keep eyes open on fixation cross)...")
            self.eyes_open_button.setEnabled(False)
        
        self.log_message(f"✓ Started {phase_name} calibration")
    
    def start_task(self):
        """Start task calibration"""
        if self.feature_engine.current_state != 'idle':
            self.log_message("Please stop current phase first")
            return
        
        task_type = self.task_combo.currentText()
        self.feature_engine.start_calibration_phase('task', task_type)
        
        self.task_label.setText(f"Status: Recording {task_type}...")
        self.task_button.setEnabled(False)
        self.stop_button.setEnabled(True)
        
        self.log_message(f"✓ Started task: {task_type}")
        self.show_task_interface(task_type)
    
    def stop_calibration(self):
        """Stop current calibration phase"""
        if self.feature_engine.current_state == 'idle':
            return
        
        phase = self.feature_engine.current_state
        self.feature_engine.stop_calibration_phase()
        
        self.stop_button.setEnabled(False)
        
        if phase == 'eyes_closed':
            self.eyes_closed_label.setText("Status: Completed")
            self.eyes_closed_button.setEnabled(True)
        elif phase == 'eyes_open':
            self.eyes_open_label.setText("Status: Completed (eyes-open baseline)")
            self.eyes_open_button.setEnabled(True)
        elif phase == 'task':
            self.task_label.setText("Status: Completed")
            self.task_button.setEnabled(True)
            self.close_task_interface()
        
        self.log_message(f"✓ Stopped {phase} calibration")
        
        if len(self.feature_engine.calibration_data['eyes_open']['features']) > 0:
            self.compute_baseline_button.setEnabled(True)
        
        if len(self.feature_engine.calibration_data['task']['features']) > 0:
            self.analyze_task_button.setEnabled(True)
    
    # Legacy (not used directly) kept for compatibility
    def compute_baseline_statistics(self):
        pass
    
    def analyze_task_data(self):
        pass
    
    def log_message(self, message):
        """Add timestamped message to log"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_area.append(f"[{timestamp}] {message}")
        self.status_label.setText(message)
    
    def update_features_display(self):
        """Update real-time features display"""
        if not self.feature_engine.latest_features:
            return
        
        features = self.feature_engine.latest_features
        self.features_table.setRowCount(len(features))
        
        for i, (feature, value) in enumerate(sorted(features.items())):
            self.features_table.setItem(i, 0, QTableWidgetItem(feature))
            self.features_table.setItem(i, 1, QTableWidgetItem(f"{float(value):.6f}"))
    
    def show_task_interface(self, task_type):
        """Show interactive task interface (placeholder for GUI tasks)"""
        pass
    
    def close_task_interface(self):
        """Close task interface"""
        pass
    
    def compute_baseline(self):
        """Compute baseline statistics (eyes-open only)"""
        self.feature_engine.compute_baseline_statistics()
        self.analyze_task_button.setEnabled(True)
        # Quick heads-up in the log if short baseline
        eo_ts = self.feature_engine.calibration_data['eyes_open']['timestamps']
        if len(eo_ts) > 1 and (eo_ts[-1] - eo_ts[0]) < 120:
            self.log_message("Baseline computed, but eyes-open duration < 120s (recommended).")
        else:
            self.log_message("✓ Baseline statistics computed")
    
    def analyze_task(self):
        """Analyze task data"""
        results = self.feature_engine.analyze_task_data()
        if results:
            self.update_results_display(results)
            self._update_summary_display()
            self.generate_report_button.setEnabled(True)
            self.log_message("✓ Task analysis completed")
    
    def _update_summary_display(self):
        """Show enhanced significance + cosine summary"""
        s = self.feature_engine.summary_results
        lines = []
        if s and s.get('significance'):
            sig = s['significance']
            lines.append("=== Enhanced Statistical Significance ===")
            lines.append(f"Summed p-value: {sig['summed_p_value']:.6f}")
            lines.append(f"Mean effect size (|d|): {sig['mean_effect_size']:.3f} ({sig['effect_magnitude']})")
            lines.append(f"Significant features (p<0.05): {sig['significant_features']}")
            lines.append(f"Composite significance (Bonferroni-style): {sig['composite_significance']}")
            lines.append("")
        if s and s.get('cosine'):
            cos = s['cosine']
            lines.append("=== Cosine Similarity Analysis ===")
            lines.append(f"Cosine similarity: {cos['cosine_similarity']:.4f}")
            lines.append(f"Cosine distance:  {cos['cosine_distance']:.4f}")
            lines.append(f"Bootstrap p-value: {cos['p_value']:.4f}")
            lines.append(f"Interpretation: {cos['interpretation']}")
        self.stats_text.setPlainText("\n".join(lines))
    
    def update_results_display(self, results):
        """Update results table"""
        self.results_table.setRowCount(len(results))
        
        for i, (feature, data) in enumerate(sorted(results.items())):
            self.results_table.setItem(i, 0, QTableWidgetItem(feature))
            self.results_table.setItem(i, 1, QTableWidgetItem(f"{data['baseline_mean']:.6f}"))
            self.results_table.setItem(i, 2, QTableWidgetItem(f"{data['baseline_std']:.6f}"))
            self.results_table.setItem(i, 3, QTableWidgetItem(f"{data['task_mean']:.6f}"))
            self.results_table.setItem(i, 4, QTableWidgetItem(f"{data['task_std']:.6f}"))
            self.results_table.setItem(i, 5, QTableWidgetItem("Yes" if data['significant_change'] else "No"))
    
    def generate_report(self):
        """Generate analysis report"""
        report = "BrainLink Feature Analysis Report\n"
        report += "=" * 50 + "\n\n"
        
        # Add baseline statistics
        if hasattr(self.feature_engine, 'baseline_stats') and self.feature_engine.baseline_stats:
            report += "Baseline Statistics (Eyes-Open):\n"
            report += "-" * 20 + "\n"
            for feature, stats_ in sorted(self.feature_engine.baseline_stats.items()):
                report += f"{feature}: Mean={stats_['mean']:.6f}, Std={stats_['std']:.6f}\n"
            report += "\n"
        
        # Add task analysis
        if hasattr(self.feature_engine, 'analysis_results') and self.feature_engine.analysis_results:
            report += "Task Analysis Results:\n"
            report += "-" * 20 + "\n"
            for feature, results in sorted(self.feature_engine.analysis_results.items()):
                if results['significant_change']:
                    report += f"{feature}: SIGNIFICANT CHANGE - "
                    report += f"Task Mean={results['task_mean']:.6f}, "
                    report += f"Baseline Mean={results['baseline_mean']:.6f}\n"
            report += "\n"
        
        # Add summary statistics
        s = self.feature_engine.summary_results
        if s and s.get('significance'):
            sig = s['significance']
            report += "Enhanced Statistical Significance:\n"
            report += "-" * 20 + "\n"
            report += f"Summed p-value: {sig['summed_p_value']:.6f}\n"
            report += f"Mean effect size (|d|): {sig['mean_effect_size']:.3f} ({sig['effect_magnitude']})\n"
            report += f"Significant features (p<0.05): {sig['significant_features']}\n"
            report += f"Composite significance (Bonferroni-style): {sig['composite_significance']}\n\n"
        if s and s.get('cosine'):
            cos = s['cosine']
            report += "Cosine Similarity:\n"
            report += "-" * 20 + "\n"
            report += f"Cosine similarity: {cos['cosine_similarity']:.4f}\n"
            report += f"Cosine distance:  {cos['cosine_distance']:.4f}\n"
            report += f"Bootstrap p-value: {cos['p_value']:.4f}\n"
            report += f"Interpretation: {cos['interpretation']}\n"
        
        self.stats_text.setPlainText(report)
        self.log_message("✓ Report generated")


# --- Main execution ---
if __name__ == "__main__":
    import random
    
    # OS Selection
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    # Show OS selection dialog
    os_dialog = OSSelectionDialog()
    if os_dialog.exec() == QDialog.Accepted:
        selected_os = os_dialog.get_selected_os()
        
        # Create and show main window
        window = BrainLinkAnalyzerWindow(selected_os)
        window.show()
        
        sys.exit(app.exec())
    else:
        sys.exit(0)