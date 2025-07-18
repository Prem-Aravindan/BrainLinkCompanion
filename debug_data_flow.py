#!/usr/bin/env python3
"""
Debug script to test BrainLink EEG plotting
"""

import sys
import numpy as np
import time
import threading
from BrainLinkAnalyzer_GUI import live_data_buffer, onRaw

def test_data_flow():
    """Test if data flows correctly to the live buffer"""
    print("Testing data flow...")
    
    # Clear buffer
    live_data_buffer.clear()
    
    # Add test data using the onRaw callback
    print("Adding test data...")
    for i in range(100):
        test_value = 50 * np.sin(i * 0.1) + 25 * np.sin(i * 0.05) + 10 * np.random.randn()
        onRaw(test_value)
        time.sleep(0.001)  # Small delay
    
    print(f"Buffer size after adding data: {len(live_data_buffer)}")
    print(f"First 10 values: {live_data_buffer[:10]}")
    print(f"Last 10 values: {live_data_buffer[-10:]}")
    
    # Test the buffer continuously
    print("\nStarting continuous data generation...")
    
    def generate_continuous_data():
        counter = 0
        while True:
            test_value = 50 * np.sin(counter * 0.1) + 25 * np.sin(counter * 0.05) + 10 * np.random.randn()
            onRaw(test_value)
            counter += 1
            time.sleep(1/256)  # 256 Hz
    
    # Start background thread
    thread = threading.Thread(target=generate_continuous_data)
    thread.daemon = True
    thread.start()
    
    # Monitor buffer size
    for i in range(10):
        time.sleep(1)
        print(f"Buffer size after {i+1} seconds: {len(live_data_buffer)}")

if __name__ == "__main__":
    test_data_flow()
