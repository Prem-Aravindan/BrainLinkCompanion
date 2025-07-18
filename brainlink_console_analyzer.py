#!/usr/bin/env python3
"""
BrainLink Console Analyzer - Shows processed EEG values in console
No GUI required - pure console output with real-time analysis
"""

import sys, os, time, threading
import serial.tools.list_ports
from cushy_serial import CushySerial
import numpy as np
import platform
from scipy.signal import butter, filtfilt, iirnotch, welch
from scipy.integrate import simpson as simps

# Global flag to track if real BrainLinkParser is available
REAL_BRAINLINK_PARSER = False

try:
    from BrainLinkParser.BrainLinkParser import BrainLinkParser
    REAL_BRAINLINK_PARSER = True
    print("✓ BrainLinkParser successfully imported - using real device data")
except ImportError:
    print("⚠️  BrainLinkParser not available - using dummy data for testing")

# Global variables
SERIAL_PORT = None
SERIAL_BAUD = 115200
stop_thread_flag = False
live_data_buffer = []

# EEG frequency bands
EEG_BANDS = {
    'delta': (0.5, 4),
    'theta': (4, 8),
    'alpha': (8, 12),
    'beta': (12, 30),
    'gamma': (30, 45)
}

# Signal processing functions
def butter_lowpass_filter(data, cutoff, fs, order=2):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    return filtfilt(b, a, data)

def bandpass_filter(data, lowcut=1.0, highcut=45.0, fs=256, order=2):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return filtfilt(b, a, data)

def notch_filter(data, fs, notch_freq=50.0, quality_factor=30.0):
    freq_ratio = notch_freq / (fs / 2.0)
    b, a = iirnotch(freq_ratio, quality_factor)
    return filtfilt(b, a, data)

def compute_psd(data, fs):
    window_size = 256
    overlap_size = 128
    freqs, psd = welch(data, fs=fs, nperseg=window_size, noverlap=overlap_size)
    return freqs, psd

def bandpower(psd, freqs, band_name):
    low, high = EEG_BANDS[band_name]
    idx = np.logical_and(freqs >= low, freqs <= high)
    if np.sum(idx) == 0:
        return 0
    bp = simps(psd[idx], dx=freqs[1] - freqs[0])
    return bp

def detect_brainlink():
    """Device detection"""
    ports = serial.tools.list_ports.comports()
    print(f"Scanning {len(ports)} available ports...")
    
    if platform.system() == 'Windows':
        BRAINLINK_SERIALS = ("5C361634682F", "5C3616327E59", "5C3616346938", "5C3616346838")
        for port in ports:
            if hasattr(port, 'hwid'):
                if any(hw in port.hwid for hw in BRAINLINK_SERIALS):
                    print(f"✓ Found BrainLink device by serial: {port.device}")
                    return port.device
    
    print("✗ No BrainLink device found")
    return None

def onEEG(data):
    pass

def onExtendEEG(data):
    pass

def onGyro(data):
    pass

def onRR(data):
    pass

