#!/usr/bin/env python3
"""
Simple buffer monitor to verify BrainLink data is flowing
"""
import sys
import time
import threading

# Import the global buffer from our GUI
sys.path.append('.')
from BrainLinkAnalyzer_GUI import live_data_buffer

def monitor_buffer():
    """Monitor the buffer in real-time"""
    print("Buffer Monitor Started")
    print("=" * 50)
    
    last_size = 0
    stable_count = 0
    
    while True:
        current_size = len(live_data_buffer)
        
        if current_size != last_size:
            # Buffer changed
            if current_size > 0:
                latest_value = live_data_buffer[-1]
                print(f"Buffer: {current_size:4d} samples | Latest: {latest_value:6.1f} µV | Growth: +{current_size - last_size}")
            else:
                print(f"Buffer: {current_size:4d} samples | Empty")
            
            last_size = current_size
            stable_count = 0
        else:
            # Buffer stable
            stable_count += 1
            if stable_count % 10 == 0:  # Every 10 seconds
                if current_size > 0:
                    latest_value = live_data_buffer[-1]
                    print(f"Buffer: {current_size:4d} samples | Latest: {latest_value:6.1f} µV | (stable for {stable_count}s)")
                else:
                    print(f"Buffer: {current_size:4d} samples | Empty (stable for {stable_count}s)")
        
        time.sleep(1)

if __name__ == "__main__":
    try:
        monitor_buffer()
    except KeyboardInterrupt:
        print("\nBuffer monitor stopped.")
