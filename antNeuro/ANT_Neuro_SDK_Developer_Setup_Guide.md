# ANT Neuro eego SDK - Developer Setup Guide

**Complete Step-by-Step Installation & Configuration Guide**

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Required Software Installation](#required-software-installation)
3. [SDK Build Process](#sdk-build-process)
4. [Environment Configuration](#environment-configuration)
5. [Verification & Testing](#verification--testing)
6. [Troubleshooting](#troubleshooting)
7. [Integration Examples](#integration-examples)

---

## Prerequisites

### System Requirements
- **Operating System**: Windows 10/11 (64-bit)
- **RAM**: Minimum 8GB
- **Disk Space**: ~2GB for build tools and SDK

### Required Files
Ensure you have the following in `M:\CODEBASE\antneuroSDK`:
- `eego_sdk.zip` - The ANT Neuro SDK package
- `eego-sdk-pybind11-master/` - Python bindings source code

### Knowledge Requirements
- Basic command line usage (PowerShell)
- Basic Python programming
- Understanding of environment variables

---

## Required Software Installation

### Step 1: Install Python 3.13

1. Download Python 3.13.x from [python.org](https://www.python.org/downloads/)
2. Run the installer
3. **IMPORTANT**: Check "Add Python to PATH" during installation
4. Install to: `C:\Python313\`
5. Verify installation:
   ```powershell
   C:\Python313\python.exe --version
   ```
   Expected output: `Python 3.13.x`

### Step 2: Install CMake

1. Download CMake from [cmake.org](https://cmake.org/download/)
2. Use version 4.2+ or latest stable
3. During installation, select "Add CMake to system PATH"
4. Verify installation:
   ```powershell
   cmake --version
   ```
   Expected output: `cmake version 4.2.x` or higher

### Step 3: Install MSYS2 (MinGW-w64 Compiler)

1. Download MSYS2 from [msys2.org](https://www.msys2.org/)
2. Install to default location: `C:\msys64\`
3. After installation, open "MSYS2 UCRT64" terminal
4. Update package database:
   ```bash
   pacman -Syu
   ```
5. Install build tools:
   ```bash
   pacman -S mingw-w64-ucrt-x86_64-gcc
   pacman -S mingw-w64-ucrt-x86_64-make
   pacman -S mingw-w64-ucrt-x86_64-cmake
   ```
6. Close MSYS2 terminal

---

## SDK Build Process

### Step 1: Configure user.cmake

1. Open PowerShell as Administrator
2. Navigate to SDK directory:
   ```powershell
   cd M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master
   ```

3. Check if `user.cmake` exists:
   ```powershell
   Test-Path .\user.cmake
   ```

4. Create or update `user.cmake` with correct path:
   ```powershell
   Set-Content -Path .\user.cmake -Value "set(EEGO_SDK_ZIP M:/CODEBASE/antneuroSDK/eego_sdk.zip)"
   ```

5. Verify the file:
   ```powershell
   Get-Content .\user.cmake
   ```
   Should show: `set(EEGO_SDK_ZIP M:/CODEBASE/antneuroSDK/eego_sdk.zip)`

**⚠ IMPORTANT**: Use forward slashes `/` not backslashes `\` in the path!

### Step 2: Add MSYS2 to Current Session PATH

Before building, add the compiler to your PATH:
```powershell
$env:Path = "C:\msys64\ucrt64\bin;$env:Path"
```

Verify compiler is accessible:
```powershell
gcc --version
g++ --version
mingw32-make --version
```

### Step 3: Clean Build Directory

1. Navigate away from BUILD directory:
   ```powershell
   cd M:\CODEBASE
   ```

2. Remove old build files:
   ```powershell
   Remove-Item -Path "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD" -Recurse -Force
   ```

3. Recreate clean BUILD directory:
   ```powershell
   New-Item -Path "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD" -ItemType Directory
   ```

### Step 4: Configure with CMake

1. Navigate to BUILD directory:
   ```powershell
   cd M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD
   ```

2. Run CMake configuration:
   ```powershell
   cmake -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release ..
   ```

3. **Expected output**:
   - Should detect GCC 15.x compiler
   - Should find Python 3.13
   - Should extract eego_sdk.zip
   - "Configuring done"
   - "Generating done"
   - "Build files have been written to: ..."

4. **If you see errors**, check:
   - GCC is in PATH (run `gcc --version`)
   - Python 3.13 is installed
   - `user.cmake` has correct path with forward slashes

### Step 5: Build the SDK

Build the Python module:
```powershell
cmake --build . --config Release
```

**Expected output**:
```
[ 50%] Building CXX object python3/CMakeFiles/eego_sdk3.dir/__/eego_sdk.cc.obj
[100%] Linking CXX shared module libeego_sdk.pyd
[100%] Built target eego_sdk3
```

**Build time**: ~2-5 minutes depending on your system.

### Step 6: Locate Built Files

After successful build, find the compiled files:
```powershell
Get-ChildItem .\python3 -Recurse -Include *.pyd
```

Should show: `BUILD\python3\libeego_sdk.pyd`

---

## Environment Configuration

### Step 1: Create Permanent Toolbox Folder

1. Create toolbox directory in your project:
   ```powershell
   New-Item -Path "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox" -ItemType Directory -Force
   ```

### Step 2: Copy Required Files

1. Copy the Python module (rename it):
   ```powershell
   Copy-Item "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD\python3\libeego_sdk.pyd" -Destination "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\eego_sdk.pyd"
   ```

2. Copy the SDK DLL (64-bit):
   ```powershell
   Copy-Item "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD\_deps\eego_sdk-src\windows\64bit\eego-SDK.dll" -Destination "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\"
   ```

3. Copy the import library:
   ```powershell
   Copy-Item "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD\_deps\eego_sdk-src\windows\64bit\eego-SDK.lib" -Destination "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\"
   ```

4. Copy MSYS2 runtime DLLs:
   ```powershell
   Copy-Item "C:\msys64\ucrt64\bin\libgcc_s_seh-1.dll" -Destination "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\"
   Copy-Item "C:\msys64\ucrt64\bin\libstdc++-6.dll" -Destination "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\"
   Copy-Item "C:\msys64\ucrt64\bin\libwinpthread-1.dll" -Destination "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\"
   ```

5. Copy example/test script:
   ```powershell
   Copy-Item "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\stream.py" -Destination "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox\"
   ```

### Step 3: Verify Toolbox Contents

Check all files are present:
```powershell
Get-ChildItem "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox" | Format-Table Name, Length -AutoSize
```

**Expected files**:
- `eego_sdk.pyd` (~664 KB)
- `eego-SDK.dll` (~683 KB)
- `eego-SDK.lib` (~9 KB)
- `libgcc_s_seh-1.dll`
- `libstdc++-6.dll`
- `libwinpthread-1.dll`
- `stream.py`

### Step 4: Set Environment Variables (PERMANENT)

#### Option A: Via PowerShell (Recommended)

1. Add MSYS2 to user PATH permanently:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\msys64\ucrt64\bin", "User")
   ```

2. Set PYTHONPATH to toolbox:
   ```powershell
   [Environment]::SetEnvironmentVariable("PYTHONPATH", "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox", "User")
   ```

3. **Restart PowerShell** for changes to take effect

#### Option B: Via Windows GUI

1. Press `Windows + R`
2. Type `sysdm.cpl` and press Enter
3. Click "Advanced" tab
4. Click "Environment Variables" button
5. Under "User variables":
   - Click "New" to create `PYTHONPATH`
   - Variable name: `PYTHONPATH`
   - Variable value: `M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox`
   - Click OK
6. Select "Path" variable and click "Edit"
7. Click "New" and add: `C:\msys64\ucrt64\bin`
8. Click OK on all dialogs
9. **Restart PowerShell**

### Step 5: Verify Environment Variables

Open a **NEW** PowerShell window and check:
```powershell
$env:PYTHONPATH
$env:Path -split ';' | Select-String -Pattern 'msys64|eego'
```

Should show your toolbox path and MSYS2 path.

---

## Verification & Testing

### Step 1: Test SDK Import

Open a **new** PowerShell window:
```powershell
cd M:\CODEBASE\BrainLinkCompanion
C:\Python313\python.exe -c "import sys; sys.path.insert(0, 'M:/CODEBASE/BrainLinkCompanion/eego_sdk_toolbox'); import eego_sdk; print('✓ Successfully imported eego_sdk')"
```

**Expected output**: `✓ Successfully imported eego_sdk`

### Step 2: Run Basic Test Script

If you have the test script:
```powershell
C:\Python313\python.exe test_antneuro_eego.py
```

**Expected output**:
```
✓ Successfully imported eego_sdk module

Available SDK components:
  - amplifier
  - factory
  - stream
  - channel
  - buffer

============================================================
ATTEMPTING TO DISCOVER AMPLIFIERS...
============================================================

⚠ No amplifiers found (device not connected)
  This is expected if the hardware is not connected yet.

============================================================
SDK SETUP COMPLETE
============================================================
```

### Step 3: Test Data Acquisition Module

```powershell
C:\Python313\python.exe antneuro_data_acquisition.py
```

Should show similar output about no amplifiers found (expected without hardware).

### Step 4: Test with Hardware (When Available)

Once you have the ANT Neuro headset:

1. **Connect the device** via USB or network
2. **Install drivers** if prompted
3. Run the test:
   ```powershell
   C:\Python313\python.exe test_antneuro_eego.py
   ```

Should now show:
```
✓ Found 1 amplifier(s)
  - [serial]: [type] (64 channels)
```

---

## Troubleshooting

### Issue 1: "ImportError: DLL load failed while importing eego_sdk"

**Causes**:
- Wrong Python version
- Missing DLL files
- PATH not set correctly

**Solutions**:

1. **Verify Python version**:
   ```powershell
   C:\Python313\python.exe --version
   ```
   Must be Python 3.13.x

2. **Check all DLLs are present**:
   ```powershell
   Get-ChildItem "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox" | Where-Object {$_.Extension -eq '.dll' -or $_.Extension -eq '.pyd'}
   ```
   Should show 5 files (1 .pyd + 4 .dll files)

3. **Add toolbox to PATH temporarily**:
   ```powershell
   $env:Path = "M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox;$env:Path"
   ```

4. **Test again**

### Issue 2: "CMake Error: CMAKE_C_COMPILER not set"

**Cause**: GCC compiler not in PATH

**Solution**:
```powershell
$env:Path = "C:\msys64\ucrt64\bin;$env:Path"
gcc --version  # Should work now
```

Then retry CMake configuration.

### Issue 3: "CMakeCache.txt directory is different"

**Cause**: Old build cache from different location

**Solution**:
```powershell
cd M:\CODEBASE
Remove-Item -Path "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD" -Recurse -Force
New-Item -Path "M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD" -ItemType Directory
```

Then retry build from Step 4 in SDK Build Process.

### Issue 4: "generator : Visual Studio ... Does not match"

**Cause**: Trying to use Visual Studio generator but VS not installed

**Solution**: Use MinGW Makefiles instead:
```powershell
cmake -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release ..
```

### Issue 5: Python 3.12 vs 3.13 Mismatch

**Symptom**: Module imports but crashes or shows version errors

**Cause**: Module compiled for Python 3.13 but running with different version

**Solution**: Always use the correct Python:
```powershell
C:\Python313\python.exe your_script.py
```

**NOT**:
```powershell
python your_script.py  # May use wrong version
```

### Issue 6: "No amplifiers found"

**Without Hardware** - This is **EXPECTED**. The SDK is working correctly.

**With Hardware Connected**:

1. **Check USB/network connection**
2. **Install drivers** from the SDK package
3. **Check Device Manager** (Windows + X → Device Manager)
   - Look for "ANT Neuro" or "eego" device
   - Check for yellow warning icons
4. **Try USB different port**
5. **Restart device and computer**
6. **Check ANT Neuro software** works (if provided)

---

## Integration Examples

### Basic Usage Example

```python
import sys
sys.path.insert(0, 'M:/CODEBASE/BrainLinkCompanion/eego_sdk_toolbox')
import eego_sdk
import numpy as np

# Initialize
factory = eego_sdk.factory()
amplifiers = factory.getAmplifiers()

if amplifiers:
    # Connect to first amplifier
    amp = amplifiers[0]
    print(f"Connected to: {amp.getSerial()}")
    
    # Start streaming at 500 Hz
    stream = amp.OpenStream(500)
    
    # Get channel info
    channels = stream.getChannelList()
    print(f"Channels: {len(channels)}")
    
    # Read data
    buffer = stream.getData()
    if buffer.size() > 0:
        # Process samples...
        for i in range(buffer.size()):
            sample = buffer.getSample(i)
            # sample contains data for all channels
            
    # Cleanup
    stream = None
```

### Using the Data Acquisition Module

```python
from antneuro_data_acquisition import AntNeuroDevice
import time

# Initialize device
device = AntNeuroDevice()

# Discover and connect
amplifiers = device.discover_amplifiers()
device.connect()

# Start streaming
device.start_streaming(sample_rate=500)

# Read data
for i in range(10):
    data = device.read_samples(250)  # 0.5 seconds at 500 Hz
    if data is not None:
        print(f"Data shape: {data.shape}")
        # data is numpy array: (samples, channels)
    time.sleep(0.5)

# Cleanup
device.stop_streaming()
device.disconnect()
```

---

## Quick Reference

### File Locations
| Item | Path |
|------|------|
| SDK Source | `M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master` |
| SDK ZIP | `M:\CODEBASE\antneuroSDK\eego_sdk.zip` |
| Build Folder | `M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD` |
| Toolbox | `M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox` |
| Python 3.13 | `C:\Python313\python.exe` |
| MSYS2 | `C:\msys64\ucrt64\bin` |

### Important Commands

**Build SDK:**
```powershell
cd M:\CODEBASE\antneuroSDK\eego-sdk-pybind11-master\BUILD
$env:Path = "C:\msys64\ucrt64\bin;$env:Path"
cmake -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release ..
cmake --build . --config Release
```

**Test Import:**
```powershell
C:\Python313\python.exe -c "import sys; sys.path.insert(0, 'M:/CODEBASE/BrainLinkCompanion/eego_sdk_toolbox'); import eego_sdk; print('OK')"
```

**Run Test:**
```powershell
cd M:\CODEBASE\BrainLinkCompanion
C:\Python313\python.exe test_antneuro_eego.py
```

### Environment Variables
```
PYTHONPATH = M:\CODEBASE\BrainLinkCompanion\eego_sdk_toolbox
PATH += C:\msys64\ucrt64\bin
```

---

## Support & Resources

- **ANT Neuro Documentation**: Check `eego_SDK_Python_Instructions.pdf` in antneuroSDK folder
- **Example Code**: `stream.py` in toolbox folder
- **GitHub**: Check `LINK.txt` in antneuroSDK folder for repository URL
- **Project Integration Plan**: See `ANT_Neuro_Integration_Plan.md`

---

## Checklist for New Developers

- [ ] Python 3.13 installed at `C:\Python313`
- [ ] CMake installed and in PATH
- [ ] MSYS2 installed at `C:\msys64`
- [ ] GCC/G++ compilers installed via MSYS2
- [ ] `user.cmake` configured with correct path (forward slashes!)
- [ ] BUILD directory cleaned
- [ ] CMake configuration successful
- [ ] Build completed without errors
- [ ] Toolbox folder created
- [ ] All 7 files copied to toolbox (1 .pyd + 3 SDK files + 3 runtime DLLs)
- [ ] PYTHONPATH environment variable set
- [ ] MSYS2 added to PATH environment variable
- [ ] PowerShell restarted after environment changes
- [ ] SDK import test successful
- [ ] Test script runs without errors

**Expected result without hardware**: "No amplifiers found" message (this is correct!)

---

**Last Updated**: February 3, 2026  
**Tested On**: Windows 11, Python 3.13.5, CMake 4.2.3, GCC 15.2.0
