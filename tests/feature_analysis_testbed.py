#!/usr/bin/env python3
"""
Feature Analysis Test Bed for EEG Signal Processing
Implements power analysis, band-pass filtering, calibration, and histogram strategy
for local EEG feature extraction and analysis.
Includes BrainLink device connectivity for real-time data collection.
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy.signal import hilbert, butter, filtfilt, iirnotch
from scipy.stats import zscore, norm
import pandas as pd
from collections import deque
import time
from datetime import datetime
import json
import os
import sys
import threading
import serial.tools.list_ports
from cushy_serial import CushySerial
import requests
import platform
import ssl

# Import BrainLink parser
try:
    from BrainLinkParser.BrainLinkParser import BrainLinkParser
except ImportError:
    print("BrainLinkParser not available. Some functionality will be limited.")
    class BrainLinkParser:
        def __init__(self, *args, **kwargs):
            print("Using dummy BrainLinkParser for testing")
        def parse(self, *args, **kwargs):
            pass

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

class FeatureAnalyzer:
    """
    Comprehensive feature analysis system for EEG signals with calibration
    and histogram-based classification.
    """
    
    def __init__(self, fs=512, window_size=1.0, overlap=0.5, use_real_device=False):
        """
        Initialize the feature analyzer.
        
        Args:
            fs (int): Sampling frequency in Hz
            window_size (float): Analysis window size in seconds
            overlap (float): Overlap between windows (0-1)
            use_real_device (bool): Whether to connect to actual BrainLink device
        """
        self.fs = fs
        self.window_size = window_size
        self.overlap = overlap
        self.window_samples = int(window_size * fs)
        self.overlap_samples = int(overlap * self.window_samples)
        self.step_samples = self.window_samples - self.overlap_samples
        
        # Device connection settings
        self.use_real_device = use_real_device
        self.serial_port = None
        self.serial_obj = None
        self.parser = None
        self.stop_thread_flag = False
        self.brainlink_thread = None
        
        # Authentication settings
        self.jwt_token = None
        self.backend_url = None
        self.login_url = None
        self.environment = None
        self.username = None
        self.password = None
        
        # Real-time data from BrainLink
        self.live_data_buffer = deque(maxlen=fs * 10)  # 10 seconds of live data
        self.device_connected = False
        self.authenticated = False
        self.battery_level = 0
        self.attention_level = 0
        self.meditation_level = 0
        
        # EEG frequency bands
        self.bands = {
            'delta': (0.5, 4),
            'theta': (4, 8),
            'alpha': (8, 12),
            'beta': (12, 30),
            'gamma': (30, 45)
        }
        
        # Power analysis parameters
        self.smoothing_alpha = 0.2  # Exponential moving average alpha
        self.rms_window = 0.1  # RMS window size in seconds
        self.rms_samples = int(self.rms_window * fs)
        
        # Data buffers
        self.raw_buffer = deque(maxlen=fs * 10)  # 10 seconds of raw data
        self.filtered_buffers = {band: deque(maxlen=fs * 10) for band in self.bands}
        self.power_buffers = {band: deque(maxlen=fs * 10) for band in self.bands}
        self.smoothed_power = {band: deque(maxlen=fs * 10) for band in self.bands}
        
        # Calibration data storage
        self.calibration_data = {
            'eyes_closed': {'features': [], 'timestamps': []},
            'eyes_open': {'features': [], 'timestamps': []},
            'task': {'features': [], 'timestamps': []}
        }
        
        # Available tasks for user engagement
        self.available_tasks = {
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
        
        # Current task information
        self.current_task = None
        self.task_start_time = None
        
        # Baseline statistics
        self.baseline_stats = {}
        self.baseline_histograms = {}
        
        # Current state
        self.current_state = 'idle'  # idle, eyes_closed, eyes_open, task
        self.state_start_time = None
        
        # Feature extraction settings
        self.feature_names = [
            'delta_power', 'theta_power', 'alpha_power', 'beta_power', 'gamma_power',
            'delta_peak_freq', 'theta_peak_freq', 'alpha_peak_freq', 'beta_peak_freq', 'gamma_peak_freq',
            'delta_peak_amp', 'theta_peak_amp', 'alpha_peak_amp', 'beta_peak_amp', 'gamma_peak_amp',
            'delta_snr', 'theta_snr', 'alpha_snr', 'beta_snr', 'gamma_snr',
            'alpha_theta_ratio', 'beta_alpha_ratio', 'total_power'
        ]
        
        print(f"Feature Analyzer initialized with {fs}Hz sampling, {window_size}s windows")
    
    def bandpass_filter(self, data, band, order=4):
        """
        Apply zero-phase IIR bandpass filter to isolate frequency band.
        
        Args:
            data (array): Input signal
            band (tuple): (low_freq, high_freq) in Hz
            order (int): Filter order
            
        Returns:
            array: Filtered signal
        """
        if len(data) < 2 * order:
            return np.zeros_like(data)
            
        low, high = band
        nyquist = self.fs / 2
        
        # Ensure frequencies are within valid range
        low = max(0.1, min(low, nyquist - 0.1))
        high = max(low + 0.1, min(high, nyquist - 0.1))
        
        try:
            # Design Butterworth bandpass filter
            b, a = butter(order, [low / nyquist, high / nyquist], btype='band')
            
            # Apply zero-phase filtering
            filtered = filtfilt(b, a, data)
            return filtered
        except Exception as e:
            print(f"Filter error for band {band}: {e}")
            return np.zeros_like(data)
    
    def compute_instantaneous_power(self, signal, method='square'):
        """
        Compute instantaneous power using squaring or Hilbert transform.
        
        Args:
            signal (array): Input signal
            method (str): 'square' or 'hilbert'
            
        Returns:
            array: Power envelope
        """
        if method == 'square':
            return signal ** 2
        elif method == 'hilbert':
            try:
                analytic_signal = hilbert(signal)
                return np.abs(analytic_signal) ** 2
            except:
                return signal ** 2
        else:
            raise ValueError("Method must be 'square' or 'hilbert'")
    
    def smooth_power(self, power, method='ema', alpha=None):
        """
        Apply smoothing to power envelope.
        
        Args:
            power (array): Input power signal
            method (str): 'ema' (exponential moving average) or 'rms'
            alpha (float): Smoothing factor for EMA
            
        Returns:
            array: Smoothed power envelope
        """
        if alpha is None:
            alpha = self.smoothing_alpha
            
        if method == 'ema':
            # Exponential moving average
            smoothed = np.zeros_like(power)
            smoothed[0] = power[0]
            
            for i in range(1, len(power)):
                smoothed[i] = alpha * power[i] + (1 - alpha) * smoothed[i-1]
            
            return smoothed
            
        elif method == 'rms':
            # RMS windowed smoothing
            smoothed = np.zeros_like(power)
            half_window = self.rms_samples // 2
            
            for i in range(len(power)):
                start = max(0, i - half_window)
                end = min(len(power), i + half_window + 1)
                smoothed[i] = np.sqrt(np.mean(power[start:end]))
            
            return smoothed
    
    def extract_features(self, window_data):
        """
        Extract comprehensive features from a window of EEG data.
        
        Args:
            window_data (array): Window of raw EEG data
            
        Returns:
            dict: Dictionary of extracted features
        """
        features = {}
        
        # Remove DC component
        window_data = window_data - np.mean(window_data)
        
        # Apply notch filter for line noise
        try:
            window_data = self.notch_filter(window_data, 50.0)  # 50Hz for Europe
        except:
            pass
        
        band_powers = {}
        band_psds = {}
        
        # Process each frequency band
        for band_name, (low, high) in self.bands.items():
            # Bandpass filter
            filtered = self.bandpass_filter(window_data, (low, high))
            
            # Compute power
            power = self.compute_instantaneous_power(filtered, method='square')
            smoothed_power = self.smooth_power(power, method='ema')
            
            # Band power (mean of smoothed power)
            band_power = np.mean(smoothed_power)
            band_powers[band_name] = band_power
            features[f'{band_name}_power'] = band_power
            
            # Compute PSD for peak analysis
            from scipy.signal import welch
            freqs, psd = welch(filtered, fs=self.fs, nperseg=min(256, len(filtered)//2))
            
            # Find peak frequency and amplitude in band
            band_mask = (freqs >= low) & (freqs <= high)
            if np.any(band_mask):
                band_freqs = freqs[band_mask]
                band_psd = psd[band_mask]
                
                if len(band_psd) > 0:
                    peak_idx = np.argmax(band_psd)
                    peak_freq = band_freqs[peak_idx]
                    peak_amp = band_psd[peak_idx]
                    
                    features[f'{band_name}_peak_freq'] = peak_freq
                    features[f'{band_name}_peak_amp'] = peak_amp
                    
                    # Compute SNR (signal in band vs total power)
                    total_power = np.sum(psd)
                    snr = band_power / (total_power - band_power + 1e-10)
                    features[f'{band_name}_snr'] = snr
                    
                    band_psds[band_name] = (band_freqs, band_psd)
                else:
                    features[f'{band_name}_peak_freq'] = low + (high - low) / 2
                    features[f'{band_name}_peak_amp'] = 0
                    features[f'{band_name}_snr'] = 0
            else:
                features[f'{band_name}_peak_freq'] = low + (high - low) / 2
                features[f'{band_name}_peak_amp'] = 0
                features[f'{band_name}_snr'] = 0
        
        # Compute ratios
        features['alpha_theta_ratio'] = band_powers.get('alpha', 0) / (band_powers.get('theta', 0) + 1e-10)
        features['beta_alpha_ratio'] = band_powers.get('beta', 0) / (band_powers.get('alpha', 0) + 1e-10)
        
        # Total power
        features['total_power'] = sum(band_powers.values())
        
        return features
    
    def notch_filter(self, data, freq, quality_factor=30.0):
        """Apply notch filter to remove line noise."""
        nyquist = self.fs / 2
        b, a = iirnotch(freq / nyquist, quality_factor)
        return filtfilt(b, a, data)
    
    def add_data(self, new_data):
        """
        Add new EEG data and process it through the analysis pipeline.
        
        Args:
            new_data (array or float): New EEG sample(s)
        """
        # Convert to numpy array if needed
        if np.isscalar(new_data):
            new_data = np.array([new_data])
        else:
            new_data = np.array(new_data)
        
        # Add to raw buffer
        self.raw_buffer.extend(new_data)
        
        # Process if we have enough data for a window
        if len(self.raw_buffer) >= self.window_samples:
            # Extract window
            window_data = np.array(list(self.raw_buffer)[-self.window_samples:])
            
            # Extract features
            features = self.extract_features(window_data)
            
            # Store features based on current state
            if self.current_state in ['eyes_closed', 'eyes_open', 'task']:
                self.calibration_data[self.current_state]['features'].append(features)
                self.calibration_data[self.current_state]['timestamps'].append(time.time())
            
            # Process band-specific data
            for band_name, (low, high) in self.bands.items():
                filtered = self.bandpass_filter(window_data, (low, high))
                power = self.compute_instantaneous_power(filtered)
                smoothed = self.smooth_power(power)
                
                # Store in buffers
                self.filtered_buffers[band_name].extend(filtered)
                self.power_buffers[band_name].extend(power)
                self.smoothed_power[band_name].extend(smoothed)
            
            return features
        
        return None
    
    def start_calibration_phase(self, phase_name, task_type=None):
        """
        Start a calibration phase (eyes_closed, eyes_open, or task).
        
        Args:
            phase_name (str): Name of the calibration phase
            task_type (str): Type of task for 'task' phase (optional)
        """
        if phase_name not in ['eyes_closed', 'eyes_open', 'task']:
            raise ValueError("Phase must be 'eyes_closed', 'eyes_open', or 'task'")
        
        self.current_state = phase_name
        self.state_start_time = time.time()
        
        # Clear existing data for this phase
        self.calibration_data[phase_name]['features'] = []
        self.calibration_data[phase_name]['timestamps'] = []
        
        # Handle task-specific setup
        if phase_name == 'task':
            if task_type and task_type in self.available_tasks:
                self.current_task = task_type
                task_info = self.available_tasks[task_type]
                print(f"Started calibration phase: {phase_name} - {task_info['name']}")
                print(f"Task Instructions: {task_info['instructions']}")
                print(f"Recommended duration: {task_info['duration']} seconds")
            else:
                self.current_task = None
                print(f"Started calibration phase: {phase_name} (no specific task)")
                print("Available tasks:", list(self.available_tasks.keys()))
        else:
            print(f"Started calibration phase: {phase_name}")
            
        # Provide phase-specific instructions
        if phase_name == 'eyes_closed':
            print("Instructions: Close your eyes and relax. Try to clear your mind.")
        elif phase_name == 'eyes_open':
            print("Instructions: Keep your eyes open but relaxed. Look at a fixed point.")
    
    def list_available_tasks(self):
        """List all available tasks with descriptions."""
        print("\n=== Available Tasks ===")
        for task_id, task_info in self.available_tasks.items():
            print(f"{task_id}: {task_info['name']}")
            print(f"  Description: {task_info['description']}")
            print(f"  Instructions: {task_info['instructions']}")
            print(f"  Duration: {task_info['duration']}s")
            print()
    
    def get_task_instructions(self, task_type):
        """Get instructions for a specific task."""
        if task_type in self.available_tasks:
            return self.available_tasks[task_type]['instructions']
        return "No instructions available for this task."
    
    def stop_calibration_phase(self):
        """Stop the current calibration phase."""
        if self.current_state != 'idle':
            duration = time.time() - self.state_start_time
            num_features = len(self.calibration_data[self.current_state]['features'])
            
            phase_info = f"Stopped calibration phase: {self.current_state}"
            if self.current_state == 'task' and self.current_task:
                task_name = self.available_tasks[self.current_task]['name']
                phase_info += f" - {task_name}"
            
            print(phase_info)
            print(f"Duration: {duration:.1f}s, Features collected: {num_features}")
            
            # Reset task info
            if self.current_state == 'task':
                self.current_task = None
                self.task_start_time = None
            
            self.current_state = 'idle'
            self.state_start_time = None
    
    def compute_baseline_statistics(self):
        """
        Compute baseline statistics from eyes_closed and eyes_open data.
        """
        print("Computing baseline statistics...")
        
        # Combine eyes_closed and eyes_open data for baseline
        baseline_features = []
        baseline_features.extend(self.calibration_data['eyes_closed']['features'])
        baseline_features.extend(self.calibration_data['eyes_open']['features'])
        
        if len(baseline_features) == 0:
            print("No baseline data available!")
            return
        
        # Convert to DataFrame for easier analysis
        df = pd.DataFrame(baseline_features)
        
        # Compute statistics for each feature
        self.baseline_stats = {}
        self.baseline_histograms = {}
        
        for feature in self.feature_names:
            if feature in df.columns:
                values = df[feature].values
                
                # Basic statistics
                self.baseline_stats[feature] = {
                    'mean': np.mean(values),
                    'std': np.std(values),
                    'min': np.min(values),
                    'max': np.max(values),
                    'median': np.median(values),
                    'q25': np.percentile(values, 25),
                    'q75': np.percentile(values, 75)
                }
                
                # Create histogram
                hist, bin_edges = np.histogram(values, bins=30, density=True)
                self.baseline_histograms[feature] = {
                    'hist': hist,
                    'bin_edges': bin_edges,
                    'bin_centers': (bin_edges[:-1] + bin_edges[1:]) / 2
                }
        
        print(f"Baseline statistics computed for {len(self.baseline_stats)} features")
        print(f"Total baseline windows: {len(baseline_features)}")
    
    def analyze_task_data(self):
        """
        Analyze task data against baseline statistics.
        """
        if not self.baseline_stats:
            print("No baseline statistics available! Run compute_baseline_statistics() first.")
            return
        
        task_features = self.calibration_data['task']['features']
        if len(task_features) == 0:
            print("No task data available!")
            return
        
        print(f"Analyzing {len(task_features)} task windows against baseline...")
        
        # Convert to DataFrame
        task_df = pd.DataFrame(task_features)
        
        analysis_results = {}
        
        for feature in self.feature_names:
            if feature in task_df.columns and feature in self.baseline_stats:
                task_values = task_df[feature].values
                baseline_mean = self.baseline_stats[feature]['mean']
                baseline_std = self.baseline_stats[feature]['std']
                
                # Compute z-scores
                z_scores = (task_values - baseline_mean) / (baseline_std + 1e-10)
                
                # Detect outliers (outside μ ± 2σ)
                outliers = np.abs(z_scores) > 2
                
                # Compute percentiles relative to baseline
                percentiles = []
                for value in task_values:
                    # Use baseline distribution to compute percentile
                    baseline_values = []
                    for phase in ['eyes_closed', 'eyes_open']:
                        phase_features = self.calibration_data[phase]['features']
                        for feat_dict in phase_features:
                            if feature in feat_dict:
                                baseline_values.append(feat_dict[feature])
                    
                    if baseline_values:
                        percentile = (np.sum(np.array(baseline_values) <= value) / len(baseline_values)) * 100
                        percentiles.append(percentile)
                    else:
                        percentiles.append(50)  # Default to median
                
                analysis_results[feature] = {
                    'task_mean': np.mean(task_values),
                    'task_std': np.std(task_values),
                    'baseline_mean': baseline_mean,
                    'baseline_std': baseline_std,
                    'z_scores': z_scores,
                    'outliers': outliers,
                    'outlier_percentage': np.sum(outliers) / len(outliers) * 100,
                    'percentiles': percentiles,
                    'mean_percentile': np.mean(percentiles)
                }
        
        self.analysis_results = analysis_results
        return analysis_results
    
    def plot_feature_analysis(self, feature_name, save_path=None):
        """
        Create visualization of feature analysis including histogram and task overlay.
        
        Args:
            feature_name (str): Name of feature to plot
            save_path (str): Optional path to save the plot
        """
        if feature_name not in self.baseline_histograms:
            print(f"No baseline data for feature: {feature_name}")
            return
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
        
        # Plot 1: Histogram with task overlay
        hist_data = self.baseline_histograms[feature_name]
        ax1.bar(hist_data['bin_centers'], hist_data['hist'], 
                width=np.diff(hist_data['bin_edges'])[0], 
                alpha=0.7, label='Baseline (Eyes Closed + Open)', color='blue')
        
        # Overlay task data
        task_features = self.calibration_data['task']['features']
        if task_features:
            task_values = [f[feature_name] for f in task_features if feature_name in f]
            if task_values:
                ax1.hist(task_values, bins=20, alpha=0.7, label='Task Data', color='red', density=True)
        
        # Add statistical lines
        stats = self.baseline_stats[feature_name]
        ax1.axvline(stats['mean'], color='blue', linestyle='--', label=f"Baseline μ={stats['mean']:.3f}")
        ax1.axvline(stats['mean'] + 2*stats['std'], color='orange', linestyle=':', label='μ+2σ')
        ax1.axvline(stats['mean'] - 2*stats['std'], color='orange', linestyle=':', label='μ-2σ')
        
        ax1.set_xlabel(f'{feature_name}')
        ax1.set_ylabel('Density')
        ax1.set_title(f'Feature Analysis: {feature_name}')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Plot 2: Time series of task data with z-scores
        if hasattr(self, 'analysis_results') and feature_name in self.analysis_results:
            results = self.analysis_results[feature_name]
            task_timestamps = self.calibration_data['task']['timestamps']
            
            if task_timestamps:
                # Convert to relative time
                start_time = task_timestamps[0]
                rel_times = [(t - start_time) / 60 for t in task_timestamps]  # Convert to minutes
                
                ax2.plot(rel_times, results['z_scores'], 'o-', color='red', label='Z-scores')
                ax2.axhline(2, color='orange', linestyle='--', label='±2σ threshold')
                ax2.axhline(-2, color='orange', linestyle='--')
                ax2.axhline(0, color='black', linestyle='-', alpha=0.3)
                
                # Mark outliers
                outliers = results['outliers']
                if np.any(outliers):
                    outlier_times = [t for i, t in enumerate(rel_times) if outliers[i]]
                    outlier_zscores = [z for i, z in enumerate(results['z_scores']) if outliers[i]]
                    ax2.scatter(outlier_times, outlier_zscores, color='red', s=100, marker='x', label='Outliers')
                
                ax2.set_xlabel('Time (minutes)')
                ax2.set_ylabel('Z-score')
                ax2.set_title(f'Task Z-scores: {feature_name}')
                ax2.legend()
                ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"Plot saved to: {save_path}")
        
        plt.show()
    
    def generate_report(self, save_path=None):
        """
        Generate a comprehensive analysis report.
        
        Args:
            save_path (str): Optional path to save the report
        """
        report = {
            'timestamp': datetime.now().isoformat(),
            'configuration': {
                'sampling_rate': self.fs,
                'window_size': self.window_size,
                'overlap': self.overlap,
                'smoothing_alpha': self.smoothing_alpha,
                'frequency_bands': self.bands
            },
            'tasks': {
                'available_tasks': self.available_tasks,
                'current_task': self.current_task
            },
            'data_collection': {
                'eyes_closed_windows': len(self.calibration_data['eyes_closed']['features']),
                'eyes_open_windows': len(self.calibration_data['eyes_open']['features']),
                'task_windows': len(self.calibration_data['task']['features'])
            },
            'baseline_statistics': self.baseline_stats,
            'analysis_results': getattr(self, 'analysis_results', {})
        }
        
        # Add task-specific information
        if self.current_task:
            report['task_info'] = {
                'task_type': self.current_task,
                'task_name': self.available_tasks[self.current_task]['name'],
                'task_description': self.available_tasks[self.current_task]['description'],
                'instructions': self.available_tasks[self.current_task]['instructions']
            }
        
        # Add summary statistics
        if hasattr(self, 'analysis_results'):
            summary = {}
            for feature, results in self.analysis_results.items():
                summary[feature] = {
                    'outlier_percentage': results['outlier_percentage'],
                    'mean_percentile': results['mean_percentile'],
                    'significant_change': abs(results['task_mean'] - results['baseline_mean']) > 2 * results['baseline_std']
                }
            report['summary'] = summary
        
        if save_path:
            with open(save_path, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            print(f"Report saved to: {save_path}")
        
        return report
    
    def get_real_time_features(self):
        """
        Get the most recent features for real-time monitoring.
        
        Returns:
            dict: Latest feature values
        """
        if len(self.raw_buffer) >= self.window_samples:
            window_data = np.array(list(self.raw_buffer)[-self.window_samples:])
            return self.extract_features(window_data)
        return {}
    
    def print_status(self):
        """Print current status of the analyzer."""
        print("\n=== Feature Analyzer Status ===")
        print(f"Device mode: {'Real BrainLink' if self.use_real_device else 'Simulation'}")
        
        if self.use_real_device:
            status = self.get_device_status()
            print(f"Device connected: {status['connected']}")
            if status['connected']:
                print(f"Port: {status['port']}")
                print(f"Battery: {status['battery']}%")
                print(f"Attention: {status['attention']}")
                print(f"Meditation: {status['meditation']}")
                print(f"Live buffer: {status['live_buffer_size']} samples")
        
        print(f"Current state: {self.current_state}")
        if self.current_state == 'task' and self.current_task:
            task_name = self.available_tasks[self.current_task]['name']
            print(f"Current task: {task_name}")
        print(f"Buffer size: {len(self.raw_buffer)}/{self.raw_buffer.maxlen}")
        print(f"Window size: {self.window_samples} samples ({self.window_size}s)")
        
        for phase in ['eyes_closed', 'eyes_open', 'task']:
            count = len(self.calibration_data[phase]['features'])
            print(f"{phase}: {count} windows")
        
        if self.baseline_stats:
            print(f"Baseline statistics: {len(self.baseline_stats)} features")
        
        if hasattr(self, 'analysis_results'):
            print(f"Analysis results: {len(self.analysis_results)} features")
        
        print(f"Available tasks: {len(self.available_tasks)}")
        print("===============================\n")
    
    def detect_brainlink(self):
        """
        Detect BrainLink device port.
        
        Returns:
            str: Port name if found, None otherwise
        """
        ports = serial.tools.list_ports.comports()
        brainlink_port = None

        BRAINLINK_SERIALS = ("5C361634682F", "5C3616327E59", "5C3616346938")

        for port in ports:
            # Check both serial_number and HWID for a match
            if (
                getattr(port, "serial_number", None) in BRAINLINK_SERIALS
                or any(sn in getattr(port, "hwid", "") for sn in BRAINLINK_SERIALS)
            ):
                brainlink_port = port.device
                break

        # Fallback: try by description or device name if not found
        if not brainlink_port:
            for port in ports:
                if any(id in port.description.lower() for id in ["BrainLink_Pro", "neurosky", "ftdi", "silabs", "ch340"]):
                    brainlink_port = port.device
                    break
                if port.device.startswith(("/dev/tty.usbserial", "/dev/tty.usbmodem")):
                    brainlink_port = port.device
                    break

        return brainlink_port
    
    def connect_to_brainlink(self):
        """
        Connect to BrainLink device.
        
        Returns:
            bool: True if connected successfully, False otherwise
        """
        if not self.use_real_device:
            print("Real device connection disabled. Use use_real_device=True to enable.")
            return False
            
        self.serial_port = self.detect_brainlink()
        
        if not self.serial_port:
            print("BrainLink device not found!")
            return False
            
        try:
            self.serial_obj = CushySerial(self.serial_port, 115200)
            
            # Set up BrainLink parser with callbacks
            self.parser = BrainLinkParser(
                self._on_eeg, 
                self._on_extended_eeg, 
                self._on_gyro, 
                self._on_rr, 
                self._on_raw
            )
            
            @self.serial_obj.on_message()
            def handle_serial_message(msg: bytes):
                self.parser.parse(msg)
            
            self.serial_obj.open()
            self.device_connected = True
            print(f"Connected to BrainLink device on {self.serial_port}")
            
            # Start BrainLink thread
            self.stop_thread_flag = False
            self.brainlink_thread = threading.Thread(target=self._run_brainlink_thread)
            self.brainlink_thread.daemon = True
            self.brainlink_thread.start()
            
            return True
            
        except Exception as e:
            print(f"Failed to connect to BrainLink device: {e}")
            return False
    
    def disconnect_from_brainlink(self):
        """Disconnect from BrainLink device."""
        if self.device_connected:
            self.stop_thread_flag = True
            if self.brainlink_thread:
                self.brainlink_thread.join(timeout=2)
            
            if self.serial_obj:
                try:
                    self.serial_obj.close()
                except:
                    pass
                
            self.device_connected = False
            print("Disconnected from BrainLink device")
    
    def _run_brainlink_thread(self):
        """Run BrainLink data collection in background thread."""
        try:
            while not self.stop_thread_flag:
                time.sleep(0.1)  # Small delay to prevent CPU overload
        except Exception as e:
            print(f"BrainLink thread error: {e}")
    
    def _on_raw(self, raw):
        """Handle raw EEG data from BrainLink."""
        self.live_data_buffer.append(raw)
        # Also add to main processing buffer
        self.add_data(raw)
    
    def _on_eeg(self, data):
        """Handle EEG data from BrainLink."""
        self.attention_level = getattr(data, 'attention', 0)
        self.meditation_level = getattr(data, 'meditation', 0)
        print(f"EEG -> attention: {self.attention_level}, meditation: {self.meditation_level}")
    
    def _on_extended_eeg(self, data):
        """Handle extended EEG data from BrainLink."""
        self.battery_level = getattr(data, 'battery', 0)
        print(f"Extended EEG -> battery: {self.battery_level}%, version: {getattr(data, 'version', 'N/A')}")
    
    def _on_gyro(self, x, y, z):
        """Handle gyro data from BrainLink."""
        print(f"Gyro -> x={x}, y={y}, z={z}")
    
    def _on_rr(self, rr1, rr2, rr3):
        """Handle RR data from BrainLink."""
        print(f"RR -> rr1={rr1}, rr2={rr2}, rr3={rr3}")
    
    def get_device_status(self):
        """
        Get current device status.
        
        Returns:
            dict: Device status information
        """
        return {
            'connected': self.device_connected,
            'port': self.serial_port,
            'battery': self.battery_level,
            'attention': self.attention_level,
            'meditation': self.meditation_level,
            'live_buffer_size': len(self.live_data_buffer)
        }
    
    def cleanup(self):
        """Clean up resources and close connections."""
        if self.device_connected:
            self.disconnect_from_brainlink()
        print("Cleanup completed.")
    
    def __del__(self):
        """Destructor to ensure proper cleanup."""
        try:
            self.cleanup()
        except:
            pass
    
    def authenticate_user(self, username, password, environment="en"):
        """
        Authenticate user with the BrainLink backend.
        
        Args:
            username (str): Username for authentication
            password (str): Password for authentication
            environment (str): Environment to use ('en', 'nl', 'local')
            
        Returns:
            bool: True if authentication successful, False otherwise
        """
        if environment not in BACKEND_URLS:
            print(f"Invalid environment: {environment}")
            return False
            
        self.environment = environment
        self.backend_url = BACKEND_URLS[environment]
        self.login_url = LOGIN_URLS[environment]
        self.username = username
        self.password = password
        
        print(f"Authenticating with {environment} environment...")
        print(f"Login URL: {self.login_url}")
        
        login_payload = {
            "username": username,
            "password": password
        }
        
        try:
            # First try with certificate verification
            print("Attempting login with SSL verification...")
            try:
                login_response = requests.post(
                    self.login_url, 
                    json=login_payload,
                    headers={"Content-Type": "application/json"},
                    timeout=5,
                    verify=True
                )
            except requests.exceptions.ProxyError as e:
                print(f"Proxy error: {str(e)}. Retrying without proxy...")
                # Create a direct session without proxy
                direct_session = requests.Session()
                direct_session.proxies = {}
                login_response = direct_session.post(
                    self.login_url, 
                    json=login_payload,
                    headers={"Content-Type": "application/json"},
                    timeout=5,
                    verify=True
                )
            
            if login_response.status_code == 200:
                data = login_response.json()
                self.jwt_token = data.get("x-jwt-access-token")
                if self.jwt_token:
                    print("Login successful. JWT token obtained.")
                    self.authenticated = True
                    return True
                else:
                    print("Login response didn't contain expected token.")
                    print(f"Response: {data}")
                    return False
            else:
                # Try without certificate verification
                print(f"First login attempt failed with status {login_response.status_code}.")
                print("Trying without SSL verification...")
                login_response = requests.post(
                    self.login_url, 
                    json=login_payload,
                    headers={"Content-Type": "application/json"},
                    timeout=5,
                    verify=False
                )
                
                if login_response.status_code == 200:
                    data = login_response.json()
                    self.jwt_token = data.get("x-jwt-access-token")
                    if self.jwt_token:
                        print("Login successful (without SSL verification). JWT token obtained.")
                        self.authenticated = True
                        return True
                    else:
                        print("Login response didn't contain expected token.")
                        return False
                else:
                    # Try with form data format
                    print("Trying with alternate payload format...")
                    login_response = requests.post(
                        self.login_url,
                        data=login_payload,
                        timeout=5,
                        verify=False
                    )
                    
                    if login_response.status_code == 200:
                        data = login_response.json()
                        self.jwt_token = data.get("x-jwt-access-token")
                        if self.jwt_token:
                            print("Login successful with alternate format. JWT token obtained.")
                            self.authenticated = True
                            return True
                        else:
                            print("Login response didn't contain expected token.")
                            return False
                    else:
                        print(f"All login attempts failed. Status: {login_response.status_code}")
                        if hasattr(login_response, 'text'):
                            print(f"Response: {login_response.text}")
                        return False
                        
        except requests.exceptions.SSLError as e:
            print(f"SSL Error: {str(e)}")
            return False
        except requests.exceptions.ConnectionError as e:
            print(f"Connection Error: {str(e)}")
            return False
        except Exception as e:
            print(f"Login error: {str(e)}")
            return False
    
    def get_authentication_credentials(self):
        """
        Get authentication credentials from user input.
        
        Returns:
            tuple: (username, password, environment) or None if cancelled
        """
        print("\n=== BrainLink Authentication ===")
        print("Available environments:")
        print("1. EN (en.mindspeller.com)")
        print("2. NL (stg-nl.mindspell.be)")
        print("3. Local (127.0.0.1:5000)")
        
        while True:
            try:
                env_choice = input("Choose environment (1-3): ").strip()
                if env_choice == '1':
                    environment = 'en'
                    break
                elif env_choice == '2':
                    environment = 'nl'
                    break
                elif env_choice == '3':
                    environment = 'local'
                    break
                else:
                    print("Invalid choice. Please enter 1, 2, or 3.")
            except KeyboardInterrupt:
                print("\nAuthentication cancelled.")
                return None
        
        try:
            username = input("Username: ").strip()
            if not username:
                print("Username cannot be empty.")
                return None
                
            # Hide password input (simple version - in production use getpass)
            import getpass
            password = getpass.getpass("Password: ")
            if not password:
                print("Password cannot be empty.")
                return None
                
            return username, password, environment
            
        except KeyboardInterrupt:
            print("\nAuthentication cancelled.")
            return None
    
    def upload_data_to_backend(self, data):
        """
        Upload EEG data to the backend server.
        
        Args:
            data (dict): Data to upload
            
        Returns:
            bool: True if upload successful, False otherwise
        """
        if not self.authenticated or not self.jwt_token:
            print("Not authenticated. Cannot upload data.")
            return False
            
        headers = {
            "X-Authorization": f"Bearer {self.jwt_token}",
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(
                self.backend_url,
                json=data,
                headers=headers,
                timeout=10,
                verify=False
            )
            
            if response.status_code == 200:
                print("Data uploaded successfully.")
                return True
            else:
                print(f"Upload failed with status: {response.status_code}")
                if hasattr(response, 'text'):
                    print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"Upload error: {str(e)}")
            return False
    
    def get_authentication_status(self):
        """
        Get current authentication status.
        
        Returns:
            dict: Authentication status information
        """
        return {
            'authenticated': self.authenticated,
            'username': self.username,
            'environment': self.environment,
            'backend_url': self.backend_url,
            'has_jwt_token': self.jwt_token is not None
        }
    

# Example usage and testing
if __name__ == "__main__":
    print("=== Feature Analysis Test Bed ===")
    print("Choose mode:")
    print("1. Simulation mode (synthetic data)")
    print("2. Real BrainLink device mode")
    
    while True:
        try:
            choice = input("Enter choice (1 or 2): ").strip()
            if choice == '1':
                use_real_device = False
                break
            elif choice == '2':
                use_real_device = True
                break
            else:
                print("Invalid choice. Please enter 1 or 2.")
        except KeyboardInterrupt:
            print("\nExiting...")
            sys.exit(0)
    
    # Create analyzer
    analyzer = FeatureAnalyzer(fs=512, window_size=1.0, overlap=0.5, use_real_device=use_real_device)
    
    # Connect to device if in real mode
    if use_real_device:
        print("\nConnecting to BrainLink device...")
        if not analyzer.connect_to_brainlink():
            print("Failed to connect to BrainLink device. Falling back to simulation mode.")
            use_real_device = False
    
    # Show device status
    analyzer.print_status()
    
    if use_real_device:
        print("\n=== Real Device Mode ===")
        print("Make sure the BrainLink device is properly positioned and connected.")
        print("The system will collect real EEG data from the device.")
        print("\nInstructions:")
        print("- Follow the prompts for each calibration phase")
        print("- Press Ctrl+C to stop data collection at any time")
        print("- The system will analyze real brain activity patterns")
        
        try:
            # Show available tasks
            print("\nAvailable tasks:")
            analyzer.list_available_tasks()
            
            # Real-time data collection
            print("\n1. Collecting baseline data...")
            input("Press Enter to start 'eyes closed' baseline recording...")
            analyzer.start_calibration_phase('eyes_closed')
            
            print("Recording eyes closed baseline for 30 seconds...")
            time.sleep(30)
            analyzer.stop_calibration_phase()
            
            input("Press Enter to start 'eyes open' baseline recording...")
            analyzer.start_calibration_phase('eyes_open')
            
            print("Recording eyes open baseline for 30 seconds...")
            time.sleep(30)
            analyzer.stop_calibration_phase()
            
            # Compute baseline statistics
            analyzer.compute_baseline_statistics()
            
            # Task selection
            print("\n2. Task selection...")
            task_choice = input("Enter task type (e.g., 'mental_math', 'visual_imagery'): ").strip()
            if task_choice not in analyzer.available_tasks:
                print(f"Unknown task. Using 'mental_math' as default.")
                task_choice = 'mental_math'
            
            input(f"Press Enter to start '{task_choice}' task recording...")
            analyzer.start_calibration_phase('task', task_choice)
            
            print("Recording task data for 60 seconds...")
            time.sleep(60)
            analyzer.stop_calibration_phase()
            
            # Analyze task data
            print("\n3. Analyzing task data...")
            results = analyzer.analyze_task_data()
            
            # Show final status
            analyzer.print_status()
            
            # Generate report
            print("\n4. Generating report...")
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_filename = f'brainlink_analysis_report_{timestamp}.json'
            report = analyzer.generate_report(report_filename)
            
            print(f"\nReal-time BrainLink analysis complete!")
            print(f"Report saved as: {report_filename}")
            
        except KeyboardInterrupt:
            print("\nStopping data collection...")
        finally:
            analyzer.disconnect_from_brainlink()
    
    else:
        print("\n=== Simulation Mode ===")
        print("Using synthetic EEG data for demonstration.")
        
        # Simulate some EEG data
        def generate_synthetic_eeg(duration, fs, noise_level=0.1):
            """Generate synthetic EEG data for testing."""
            t = np.linspace(0, duration, int(duration * fs))
            
            # Base signal with multiple frequency components
            signal = (
                0.5 * np.sin(2 * np.pi * 6 * t) +    # Theta
                0.3 * np.sin(2 * np.pi * 10 * t) +   # Alpha
                0.2 * np.sin(2 * np.pi * 15 * t) +   # Beta
                0.1 * np.sin(2 * np.pi * 2 * t)      # Delta
            )
            
            # Add noise
            noise = noise_level * np.random.randn(len(t))
            return signal + noise
        
        print("Testing Feature Analysis Test Bed...")
        
        # Show available tasks
        print("\n0. Available tasks:")
        analyzer.list_available_tasks()
        
        # Test baseline collection
        print("\n1. Collecting baseline data...")
        analyzer.start_calibration_phase('eyes_closed')
        
        # Simulate eyes closed data (60 seconds)
        baseline_data = generate_synthetic_eeg(60, 512, noise_level=0.1)
        for sample in baseline_data:
            analyzer.add_data(sample)
        
        analyzer.stop_calibration_phase()
        
        # Eyes open data
        analyzer.start_calibration_phase('eyes_open')
        baseline_data = generate_synthetic_eeg(60, 512, noise_level=0.15)
        for sample in baseline_data:
            analyzer.add_data(sample)
        
        analyzer.stop_calibration_phase()
        
        # Compute baseline statistics
        analyzer.compute_baseline_statistics()
        
        # Test task data collection with specific task
        print("\n2. Collecting task data...")
        analyzer.start_calibration_phase('task', 'mental_math')
        
        # Simulate task data with different characteristics
        task_data = generate_synthetic_eeg(30, 512, noise_level=0.2)
        # Add some beta enhancement to simulate mental math task
        t = np.linspace(0, 30, len(task_data))
        beta_enhancement = 0.4 * np.sin(2 * np.pi * 15 * t)  # Beta band enhancement
        task_data += beta_enhancement
        
        for sample in task_data:
            analyzer.add_data(sample)
        
        analyzer.stop_calibration_phase()
        
        # Analyze task data
        print("\n3. Analyzing task data...")
        results = analyzer.analyze_task_data()
        
        # Print status
        analyzer.print_status()
        
        # Generate report
        print("\n4. Generating report...")
        report = analyzer.generate_report('feature_analysis_report.json')
        
        print("\nFeature Analysis Test Bed demonstration complete!")
        print("Check the generated report for detailed analysis results.")
