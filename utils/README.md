# Utility Scripts

Helper scripts and utility modules used across the project.

## Files

### Launcher & UI
- **`launcher.py`** - Application launcher
- **`splash_screen.py`** - Splash screen for startup
- **`terminalUI.py`** - Terminal-based user interface

### Alternative Applications
- **`companion_app.py`** - Companion application variant
- **`brainlink_console_analyzer.py`** - Console-based analyzer

### Visualization
- **`rawbufferplot.py`** - Raw buffer plotting utility

### Other
- **`prompttask.py`** - Prompt task management

## Usage

These utilities are typically imported by main applications:

```python
from utils.splash_screen import show_splash
from utils.launcher import launch_app
```

Or run standalone:
```powershell
python utils/terminalUI.py
```
