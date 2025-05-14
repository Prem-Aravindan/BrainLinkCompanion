# macOS Troubleshooting Guide

## Serial Port Access

When using BrainCompanion on macOS, you may need to grant permission for the application to access serial ports:

1. Connect your BrainLink device to your Mac
2. Go to System Preferences > Security & Privacy > Privacy > USB
3. Make sure BrainCompanion is allowed to access the USB device

If your device is not automatically detected:

1. Open Terminal and run: `ls /dev/tty.*` to see all available serial ports
2. Look for entries like `/dev/tty.usbserial*` or `/dev/tty.usbmodem*`
3. If you can identify your device, you can manually select it in the app diagnostics

## SSL Certificate Issues

If you encounter SSL certificate issues when connecting to the backend servers:

1. Make sure your macOS has up-to-date root certificates
2. Try using a direct connection without proxy settings
3. In some corporate environments, you may need to install additional certificates

## Python Environment

If you're running the application from Python source (not the bundled app):

1. Make sure you've installed all dependencies: `pip install -r requirements.txt`
2. Some packages might need to be installed with Homebrew first:
   ```
   brew install python-tk@3.9
   brew install qt@5
   ```

## Common Issues

### Device Not Detected

If the BrainLink device is not automatically detected:

1. Run the "Run Diagnostics" option in the app
2. Look at the list of serial ports
3. Try unplugging and reconnecting the device

### App Crashes on Startup

If the app crashes immediately:

1. Try running it from the command line to see error messages:
   ```
   open /Applications/BrainCompanion.app --args --debug
   ```
2. Check if all required dependencies are installed

### Data Not Being Sent to Backend

If the device is connected but data isn't reaching the server:

1. Check your internet connection
2. Try selecting a different environment (EN/NL/Local)
3. Verify your login credentials
