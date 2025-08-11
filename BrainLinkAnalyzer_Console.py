#!/usr/bin/env python3
"""
BrainLink Feature Analysis Console
Simple console-only version that shows processed EEG values in real-time.
"""

import sys, os, time, threading, random
import serial.tools.list_ports
from cushy_serial import CushySerial
import numpy as np
import platform
from collections import deque
from scipy.signal import butter, filtfilt, iirnotch, welch
from scipy.integrate import simpson as simps

try:
    from BrainLinkParser.BrainLinkParser import BrainLinkParser
except ImportError:
    print("BrainLinkParser not available. Using dummy data for testing.")
    
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
            """Generate dummy EEG data for testing"""
            while self.running:
                # Generate realistic EEG-like data
                dummy_raw = random.randint(-100, 100) + 50 * np.sin(time.time() * 2 * np.pi * 10)
                self.onRaw(dummy_raw)
                time.sleep(1/256)  # 256 Hz sampling rate

# Global variables
SERIAL_PORT = None
SERIAL_BAUD = 115200
stop_thread_flag = False
live_data_buffer = deque(maxlen=1000)

# Signal processing constants
FS = 256
WINDOW_SIZE = 256 
OVERLAP_SIZE = 128
EEG_BANDS = {
    'delta': (0.5, 4),
    'theta': (4, 8),
    'alpha': (8, 12),
    'beta': (12, 30),
    'gamma': (30, 45)
}

def bandpass_filter(data, lowcut=1.0, highcut=45.0, fs=256, order=2):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return filtfilt(b, a, data)

def notch_filter(data, fs, notch_freq=60.0, quality_factor=30.0):
    freq_ratio = notch_freq / (fs / 2.0)
    b, a = iirnotch(freq_ratio, quality_factor)
    return filtfilt(b, a, data)

def compute_psd(data, fs):
    freqs, psd = welch(data, fs=fs, nperseg=WINDOW_SIZE, noverlap=OVERLAP_SIZE)
    return freqs, psd

def bandpower(psd, freqs, band):
    low, high = EEG_BANDS[band]
    idx = np.logical_and(freqs >= low, freqs <= high)
    if np.sum(idx) == 0:
        return 0
    bp = simps(psd[idx], dx=freqs[1] - freqs[0])
    return bp

def detect_brainlink():
    """Device detection with enhanced logging"""
    ports = serial.tools.list_ports.comports()
    print(f"Scanning {len(ports)} available ports...")
    
    # Platform-specific detection
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
            if port.device.startswith("/dev/tty.usbserial") or port.device.startswith("/dev/tty.usbmodem"):
                print(f"✓ Found BrainLink device by device name: {port.device}")
                return port.device
    
    print("✗ No BrainLink device found")
    print("Available ports:")
    for port in ports:
        hwid_info = f" (HWID: {port.hwid})" if hasattr(port, 'hwid') else ""
        print(f"  - {port.device}: {port.description}{hwid_info}")
    
    return None

def onRaw(raw):
    """Process raw EEG data and show analysis in console"""
    global live_data_buffer
    live_data_buffer.append(raw)
    
    # Show processed values in console every 50 samples
    if len(live_data_buffer) % 50 == 0:
        print(f"Buffer size: {len(live_data_buffer)} samples")
        print(f"Latest raw value: {raw:.1f} µV")
        
        # Process the data if we have enough samples
        if len(live_data_buffer) >= 256:
            try:
                # Get recent data for analysis
                data = np.array(list(live_data_buffer)[-256:])
                
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
                print(f"EEG BAND POWERS:")
                for band_name, (low, high) in EEG_BANDS.items():
                    power = bandpower(psd, freqs, band_name)
                    relative = power / total_power if total_power > 0 else 0
                    print(f"  {band_name.upper():5}: {power:8.2f} µV² ({relative:6.1%})")
                
                # Calculate ratios
                alpha_power = bandpower(psd, freqs, 'alpha')
                theta_power = bandpower(psd, freqs, 'theta')
                beta_power = bandpower(psd, freqs, 'beta')
                
                alpha_theta_ratio = alpha_power / (theta_power + 1e-10)
                beta_alpha_ratio = beta_power / (alpha_power + 1e-10)
                
                print(f"RATIOS:")
                print(f"  Alpha/Theta: {alpha_theta_ratio:.2f}")
                print(f"  Beta/Alpha:  {beta_alpha_ratio:.2f}")
                print(f"  Total Power: {total_power:.2f} µV²")
                
                # Mental state interpretation
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
            print(f"Need {256 - len(live_data_buffer)} more samples for analysis")
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

def main():
    global SERIAL_PORT, stop_thread_flag
    
    print("BrainLink Feature Analysis Console")
    print("=" * 50)
    
    # Detect BrainLink device
    SERIAL_PORT = detect_brainlink()
    if not SERIAL_PORT:
        print("No BrainLink device found. Exiting.")
        return
    
    print(f"Found BrainLink device: {SERIAL_PORT}")
    
    # Create serial object and start connection
    try:
        serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)
        
        # Start BrainLink thread
        brainlink_thread = threading.Thread(target=run_brainlink, args=(serial_obj,))
        brainlink_thread.daemon = True
        brainlink_thread.start()
        
        print("\n" + "="*60)
        print("BRAINLINK ANALYZER STARTED")
        print("Real-time EEG analysis will appear every 50 samples")
        print("Press Ctrl+C to stop")
        print("="*60)
        
        # Keep main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nStopping BrainLink analyzer...")
            stop_thread_flag = True
            if serial_obj.is_open:
                serial_obj.close()
            print("BrainLink analyzer stopped.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
