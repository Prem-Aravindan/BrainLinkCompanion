# Configuration Files

Project configuration, requirements, and settings files.

## Files

### Python Dependencies
- **`requirements.txt`** - Main Python package requirements
- **`requirements_cross_platform.txt`** - Cross-platform compatible requirements

### Documentation
- **`MindLink_User_Manual.txt`** - User manual

### Data Files
- **`results.csv`** - Sample results data

### Keys & Authentication
- **`gitssh`** - SSH key for git (private)
- **`gitssh.pub`** - SSH public key

## Usage

### Install Dependencies
```powershell
pip install -r config/requirements.txt
```

### Cross-Platform Install
```powershell
pip install -r config/requirements_cross_platform.txt
```

## Notes

- Keep `gitssh` private and secure
- Update `requirements.txt` when adding new dependencies
- `results.csv` is for testing purposes
