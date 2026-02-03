#!/usr/bin/env python3
# launcher.py - Cross-platform launcher for BrainCompanion

import os
import sys
import platform

# Add the current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

# Import the main application
import BrainCompanion

# Launch the application
if __name__ == "__main__":
    # Print diagnostic info to help with troubleshooting
    print(f"Platform: {platform.system()}")
    print(f"Python version: {sys.version}")
    print(f"Running from: {os.path.abspath(__file__)}")
    
    # Launch the main application
    BrainCompanion.main()
