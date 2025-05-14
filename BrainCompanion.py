import sys, os, time, threading, requests
import serial.tools.list_ports
from cushy_serial import CushySerial
from BrainLinkParser.BrainLinkParser import BrainLinkParser
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QRadioButton, QButtonGroup, QDialog, QFormLayout, QLineEdit,
    QDialogButtonBox, QGroupBox, QCheckBox, QTextEdit, QMessageBox, QInputDialog
)
from PySide6.QtCore import QTimer, Qt, QSettings
from PySide6.QtGui import QIcon
import pyqtgraph as pg
from scipy.signal import butter, filtfilt, iirnotch, welch
from scipy.integrate import simpson as simps
import numpy as np
import platform
import ssl

# Import winreg only on Windows
if platform.system() == 'Windows':
    import winreg

# Configure requests to use system proxy settings
def setup_system_proxy():
    """Configure requests to use system proxy settings"""
    try:
        if platform.system() == 'Windows':
            # Windows: Access the Windows Registry to get proxy settings
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 
                            r'Software\Microsoft\Windows\CurrentVersion\Internet Settings') as key:
                # Check if proxy is enabled
                proxy_enabled = winreg.QueryValueEx(key, 'ProxyEnable')[0]
                
                if proxy_enabled:
                    # Get proxy server address
                    proxy_server = winreg.QueryValueEx(key, 'ProxyServer')[0]
                    print(f"System proxy detected: {proxy_server}")
                    
                    # Configure requests to use the proxy
                    if "=" in proxy_server:  # Multiple protocols specified
                        proxies = {}
                        for p in proxy_server.split(";"):
                            if "=" in p:
                                protocol, address = p.split("=", 1)
                                if protocol.lower() in ('http', 'https'):
                                    proxies[protocol] = address
                    else:  # Single proxy for all protocols
                        proxies = {
                            'http': f'http://{proxy_server}',
                            'https': f'http://{proxy_server}'
                        }
                    
                    # Apply proxy settings to requests session
                    session = requests.Session()
                    session.proxies.update(proxies)
                    
                    # Monkey patch the requests.api functions to use our session
                    for func in ('get', 'post', 'put', 'delete', 'head', 'options', 'patch'):
                        setattr(requests, func, getattr(session, func))
                    
                    return True
        elif platform.system() == 'Darwin':  # macOS
            # On macOS, requests should automatically use system proxy settings
            # But we can explicitly try to get them from environment variables
            http_proxy = os.environ.get('http_proxy') or os.environ.get('HTTP_PROXY')
            https_proxy = os.environ.get('https_proxy') or os.environ.get('HTTPS_PROXY')
            
            if http_proxy or https_proxy:
                proxies = {}
                if http_proxy:
                    proxies['http'] = http_proxy
                    print(f"HTTP proxy detected: {http_proxy}")
                if https_proxy:
                    proxies['https'] = https_proxy
                    print(f"HTTPS proxy detected: {https_proxy}")
                
                # Apply proxy settings to requests session
                session = requests.Session()
                session.proxies.update(proxies)
                
                # Monkey patch the requests.api functions to use our session
                for func in ('get', 'post', 'put', 'delete', 'head', 'options', 'patch'):
                    setattr(requests, func, getattr(session, func))
                
                return True
    except Exception as e:
        print(f"Error setting up system proxy: {e}")
    
    return False

# Try to configure system proxy on module import
proxy_configured = setup_system_proxy()

# --- OS Selection Dialog ---
class OSSelectionDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Select Your Operating System")
        self.setMinimumWidth(300)

        # Determine default based on auto-detection
        if sys.platform.startswith("win"):
            default_os = "Windows"
        elif sys.platform.startswith("darwin"):
            default_os = "macOS"
        else:
            default_os = "Windows"

        self.selected_os = default_os

        self.radio_windows = QRadioButton("Windows")
        self.radio_macos = QRadioButton("macOS")
        if default_os == "Windows":
            self.radio_windows.setChecked(True)
        else:
            self.radio_macos.setChecked(True)

        layout = QVBoxLayout()
        layout.addWidget(QLabel("Please select your operating system:"))
        layout.addWidget(self.radio_windows)
        layout.addWidget(self.radio_macos)

        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

        self.setLayout(layout)

    def get_selected_os(self):
        if self.radio_windows.isChecked():
            return "Windows"
        else:
            return "macOS"

