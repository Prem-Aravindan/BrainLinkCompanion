#!/usr/bin/env python3
"""
Offline 64-Channel EEG Recording and Analysis Engine

This module implements OFFLINE analysis for 64-channel EEG:
1. During streaming: Record raw data to CSV/Excel with timestamps
2. Mark phase transitions (eyes_closed, eyes_open, task)
3. After recording: Load raw data, segment by phase, extract features, analyze

Advantages:
- Zero computational overhead during streaming
- Raw data preserved for reanalysis
- Can apply sophisticated artifact rejection offline
- Full 1,400+ features extracted without time pressure

Author: BrainLink Companion Team
Date: February 2026
"""

import numpy as np
import pandas as pd
import time
import os
from datetime import datetime
from collections import deque
from typing import Optional, Dict, List, Any, Tuple
from scipy import signal
import warnings
import threading

# Try to import base engine for analyze_all_tasks_data
BASE_ENGINE_AVAILABLE = False
EnhancedFeatureAnalysisEngine = None
EnhancedAnalyzerConfig = None

try:
    from BrainLinkAnalyzer_GUI_Enhanced import (
        EnhancedFeatureAnalysisEngine,
        EnhancedAnalyzerConfig
    )
    BASE_ENGINE_AVAILABLE = True
except ImportError:
    pass

warnings.filterwarnings('ignore', category=RuntimeWarning)

# Import channel names from enhanced engine
try:
    from antNeuro.enhanced_multichannel_analysis import (
        CHANNEL_NAMES_64,
        CHANNEL_REGIONS,
        ASYMMETRY_PAIRS,
        KEY_CHANNELS
    )
except ImportError:
    # Fallback definitions
    CHANNEL_NAMES_64 = [
        'Fp1', 'Fp2', 'F9', 'F7', 'F3', 'Fz', 'F4', 'F8',
        'F10', 'FC5', 'FC1', 'FC2', 'FC6', 'T9', 'T7', 'C3',
        'C4', 'T8', 'T10', 'CP5', 'CP1', 'CP2', 'CP6', 'P9',
        'P7', 'P3', 'Pz', 'P4', 'P8', 'P10', 'O1', 'O2',
        'AF7', 'AF3', 'AF4', 'AF8', 'F5', 'F1', 'F2', 'F6',
        'FC3', 'FCz', 'FC4', 'C5', 'C1', 'C2', 'C6', 'CP3',
        'CP4', 'P5', 'P1', 'P2', 'P6', 'PO5', 'PO3', 'PO4',
        'PO6', 'FT7', 'FT8', 'TP7', 'TP8', 'PO7', 'PO8', 'POz'
    ]
    CHANNEL_REGIONS = {
        'frontal': ['Fp1', 'Fp2', 'F7', 'F3', 'Fz', 'F4', 'F8', 'AF7', 'AF3', 'AF4', 'AF8', 'F5', 'F1', 'F2', 'F6', 'F9', 'F10'],
        'central': ['FC5', 'FC1', 'FC2', 'FC6', 'C3', 'C4', 'FC3', 'FCz', 'FC4', 'C5', 'C1', 'C2', 'C6'],
        'temporal': ['T7', 'T8', 'T9', 'T10', 'FT7', 'FT8', 'TP7', 'TP8'],
        'parietal': ['CP5', 'CP1', 'CP2', 'CP6', 'P7', 'P3', 'Pz', 'P4', 'P8', 'CP3', 'CP4', 'P5', 'P1', 'P2', 'P6', 'P9', 'P10'],
        'occipital': ['O1', 'O2', 'PO5', 'PO3', 'PO4', 'PO6', 'PO7', 'PO8', 'POz']
    }
    ASYMMETRY_PAIRS = [
        ('Fp1', 'Fp2'), ('F7', 'F8'), ('F3', 'F4'), ('FC5', 'FC6'), ('FC1', 'FC2'),
        ('T7', 'T8'), ('C3', 'C4'), ('CP5', 'CP6'), ('CP1', 'CP2'),
        ('P7', 'P8'), ('P3', 'P4'), ('O1', 'O2'),
        ('AF7', 'AF8'), ('AF3', 'AF4'), ('F5', 'F6'), ('F1', 'F2'),
        ('FC3', 'FC4'), ('C5', 'C6'), ('C1', 'C2'), ('CP3', 'CP4'),
        ('P5', 'P6'), ('P1', 'P2'), ('PO5', 'PO6'), ('PO3', 'PO4'), ('PO7', 'PO8'),
        ('FT7', 'FT8'), ('TP7', 'TP8')
    ]


