# Tests and Debug Scripts

This folder contains test scripts, debug utilities, and diagnostic tools.

## Test Scripts

### Device Tests
- **`test_antneuro_eego.py`** - Test ANT Neuro SDK integration (moved to antNeuro/)
- **`test_brainlink_direct.py`** - Direct BrainLink device testing
- **`test_algorithm.py`** - Algorithm validation tests

### Debug Scripts
- **`debug_data_flow.py`** - Trace data flow through pipeline
- **`debug_mpl_plot.py`** - Debug matplotlib plotting issues
- **`debug_plot.py`** - General plotting debug
- **`debug_plot_save.py`** - Debug plot saving functionality
- **`debug_plot_snapshot.py`** - Debug snapshot feature

### Analysis Tests
- **`feature_analysis_testbed.py`** - Test feature extraction
- **`check_protocol_videos.py`** - Verify protocol video files

### Diagnostics
- **`diagnostic.py`** - System diagnostic tool

## Usage

Run any test script:
```powershell
cd tests
python test_brainlink_direct.py
```

Debug specific functionality:
```powershell
python debug_data_flow.py
```

## Notes

- Tests may require hardware connections
- Debug scripts output verbose logging
- Use for troubleshooting and development