# --- Helper to locate asset files ---
def resource_path(relative_path):
    """
    Get absolute path to resource, works for dev and for PyInstaller.
    Note: You might add OS specific adjustments here if necessary.
    """
    base_path = getattr(sys, '_MEIPASS', os.path.abspath("."))
    return os.path.join(base_path, relative_path)

# Global variables
BACKEND_URL = None
SERIAL_PORT = None
SERIAL_BAUD = 115200
stop_thread_flag = False
live_data_buffer = []  

def detect_brainlink():
    ports = serial.tools.list_ports.comports()
    brainlink_port = None
    
    if platform.system() == 'Windows':
        # Windows: Identifies the device by a unique substring in its HWID.
        for port in ports:
            if "5C361634682F" in port.hwid:
                brainlink_port = port.device
                break
    elif platform.system() == 'Darwin':  # macOS
        # On macOS, look for the device by a combination of identifiers
        # This is a generic approach and might need adjustment for actual macOS BrainLink detection
        for port in ports:
            # Check for typical USB-to-Serial adapter manufacturers or BrainLink identifiers
            # You may need to adjust these based on actual device identifiers on macOS
            if any(id in port.description.lower() for id in ["brainlink", "neurosky", "ftdi", "silabs", "ch340"]):
                brainlink_port = port.device
                break
            
            # If no matches by description, try to check by port name patterns common for USB devices on macOS
            if not brainlink_port and port.device.startswith(("/dev/tty.usbserial", "/dev/tty.usbmodem")):
                brainlink_port = port.device
                break
    
    return brainlink_port

def onRaw(raw):
    global live_data_buffer
    live_data_buffer.append(raw)
    if len(live_data_buffer) > 1000:
        live_data_buffer = live_data_buffer[-1000:]

def onEEG(data):
    print("EEG -> attention:", data.attention, "meditation:", data.meditation)

def onExtendEEG(data):
    print("Extended EEG -> battery:", data.battery, "version:", data.version)

def onGyro(x, y, z):
    print(f"Gyro -> x={x}, y={y}, z={z}")

def onRR(rr1, rr2, rr3):
    print(f"RR -> rr1={rr1}, rr2={rr2}, rr3={rr3}")

def run_brainlink(serial_obj):
    global stop_thread_flag
    parser = BrainLinkParser(onEEG, onExtendEEG, onGyro, onRR, onRaw)

    @serial_obj.on_message()
    def handle_serial_message(msg: bytes):
        parser.parse(msg)

    serial_obj.open()
    print(f"Opened {SERIAL_PORT} at {SERIAL_BAUD} baud.")
    print("BrainLink local companion is running. Close the window or click Exit to stop.")
    try:
        while not stop_thread_flag:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Exiting local companion app (KeyboardInterrupt).")
    finally:
        if serial_obj.is_open:
            serial_obj.close()
        print("Serial closed. Thread exiting.")

def butter_lowpass_filter(data, cutoff, fs, order=2):
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    return filtfilt(b, a, data)

def bandpass_filter(data, lowcut=1.0, highcut=45.0, fs=256, order=2):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return filtfilt(b, a, data)

def notch_filter(data, fs, notch_freq=60.0, quality_factor=30.0):
    freq_ratio = notch_freq / (fs / 2.0)
    b, a = iirnotch(freq_ratio, quality_factor)
    return filtfilt(b, a, data)

FS = 256
WINDOW_SIZE = 256 
OVERLAP_SIZE = 128
EEG_BANDS = {
    'delta': (0.5, 4),
    'theta': (4, 8),
    'alpha': (8, 12),
    'beta': (12, 30),
    'gamma': (30, 45)
}

def compute_psd(data, fs):
    freqs, psd = welch(data, fs=fs, nperseg=WINDOW_SIZE, noverlap=OVERLAP_SIZE)
    return freqs, psd

def bandpower(psd, freqs, band):
    low, high = EEG_BANDS[band]
    idx = np.logical_and(freqs >= low, freqs <= high)
    if np.sum(idx) == 0:
        return 0  # Return zero if no values are found for this band
    bp = simps(psd[idx], dx=freqs[1] - freqs[0])
    return bp

