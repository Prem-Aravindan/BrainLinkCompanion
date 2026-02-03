# ANT Neuro eego 64-Channel EEG Integration

This folder contains all files related to the ANT Neuro eego 64-channel EEG headset integration.

## Files

### Python Modules
- **`antneuro_data_acquisition.py`** - Core data acquisition module for ANT Neuro devices
  - Class: `AntNeuroDevice` - Main interface for device connection and streaming
  - Handles 64-channel EEG data streaming
  - Supports multiple sampling rates (500Hz, 1000Hz, etc.)

- **`test_antneuro_eego.py`** - Test script to verify SDK installation and device connection
  - Tests SDK import
  - Discovers connected amplifiers
  - Verifies basic functionality

### Documentation
- **`ANT_Neuro_Integration_Plan.md`** - Complete integration plan and architecture
  - Setup completion status
  - Integration architecture
  - Development roadmap
  - Next steps for full integration

- **`ANT_Neuro_SDK_Developer_Setup_Guide.md`** - Step-by-step setup guide for developers
  - Prerequisites and requirements
  - Complete installation instructions
  - Build process documentation
  - Troubleshooting guide
  - Quick reference

## SDK Location

The compiled SDK toolbox is located at:
```
M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\
```

Contains:
- `eego_sdk.pyd` - Python module
- `eego-SDK.dll` - ANT Neuro SDK library
- Runtime DLLs (libgcc, libstdc++, libwinpthread)

## Usage

### Quick Test
```powershell
cd M:\CODEBASE\BrainLinkCompanion\antNeuro
C:\Python313\python.exe test_antneuro_eego.py
```

### Import in Your Code
```python
import sys
sys.path.insert(0, '../antNeuro')
from antneuro_data_acquisition import AntNeuroDevice

device = AntNeuroDevice()
amplifiers = device.discover_amplifiers()
device.connect()
device.start_streaming(sample_rate=500)
```

## Requirements

- **Python**: 3.13+ (compiled for Python 3.13)
- **OS**: Windows 10/11 (64-bit)
- **Hardware**: ANT Neuro eego 64-channel amplifier
- **Dependencies**: numpy (for data processing)

## Environment Variables

Ensure these are set:
- `PYTHONPATH` = `M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox`
- `PATH` includes `C:\msys64\ucrt64\bin`

## Next Steps

1. Connect ANT Neuro headset hardware
2. Test device detection
3. Create GUI application for 64-channel visualization
4. Integrate with existing BrainLink analysis pipeline
5. Build standalone executable

## Related Files

- SDK source: `M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master`
- Build files: `M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD`
- Toolbox: `M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox`