# Create base class dynamically based on availability
_BaseClass = EnhancedFeatureAnalysisEngine if BASE_ENGINE_AVAILABLE else object


class OfflineMultichannelEngine(_BaseClass):
    """
    Offline 64-channel EEG recording and analysis engine.
    
    Inherits from EnhancedFeatureAnalysisEngine to get analyze_all_tasks_data().
    
    Usage:
        engine = OfflineMultichannelEngine(sample_rate=500, channel_count=64)
        
        # During streaming - just record data
        engine.add_data(multichannel_samples)
        
        # Mark phase transitions
        engine.start_phase('eyes_closed')
        engine.stop_phase()
        engine.start_phase('eyes_open')
        engine.stop_phase()
        engine.start_phase('task', task_type='visual_imagery')
        engine.stop_phase()
        
        # After all recording - offline analysis
        results = engine.analyze_offline(progress_callback=lambda p: print(f"{p}%"))
    """
    
    def __init__(
        self,
        sample_rate: int = 500,
        channel_count: int = 64,
        channel_names: List[str] = None,
        save_dir: str = None,
        window_size: float = 2.0,
        window_overlap: float = 0.5,
        user_email: str = None
    ):
        """
        Initialize the offline recording engine.
        
        Args:
            sample_rate: Sampling rate in Hz
            channel_count: Number of channels
            channel_names: List of channel names
            save_dir: Directory to save raw data files
            window_size: Analysis window size in seconds
            window_overlap: Window overlap ratio (0-1)
        """
        # Initialize parent class if available (for analyze_all_tasks_data)
        if BASE_ENGINE_AVAILABLE:
            config = EnhancedAnalyzerConfig()
            super().__init__(config=config)
        
        self.fs = sample_rate
        self.channel_count = min(channel_count, 64)
        self.channel_names = channel_names or CHANNEL_NAMES_64[:self.channel_count]
        self.window_size = window_size
        self.window_overlap = window_overlap
        
        # Create save directory
        if save_dir is None:
            save_dir = os.path.join(os.path.expanduser("~"), "BrainLink_Recordings")
        self.save_dir = save_dir
        os.makedirs(self.save_dir, exist_ok=True)
        
        # Create session ID with user email
        self.user_email = user_email or "unknown"
        self.session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        # Sanitize email for filename (replace @ and . with underscores)
        email_safe = self.user_email.replace('@', '_').replace('.', '_')
        self.session_file = os.path.join(self.save_dir, f"session_{self.session_id}_{email_safe}.csv")
        
        # Raw data buffer (in-memory, will also write to disk)
        self.raw_data = []  # List of (timestamp, sample_array) tuples
        self.recording_start_time = None
        
        # Phase markers
        self.phase_markers = []  # List of {'phase': str, 'task': str, 'start': float, 'end': float}
        self.current_phase = None
        self.current_task = None
        self.phase_start_time = None
        
        # Analysis results (override parent's to ensure clean state)
        self.calibration_data = {
            'eyes_closed': {'features': [], 'timestamps': []},
            'eyes_open': {'features': [], 'timestamps': []},
            'task': {'features': [], 'timestamps': []},
            'tasks': {}
        }
        self.baseline_stats = {}
        self.latest_features = {}
        
        # For compatibility with existing code
        self.current_state = 'idle'
        
        # Channel index mapping
        self.channel_index = {name: i for i, name in enumerate(self.channel_names)}
        
        # Primary channel index (Fz) for compatibility
        self.primary_channel_idx = self.channel_index.get('Fz', 5)
        
        # Region indices
        self.region_indices = {}
        for region, channels in CHANNEL_REGIONS.items():
            indices = [self.channel_index[ch] for ch in channels if ch in self.channel_index]
            if indices:
                self.region_indices[region] = indices
        
        # Asymmetry pair indices
        self.asymmetry_indices = []
        for left, right in ASYMMETRY_PAIRS:
            if left in self.channel_index and right in self.channel_index:
                self.asymmetry_indices.append((
                    left, right,
                    self.channel_index[left],
                    self.channel_index[right]
                ))
        
        # Frequency bands
        self.bands = {
            'delta': (0.5, 4),
            'theta': (4, 8),
            'alpha': (8, 13),
            'beta': (13, 30),
            'gamma': (30, 45)
        }
        
        # File writer (for streaming to disk)
        self._file_handle = None
        self._write_lock = threading.Lock()
        self._samples_written = 0
        
        print(f"[OFFLINE ENGINE] Initialized: {channel_count} channels @ {sample_rate} Hz")
        print(f"[OFFLINE ENGINE] Session ID: {self.session_id}")
        print(f"[OFFLINE ENGINE] Save directory: {self.save_dir}")
    
    def start_recording(self):
        """Start recording raw data to disk."""
        self.recording_start_time = time.time()
        self.raw_data = []
        self._samples_written = 0
        
        # Open CSV file with headers
        self._file_handle = open(self.session_file, 'w', newline='')
        headers = ['timestamp', 'sample_index'] + self.channel_names[:self.channel_count]
        self._file_handle.write(','.join(headers) + '\n')
        
        print(f"[OFFLINE ENGINE] Recording started: {self.session_file}")
    
    def stop_recording(self):
        """Stop recording and close file."""
        if self._file_handle:
            self._file_handle.close()
            self._file_handle = None
        
        print(f"[OFFLINE ENGINE] Recording stopped: {self._samples_written} samples written")
        print(f"[OFFLINE ENGINE] File: {self.session_file}")
    
    def detect_artifacts(self, data: np.ndarray) -> Dict[str, Any]:
        """
        Detect artifacts in multi-channel EEG data.
        
        Args:
            data: Shape (n_samples, n_channels)
        
        Returns:
            Dictionary with artifact information:
            - bad_channels: List of channel indices with poor signal
            - artifact_windows: List of (start_idx, end_idx) with artifacts
            - flat_channels: Channels with flat/zero signal
            - noisy_channels: Channels with excessive amplitude
        """
        n_samples, n_channels = data.shape
        artifact_info = {
            'bad_channels': [],
            'flat_channels': [],
            'noisy_channels': [],
            'artifact_windows': [],
            'channel_quality': {}  # Quality score per channel (0-1)
        }
        
        # 1. Detect flat channels (likely disconnected)
        for ch_idx in range(n_channels):
            ch_data = data[:, ch_idx]
            std = np.std(ch_data)
            
            # Flat signal detection (<0.1 µV std)
            if std < 0.1:
                artifact_info['flat_channels'].append(ch_idx)
                artifact_info['bad_channels'].append(ch_idx)
                artifact_info['channel_quality'][ch_idx] = 0.0
                continue
            
            # Check for excessive amplitude (>200 µV)
            max_amp = np.max(np.abs(ch_data))
            if max_amp > 200:
                artifact_info['noisy_channels'].append(ch_idx)
                artifact_info['bad_channels'].append(ch_idx)
                artifact_info['channel_quality'][ch_idx] = 0.3
                continue
            
            # Compute quality score based on std and amplitude
            # Good EEG typically has 5-50 µV std
            if 5 <= std <= 50 and max_amp <= 150:
                quality = 1.0
            elif 2 <= std <= 80 and max_amp <= 200:
                quality = 0.7
            else:
                quality = 0.5
            
            artifact_info['channel_quality'][ch_idx] = quality
        
        # 2. Detect high-amplitude artifact windows
        window_size = int(0.5 * self.fs)  # 0.5 second windows
        for start_idx in range(0, n_samples - window_size, window_size // 2):
            end_idx = start_idx + window_size
            window = data[start_idx:end_idx, :]
            
            # Check for sudden amplitude spikes across channels
            max_per_channel = np.max(np.abs(window), axis=0)
            if np.mean(max_per_channel) > 150:  # Average across channels exceeds threshold
                artifact_info['artifact_windows'].append((start_idx, end_idx))
        
        return artifact_info
    
    def remove_artifacts(self, data: np.ndarray, artifact_info: Dict[str, Any] = None) -> np.ndarray:
        """
        Remove artifacts from multi-channel EEG data.
        
        Args:
            data: Shape (n_samples, n_channels)
            artifact_info: Artifact detection results (if None, will detect automatically)
        
        Returns:
            Cleaned data with artifacts removed/interpolated
        """
        if artifact_info is None:
            artifact_info = self.detect_artifacts(data)
        
        cleaned_data = data.copy()
        n_samples, n_channels = data.shape
        
        # 1. Remove bad channels by interpolating from neighbors
        bad_channels = artifact_info.get('bad_channels', [])
        if bad_channels:
            print(f"[ARTIFACT REMOVAL] Interpolating {len(bad_channels)} bad channels")
            for bad_ch in bad_channels:
                if 0 < bad_ch < n_channels - 1:
                    # Simple average of neighbors
                    cleaned_data[:, bad_ch] = (cleaned_data[:, bad_ch - 1] + cleaned_data[:, bad_ch + 1]) / 2
                elif bad_ch == 0 and n_channels > 1:
                    cleaned_data[:, bad_ch] = cleaned_data[:, bad_ch + 1]
                elif bad_ch == n_channels - 1 and n_channels > 1:
                    cleaned_data[:, bad_ch] = cleaned_data[:, bad_ch - 1]
        
        # 2. Remove high-amplitude artifact windows by linear interpolation
        artifact_windows = artifact_info.get('artifact_windows', [])
        if artifact_windows:
            print(f"[ARTIFACT REMOVAL] Interpolating {len(artifact_windows)} artifact windows")
            for start_idx, end_idx in artifact_windows:
                if start_idx > 0 and end_idx < n_samples - 1:
                    # Linear interpolation across all channels
                    for ch_idx in range(n_channels):
                        before = cleaned_data[start_idx - 1, ch_idx]
                        after = cleaned_data[end_idx + 1, ch_idx]
                        n_samples_interp = end_idx - start_idx
                        interpolated = np.linspace(before, after, n_samples_interp)
                        cleaned_data[start_idx:end_idx, ch_idx] = interpolated
        
        return cleaned_data
    
    def add_data(self, new_data):
        """
        Add new EEG data (just record, no processing).
        
        Args:
            new_data: Shape (n_samples, n_channels) or (n_channels,) for single sample
        """
        if self.recording_start_time is None:
            self.start_recording()
        
        current_time = time.time()
        relative_time = current_time - self.recording_start_time
        
        # Handle different input formats
        if np.isscalar(new_data):
            return  # Can't record single values without channel info
        
        data = np.atleast_2d(new_data)
        if data.shape[1] != self.channel_count and data.shape[0] == self.channel_count:
            data = data.T  # Transpose if needed
        
        # Store in memory
        for i, sample in enumerate(data):
            timestamp = relative_time + i / self.fs
            self.raw_data.append((timestamp, sample.copy()))
        
        # Write to disk (batched for efficiency)
        if self._file_handle:
            with self._write_lock:
                lines = []
                for i, sample in enumerate(data):
                    timestamp = relative_time + i / self.fs
                    sample_idx = self._samples_written + i
                    values = [f"{timestamp:.6f}", str(sample_idx)] + [f"{v:.6f}" for v in sample]
                    lines.append(','.join(values))
                self._file_handle.write('\n'.join(lines) + '\n')
                self._samples_written += len(data)
    
    def start_phase(self, phase: str, task_type: str = None, phase_subtype: str = None, should_record: bool = True):
        """
        Mark the start of a calibration/task phase or sub-phase.
        
        Args:
            phase: 'eyes_closed', 'eyes_open', or 'task'
            task_type: Task name (for task phase)
            phase_subtype: Detailed phase type (e.g., 'cue', 'baseline', 'execution', 'rest')
            should_record: Whether this phase should be recorded for analysis
        """
        self.current_phase = phase
        self.current_task = task_type
        self.current_phase_subtype = phase_subtype
        self.current_should_record = should_record
        self.current_state = phase  # For compatibility
        self.phase_start_time = time.time()
        
        relative_time = 0
        if self.recording_start_time:
            relative_time = self.phase_start_time - self.recording_start_time
        
        phase_desc = f"{phase}"
        if phase_subtype:
            phase_desc += f" ({phase_subtype})"
        if task_type:
            phase_desc += f" - {task_type}"
        record_flag = "RECORDING" if should_record else "NOT RECORDED"
        print(f"[OFFLINE ENGINE] Phase started: {phase_desc} [{record_flag}] at t={relative_time:.2f}s")
    
    def stop_phase(self):
        """Mark the end of current phase."""
        if self.current_phase is None:
            return
        
        end_time = time.time()
        relative_start = 0
        relative_end = 0
        
        if self.recording_start_time:
            relative_start = self.phase_start_time - self.recording_start_time
            relative_end = end_time - self.recording_start_time
        
        marker = {
            'phase': self.current_phase,
            'task': self.current_task,
            'start': relative_start,
            'end': relative_end
        }
        
        # Add detailed phase information if available
        if hasattr(self, 'current_phase_subtype') and self.current_phase_subtype:
            marker['phase_type'] = self.current_phase_subtype
        if hasattr(self, 'current_should_record'):
            marker['record'] = self.current_should_record
        
        self.phase_markers.append(marker)
        
        duration = relative_end - relative_start
        phase_desc = self.current_phase
        if hasattr(self, 'current_phase_subtype') and self.current_phase_subtype:
            phase_desc += f" ({self.current_phase_subtype})"
        print(f"[OFFLINE ENGINE] Phase ended: {phase_desc} (duration: {duration:.1f}s)")
        
        self.current_phase = None
        self.current_task = None
        self.current_state = 'idle'
        self.phase_start_time = None
        if hasattr(self, 'current_phase_subtype'):
            self.current_phase_subtype = None
        if hasattr(self, 'current_should_record'):
            self.current_should_record = True
    
    # Compatibility methods
    def start_calibration_phase(self, phase: str, task_type: str = None):
        """Compatibility wrapper for start_phase."""
        self.start_phase(phase, task_type)
    
    def stop_calibration_phase(self):
        """Compatibility wrapper for stop_phase."""
        self.stop_phase()
    
    def set_log_function(self, log_func):
        """Set logging function for compatibility."""
        self._log_func = log_func
    
    def analyze_offline(self, progress_callback=None) -> Dict[str, Any]:
        """
        Perform offline analysis on recorded data.
        
        This is called when the user clicks "Analyze" after recording.
        Extracts features from all phases and runs statistical analysis.
        
        Args:
            progress_callback: Function to call with progress (0-100)
        
        Returns:
            Dictionary with analysis results
        """
        print(f"\n{'='*70}")
        print(f"[OFFLINE ENGINE] STARTING OFFLINE ANALYSIS")
        print(f"[OFFLINE ENGINE] Total samples: {len(self.raw_data)}")
        print(f"[OFFLINE ENGINE] Phase markers: {len(self.phase_markers)}")
        print(f"{'='*70}\n")
        
        if not self.raw_data:
            print("[OFFLINE ENGINE] No data to analyze!")
            return None
        
        if not self.phase_markers:
            print("[OFFLINE ENGINE] No phase markers found!")
            return None
        
        # Convert raw data to numpy array
        timestamps = np.array([t for t, _ in self.raw_data])
        samples = np.array([s for _, s in self.raw_data])
        
        total_phases = len(self.phase_markers)
        
        # Process each phase
        for phase_idx, marker in enumerate(self.phase_markers):
            phase = marker['phase']
            task = marker['task']
            start_time = marker['start']
            end_time = marker['end']
            
            if progress_callback:
                progress_callback(int(phase_idx / total_phases * 50))
            
            print(f"[OFFLINE ENGINE] Processing phase: {phase} (t={start_time:.1f}s to {end_time:.1f}s)")
            
            # Extract samples for this phase
            mask = (timestamps >= start_time) & (timestamps <= end_time)
            phase_data = samples[mask]
            
            if len(phase_data) < self.fs * self.window_size:
                print(f"  Warning: Not enough data for phase {phase} ({len(phase_data)} samples)")
                continue
            
            # Extract features using windowing
            features_list = self._extract_windowed_features(phase_data, progress_callback, 
                                                            base_progress=int(phase_idx / total_phases * 50))
            
            if not features_list:
                continue
            
            # Store features
            if phase == 'eyes_closed':
                self.calibration_data['eyes_closed']['features'] = features_list
                self.calibration_data['eyes_closed']['timestamps'] = list(range(len(features_list)))
            elif phase == 'eyes_open':
                self.calibration_data['eyes_open']['features'] = features_list
                self.calibration_data['eyes_open']['timestamps'] = list(range(len(features_list)))
            elif phase == 'task':
                self.calibration_data['task']['features'] = features_list
                self.calibration_data['task']['timestamps'] = list(range(len(features_list)))
                
                if task:
                    tasks = self.calibration_data.setdefault('tasks', {})
                    tasks[task] = {
                        'features': features_list,
                        'timestamps': list(range(len(features_list)))
                    }
            
            print(f"  Extracted {len(features_list)} feature windows ({len(features_list[0])} features each)")
        
        if progress_callback:
            progress_callback(60)
        
        # Compute baseline
        self.compute_baseline_statistics()
        
        if progress_callback:
            progress_callback(100)
        
        print(f"\n[OFFLINE ENGINE] Analysis complete!")
        print(f"  Eyes-closed windows: {len(self.calibration_data['eyes_closed']['features'])}")
        print(f"  Eyes-open windows: {len(self.calibration_data['eyes_open']['features'])}")
        print(f"  Task windows: {len(self.calibration_data['task']['features'])}")
        
        return self.calibration_data
    
    def _extract_windowed_features(self, data: np.ndarray, progress_callback=None, base_progress=0) -> List[Dict]:
        """
        Extract features from data using sliding windows.
        
        Args:
            data: Shape (n_samples, n_channels)
            progress_callback: Progress callback
            base_progress: Base progress value
        
        Returns:
            List of feature dictionaries
        """
        n_samples = len(data)
        window_samples = int(self.window_size * self.fs)
        step_samples = int(window_samples * (1 - self.window_overlap))
        
        # Perform artifact detection on full data
        artifact_info = self.detect_artifacts(data)
        print(f"[ARTIFACT DETECTION] Bad channels: {len(artifact_info['bad_channels'])}")
        print(f"[ARTIFACT DETECTION] Artifact windows: {len(artifact_info['artifact_windows'])}")
        
        # Apply artifact removal
        cleaned_data = self.remove_artifacts(data, artifact_info)
        
        # Store artifact info for reporting
        if not hasattr(self, 'artifact_summary'):
            self.artifact_summary = {}
        self.artifact_summary = artifact_info
        
        features_list = []
        n_windows = (n_samples - window_samples) // step_samples + 1
        
        for i, start_idx in enumerate(range(0, n_samples - window_samples + 1, step_samples)):
            end_idx = start_idx + window_samples
            window_data = cleaned_data[start_idx:end_idx]
            
            features = self._extract_multichannel_features(window_data)
            if features:
                features_list.append(features)
        
        return features_list
    
    def _extract_multichannel_features(self, mc_data: np.ndarray) -> Dict[str, float]:
        """
        Extract comprehensive features from multi-channel EEG window.
        
        Args:
            mc_data: Shape (n_samples, n_channels)
        
        Returns:
            Dictionary with ~1,400 features
        """
        features = {}
        n_samples, n_channels = mc_data.shape
        
        if n_samples < 256 or n_channels < 1:
            return None
        
        # Remove DC offset
        mc_data = mc_data - np.mean(mc_data, axis=0, keepdims=True)
        
        # Apply notch filter for line noise
        try:
            b_notch, a_notch = signal.iirnotch(60.0, 30.0, self.fs)
            mc_data = signal.filtfilt(b_notch, a_notch, mc_data, axis=0)
        except:
            pass
        
        # Compute PSD for all channels
        nperseg = min(n_samples, 256)
        try:
            freqs, psd_all = signal.welch(mc_data, self.fs, nperseg=nperseg, axis=0)
        except:
            return None
        
        # ==================================================================
        # 1. PER-CHANNEL FEATURES
        # ==================================================================
        for ch_idx in range(min(n_channels, self.channel_count)):
            ch_name = self.channel_names[ch_idx] if ch_idx < len(self.channel_names) else f'Ch{ch_idx}'
            psd = psd_all[:, ch_idx]
            total_power = np.sum(psd) + 1e-12
            
            for band_name, (low, high) in self.bands.items():
                mask = (freqs >= low) & (freqs <= high)
                band_power = np.sum(psd[mask])
                
                features[f'{ch_name}_{band_name}_power'] = float(band_power)
                features[f'{ch_name}_{band_name}_relative'] = float(band_power / total_power)
                
                # Peak frequency in band
                if np.any(mask) and band_power > 0:
                    band_psd = psd[mask]
                    band_freqs = freqs[mask]
                    peak_idx = np.argmax(band_psd)
                    features[f'{ch_name}_{band_name}_peak_freq'] = float(band_freqs[peak_idx])
            
            # Cross-band ratios
            alpha_power = features.get(f'{ch_name}_alpha_power', 0)
            theta_power = features.get(f'{ch_name}_theta_power', 0)
            beta_power = features.get(f'{ch_name}_beta_power', 0)
            
            features[f'{ch_name}_alpha_theta_ratio'] = float(alpha_power / (theta_power + 1e-10))
            features[f'{ch_name}_beta_alpha_ratio'] = float(beta_power / (alpha_power + 1e-10))
            features[f'{ch_name}_total_power'] = float(total_power)
        
        # ==================================================================
        # 2. REGIONAL FEATURES
        # ==================================================================
        for region_name, ch_indices in self.region_indices.items():
            if not ch_indices:
                continue
            
            region_psd = np.mean(psd_all[:, ch_indices], axis=1)
            total_power = np.sum(region_psd) + 1e-12
            
            for band_name, (low, high) in self.bands.items():
                mask = (freqs >= low) & (freqs <= high)
                band_power = np.sum(region_psd[mask])
                
                features[f'{region_name}_{band_name}_power'] = float(band_power)
                features[f'{region_name}_{band_name}_relative'] = float(band_power / total_power)
            
            alpha = features.get(f'{region_name}_alpha_power', 0)
            theta = features.get(f'{region_name}_theta_power', 0)
            beta = features.get(f'{region_name}_beta_power', 0)
            
            features[f'{region_name}_alpha_theta_ratio'] = float(alpha / (theta + 1e-10))
            features[f'{region_name}_beta_alpha_ratio'] = float(beta / (alpha + 1e-10))
            features[f'{region_name}_total_power'] = float(total_power)
        
        # ==================================================================
        # 3. SPATIAL FEATURES
        # ==================================================================
        # Asymmetry
        for left_name, right_name, left_idx, right_idx in self.asymmetry_indices:
            left_psd = psd_all[:, left_idx]
            right_psd = psd_all[:, right_idx]
            
            for band_name, (low, high) in self.bands.items():
                mask = (freqs >= low) & (freqs <= high)
                left_power = np.sum(left_psd[mask]) + 1e-12
                right_power = np.sum(right_psd[mask]) + 1e-12
                
                asym = np.log(right_power) - np.log(left_power)
                features[f'asym_{left_name}_{right_name}_{band_name}'] = float(asym)
        
        # Frontal Alpha Asymmetry
        if 'F3' in self.channel_index and 'F4' in self.channel_index:
            f3_idx = self.channel_index['F3']
            f4_idx = self.channel_index['F4']
            alpha_mask = (freqs >= 8) & (freqs <= 13)
            f3_alpha = np.sum(psd_all[alpha_mask, f3_idx]) + 1e-12
            f4_alpha = np.sum(psd_all[alpha_mask, f4_idx]) + 1e-12
            features['frontal_alpha_asymmetry'] = float(np.log(f4_alpha) - np.log(f3_alpha))
        
        # Inter-regional coherence
        region_pairs = [
            ('frontal', 'parietal'),
            ('frontal', 'occipital'),
            ('central', 'parietal'),
            ('temporal', 'parietal'),
            ('frontal', 'temporal')
        ]
        
        for region1, region2 in region_pairs:
            if region1 in self.region_indices and region2 in self.region_indices:
                idx1 = self.region_indices[region1][0]
                idx2 = self.region_indices[region2][0]
                
                try:
                    f_coh, coh = signal.coherence(
                        mc_data[:, idx1], mc_data[:, idx2],
                        fs=self.fs, nperseg=min(n_samples, 128)
                    )
                    
                    for band_name, (low, high) in self.bands.items():
                        mask = (f_coh >= low) & (f_coh <= high)
                        if np.any(mask):
                            mean_coh = np.mean(coh[mask])
                            features[f'coh_{region1}_{region2}_{band_name}'] = float(mean_coh)
                except:
                    pass
        
        # Global Field Power
        gfp = np.std(mc_data, axis=1)
        features['gfp_mean'] = float(np.mean(gfp))
        features['gfp_std'] = float(np.std(gfp))
        features['gfp_max'] = float(np.max(gfp))
        
        # ==================================================================
        # 4. GLOBAL FEATURES
        # ==================================================================
        global_psd = np.mean(psd_all, axis=1)
        global_total = np.sum(global_psd) + 1e-12
        
        for band_name, (low, high) in self.bands.items():
            mask = (freqs >= low) & (freqs <= high)
            band_power = np.sum(global_psd[mask])
            features[f'global_{band_name}_power'] = float(band_power)
            features[f'global_{band_name}_relative'] = float(band_power / global_total)
        
        features['global_total_power'] = float(global_total)
        features['global_alpha_theta_ratio'] = float(
            features.get('global_alpha_power', 0) / (features.get('global_theta_power', 1e-10) + 1e-10)
        )
        features['global_beta_alpha_ratio'] = float(
            features.get('global_beta_power', 0) / (features.get('global_alpha_power', 1e-10) + 1e-10)
        )
        
        features['n_good_channels'] = int(n_channels)
        features['n_features_extracted'] = len(features)
        
        return features
    
    def compute_baseline_statistics(self):
        """Compute baseline statistics from eyes-closed data."""
        ec_features = self.calibration_data['eyes_closed']['features']
        if not ec_features:
            print("[OFFLINE ENGINE] No eyes-closed features for baseline")
            return False
        
        df = pd.DataFrame(ec_features)
        self.baseline_stats = {}
        
        for col in df.columns:
            values = df[col].dropna().values
            if len(values) > 0:
                self.baseline_stats[col] = {
                    'mean': float(np.mean(values)),
                    'std': float(np.std(values) + 1e-12),
                    'median': float(np.median(values))
                }
        
        print(f"[OFFLINE ENGINE] Baseline computed from {len(ec_features)} windows")
        print(f"[OFFLINE ENGINE] Total features in baseline: {len(self.baseline_stats)}")
        return True
    
    def save_phase_markers(self):
        """Save phase markers to a JSON file."""
        import json
        # Include user email in markers filename
        email_safe = self.user_email.replace('@', '_').replace('.', '_')
        markers_file = os.path.join(self.save_dir, f"markers_{self.session_id}_{email_safe}.json")
        
        with open(markers_file, 'w') as f:
            json.dump({
                'session_id': self.session_id,
                'user_email': self.user_email,
                'sample_rate': self.fs,
                'channel_count': self.channel_count,
                'channel_names': self.channel_names,
                'recording_file': self.session_file,
                'phase_markers': self.phase_markers
            }, f, indent=2)
        
        print(f"[OFFLINE ENGINE] Phase markers saved: {markers_file}")
        return markers_file
    
    def export_features_to_excel(self, output_file: str = None):
        """Export extracted features to Excel file."""
        if output_file is None:
            # Include user email in features filename
            email_safe = self.user_email.replace('@', '_').replace('.', '_')
            output_file = os.path.join(self.save_dir, f"features_{self.session_id}_{email_safe}.xlsx")
        
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            # Eyes closed features
            if self.calibration_data['eyes_closed']['features']:
                df_ec = pd.DataFrame(self.calibration_data['eyes_closed']['features'])
                df_ec.to_excel(writer, sheet_name='Eyes_Closed', index=False)
            
            # Eyes open features
            if self.calibration_data['eyes_open']['features']:
                df_eo = pd.DataFrame(self.calibration_data['eyes_open']['features'])
                df_eo.to_excel(writer, sheet_name='Eyes_Open', index=False)
            
            # Task features
            if self.calibration_data['task']['features']:
                df_task = pd.DataFrame(self.calibration_data['task']['features'])
                df_task.to_excel(writer, sheet_name='Task', index=False)
            
            # Baseline statistics
            if self.baseline_stats:
                df_baseline = pd.DataFrame(self.baseline_stats).T
                df_baseline.to_excel(writer, sheet_name='Baseline_Stats')
        
        print(f"[OFFLINE ENGINE] Features exported: {output_file}")
        return output_file


def create_offline_engine(sample_rate: int = 500, channel_count: int = 64, user_email: str = None, **kwargs) -> OfflineMultichannelEngine:
    """Factory function to create an OfflineMultichannelEngine.
    
    Args:
        sample_rate: Sampling rate in Hz
        channel_count: Number of EEG channels
        user_email: User's email for filename identification
        **kwargs: Additional arguments for OfflineMultichannelEngine
    
    Returns:
        Configured OfflineMultichannelEngine instance
    """
    return OfflineMultichannelEngine(
        sample_rate=sample_rate,
        channel_count=channel_count,
        user_email=user_email,
        **kwargs
    )