# --- Login Dialog ---
class LoginDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Login")
        self.setWindowIcon(QIcon(resource_path("assets/favicon.ico")))
        self.setMinimumWidth(300)
        self.settings = QSettings("MyCompany", "BrainLinkApp")
        
        self.username_edit = QLineEdit()
        saved_username = self.settings.value("username", "")
        self.username_edit.setText(saved_username)
        
        self.password_edit = QLineEdit()
        saved_password = self.settings.value("password", "")
        self.password_edit.setText(saved_password)
        self.password_edit.setEchoMode(QLineEdit.Password)
        
        # Add an eye icon action to toggle password visibility
        self.eye_visible = False
        self.eye_action = self.password_edit.addAction(QIcon(resource_path("assets/eye-off.png")), QLineEdit.TrailingPosition)
        self.eye_action.triggered.connect(self.toggle_password_visibility)
        
        self.remember_checkbox = QCheckBox("Remember Me")
        if saved_username:
            self.remember_checkbox.setChecked(True)
        
        form_layout = QFormLayout()
        form_layout.addRow("Username:", self.username_edit)
        form_layout.addRow("Password:", self.password_edit)
        form_layout.addRow("", self.remember_checkbox)
        
        buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        
        layout = QVBoxLayout()
        layout.addLayout(form_layout)
        layout.addWidget(buttons)
        self.setLayout(layout)
        
        self.setStyleSheet("""
            QLabel { font-size: 14px; }
            QLineEdit { font-size: 14px; padding: 4px; }
            QCheckBox { font-size: 14px; }
            QDialog { background-color: #7878e9; }
        """)
    
    def toggle_password_visibility(self):
        if self.eye_visible:
            self.password_edit.setEchoMode(QLineEdit.Password)
            self.eye_action.setIcon(QIcon(resource_path("assets/eye-off.png")))
            self.eye_visible = False
        else:
            self.password_edit.setEchoMode(QLineEdit.Normal)
            self.eye_action.setIcon(QIcon(resource_path("assets/eye.png")))
            self.eye_visible = True
    
    def get_credentials(self):
        if self.remember_checkbox.isChecked():
            self.settings.setValue("username", self.username_edit.text())
            self.settings.setValue("password", self.password_edit.text())
        else:
            self.settings.remove("username")
            self.settings.remove("password")
        return self.username_edit.text(), self.password_edit.text()

