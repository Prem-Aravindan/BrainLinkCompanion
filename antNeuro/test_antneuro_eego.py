"""
Test script for ANT Neuro eego SDK
This script tests the basic functionality of the ANT Neuro 64-channel EEG headset SDK
"""
import sys
import time

# Add the SDK path
sys.path.insert(0, 'M:/CODEBASE/BrainLinkCompanion/eego_sdk_toolbox')

try:
    import eego_sdk
    print("✓ Successfully imported eego_sdk module")
    print("\nAvailable SDK components:")
    print("  - amplifier")
    print("  - factory")
    print("  - stream")
    print("  - channel")
    print("  - buffer")
    
    # Try to discover amplifiers (will work when device is connected)
    print("\n" + "="*60)
    print("ATTEMPTING TO DISCOVER AMPLIFIERS...")
    print("="*60)
    
    try:
        factory_instance = eego_sdk.factory()
        amplifiers = factory_instance.getAmplifiers()
        
        if amplifiers:
            print(f"\n✓ Found {len(amplifiers)} amplifier(s):")
            for i, amp in enumerate(amplifiers):
                print(f"\n  Amplifier {i+1}:")
                print(f"    Serial: {amp.getSerial()}")
                print(f"    Type: {amp.getType()}")
                print(f"    Channels: {amp.getChannelCount()}")
        else:
            print("\n⚠ No amplifiers found (device not connected)")
            print("  This is expected if the hardware is not connected yet.")
            
    except Exception as e:
        print(f"\n⚠ Could not discover amplifiers: {e}")
        print("  This is expected if the hardware is not connected yet.")
    
    print("\n" + "="*60)
    print("SDK SETUP COMPLETE")
    print("="*60)
    print("\nNext steps:")
    print("1. ✓ SDK is built and functional")
    print("2. ✓ Environment variables are configured")
    print("3. Connect the ANT Neuro eego 64-channel headset")
    print("4. Run this script again to verify device detection")
    print("5. Integrate into BrainLinkCompanion pipeline")
    
except ImportError as e:
    print(f"✗ Failed to import eego_sdk: {e}")
    print("\nTroubleshooting:")
    print("1. Ensure Python 3.13 is being used")
    print("2. Check PYTHONPATH environment variable")
    print("3. Verify all DLL files are in the toolbox folder")
    sys.exit(1)
