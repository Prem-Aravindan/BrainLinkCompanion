# BrainLink Companion - Project Organization

**Date Organized**: February 3, 2026

---

## 📁 Folder Structure

```
BrainLinkCompanion/
│
├── 📂 antNeuro/                          # ANT Neuro 64-Channel Integration
│   ├── antneuro_data_acquisition.py     # Data acquisition module
│   ├── test_antneuro_eego.py            # SDK test script
│   ├── ANT_Neuro_Integration_Plan.md    # Integration plan
│   ├── ANT_Neuro_SDK_Developer_Setup_Guide.md  # Setup guide
│   └── README.md                        # ANT Neuro documentation
│
├── 📂 build_scripts/                     # Build & Packaging
│   ├── build_exe.ps1                    # Windows build script
│   ├── build_macos.sh                   # macOS build script
│   ├── build_macos_analyzer.sh          # macOS analyzer build
│   ├── install_macos_deps.sh            # macOS dependency installer
│   ├── build.bat                        # Windows batch build
│   ├── BrainCompanion.spec              # PyInstaller spec
│   ├── BrainCompanion_macOS.spec        # macOS PyInstaller spec
│   ├── BrainLinkAnalyzer.spec           # Analyzer PyInstaller spec
│   ├── BrainLinkAnalyzer_macOS.spec     # macOS analyzer spec
│   └── README.md
│
├── 📂 config/                            # Configuration Files
│   ├── requirements.txt                 # Python dependencies
│   ├── requirements_cross_platform.txt  # Cross-platform deps
│   ├── MindLink_User_Manual.txt         # User manual
│   ├── results.csv                      # Sample data
│   ├── gitssh                          # SSH private key
│   ├── gitssh.pub                      # SSH public key
│   └── README.md
│
├── 📂 docs/                              # Documentation
│   ├── BrainLink_Analysis_Methodology_Report.md
│   ├── BrainLink_Implementation_Report_EyesClosed_Baseline.md
│   ├── BrainLink_JavaScript_Implementation_Guide.md
│   ├── BrainLink_Methodology_Professor_Report.md
│   ├── BrainLink_Processing_Architecture.md
│   ├── BrainLink_Professor_QA.md
│   ├── BrainLink_Python_Implementation_Report.md
│   ├── BrainLink_Statistical_Analysis_Report.md
│   ├── BrainLinkAnalyzer_GUI_Documentation.md
│   ├── BrainLinkAnalyzer_IEEE_Paper.md
│   ├── CrossPlatformNotes.md
│   ├── EEG_Feature_Extraction_Formulas.md
│   ├── EnvironmentDifferences.md
│   ├── FIX_IMPLEMENTATION_SUMMARY_001.md
│   ├── GRAPH_SCALING_FIXES.md
│   ├── INSTALLATION_SUMMARY.md
│   ├── LoginTroubleshooting.md
│   ├── macOS_CI_Secrets_Setup.md
│   ├── macOS_Compatibility_Report.md
│   ├── macOS_Compatibility_Verification.md
│   ├── macOS_Porting_Guide.md
│   ├── macOS_README.md
│   ├── MacOS_TroubleshootingGuide.md
│   ├── PYQTGRAPH_ONLY_IMPLEMENTATION.md
│   ├── README_macOS_Build.md
│   ├── REAL_DEVICE_INTEGRATION_SUMMARY.md
│   └── SignalQualityDetection.md
│
├── 📂 eego_sdk_toolbox/                  # ANT Neuro SDK Binaries
│   ├── eego_sdk.pyd                     # Python module
│   ├── eego-SDK.dll                     # ANT Neuro library
│   ├── eego-SDK.lib                     # Import library
│   ├── libgcc_s_seh-1.dll              # GCC runtime
│   ├── libstdc++-6.dll                 # C++ standard library
│   ├── libwinpthread-1.dll             # pthread library
│   └── stream.py                        # Example script
│
├── 📂 legacy/                            # Backup & Old Files
│   ├── BrainLinkAnalyzer_GUI_backup.py
│   ├── clean_file.py
│   ├── fix_file.py
│   └── README.md
│
├── 📂 tests/                             # Test & Debug Scripts
│   ├── test_algorithm.py
│   ├── test_brainlink_direct.py
│   ├── debug_data_flow.py
│   ├── debug_mpl_plot.py
│   ├── debug_plot.py
│   ├── debug_plot_save.py
│   ├── debug_plot_snapshot.py
│   ├── feature_analysis_testbed.py
│   ├── check_protocol_videos.py
│   ├── diagnostic.py
│   ├── macOS_compatibility_test.py
│   └── README.md
│
├── 📂 utils/                             # Utility Scripts
│   ├── launcher.py
│   ├── splash_screen.py
│   ├── terminalUI.py
│   ├── companion_app.py
│   ├── brainlink_console_analyzer.py
│   ├── rawbufferplot.py
│   ├── prompttask.py
│   └── README.md
│
├── 📂 assets/                            # Media & Resources
│   └── (various image and video files)
│
├── 📂 BrainLinkParser/                   # Parser module
├── 📂 BrainlinkReact/                    # React web interface
├── 📂 BrainlinkReactNew/                 # Updated React interface
│
├── 🐍 BrainLinkAnalyzer_GUI_Sequential_Integrated.py  # Main Application
├── 🐍 BrainLinkAnalyzer_GUI_Sequential.py
├── 🐍 BrainLinkAnalyzer_GUI_Enhanced.py
├── 🐍 BrainLinkAnalyzer_GUI_AImod.py
├── 🐍 BrainLinkAnalyzer_GUI.py
├── 🐍 BrainLinkAnalyzer_Console.py
├── 🐍 BrainLinkRawEEG_Plot.py
├── 🐍 BrainCompanion.py
├── 🐍 BrainCompanion_updated.py
├── 🐍 BrainCompanion_TestBed.py
│
└── 📄 README.md                          # Main project documentation
```

