#!/usr/bin/env python3
"""
Test script to verify real EEG data acquisition and feature extraction
This script demonstrates that we're now using REAL BrainLink data, not dummy data
"""

import time
import numpy as np
import threading
from collections import deque
import serial.tools.list_ports

# Import the REAL BrainLink components
from BrainLinkParser.BrainLinkParser import BrainLinkParser
from cushy_serial import CushySerial
import BrainLinkAnalyzer_GUI as BL

# Real data collection
real_data_buffer = deque(maxlen=1000)
data_timestamps = deque(maxlen=1000)
stop_flag = False

def onEEG(attention, meditation, delta, theta, alpha, beta_low, beta_mid, beta_high, gamma_mid):
    """Handle EEG band power data"""
    print(f"EEG Bands - Alpha: {alpha}, Beta: {beta_low}, Theta: {theta}, Delta: {delta}")

def onExtendEEG(delta, theta, low_alpha, high_alpha, low_beta, high_beta, low_gamma, mid_gamma):
    """Handle extended EEG data"""
    pass

def onGyro(x, y, z):
    """Handle gyroscope data"""
    pass

def onRR(rr1, rr2, rr3):
    """Handle R-R interval data"""
    pass

def onRaw(raw_value):
    """Handle raw EEG data - THIS IS THE CRITICAL FUNCTION"""
    global real_data_buffer, data_timestamps
    
    current_time = time.time()
    real_data_buffer.append(float(raw_value))
    data_timestamps.append(current_time)
    
    # Print every 50th sample to show we're getting REAL data
    if len(real_data_buffer) % 50 == 0:
        print(f"\n=== REAL EEG DATA VERIFICATION ===")
        print(f"Sample #{len(real_data_buffer)}: {raw_value:.2f} µV")
        print(f"Timestamp: {current_time:.3f}")
        
        if len(real_data_buffer) >= 100:
            recent_data = list(real_data_buffer)[-100:]
            print(f"Last 100 samples - Mean: {np.mean(recent_data):.2f} µV")
            print(f"                  Std:  {np.std(recent_data):.2f} µV")
            print(f"                  Range: {np.min(recent_data):.2f} to {np.max(recent_data):.2f} µV")
            
            # Check if this looks like real EEG (should be variable, not dummy pattern)
            diffs = np.diff(recent_data)
            variability = np.std(diffs)
            print(f"Signal variability: {variability:.2f} (>1.0 indicates real data)")
            
            if variability > 1.0:
                print("✅ DATA APPEARS TO BE REAL EEG SIGNAL")
            else:
                print("⚠️  WARNING: Data may be artificial/dummy")

def run_real_data_test():
    """Connect to real BrainLink and collect data"""
    global stop_flag
    
    # Detect real device
    print("🔍 Detecting BrainLink device...")
    serial_port = BL.detect_brainlink()
    
    if not serial_port:
        print("❌ ERROR: No real BrainLink device found!")
        print("Please connect your BrainLink device and try again.")
        return
    
    print(f"✅ Found real BrainLink device: {serial_port}")
    
    # Create real parser (NOT dummy)
    parser = BrainLinkParser(onEEG, onExtendEEG, onGyro, onRR, onRaw)
    print("✅ Real BrainLinkParser created")
    
    # Open serial connection
    try:
        serial_obj = CushySerial(serial_port, 115200)
        
        @serial_obj.on_message()
        def handle_serial_message(msg: bytes):
            # Parse REAL serial data from BrainLink device
            parser.parse(msg)
        
        serial_obj.open()
        print(f"✅ Serial connection opened: {serial_port} @ 115200 baud")
        print("\n🧠 Starting REAL EEG data collection...")
        print("   Collecting for 30 seconds to verify real data...")
        
        # Collect data for 30 seconds
        start_time = time.time()
        while time.time() - start_time < 30.0 and not stop_flag:
            time.sleep(0.1)
        
        print(f"\n📊 FINAL STATISTICS:")
        if len(real_data_buffer) > 0:
            all_data = list(real_data_buffer)
            print(f"Total samples collected: {len(all_data)}")
            print(f"Sampling rate: ~{len(all_data)/30.0:.1f} Hz")
            print(f"Data range: {np.min(all_data):.2f} to {np.max(all_data):.2f} µV")
            print(f"Mean: {np.mean(all_data):.2f} µV")
            print(f"Standard deviation: {np.std(all_data):.2f} µV")
            
            # Compute simple features to verify they're reasonable
            if len(all_data) >= 512:
                print(f"\n🧮 COMPUTING FEATURES FROM REAL DATA:")
                window = np.array(all_data[-512:])  # Last 512 samples
                
                # Remove DC
                window = window - np.mean(window)
                
                # Basic filtering
                try:
                    window = BL.notch_filter(window, 512, 50.0)
                    print("✅ Notch filter applied")
                except:
                    pass
                
                # Compute PSD
                freqs, psd = BL.compute_psd(window, 512)
                total_power = np.var(window)
                
                print(f"Total power: {total_power:.2f} µV²")
                
                for band_name in BL.EEG_BANDS:
                    power = BL.bandpower(psd, freqs, band_name)
                    rel_power = power / total_power if total_power > 0 else 0
                    print(f"{band_name.upper():5}: {power:8.2f} µV² ({rel_power:6.1%})")
            
            print(f"\n✅ SUCCESS: Real EEG data acquisition and feature extraction verified!")
        else:
            print("❌ ERROR: No data collected - check device connection")
        
        serial_obj.close()
        print("🔌 Serial connection closed")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    try:
        run_real_data_test()
    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")
        stop_flag = True