# --- Main Window ---
class MainWindow(QMainWindow):
    def __init__(self, user_os, parent=None):
        super().__init__(parent)
        self.user_os = user_os  # Store the selected OS for future configuration if needed
        self.setWindowTitle(f"BrainLink Companion (PySide6) - {self.user_os}")
        self.setWindowIcon(QIcon(resource_path("assets/favicon.ico")))
        self.jwt_token = None
        self.brainlink_thread = None
        self.serial_obj = None
        self.setMinimumSize(900, 600)
        
        self.setStyleSheet("""
            QMainWindow { background: #7878e9; }
            QLabel { font-size: 14px; }
            QPushButton {
                background-color: #0A00FF;
                color: white;
                border-radius: 5px;
                padding: 8px;
                font-size: 14px;
            }
            QPushButton:disabled { background-color: #a0a0a0; }
            QRadioButton { font-size: 14px; }
            QGroupBox {
                margin-top: 10px;
                border: 1px solid #a0a0a0;
                border-radius: 5px;
                padding: 5px;
            }
            QLineEdit { font-size: 14px; padding: 4px; }
            QTextEdit { font-size: 14px; }
        """)
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(15)
        
        header = QLabel("BrainLink Companion")
        header.setAlignment(Qt.AlignCenter)
        header.setStyleSheet("font-size: 24px; font-weight: bold;")
        main_layout.addWidget(header)
        
        env_groupbox = QGroupBox("Select Environment")
        env_layout = QHBoxLayout()
        self.env_group = QButtonGroup(self)
        self.radio_en = QRadioButton("EN (PROD Environment)")
        self.radio_nl = QRadioButton("NL (PROD Environment)")
        self.radio_local = QRadioButton("Local (127.0.0.1:5000)")
        self.radio_en.setChecked(True)
        self.env_group.addButton(self.radio_en)
        self.env_group.addButton(self.radio_nl)
        self.env_group.addButton(self.radio_local)
        env_layout.addWidget(self.radio_en)
        env_layout.addWidget(self.radio_nl)
        env_layout.addWidget(self.radio_local)
        env_groupbox.setLayout(env_layout)
        main_layout.addWidget(env_groupbox)
        
        global SERIAL_PORT
        SERIAL_PORT = detect_brainlink()
        if not SERIAL_PORT:
            self.log_message("No device found!")
            global stop_thread_flag
            stop_thread_flag = True
        
        self.status_label = QLabel("Not running yet.")
        self.status_label.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(self.status_label)
        
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground("#000")
        main_layout.addWidget(self.plot_widget, stretch=1)
        self.live_curve = self.plot_widget.plot([], [], pen=pg.mkPen('g', width=2))
        
        # Log area to show process messages so user isn't clueless
        self.log_area = QTextEdit()
        self.log_area.setReadOnly(True)
        self.log_area.setFixedHeight(100)
        main_layout.addWidget(self.log_area)
          # Update interval now 1 second to ease server load (or adjust as needed)
        self.live_timer = QTimer(self)
        self.live_timer.timeout.connect(self.update_live_plot)
        self.live_timer.start(1000)
        
        button_layout = QHBoxLayout()
        self.start_button = QPushButton("Start")
        self.start_button.clicked.connect(self.on_start_clicked)
        button_layout.addWidget(self.start_button)
        
        self.diagnostics_button = QPushButton("Run Diagnostics")
        self.diagnostics_button.clicked.connect(self.run_diagnostics)
        button_layout.addWidget(self.diagnostics_button)
        
        self.exit_button = QPushButton("Exit")
        self.exit_button.clicked.connect(self.close)
        button_layout.addWidget(self.exit_button)
        main_layout.addLayout(button_layout)
        main_layout.addStretch()
    
    def log_message(self, message):
        """Append a timestamped message to the log area and update the status label."""
        from datetime import datetime
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_area.append(f"[{timestamp}] {message}")
        self.status_label.setText(message)
    
    def update_live_plot(self):
        global live_data_buffer
        if len(live_data_buffer) < 3:
            self.live_curve.setData(live_data_buffer)
            return
        
        # Process the data as before...
        data = np.array(live_data_buffer)
        fs = 256
        
        data_notched = notch_filter(data, fs, notch_freq=50.0, quality_factor=30.0)
        filtered = bandpass_filter(data_notched, lowcut=1.0, highcut=45.0, fs=fs, order=2)
        self.live_curve.setData(filtered)
        
        signal = np.array(filtered)
        freqs, psd = compute_psd(signal, FS)
        total_power = simps(psd, dx=freqs[1] - freqs[0])
        
        # Calculate band powers
        delta_power = bandpower(psd, freqs, 'delta')
        theta_power = bandpower(psd, freqs, 'theta')
        alpha_power = bandpower(psd, freqs, 'alpha')
        beta_power = bandpower(psd, freqs, 'beta')
        gamma_power = bandpower(psd, freqs, 'gamma')
        
        # Calculate relative powers if total_power > 0
        delta_relative = delta_power / total_power if total_power > 0 else 0
        theta_relative = theta_power / total_power if total_power > 0 else 0
        alpha_relative = alpha_power / total_power if total_power > 0 else 0
        beta_relative = beta_power / total_power if total_power > 0 else 0
        gamma_relative = gamma_power / total_power if total_power > 0 else 0
        self.log_message(f"theta power: {theta_relative:.2f}")
          # Extended payload with all metrics
        payload = {
            'Delta power': delta_power, 'Relative Delta': delta_relative,
            'Theta power': theta_power, 'Relative Theta': theta_relative,
            'Alpha power': alpha_power, 'Relative Alpha': alpha_relative,
            'Beta power': beta_power, 'Relative Beta': beta_relative,
            'Gamma power': gamma_power, 'Relative Gamma': gamma_relative
        }
        headers = {"X-Authorization": f"Bearer {self.jwt_token}"} if self.jwt_token else {}
        try:
            response = requests.post(BACKEND_URL, json=payload, headers=headers, timeout=2)
            if response.status_code == 200:
                self.log_message("Data sent successfully")
            else:
                self.log_message(f"Error sending data: {response.status_code}")
        except requests.exceptions.ProxyError as e:
            self.log_message(f"Proxy error: {str(e)}")
            try:
                # Try once more without proxy
                direct_session = requests.Session()
                direct_session.proxies = {}
                response = direct_session.post(BACKEND_URL, json=payload, headers=headers, timeout=2)
                if response.status_code == 200:
                    self.log_message("Data sent successfully (direct connection)")
                else:
                    self.log_message(f"Error sending data (direct connection): {response.status_code}")
            except Exception as e2:
                self.log_message(f"Error sending data without proxy: {str(e2)}")
        except Exception as e:
            self.log_message(f"Error sending data: {str(e)}")
    
    def on_start_clicked(self):
        global BACKEND_URL, SERIAL_PORT
        if self.radio_en.isChecked():
            BACKEND_URL = "https://en.mindspeller.com/api/cas/brainlink_data"
            login_url = "https://en.mindspeller.com/api/cas/token/login"
            self.log_message("Using EN environment")
        elif self.radio_nl.isChecked():
            BACKEND_URL = "https://nl.mindspeller.com/api/cas/brainlink_data"
            login_url = "https://nl.mindspeller.com/api/cas/token/login"
            self.log_message("Using NL environment")
        else:
            BACKEND_URL = "http://127.0.0.1:5000/api/cas/brainlink_data"
            login_url = "http://127.0.0.1:5000/api/cas/token/login"
            self.log_message("Using local environment")
        login_dialog = LoginDialog(self)
        self.log_message("Opening login dialog...")
        if login_dialog.exec() == QDialog.Accepted:
            username, password = login_dialog.get_credentials()
            # Log masked password for debugging (never log actual passwords in production)
            # self.log_message(f"Attempting login with username: {username}, password: {'*' * len(password)}")
            
            # Try different payload formats that the API might be expecting
            login_payload = {
                "username": username,
                "password": password
            }
            self.log_message("Sending login request...")
            try:                # First try with certificate verification
                self.log_message(f"Connecting to {login_url}")
                try:
                    login_response = requests.post(
                        login_url, 
                        json=login_payload,
                        headers={"Content-Type": "application/json"},
                        timeout=5,  # Increased timeout for slower networks
                        verify=True  # Enable SSL certificate verification
                    )                
                except requests.exceptions.ProxyError as e:
                    self.log_message(f"Proxy error: {str(e)}. Will retry without proxy...")
                    # Create a direct session without proxy for this specific request
                    direct_session = requests.Session()
                    direct_session.proxies = {} # Empty proxies means direct connection
                    login_response = direct_session.post(
                        login_url, 
                        json=login_payload,
                        headers={"Content-Type": "application/json"},
                        timeout=5,
                        verify=True
                    )
                
                if login_response.status_code == 200:
                    data = login_response.json()
                    self.jwt_token = data.get("x-jwt-access-token")
                    if self.jwt_token:
                        self.log_message("Login successful. JWT obtained.")
                    else:
                        self.log_message("Login response didn't contain expected token. Received: " + str(data))
                        return
                else:
                    # If the first attempt fails, try without certificate verification
                    self.log_message(f"First login attempt failed with status {login_response.status_code}. Trying without certificate verification...")
                    login_response = requests.post(
                        login_url, 
                        json=login_payload,
                        headers={"Content-Type": "application/json"},
                        timeout=2,
                        verify=False  # Disable SSL certificate verification
                    )
                    if login_response.status_code == 200:
                        data = login_response.json()
                        self.jwt_token = data.get("x-jwt-access-token")
                        self.log_message("Login successful (without SSL verification). JWT obtained.")
                    else:
                        self.log_message(f"Login failed: {login_response.status_code}")
                        if hasattr(login_response, 'text'):
                            self.log_message(f"Response details: {login_response.text}")
                        
                        # Try one more time with form data in case the API expects that format
                        self.log_message("Trying with different payload format...")
                        login_response = requests.post(
                            login_url,
                            data=login_payload,  # Using data instead of json
                            timeout=2,
                            verify=False
                        )
                        if login_response.status_code == 200:
                            data = login_response.json()
                            self.jwt_token = data.get("x-jwt-access-token")
                            self.log_message("Login successful with alternate format. JWT obtained.")
                        else:
                            self.log_message(f"All login attempts failed. Status: {login_response.status_code}")
                            if hasattr(login_response, 'text'):
                                self.log_message(f"Response details: {login_response.text}")
                        return
            except requests.exceptions.SSLError as e:
                self.log_message(f"SSL Error: {str(e)}")
                return
            except requests.exceptions.ConnectionError as e:
                self.log_message(f"Connection Error: {str(e)}")
                return
            except Exception as e:
                self.log_message(f"Login error: {str(e)}")
                return
        else:
            self.log_message("Login canceled.")
            return
        
        self.serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)
        self.log_message("Starting BrainLink thread...")
        self.brainlink_thread = threading.Thread(target=run_brainlink, args=(self.serial_obj,))
        self.brainlink_thread.start()
        self.start_button.setEnabled(False)        
        self.log_message(f"Running... Sending data to {BACKEND_URL}")
    
    def closeEvent(self, event):
        global stop_thread_flag
        stop_thread_flag = True
        if self.serial_obj and self.serial_obj.is_open:
            self.serial_obj.close()
        if self.brainlink_thread and self.brainlink_thread.is_alive():
            self.brainlink_thread.join()
        event.accept()
    
    def run_diagnostics(self):
        """Run diagnostic tests and display results in the log area."""
        self.log_message("Starting diagnostic tests...")
        
        # Create a string buffer to capture diagnostic output
        diagnostic_results = []
        
        def add_result(message):
            self.log_message(message)
            diagnostic_results.append(message)
        
        def print_section(title):
            separator = "=" * 60
            add_result("\n" + separator)
            add_result(f" {title} ".center(58, "-"))
            add_result(separator)
        
        # Python Environment
        print_section("Python Environment")
        add_result(f"Python Version: {sys.version}")
        add_result(f"Platform: {platform.platform()}")
        add_result(f"Implementation: {platform.python_implementation()}")
        
        # Dependencies
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
                add_result(f"{package} - Version: {version} - OK")
            except ImportError:
                add_result(f"{package} - NOT FOUND!")
          # Network Connectivity
        print_section("Network Connectivity")
        
        # Check and display proxy settings
        try:
            if platform.system() == 'Windows':
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, 
                              r'Software\Microsoft\Windows\CurrentVersion\Internet Settings') as key:
                    proxy_enabled = winreg.QueryValueEx(key, 'ProxyEnable')[0]
                    if proxy_enabled:
                        proxy_server = winreg.QueryValueEx(key, 'ProxyServer')[0]
                        add_result(f"System Proxy: ENABLED - {proxy_server}")
                        try:
                            proxy_bypass = winreg.QueryValueEx(key, 'ProxyOverride')[0]
                            add_result(f"Proxy Bypass: {proxy_bypass}")
                        except:
                            add_result("No proxy bypass settings found")
                    else:
                        add_result("System Proxy: DISABLED")
            elif platform.system() == 'Darwin':
                http_proxy = os.environ.get('http_proxy') or os.environ.get('HTTP_PROXY')
                https_proxy = os.environ.get('https_proxy') or os.environ.get('HTTPS_PROXY')
                if http_proxy or https_proxy:
                    if http_proxy:
                        add_result(f"HTTP proxy detected: {http_proxy}")
                    if https_proxy:
                        add_result(f"HTTPS proxy detected: {https_proxy}")
                else:
                    add_result("No proxy settings detected on macOS")
        except Exception as e:
            add_result(f"Error reading proxy settings: {str(e)}")
            
        # Test connections to endpoints
        test_urls = [
            "https://en.mindspeller.com/api/cas/token/login",
            "https://nl.mindspeller.com/api/cas/token/login",
            "http://127.0.0.1:5000/api/cas/token/login"
        ]
        
        for url in test_urls:
            add_result(f"\nTesting connection to: {url}")
            try:
                response = requests.head(url, timeout=5, verify=True)
                add_result(f"  HEAD request Status: {response.status_code}")
                add_result(f"  SSL/TLS Verification: Passed")
            except requests.exceptions.SSLError as e:
                add_result(f"  SSL/TLS Error: {str(e)}")
                try:
                    response = requests.head(url, timeout=5, verify=False)
                    add_result(f"  HEAD request without SSL verification Status: {response.status_code}")
                    add_result(f"  SSL/TLS Verification: Failed but connection works without it")
                except Exception as e2:
                    add_result(f"  Connection failed even without SSL verification: {str(e2)}")
            except requests.exceptions.ConnectionError as e:
                add_result(f"  Connection Error: {str(e)}")
            except Exception as e:
                add_result(f"  Other Error: {str(e)}")
        
        # SSL/TLS Configuration
        print_section("SSL/TLS Configuration")
        add_result(f"OpenSSL Version: {ssl.OPENSSL_VERSION}")
        
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
                add_result(f"Protocol {protocol} is supported")
            except Exception as e:
                add_result(f"Protocol {protocol} is not supported: {e}")
        
        # Serial Ports
        print_section("Serial Ports")
        ports = serial.tools.list_ports.comports()
        
        if not ports:
            add_result("No serial ports detected!")
        else:
            add_result("Available serial ports:")
            for port in ports:
                add_result(f"  - {port.device}")
                add_result(f"    Description: {port.description}")
                add_result(f"    HWID: {port.hwid}")
                
        # Check specifically for BrainLink
        brainlink_port = None
        for port in ports:
            if "5C361634682F" in port.hwid:
                brainlink_port = port.device
                break
        
        if brainlink_port:
            add_result(f"\nBrainLink device detected on port: {brainlink_port}")
        else:
            add_result("\nNo BrainLink device detected!")
        
        # Login Test (optional)
        result = QMessageBox.question(
            self,
            "Login Test",
            "Do you want to test login credentials?",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if result == QMessageBox.Yes:
            print_section("Login Test")
            username, ok1 = QInputDialog.getText(self, "Login Test", "Enter username:")
            if ok1:
                password, ok2 = QInputDialog.getText(self, "Login Test", "Enter password:", QLineEdit.Password)
                if ok2:
                    login_urls = [
                        "https://en.mindspeller.com/api/cas/token/login",
                        "https://nl.mindspeller.com/api/cas/token/login"
                    ]
                    
                    for login_url in login_urls:
                        add_result(f"\nTesting login at: {login_url}")
                        login_payload = {"username": username, "password": password}
                        
                        try:
                            # With SSL verification
                            add_result("Attempting with SSL verification...")
                            response = requests.post(
                                login_url,
                                json=login_payload,
                                headers={"Content-Type": "application/json"},
                                timeout=5,
                                verify=True
                            )
                            add_result(f"Status: {response.status_code}")
                            if hasattr(response, 'text'):
                                add_result(f"Response: {response.text}")
                        except Exception as e:
                            add_result(f"Error with SSL verification: {str(e)}")
                        
                        try:
                            # Without SSL verification
                            add_result("Attempting without SSL verification...")
                            response = requests.post(
                                login_url,
                                json=login_payload,
                                headers={"Content-Type": "application/json"},
                                timeout=5,
                                verify=False
                            )
                            add_result(f"Status: {response.status_code}")
                            if hasattr(response, 'text'):
                                add_result(f"Response: {response.text}")
                        except Exception as e:
                            add_result(f"Error without SSL verification: {str(e)}")
                        
                        try:
                            # With form data instead of JSON
                            add_result("Attempting with form data...")
                            response = requests.post(
                                login_url,
                                data=login_payload,
                                timeout=5,
                                verify=False
                            )
                            add_result(f"Status: {response.status_code}")
                            if hasattr(response, 'text'):
                                add_result(f"Response: {response.text}")
                        except Exception as e:
                            add_result(f"Error with form data: {str(e)}")
        
        # Save results to file
        print_section("Conclusion")
        add_result("Diagnostic complete!")
        
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'diagnostic_results.txt')
        with open(output_path, 'w') as f:
            f.write("\n".join(diagnostic_results))
        
        add_result(f"Results saved to: {output_path}")
        
        # Show completion message
        QMessageBox.information(
            self,
            "Diagnostics Complete",
            f"Diagnostic tests completed successfully.\nResults have been saved to:\n{output_path}"
        )

def main():
    app = QApplication(sys.argv)
    
    # Show OS selection dialog at startup:
    os_dialog = OSSelectionDialog()
    if os_dialog.exec() == QDialog.Accepted:
        user_os = os_dialog.get_selected_os()
    else:
        # If canceled, you could exit or set a default.
        user_os = "Windows"
    
    window = MainWindow(user_os)
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()

# So while you're collecting data at 256Hz, you're analyzing chunks of data (1 second worth of samples) and sending one summary/average to the backend every second. This is actually a good practice because:
#
# - It reduces network traffic and server load
# - It provides more stable measurements by averaging over a longer period
# - It still captures the relevant frequency information since you're using proper windowing and FFT techniques
# - If you needed higher temporal resolution, you could decrease the timer interval, but remember this would increase the number of API calls to your backend.
