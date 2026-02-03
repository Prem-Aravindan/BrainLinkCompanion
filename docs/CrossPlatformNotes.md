# Cross-Platform Implementation Notes

This document describes the key differences between the Windows and macOS implementations of BrainCompanion.

## Platform Detection

The application uses `platform.system()` to detect the operating system and adjust functionality accordingly:

```python
if platform.system() == 'Windows':
    # Windows-specific code
elif platform.system() == 'Darwin':  # 'Darwin' is the system name for macOS
    # macOS-specific code
```

## Key Differences

### Proxy Settings

- **Windows**: Uses Windows Registry via `winreg` module
- **macOS**: Uses environment variables (`http_proxy`, `https_proxy`)

### Serial Port Detection

- **Windows**: Identifies BrainLink device by its hardware ID string
- **macOS**: Identifies devices by common USB-Serial adapter names and port naming patterns

### Build Process

- **Windows**: Creates a standalone .exe file
- **macOS**: Creates a .app bundle structure

### File Paths

- **Windows**: Uses backslashes (`\`) in paths
- **macOS**: Uses forward slashes (`/`) in paths

### Serial Port Names

- **Windows**: Ports appear as `COM1`, `COM2`, etc.
- **macOS**: Ports appear as `/dev/tty.usbserial-*` or `/dev/tty.usbmodem-*`

## Common Code

Most of the application logic is identical between platforms, including:

- UI components (PySide6)
- Data processing (scipy, numpy)
- Graphing (pyqtgraph)
- Network communication (requests)

## Testing Recommendations

When making changes, test on both platforms to ensure compatibility. Key areas to test:

1. Device detection
2. Serial communication
3. Network connectivity
4. User interface behavior