def onRaw(raw):
    """Real BrainLink raw data callback with console analysis"""
    global live_data_buffer
    
    if REAL_BRAINLINK_PARSER:
        live_data_buffer.append(raw)
        if len(live_data_buffer) > 1000:
            live_data_buffer = live_data_buffer[-1000:]
        
        # Show processed values in console every 50 samples
        if len(live_data_buffer) % 50 == 0:
            print(f"\n" + "="*60)
            print(f"EEG ANALYZER CONSOLE OUTPUT")
            print(f"="*60)
            print(f"Buffer size: {len(live_data_buffer)} samples")
            print(f"Latest raw value: {raw:.1f} µV")
            
            # Process the data if we have enough samples
            if len(live_data_buffer) >= 256:
                try:
                    # Get recent data for analysis
                    data = np.array(live_data_buffer[-256:])
                    
                    # Apply filters
                    data_notched = notch_filter(data, 256, notch_freq=50.0, quality_factor=30.0)
                    filtered = bandpass_filter(data_notched, lowcut=1.0, highcut=45.0, fs=256, order=2)
                    
                    # Compute basic statistics
                    print(f"Filtered data range: {np.min(filtered):.1f} to {np.max(filtered):.1f} µV")
                    print(f"Mean: {np.mean(filtered):.1f} µV, Std: {np.std(filtered):.1f} µV")
                    
                    # Compute power spectral density
                    freqs, psd = compute_psd(filtered, 256)
                    total_power = simps(psd, dx=freqs[1] - freqs[0])
                    
                    # Calculate band powers
                    print(f"\nEEG BAND POWERS:")
                    band_powers = {}
                    for band_name, (low, high) in EEG_BANDS.items():
                        power = bandpower(psd, freqs, band_name)
                        band_powers[band_name] = power
                        relative = power / total_power if total_power > 0 else 0
                        print(f"  {band_name.upper():5}: {power:8.2f} µV² ({relative:6.1%})")
                    
                    # Calculate ratios
                    alpha_power = band_powers.get('alpha', 0)
                    theta_power = band_powers.get('theta', 0)
                    beta_power = band_powers.get('beta', 0)
                    
                    alpha_theta_ratio = alpha_power / (theta_power + 1e-10)
                    beta_alpha_ratio = beta_power / (alpha_power + 1e-10)
                    
                    print(f"\nRATIOS:")
                    print(f"  Alpha/Theta: {alpha_theta_ratio:.2f}")
                    print(f"  Beta/Alpha:  {beta_alpha_ratio:.2f}")
                    print(f"  Total Power: {total_power:.2f} µV²")
                    
                    # Mental state interpretation
                    alpha_rel = alpha_power / total_power if total_power > 0 else 0
                    theta_rel = theta_power / total_power if total_power > 0 else 0
                    beta_rel = beta_power / total_power if total_power > 0 else 0
                    
                    print(f"\nMENTAL STATE INTERPRETATION:")
                    if alpha_rel > 0.3:
                        print(f"  → High alpha activity - relaxed, eyes closed state")
                    elif beta_rel > 0.3:
                        print(f"  → High beta activity - alert, focused state")
                    elif theta_rel > 0.3:
                        print(f"  → High theta activity - drowsy or meditative state")
                    else:
                        print(f"  → Mixed activity - transitional state")
                    
                    print(f"="*60)
                    
                except Exception as e:
                    print(f"Analysis error: {e}")
            else:
                print(f"Need {256 - len(live_data_buffer)} more samples for analysis")
                print(f"="*60)

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
        print("BrainLink Console Analyzer is running. Real EEG analysis will appear below.")
        print("Press Ctrl+C to stop.")
    except Exception as e:
        print(f"Failed to open serial port: {e}")
        return
        
    try:
        while not stop_thread_flag:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting BrainLink thread (KeyboardInterrupt).")
    finally:
        if serial_obj.is_open:
            serial_obj.close()
        print("Serial closed. Thread exiting.")

def main():
    global SERIAL_PORT, stop_thread_flag
    
    print("BrainLink Console Analyzer")
    print("="*40)
    
    # Detect device
    SERIAL_PORT = detect_brainlink()
    if not SERIAL_PORT:
        print("No BrainLink device found!")
        return
    
    # Create serial object
    serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)
    
    # Start BrainLink thread
    brainlink_thread = threading.Thread(target=run_brainlink, args=(serial_obj,))
    brainlink_thread.daemon = True
    brainlink_thread.start()
    
    # Keep running until user stops
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping...")
    
    # Stop
    stop_thread_flag = True
    brainlink_thread.join(timeout=2)
    
    print(f"\nFinal buffer size: {len(live_data_buffer)} samples")
    print("BrainLink Console Analyzer stopped.")

if __name__ == "__main__":
    main()
