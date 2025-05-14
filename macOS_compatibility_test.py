#!/usr/bin/env python3
# macOS_compatibility_test.py - Tests if BrainCompanion can run on macOS

import os
import sys
import platform
import importlib.util
import subprocess
import pkg_resources

def check_platform():
    """Check if running on macOS"""
    print(f"Current platform: {platform.system()}")
    if platform.system() != "Darwin":
        print("WARNING: This test is designed to run on macOS, but you're running it on another platform.")
        print("The results may not accurately reflect macOS compatibility.")
    return platform.system() == "Darwin"

def check_python_version():
    """Check Python version compatibility"""
    python_version = sys.version_info
    print(f"Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 7):
        print("❌ Python version too old. Need Python 3.7+")
        return False
    print("✅ Python version OK")
    return True

def check_required_modules():
    """Check if all required modules can be imported"""
    required_modules = [
        "PySide6", "numpy", "scipy", "pyqtgraph", "serial", "requests", 
        "cushy_serial", "ssl", "threading", "time"
    ]
    
    missing = []
    for module in required_modules:
        try:
            importlib.import_module(module)
            print(f"✅ Module '{module}' is available")
        except ImportError:
            print(f"❌ Module '{module}' is missing")
            missing.append(module)
    
    return len(missing) == 0

def check_qt_installation():
    """Check if Qt is properly installed"""
    try:
        from PySide6.QtWidgets import QApplication
        from PySide6.QtCore import QSettings
        print("✅ Qt/PySide6 is properly installed")
        return True
    except Exception as e:
        print(f"❌ Qt/PySide6 error: {str(e)}")
        return False

def check_serial_ports():
    """Check for available serial ports"""
    import serial.tools.list_ports
    ports = list(serial.tools.list_ports.comports())
    
    print(f"Found {len(ports)} serial ports:")
    for port in ports:
        print(f"  - {port.device} ({port.description})")
    
    # Check for likely USB-Serial devices
    potential_brainlink = []
    for port in ports:
        if port.device.startswith(("/dev/tty.usbserial", "/dev/tty.usbmodem")):
            potential_brainlink.append(port)
    
    if potential_brainlink:
        print(f"✅ Found {len(potential_brainlink)} potential USB-Serial devices")
        for port in potential_brainlink:
            print(f"  - {port.device} ({port.description})")
    else:
        print("⚠️ No USB-Serial devices detected")
    
    return len(ports) > 0

def check_ssl_support():
    """Check SSL/TLS support"""
    import ssl
    print(f"OpenSSL version: {ssl.OPENSSL_VERSION}")
    
    try:
        context = ssl.create_default_context()
        print("✅ SSL context created successfully")
        return True
    except Exception as e:
        print(f"❌ SSL error: {str(e)}")
        return False

def check_environment_variables():
    """Check for proxy and other relevant environment variables"""
    relevant_vars = ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "PYTHONPATH"]
    
    for var in relevant_vars:
        value = os.environ.get(var)
        if value:
            print(f"✅ Found environment variable: {var}={value}")
        else:
            print(f"  Variable {var} not set")
    
    return True

def run_ui_test():
    """Run a minimal UI test"""
    try:
        code = """
import sys
from PySide6.QtWidgets import QApplication, QMainWindow, QPushButton

app = QApplication(sys.argv)
window = QMainWindow()
window.setWindowTitle("macOS Test")
window.resize(300, 200)
button = QPushButton("Test Passed!", window)
button.move(100, 80)
window.show()
sys.exit(app.exec())
"""
        print("Running minimal UI test...")
        print("A window should appear briefly. Close it to continue the test.")
        
        # Save to temporary file and run
        with open("_temp_ui_test.py", "w") as f:
            f.write(code)
        
        # Run with a timeout to avoid hanging the test
        process = subprocess.Popen([sys.executable, "_temp_ui_test.py"])
        try:
            process.wait(timeout=10)  # 10 seconds timeout
            print("✅ UI test completed")
            result = True
        except subprocess.TimeoutExpired:
            print("❌ UI test timed out")
            process.kill()
            result = False
        
        # Clean up
        if os.path.exists("_temp_ui_test.py"):
            os.remove("_temp_ui_test.py")
        
        return result
    except Exception as e:
        print(f"❌ UI test error: {str(e)}")
        return False

def main():
    print("=" * 60)
    print("BrainCompanion macOS Compatibility Test")
    print("=" * 60)
    print()
    
    is_macos = check_platform()
    python_ok = check_python_version()
    modules_ok = check_required_modules()
    qt_ok = check_qt_installation()
    serial_ok = check_serial_ports()
    ssl_ok = check_ssl_support()
    env_ok = check_environment_variables()
    ui_ok = run_ui_test()
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    results = [
        ("Running on macOS", is_macos),
        ("Python version", python_ok),
        ("Required modules", modules_ok),
        ("Qt installation", qt_ok),
        ("Serial port detection", serial_ok),
        ("SSL/TLS support", ssl_ok),
        ("Environment variables", env_ok),
        ("UI rendering", ui_ok)
    ]
    
    all_passed = True
    for test, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test}: {status}")
        all_passed = all_passed and result
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 All tests passed! BrainCompanion should work on this macOS system.")
    else:
        print("⚠️ Some tests failed. Check the issues above before running BrainCompanion.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