---

## 🎯 Key Locations

### Main Applications
- **Primary GUI**: `BrainLinkAnalyzer_GUI_Sequential_Integrated.py`
- **Console Version**: `BrainLinkAnalyzer_Console.py`
- **Companion App**: `BrainCompanion.py`

### ANT Neuro Integration
- **All files**: `antNeuro/` folder
- **SDK binaries**: `eego_sdk_toolbox/`
- **Setup guide**: `antNeuro/ANT_Neuro_SDK_Developer_Setup_Guide.md`

### Building Executables
- **Scripts**: `build_scripts/` folder
- **Windows**: Run `build_scripts/build_exe.ps1`
- **macOS**: Run `build_scripts/build_macos_analyzer.sh`

### Dependencies
- **Requirements**: `config/requirements.txt`
- **Cross-platform**: `config/requirements_cross_platform.txt`

### Documentation
- **All docs**: `docs/` folder
- **Main README**: `README.md` (project root)
- **Folder READMEs**: Each folder has its own README.md

---

## 📋 File Categories

### By Purpose

#### **Hardware Integration**
- `antNeuro/` - ANT Neuro 64-channel devices
- Main GUI files - BrainLink 1-channel devices

#### **Development**
- `tests/` - Testing and debugging
- `utils/` - Helper utilities
- `legacy/` - Old versions for reference

#### **Deployment**
- `build_scripts/` - Executable creation
- `config/` - Configuration and requirements

#### **Documentation**
- `docs/` - Technical documentation
- `README.md` files in each folder

---

## 🔄 Migration Notes

### Files Moved

**To `antNeuro/`**:
- `antneuro_data_acquisition.py`
- `test_antneuro_eego.py`
- `ANT_Neuro_Integration_Plan.md`
- `ANT_Neuro_SDK_Developer_Setup_Guide.md`

**To `build_scripts/`**:
- All `build_*.ps1`, `build_*.sh`, `*.spec` files
- `install_macos_deps.sh`

**To `config/`**:
- `requirements.txt`, `requirements_cross_platform.txt`
- `gitssh`, `gitssh.pub`
- `MindLink_User_Manual.txt`
- `results.csv`

**To `docs/`**:
- All `.md` documentation files (except READMEs)

**To `tests/`**:
- All `test_*.py`, `debug_*.py` files
- `diagnostic.py`, `check_*.py`
- `feature_analysis_testbed.py`

**To `utils/`**:
- `launcher.py`, `splash_screen.py`, `terminalUI.py`
- `companion_app.py`, `brainlink_console_analyzer.py`
- `rawbufferplot.py`, `prompttask.py`

**To `legacy/`**:
- All `*_backup.py`, `*_old.py` files
- `clean_file.py`, `fix_file.py`

### Files Kept in Root
- Main application files (BrainLinkAnalyzer, BrainCompanion variants)
- Project README.md
- Existing folders (assets, BrainLinkParser, React folders, etc.)

---

## 🚀 Quick Start After Organization

### Run Main Application
```powershell
python BrainLinkAnalyzer_GUI_Sequential_Integrated.py
```

### Test ANT Neuro SDK
```powershell
cd antNeuro
C:\Python313\python.exe test_antneuro_eego.py
```

### Install Dependencies
```powershell
pip install -r config/requirements.txt
```

### Build Executable
```powershell
cd build_scripts
.\build_exe.ps1
```

### Run Tests
```powershell
cd tests
python test_algorithm.py
```

---

## 📝 Notes for Developers

1. **Import Paths**: After reorganization, update import statements if needed:
   ```python
   # Old
   from antneuro_data_acquisition import AntNeuroDevice
   
   # New
   from antNeuro.antneuro_data_acquisition import AntNeuroDevice
   ```

2. **Configuration Files**: Always reference from `config/`:
   ```python
   requirements_path = 'config/requirements.txt'
   ```

3. **Build Scripts**: Run from `build_scripts/` folder or use relative paths

4. **Documentation**: Check folder-specific READMEs for detailed info

5. **Testing**: Use `tests/` folder for all test scripts

---

## 🔍 Finding Files

### By Functionality

**Need to...**
- Build executable → `build_scripts/`
- Test hardware → `tests/` or `antNeuro/`
- Read documentation → `docs/` or folder READMEs
- Check requirements → `config/requirements.txt`
- Use utilities → `utils/`
- Reference old code → `legacy/`

### Quick Search
```powershell
# Find a specific file
Get-ChildItem -Recurse -Filter "filename.py"

# Find files containing text
Get-ChildItem -Recurse | Select-String -Pattern "search_term"
```

---

## ✅ Benefits of New Structure

1. **Clarity**: Related files grouped together
2. **Maintainability**: Easy to find and update files
3. **Scalability**: Easy to add new device integrations
4. **Documentation**: Each folder has its own README
5. **Clean Root**: Main applications easily accessible
6. **Separation**: Legacy code separated from active development

---

**Organized by**: GitHub Copilot  
**Date**: February 3, 2026  
**Status**: ✅ Complete
