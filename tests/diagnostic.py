"""
BrainLink Companion App Diagnostic Tool

This script helps diagnose connection issues with the BrainLink Companion App.
Run this script to check for common problems that might prevent the app from connecting.
"""

import sys
import os
import platform
import requests
import ssl
import socket
import serial.tools.list_ports

def print_section(title):
    print("\n" + "=" * 60)
    print(f" {title} ".center(60, "-"))
    print("=" * 60)

def check_python_version():
    print_section("Python Environment")
    print(f"Python Version: {sys.version}")
    print(f"Platform: {platform.platform()}")
    print(f"Implementation: {platform.python_implementation()}")

def check_network():
    print_section("Network Connectivity")
    
    test_urls = [
        "https://en.mindspeller.com/api/cas/token/login",
        "https://nl.mindspeller.com/api/cas/token/login",
        "http://127.0.0.1:5000/api/cas/token/login"
    ]
    
    for url in test_urls:
        print(f"\nTesting connection to: {url}")
        try:
            response = requests.head(url, timeout=5, verify=True)
            print(f"  HEAD request Status: {response.status_code}")
            print(f"  SSL/TLS Verification: Passed")
        except requests.exceptions.SSLError as e:
            print(f"  SSL/TLS Error: {str(e)}")
            try:
                response = requests.head(url, timeout=5, verify=False)
                print(f"  HEAD request without SSL verification Status: {response.status_code}")
                print(f"  SSL/TLS Verification: Failed but connection works without it")
            except Exception as e2:
                print(f"  Connection failed even without SSL verification: {str(e2)}")
        except requests.exceptions.ConnectionError as e:
            print(f"  Connection Error: {str(e)}")
        except Exception as e:
            print(f"  Other Error: {str(e)}")

def check_ssl():
    print_section("SSL/TLS Configuration")
    print(f"OpenSSL Version: {ssl.OPENSSL_VERSION}")
    
    # Check support for various TLS protocols
    protocols = [
        ssl.PROTOCOL_TLSv1,
        ssl.PROTOCOL_TLSv1_1,
        ssl.PROTOCOL_TLSv1_2,
        ssl.PROTOCOL_TLS,
    ]
    
    for protocol in protocols:
        try:
            ssl.SSLContext(protocol)
            print(f"Protocol {protocol} is supported")
        except Exception as e:
            print(f"Protocol {protocol} is not supported: {e}")

def check_serial_ports():
    print_section("Serial Ports")
    ports = serial.tools.list_ports.comports()
    
    if not ports:
        print("No serial ports detected!")
    else:
        print("Available serial ports:")
        for port in ports:
            print(f"  - {port.device}")
            print(f"    Description: {port.description}")
            print(f"    HWID: {port.hwid}")
            
    # Check specifically for BrainLink
    brainlink_port = None
    for port in ports:
        if "5C361634682F" in port.hwid:
            brainlink_port = port.device
            break
    
    if brainlink_port:
        print(f"\nBrainLink device detected on port: {brainlink_port}")
    else:
        print("\nNo BrainLink device detected!")

def check_dependencies():
    print_section("Dependencies")
    required_packages = [
        "requests",
        "serial",
        "cushy_serial",
        "numpy",
        "scipy",
        "pyqtgraph",
        "PySide6"
    ]
    
    for package in required_packages:
        try:
            module = __import__(package)
            if hasattr(module, "__version__"):
                version = module.__version__
            elif hasattr(module, "version"):
                version = module.version
            else:
                version = "Unknown"
            print(f"{package} - Version: {version} - OK")
        except ImportError:
            print(f"{package} - NOT FOUND!")

def try_login():
    print_section("Login Test")
    print("This will attempt a login to verify credentials.")
    print("You can enter fake credentials to just test the connection.")
    print("(This won't store or send your credentials anywhere except to the login server)")
    
    try_login = input("\nDo you want to test login? (y/n): ").lower() == 'y'
    
    if not try_login:
        print("Skipping login test.")
        return
    
    username = input("Enter username: ")
    password = input("Enter password: ")
    
    login_urls = [
        "https://en.mindspeller.com/api/cas/token/login",
        "https://nl.mindspeller.com/api/cas/token/login"
    ]
    
    for login_url in login_urls:
        print(f"\nTesting login at: {login_url}")
        login_payload = {"username": username, "password": password}
        
        try:
            # With SSL verification
            print("Attempting with SSL verification...")
            response = requests.post(
                login_url,
                json=login_payload,
                headers={"Content-Type": "application/json"},
                timeout=5,
                verify=True
            )
            print(f"Status: {response.status_code}")
            if hasattr(response, 'text'):
                print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error with SSL verification: {str(e)}")
        
        try:
            # Without SSL verification
            print("Attempting without SSL verification...")
            response = requests.post(
                login_url,
                json=login_payload,
                headers={"Content-Type": "application/json"},
                timeout=5,
                verify=False
            )
            print(f"Status: {response.status_code}")
            if hasattr(response, 'text'):
                print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error without SSL verification: {str(e)}")
        
        try:
            # With form data instead of JSON
            print("Attempting with form data...")
            response = requests.post(
                login_url,
                data=login_payload,
                timeout=5,
                verify=False
            )
            print(f"Status: {response.status_code}")
            if hasattr(response, 'text'):
                print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error with form data: {str(e)}")

def main():
    print("BrainLink Companion App Diagnostic Tool")
    print("======================================")
    print("This tool will check for common issues that might prevent the app from working.")
    print("The results will be displayed in the console and saved to 'diagnostic_results.txt'.")
    
    # Redirect stdout to both console and file
    original_stdout = sys.stdout
    with open('diagnostic_results.txt', 'w') as f:
        class TeeOutput:
            def write(self, message):
                original_stdout.write(message)
                f.write(message)
            def flush(self):
                original_stdout.flush()
                f.flush()
        
        sys.stdout = TeeOutput()
        
        try:
            check_python_version()
            check_dependencies()
            check_network()
            check_ssl()
            check_serial_ports()
            try_login()
            
            print_section("Conclusion")
            print("Diagnostic complete! Please send the 'diagnostic_results.txt' file")
            print("to the developer for analysis.")
        finally:
            sys.stdout = original_stdout
    
    print("\nDiagnostic results saved to 'diagnostic_results.txt'")
    input("Press Enter to exit...")

if __name__ == "__main__":
    main()
