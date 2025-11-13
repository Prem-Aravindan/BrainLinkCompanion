# MindLink Analyzer - macOS Build Guide

## Quick Start

### Single Command Build
```bash
python3 -m PyInstaller --clean --noconfirm BrainLinkAnalyzer_macOS.spec
```

Or use the convenient build script:
```bash
chmod +x build_macos_analyzer.sh
./build_macos_analyzer.sh
```

## Prerequisites

### 1. Install Python 3.8+
Check if Python is installed:
```bash
python3 --version
```

If not installed, download from [python.org](https://www.python.org/downloads/macos/) or use Homebrew:
```bash
brew install python@3.11
```

### 2. Install Dependencies
```bash
pip3 install -r requirements.txt
```

Key dependencies:
- PySide6 (Qt6 bindings)
- PyInstaller (for packaging)
- pyqtgraph (visualization)
- numpy, scipy, pandas (scientific computing)
- cushy-serial, pyserial (serial communication)

### 3. Install PyInstaller
```bash
pip3 install pyinstaller
```

## Build Process

### Method 1: Using Build Script (Recommended)
```bash
# Make script executable (first time only)
chmod +x build_macos_analyzer.sh

# Run the build
./build_macos_analyzer.sh
```

The script will:
- Clean previous builds
- Run PyInstaller with optimized settings
- Create the .app bundle
- Display build results

### Method 2: Direct PyInstaller Command
```bash
python3 -m PyInstaller --clean --noconfirm BrainLinkAnalyzer_macOS.spec
```

### Method 3: Using Conda Environment
If using Anaconda/Miniconda:
```bash
# Activate your environment
conda activate brainlink

# Run PyInstaller
python -m PyInstaller --clean --noconfirm BrainLinkAnalyzer_macOS.spec
```

## Output

After successful build:
```
dist/
└── MindLinkAnalyzer.app/
    ├── Contents/
    │   ├── MacOS/
    │   │   └── MindLinkAnalyzer (executable)
    │   ├── Resources/
    │   │   ├── assets/
    │   │   ├── BrainLinkParser/
    │   │   └── favicon.icns
    │   ├── Frameworks/
    │   └── Info.plist
```

## Running the Application

### From Terminal
```bash
open dist/MindLinkAnalyzer.app
```

### From Finder
Double-click `MindLinkAnalyzer.app` in the `dist` folder

## Creating a DMG Installer (Optional)

### Simple DMG
```bash
hdiutil create -volname "MindLink Analyzer" \
               -srcfolder dist/MindLinkAnalyzer.app \
               -ov -format UDZO \
               MindLinkAnalyzer.dmg
```

### DMG with Custom Layout
For a professional installer with background image and app shortcut:
```bash
# Install create-dmg tool
brew install create-dmg

# Create DMG
create-dmg \
  --volname "MindLink Analyzer" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "MindLinkAnalyzer.app" 200 190 \
  --hide-extension "MindLinkAnalyzer.app" \
  --app-drop-link 600 185 \
  "MindLinkAnalyzer.dmg" \
  "dist/MindLinkAnalyzer.app"
```

## Code Signing (For Distribution)

### Development Signing
```bash
codesign --deep --force --sign - dist/MindLinkAnalyzer.app
```

### Distribution Signing
```bash
# Sign with Apple Developer ID
codesign --deep --force --verify --verbose \
         --sign "Developer ID Application: Your Name (TEAM_ID)" \
         --options runtime \
         dist/MindLinkAnalyzer.app

# Verify signature
codesign --verify --deep --strict --verbose=2 dist/MindLinkAnalyzer.app

# Check entitlements
codesign -d --entitlements - dist/MindLinkAnalyzer.app
```

### Notarization (For Distribution Outside App Store)
```bash
# Create a zip for notarization
ditto -c -k --keepParent dist/MindLinkAnalyzer.app MindLinkAnalyzer.zip

# Submit for notarization
xcrun notarytool submit MindLinkAnalyzer.zip \
                       --apple-id "your@email.com" \
                       --team-id "TEAM_ID" \
                       --password "app-specific-password"

# Check status (use ID from submit command)
xcrun notarytool info <submission-id> \
                      --apple-id "your@email.com" \
                      --team-id "TEAM_ID"

# Staple the notarization ticket
xcrun stapler staple dist/MindLinkAnalyzer.app
```

## Troubleshooting

### Issue: "Python not found"
**Solution:** Install Python 3.8+ or add to PATH:
```bash
export PATH="/Library/Frameworks/Python.framework/Versions/3.11/bin:$PATH"
```

### Issue: "PyInstaller not found"
**Solution:** Install PyInstaller:
```bash
pip3 install pyinstaller
```

### Issue: "Module not found" during build
**Solution:** Install missing dependencies:
```bash
pip3 install -r requirements.txt
```

### Issue: "Cannot open app - developer cannot be verified"
**Solution:** Allow the app in System Preferences:
1. Right-click the app → Open
2. Or: System Preferences → Security & Privacy → Allow

Or disable Gatekeeper temporarily:
```bash
sudo spctl --master-disable
# After opening the app once:
sudo spctl --master-enable
```

### Issue: Serial port not detected on macOS
**Solution:** 
1. Check USB permissions in System Preferences → Security & Privacy
2. Install FTDI or CH340 drivers if needed
3. Look for devices in `/dev/tty.*` or `/dev/cu.*`

### Issue: Qt platform plugin error
**Solution:** Set environment variable:
```bash
export QT_QPA_PLATFORM=cocoa
python3 -m PyInstaller --clean --noconfirm BrainLinkAnalyzer_macOS.spec
```

### Issue: App bundle too large
**Solution:** The build includes all dependencies (~200-300MB). To reduce size:
- Use `--onefile` mode (slower startup)
- Exclude unnecessary packages in spec file
- Strip debug symbols

## Differences from Windows Build

| Feature | Windows | macOS |
|---------|---------|-------|
| Output | `.exe` file | `.app` bundle |
| Icon | `.ico` format | `.icns` format |
| Serial ports | `COM1`, `COM2`, etc. | `/dev/tty.usbserial*` |
| Plugin path | Automatic | Requires explicit setting |
| Distribution | Installer (NSIS/WiX) | DMG disk image |
| Code signing | Optional | Recommended for Gatekeeper |

## Performance Notes

- **First Launch:** May take 5-10 seconds (bundle unpacking)
- **Subsequent Launches:** 2-3 seconds
- **Memory Usage:** ~150-200MB
- **Disk Space:** ~250-300MB for .app bundle

## Architecture Support

The spec file builds for the current architecture:
- **Apple Silicon (M1/M2):** ARM64 native
- **Intel Macs:** x86_64

To build a universal binary:
```bash
# Install universal2 Python packages
pip3 install --upgrade --force-reinstall --platform macosx-11.0-universal2 --target packages/

# Modify spec to include both architectures (advanced)
```

## Minimum macOS Version

- **Tested on:** macOS 10.13 (High Sierra) and later
- **Recommended:** macOS 11 (Big Sur) or newer
- **Native Apple Silicon:** macOS 11.0+

## Files Included

The macOS build includes:
- `BrainLinkAnalyzer_macOS.spec` - PyInstaller specification
- `build_macos_analyzer.sh` - Automated build script
- `macOS_Compatibility_Report.md` - Detailed compatibility analysis
- This README

## Support

For issues specific to macOS builds:
1. Check this README's Troubleshooting section
2. Review `macOS_Compatibility_Report.md`
3. See `MacOS_TroubleshootingGuide.md` for device-specific issues

## License

Same as main application license.
