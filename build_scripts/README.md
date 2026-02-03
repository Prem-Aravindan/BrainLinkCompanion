# Build Scripts

This folder contains all build scripts and PyInstaller specification files for creating standalone executables.

## Files

### Windows Build Scripts
- **`build_exe.ps1`** - PowerShell script to build Windows executable
- **`build.bat`** - Batch file alternative for Windows build

### macOS Build Scripts
- **`build_macos.sh`** - Build script for macOS
- **`build_macos_analyzer.sh`** - Build BrainLink Analyzer for macOS
- **`install_macos_deps.sh`** - Install macOS dependencies

### PyInstaller Spec Files
- **`BrainCompanion.spec`** - Spec for BrainCompanion application
- **`BrainCompanion_macOS.spec`** - macOS-specific spec
- **`BrainLinkAnalyzer.spec`** - Spec for BrainLink Analyzer
- **`BrainLinkAnalyzer_macOS.spec`** - macOS-specific analyzer spec

## Usage

### Build for Windows
```powershell
cd build_scripts
.\build_exe.ps1
```

### Build for macOS
```bash
cd build_scripts
chmod +x build_macos_analyzer.sh
./build_macos_analyzer.sh
```

### Custom Build
```powershell
pyinstaller BrainLinkAnalyzer.spec
```

## Output

Executables are created in:
- `dist/` folder in the project root
- Windows: `.exe` files
- macOS: `.app` bundles

## Notes

- Ensure all dependencies are installed before building
- Spec files can be edited to customize build options
- See main README.md for platform-specific requirements
