#!/usr/bin/env python3
"""
Direct BrainLink test without GUI to isolate the buffer issue
"""

import sys, os, time, threading
import serial.tools.list_ports
from cushy_serial import CushySerial
import numpy as np

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

def onEEG(data):
    if REAL_BRAINLINK_PARSER:
        print(f"Real onEEG: {data}")

def onExtendEEG(data):
    if REAL_BRAINLINK_PARSER:
        print(f"Real onExtendEEG: {data}")

def onGyro(data):
    if REAL_BRAINLINK_PARSER:
        print(f"Real onGyro: {data}")

def onRR(data):
    if REAL_BRAINLINK_PARSER:
        print(f"Real onRR: {data}")

def onRaw(data):
    """Real BrainLink raw data callback - simplified"""
    global live_data_buffer
    
    if REAL_BRAINLINK_PARSER:
        try:
            # Convert to float
            eeg_value = float(data)
            
            # Add to buffer
            live_data_buffer.append(eeg_value)
            
            # Keep buffer size manageable
            if len(live_data_buffer) > 1000:
                live_data_buffer = live_data_buffer[-1000:]
            
            # Debug output every sample
            print(f"Buffer: {len(live_data_buffer)} samples, Latest: {eeg_value:.1f} µV")
                
        except Exception as e:
            print(f"onRaw error: {e}")
            import traceback
            traceback.print_exc()

def detect_brainlink():
    """Device detection"""
    import platform
    
    ports = serial.tools.list_ports.comports()
    print(f"Scanning {len(ports)} available ports...")
    
    # Windows detection
    if platform.system() == 'Windows':
        BRAINLINK_SERIALS = ("5C361634682F", "5C3616327E59", "5C3616346938", "5C3616346838")
        for port in ports:
            if hasattr(port, 'hwid'):
                if any(hw in port.hwid for hw in BRAINLINK_SERIALS):
                    print(f"✓ Found BrainLink device by serial: {port.device}")
                    return port.device
    
    print("✗ No BrainLink device found")
    return None

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
        print("BrainLink Direct Test is running. Real EEG data should now be flowing.")
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
    
    # Run for 30 seconds
    print("Running for 30 seconds...")
    try:
        time.sleep(30)
    except KeyboardInterrupt:
        print("Interrupted by user")
    
    # Stop
    stop_thread_flag = True
    brainlink_thread.join(timeout=2)
    
    print(f"Final buffer size: {len(live_data_buffer)} samples")
    if len(live_data_buffer) > 0:
        print(f"Last 10 values: {live_data_buffer[-10:]}")

if __name__ == "__main__":
    main()
