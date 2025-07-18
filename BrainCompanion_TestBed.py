#!/usr/bin/env python3
"""
BrainLink Companion with Feature Analysis Test Bed
Enhanced version with local feature analysis, calibration, and histogram-based classification.
"""

import sys, os, time, threading, requests
import serial.tools.list_ports
from cushy_serial import CushySerial
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import json
from datetime import datetime

try:
    from BrainLinkParser.BrainLinkParser import BrainLinkParser
except ImportError:
    print("BrainLinkParser not available. Some functionality will be limited.")
    class BrainLinkParser:
        def __init__(self, *args, **kwargs):
            print("Using dummy BrainLinkParser for testing")
        def parse(self, *args, **kwargs):
            pass

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QRadioButton, QButtonGroup, QDialog, QFormLayout, QLineEdit,
    QDialogButtonBox, QGroupBox, QCheckBox, QTextEdit, QMessageBox, QInputDialog,
    QTabWidget, QComboBox, QSpinBox, QDoubleSpinBox, QProgressBar, QTableWidget,
    QTableWidgetItem, QHeaderView, QSplitter, QFrame
)
from PySide6.QtCore import QTimer, Qt, QSettings, QThread, pyqtSignal
from PySide6.QtGui import QIcon, QFont
import pyqtgraph as pg
from scipy.signal import butter, filtfilt, iirnotch, welch
from scipy.integrate import simpson as simps
import platform, ssl

# Import our feature analysis system
try:
    from feature_analysis_testbed import FeatureAnalyzer
except ImportError:
    print("feature_analysis_testbed not found. Make sure it's in the same directory.")

# Configure PyQtGraph
pg.setConfigOption('useOpenGL', False)
pg.setConfigOption('antialias', True)
pg.setConfigOption('background', 'k')
pg.setConfigOption('foreground', 'w')
pg.setConfigOption('crashWarning', True)
pg.setConfigOption('imageAxisOrder', 'row-major')

# Global variables
SERIAL_PORT = None
SERIAL_BAUD = 115200
stop_thread_flag = False
live_data_buffer = []

class FeatureAnalysisWidget(QWidget):
    """Widget for feature analysis and calibration."""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.analyzer = FeatureAnalyzer(fs=512, window_size=1.0, overlap=0.5)
        self.setup_ui()
        
        # Timer for real-time updates
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_real_time_display)
        self.update_timer.start(1000)  # Update every second
        
    def setup_ui(self):
        """Setup the UI for feature analysis."""
        layout = QVBoxLayout(self)
        
        # Control panel
        control_panel = QGroupBox("Calibration & Analysis Controls")
        control_layout = QVBoxLayout(control_panel)
        
        # Calibration buttons
        calibration_layout = QHBoxLayout()
        
        self.eyes_closed_btn = QPushButton("Start Eyes Closed (60s)")
        self.eyes_closed_btn.clicked.connect(lambda: self.start_calibration('eyes_closed'))
        calibration_layout.addWidget(self.eyes_closed_btn)
        
        self.eyes_open_btn = QPushButton("Start Eyes Open (60s)")
        self.eyes_open_btn.clicked.connect(lambda: self.start_calibration('eyes_open'))
        calibration_layout.addWidget(self.eyes_open_btn)
        
        self.task_btn = QPushButton("Start Task Recording")
        self.task_btn.clicked.connect(lambda: self.start_calibration('task'))
        calibration_layout.addWidget(self.task_btn)
        
        self.stop_btn = QPushButton("Stop Current Phase")
        self.stop_btn.clicked.connect(self.stop_calibration)
        calibration_layout.addWidget(self.stop_btn)
        
        control_layout.addLayout(calibration_layout)
        
        # Analysis buttons
        analysis_layout = QHBoxLayout()
        
        self.compute_baseline_btn = QPushButton("Compute Baseline")
        self.compute_baseline_btn.clicked.connect(self.compute_baseline)
        analysis_layout.addWidget(self.compute_baseline_btn)
        
        self.analyze_task_btn = QPushButton("Analyze Task Data")
        self.analyze_task_btn.clicked.connect(self.analyze_task)
        analysis_layout.addWidget(self.analyze_task_btn)
        
        self.generate_report_btn = QPushButton("Generate Report")
        self.generate_report_btn.clicked.connect(self.generate_report)
        analysis_layout.addWidget(self.generate_report_btn)
        
        control_layout.addLayout(analysis_layout)
        
        # Status display
        self.status_label = QLabel("Status: Ready")
        self.status_label.setStyleSheet("font-weight: bold; color: blue;")
        control_layout.addWidget(self.status_label)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        control_layout.addWidget(self.progress_bar)
        
        layout.addWidget(control_panel)
        
        # Create splitter for plots and tables
        splitter = QSplitter(Qt.Horizontal)
        
        # Left side - Real-time plots
        plots_widget = QWidget()
        plots_layout = QVBoxLayout(plots_widget)
        
        # Real-time feature plot
        self.feature_plot = pg.PlotWidget()
        self.feature_plot.setLabel('left', 'Feature Value')
        self.feature_plot.setLabel('bottom', 'Time (s)')
        self.feature_plot.setTitle('Real-time Feature Analysis')
        self.feature_plot.setYRange(0, 1, padding=0)
        self.feature_plot.setXRange(0, 60, padding=0)
        self.feature_plot.enableAutoRange(enable=False)
        
        # Feature curves
        self.feature_curves = {}
        colors = ['r', 'g', 'b', 'c', 'm']
        for i, band in enumerate(['delta', 'theta', 'alpha', 'beta', 'gamma']):
            curve = self.feature_plot.plot([], [], pen=pg.mkPen(colors[i], width=2), name=f'{band}_power')
            self.feature_curves[f'{band}_power'] = curve
        
        # Add legend
        self.feature_plot.addLegend()
        
        plots_layout.addWidget(self.feature_plot)
        
        # Band power comparison plot
        self.band_plot = pg.PlotWidget()
        self.band_plot.setLabel('left', 'Power')
        self.band_plot.setLabel('bottom', 'Frequency Band')
        self.band_plot.setTitle('Current Band Powers')
        plots_layout.addWidget(self.band_plot)
        
        splitter.addWidget(plots_widget)
        
        # Right side - Statistics table
        self.stats_table = QTableWidget()
        self.stats_table.setColumnCount(4)
        self.stats_table.setHorizontalHeaderLabels(['Feature', 'Current', 'Baseline', 'Z-Score'])
        self.stats_table.horizontalHeader().setStretchLastSection(True)
        
        splitter.addWidget(self.stats_table)
        
        # Set splitter proportions
        splitter.setSizes([600, 300])
        
        layout.addWidget(splitter)
        
        # Real-time data buffers
        self.feature_time_buffer = []
        self.feature_data_buffers = {f'{band}_power': [] for band in ['delta', 'theta', 'alpha', 'beta', 'gamma']}
        self.plot_start_time = time.time()
        
    def start_calibration(self, phase):
        """Start a calibration phase."""
        try:
            self.analyzer.start_calibration_phase(phase)
            self.status_label.setText(f"Status: Recording {phase.replace('_', ' ').title()}")
            self.status_label.setStyleSheet("font-weight: bold; color: green;")
            
            # Show progress bar for timed phases
            if phase in ['eyes_closed', 'eyes_open']:
                self.progress_bar.setVisible(True)
                self.progress_bar.setMaximum(60)  # 60 seconds
                self.progress_bar.setValue(0)
                
                # Start progress timer
                self.progress_timer = QTimer()
                self.progress_timer.timeout.connect(self.update_progress)
                self.progress_timer.start(1000)
                self.progress_start_time = time.time()
                
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to start calibration: {str(e)}")
    
    def stop_calibration(self):
        """Stop the current calibration phase."""
        self.analyzer.stop_calibration_phase()
        self.status_label.setText("Status: Ready")
        self.status_label.setStyleSheet("font-weight: bold; color: blue;")
        
        # Hide progress bar
        self.progress_bar.setVisible(False)
        if hasattr(self, 'progress_timer'):
            self.progress_timer.stop()
    
    def update_progress(self):
        """Update progress bar during timed calibration."""
        if hasattr(self, 'progress_start_time'):
            elapsed = time.time() - self.progress_start_time
            self.progress_bar.setValue(int(elapsed))
            
            if elapsed >= 60:  # Auto-stop after 60 seconds
                self.stop_calibration()
    
    def compute_baseline(self):
        """Compute baseline statistics."""
        try:
            self.analyzer.compute_baseline_statistics()
            self.status_label.setText("Status: Baseline computed")
            self.status_label.setStyleSheet("font-weight: bold; color: green;")
            QMessageBox.information(self, "Success", "Baseline statistics computed successfully!")
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to compute baseline: {str(e)}")
    
    def analyze_task(self):
        """Analyze task data."""
        try:
            results = self.analyzer.analyze_task_data()
            if results:
                self.status_label.setText("Status: Task analysis complete")
                self.status_label.setStyleSheet("font-weight: bold; color: green;")
                QMessageBox.information(self, "Success", "Task analysis completed successfully!")
                self.update_statistics_table()
            else:
                QMessageBox.warning(self, "Warning", "No task data to analyze!")
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to analyze task data: {str(e)}")
    
    def generate_report(self):
        """Generate and save analysis report."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            report_path = f"feature_analysis_report_{timestamp}.json"
            
            report = self.analyzer.generate_report(report_path)
            
            QMessageBox.information(self, "Success", f"Report saved to {report_path}")
        except Exception as e:
            QMessageBox.warning(self, "Error", f"Failed to generate report: {str(e)}")
    
    def update_real_time_display(self):
        """Update real-time display with current features."""
        # Add new EEG data to analyzer
        global live_data_buffer
        if len(live_data_buffer) > 0:
            self.analyzer.add_data(live_data_buffer[-10:])  # Add last 10 samples
        
        # Get current features
        current_features = self.analyzer.get_real_time_features()
        
        if current_features:
            current_time = time.time() - self.plot_start_time
            
            # Update feature time series
            self.feature_time_buffer.append(current_time)
            
            # Keep only last 60 seconds
            if len(self.feature_time_buffer) > 60:
                self.feature_time_buffer = self.feature_time_buffer[-60:]
                for key in self.feature_data_buffers:
                    if len(self.feature_data_buffers[key]) > 60:
                        self.feature_data_buffers[key] = self.feature_data_buffers[key][-60:]
            
            # Update feature curves
            for feature_name, curve in self.feature_curves.items():
                if feature_name in current_features:
                    self.feature_data_buffers[feature_name].append(current_features[feature_name])
                    
                    # Update curve
                    if len(self.feature_data_buffers[feature_name]) > 0:
                        curve.setData(self.feature_time_buffer[-len(self.feature_data_buffers[feature_name]):], 
                                    self.feature_data_buffers[feature_name])
            
            # Update X-axis range
            if len(self.feature_time_buffer) > 1:
                x_min = max(0, self.feature_time_buffer[-1] - 60)
                x_max = max(60, self.feature_time_buffer[-1])
                self.feature_plot.setXRange(x_min, x_max, padding=0)
            
            # Update band power plot
            self.update_band_plot(current_features)
            
            # Update statistics table if analysis is available
            if hasattr(self.analyzer, 'analysis_results'):
                self.update_statistics_table(current_features)
    
    def update_band_plot(self, features):
        """Update the band power comparison plot."""
        self.band_plot.clear()
        
        bands = ['delta', 'theta', 'alpha', 'beta', 'gamma']
        powers = [features.get(f'{band}_power', 0) for band in bands]
        colors = ['r', 'g', 'b', 'c', 'm']
        
        # Create bar plot
        x = np.arange(len(bands))
        bargraph = pg.BarGraphItem(x=x, height=powers, width=0.8, brush=colors)
        self.band_plot.addItem(bargraph)
        
        # Set axis labels
        self.band_plot.getAxis('bottom').setTicks([[(i, band) for i, band in enumerate(bands)]])
    
    def update_statistics_table(self, current_features=None):
        """Update the statistics table with current vs baseline comparison."""
        if not hasattr(self.analyzer, 'analysis_results'):
            return
        
        results = self.analyzer.analysis_results
        
        # Clear and resize table
        self.stats_table.setRowCount(len(results))
        
        row = 0
        for feature_name, analysis in results.items():
            # Feature name
            self.stats_table.setItem(row, 0, QTableWidgetItem(feature_name))
            
            # Current value
            current_val = current_features.get(feature_name, 0) if current_features else analysis['task_mean']
            self.stats_table.setItem(row, 1, QTableWidgetItem(f"{current_val:.4f}"))
            
            # Baseline value
            baseline_val = analysis['baseline_mean']
            self.stats_table.setItem(row, 2, QTableWidgetItem(f"{baseline_val:.4f}"))
            
            # Z-score
            if current_features and feature_name in current_features:
                z_score = (current_val - baseline_val) / (analysis['baseline_std'] + 1e-10)
            else:
                z_score = np.mean(analysis['z_scores'])
            
            z_score_item = QTableWidgetItem(f"{z_score:.2f}")
            
            # Color code based on z-score
            if abs(z_score) > 2:
                z_score_item.setBackground(Qt.red)
            elif abs(z_score) > 1:
                z_score_item.setBackground(Qt.yellow)
            else:
                z_score_item.setBackground(Qt.green)
            
            self.stats_table.setItem(row, 3, z_score_item)
            
            row += 1
        
        # Resize columns
        self.stats_table.resizeColumnsToContents()

class BrainLinkCompanionTestBed(QMainWindow):
    """Main application window with feature analysis test bed."""
    
    def __init__(self, user_os, parent=None):
        super().__init__(parent)
        self.user_os = user_os
        self.setWindowTitle(f"BrainLink Companion - Feature Analysis Test Bed - {self.user_os}")
        self.setMinimumSize(1200, 800)
        
        # Initialize components
        self.jwt_token = None
        self.brainlink_thread = None
        self.serial_obj = None
        
        self.setup_ui()
        self.setup_brainlink_detection()
        
    def setup_ui(self):
        """Setup the main UI."""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Header
        header = QLabel("BrainLink Companion - Feature Analysis Test Bed")
        header.setAlignment(Qt.AlignCenter)
        header.setStyleSheet("font-size: 24px; font-weight: bold; color: #2E8B57;")
        layout.addWidget(header)
        
        # Create tab widget
        self.tabs = QTabWidget()
        
        # Tab 1: Live Data & Basic Analysis
        live_tab = QWidget()
        live_layout = QVBoxLayout(live_tab)
        
        # Connection status
        self.connection_label = QLabel("Connection: Not Connected")
        self.connection_label.setStyleSheet("font-size: 14px; font-weight: bold; color: red;")
        live_layout.addWidget(self.connection_label)
        
        # Simple live plot
        self.live_plot = pg.PlotWidget()
        self.live_plot.setLabel('left', 'Amplitude')
        self.live_plot.setLabel('bottom', 'Time (s)')
        self.live_plot.setTitle('Live EEG Signal')
        self.live_plot.setYRange(-100, 100, padding=0)
        self.live_plot.setXRange(0, 10, padding=0)
        self.live_plot.enableAutoRange(enable=False)
        
        self.live_curve = self.live_plot.plot([], [], pen=pg.mkPen('g', width=2))
        live_layout.addWidget(self.live_plot)
        
        # Control buttons
        controls_layout = QHBoxLayout()
        
        self.connect_btn = QPushButton("Connect to BrainLink")
        self.connect_btn.clicked.connect(self.connect_brainlink)
        controls_layout.addWidget(self.connect_btn)
        
        self.disconnect_btn = QPushButton("Disconnect")
        self.disconnect_btn.clicked.connect(self.disconnect_brainlink)
        self.disconnect_btn.setEnabled(False)
        controls_layout.addWidget(self.disconnect_btn)
        
        controls_layout.addStretch()
        live_layout.addLayout(controls_layout)
        
        self.tabs.addTab(live_tab, "Live Data")
        
        # Tab 2: Feature Analysis
        self.feature_analysis_widget = FeatureAnalysisWidget()
        self.tabs.addTab(self.feature_analysis_widget, "Feature Analysis")
        
        # Tab 3: Reports & Export
        reports_tab = QWidget()
        reports_layout = QVBoxLayout(reports_tab)
        
        reports_layout.addWidget(QLabel("Analysis Reports and Data Export"))
        
        # Report text area
        self.report_text = QTextEdit()
        self.report_text.setReadOnly(True)
        reports_layout.addWidget(self.report_text)
        
        # Export buttons
        export_layout = QHBoxLayout()
        
        export_csv_btn = QPushButton("Export to CSV")
        export_csv_btn.clicked.connect(self.export_csv)
        export_layout.addWidget(export_csv_btn)
        
        export_json_btn = QPushButton("Export to JSON")
        export_json_btn.clicked.connect(self.export_json)
        export_layout.addWidget(export_json_btn)
        
        export_layout.addStretch()
        reports_layout.addLayout(export_layout)
        
        self.tabs.addTab(reports_tab, "Reports & Export")
        
        layout.addWidget(self.tabs)
        
        # Status bar equivalent
        self.status_widget = QLabel("Ready")
        self.status_widget.setStyleSheet("background-color: #f0f0f0; padding: 5px; border: 1px solid #ccc;")
        layout.addWidget(self.status_widget)
        
        # Timer for live data updates
        self.live_timer = QTimer()
        self.live_timer.timeout.connect(self.update_live_plot)
        self.live_timer.start(100)  # Update every 100ms
        
        # Live data buffers
        self.live_time_buffer = []
        self.live_data_buffer_display = []
        self.live_plot_start_time = time.time()
        
    def setup_brainlink_detection(self):
        """Setup BrainLink device detection."""
        global SERIAL_PORT
        SERIAL_PORT = self.detect_brainlink()
        
        if SERIAL_PORT:
            self.status_widget.setText(f"BrainLink device detected on {SERIAL_PORT}")
            self.connection_label.setText(f"Device detected: {SERIAL_PORT}")
            self.connection_label.setStyleSheet("font-size: 14px; font-weight: bold; color: orange;")
        else:
            self.status_widget.setText("No BrainLink device detected")
            self.connection_label.setText("No device detected")
    
    def detect_brainlink(self):
        """Detect BrainLink device."""
        ports = serial.tools.list_ports.comports()
        brainlink_port = None
        
        BRAINLINK_SERIALS = ("5C361634682F", "5C3616327E59", "5C3616346938")
        
        for port in ports:
            if (
                getattr(port, "serial_number", None) in BRAINLINK_SERIALS
                or any(sn in getattr(port, "hwid", "") for sn in BRAINLINK_SERIALS)
            ):
                brainlink_port = port.device
                break
        
        if not brainlink_port:
            for port in ports:
                if any(id in port.description.lower() for id in ["BrainLink_Pro", "neurosky", "ftdi", "silabs", "ch340"]):
                    brainlink_port = port.device
                    break
                if port.device.startswith(("/dev/tty.usbserial", "/dev/tty.usbmodem")):
                    brainlink_port = port.device
                    break
        
        return brainlink_port
    
    def connect_brainlink(self):
        """Connect to BrainLink device."""
        global SERIAL_PORT
        
        if not SERIAL_PORT:
            QMessageBox.warning(self, "Error", "No BrainLink device detected!")
            return
        
        try:
            self.serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)
            self.brainlink_thread = threading.Thread(target=self.run_brainlink)
            self.brainlink_thread.daemon = True
            self.brainlink_thread.start()
            
            self.connection_label.setText(f"Connected: {SERIAL_PORT}")
            self.connection_label.setStyleSheet("font-size: 14px; font-weight: bold; color: green;")
            self.connect_btn.setEnabled(False)
            self.disconnect_btn.setEnabled(True)
            self.status_widget.setText(f"Connected to {SERIAL_PORT}")
            
        except Exception as e:
            QMessageBox.critical(self, "Connection Error", f"Failed to connect: {str(e)}")
    
    def disconnect_brainlink(self):
        """Disconnect from BrainLink device."""
        global stop_thread_flag
        
        stop_thread_flag = True
        
        if self.serial_obj and self.serial_obj.is_open:
            self.serial_obj.close()
        
        if self.brainlink_thread and self.brainlink_thread.is_alive():
            self.brainlink_thread.join(timeout=2)
        
        self.connection_label.setText("Disconnected")
        self.connection_label.setStyleSheet("font-size: 14px; font-weight: bold; color: red;")
        self.connect_btn.setEnabled(True)
        self.disconnect_btn.setEnabled(False)
        self.status_widget.setText("Disconnected")
        
        stop_thread_flag = False
    
    def run_brainlink(self):
        """Run BrainLink data collection."""
        global stop_thread_flag, live_data_buffer
        
        parser = BrainLinkParser(self.onEEG, self.onExtendEEG, self.onGyro, self.onRR, self.onRaw)
        
        @self.serial_obj.on_message()
        def handle_serial_message(msg: bytes):
            parser.parse(msg)
        
        try:
            self.serial_obj.open()
            print(f"Opened {SERIAL_PORT} at {SERIAL_BAUD} baud.")
            
            while not stop_thread_flag:
                time.sleep(0.1)
                
        except Exception as e:
            print(f"BrainLink thread error: {e}")
        finally:
            if self.serial_obj and self.serial_obj.is_open:
                self.serial_obj.close()
            print("BrainLink thread stopped.")
    
    def onRaw(self, raw):
        """Handle raw EEG data."""
        global live_data_buffer
        live_data_buffer.append(raw)
        if len(live_data_buffer) > 10000:  # Keep last 10000 samples
            live_data_buffer = live_data_buffer[-10000:]
    
    def onEEG(self, data):
        """Handle EEG data."""
        # print(f"EEG -> attention: {data.attention}, meditation: {data.meditation}")
        pass
    
    def onExtendEEG(self, data):
        """Handle extended EEG data."""
        # print(f"Extended EEG -> battery: {data.battery}, version: {data.version}")
        pass
    
    def onGyro(self, x, y, z):
        """Handle gyroscope data."""
        # print(f"Gyro -> x={x}, y={y}, z={z}")
        pass
    
    def onRR(self, rr1, rr2, rr3):
        """Handle RR interval data."""
        # print(f"RR -> rr1={rr1}, rr2={rr2}, rr3={rr3}")
        pass
    
    def update_live_plot(self):
        """Update live EEG plot."""
        global live_data_buffer
        
        if len(live_data_buffer) < 10:
            return
        
        # Get recent data for display
        display_samples = 512 * 5  # 5 seconds at 512 Hz
        recent_data = live_data_buffer[-display_samples:] if len(live_data_buffer) >= display_samples else live_data_buffer
        
        # Create time axis
        time_axis = np.arange(len(recent_data)) / 512.0  # Assuming 512 Hz
        
        # Update live plot
        self.live_curve.setData(time_axis, recent_data)
        
        # Update X-axis range
        if len(time_axis) > 0:
            self.live_plot.setXRange(0, time_axis[-1], padding=0)
    
    def export_csv(self):
        """Export data to CSV."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"brainlink_data_{timestamp}.csv"
            
            # Prepare data for export
            data_to_export = {}
            
            # Add calibration data
            for phase in ['eyes_closed', 'eyes_open', 'task']:
                features = self.feature_analysis_widget.analyzer.calibration_data[phase]['features']
                timestamps = self.feature_analysis_widget.analyzer.calibration_data[phase]['timestamps']
                
                for i, feature_dict in enumerate(features):
                    for feature_name, value in feature_dict.items():
                        col_name = f"{phase}_{feature_name}"
                        if col_name not in data_to_export:
                            data_to_export[col_name] = []
                        data_to_export[col_name].append(value)
            
            # Create DataFrame and save
            if data_to_export:
                max_len = max(len(v) for v in data_to_export.values())
                for key in data_to_export:
                    while len(data_to_export[key]) < max_len:
                        data_to_export[key].append(None)
                
                df = pd.DataFrame(data_to_export)
                df.to_csv(filename, index=False)
                
                QMessageBox.information(self, "Success", f"Data exported to {filename}")
            else:
                QMessageBox.warning(self, "Warning", "No data to export!")
                
        except Exception as e:
            QMessageBox.critical(self, "Export Error", f"Failed to export CSV: {str(e)}")
    
    def export_json(self):
        """Export data to JSON."""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"brainlink_analysis_{timestamp}.json"
            
            # Generate report
            report = self.feature_analysis_widget.analyzer.generate_report()
            
            # Save to file
            with open(filename, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            
            QMessageBox.information(self, "Success", f"Analysis exported to {filename}")
            
        except Exception as e:
            QMessageBox.critical(self, "Export Error", f"Failed to export JSON: {str(e)}")
    
    def closeEvent(self, event):
        """Handle application close."""
        self.disconnect_brainlink()
        event.accept()

# OS Selection Dialog (same as before)
class OSSelectionDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Select Your Operating System")
        self.setMinimumWidth(300)

        if sys.platform.startswith("win"):
            default_os = "Windows"
        elif sys.platform.startswith("darwin"):
            default_os = "macOS"
        else:
            default_os = "Windows"

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

def main():
    """Main application entry point."""
    # Set up environment variables for display compatibility
    os.environ["QT_AUTO_SCREEN_SCALE_FACTOR"] = "0"
    os.environ["QT_SCALE_FACTOR"] = "1"
    os.environ["QT_SCREEN_SCALE_FACTORS"] = "1"
    os.environ["QT_DEVICE_PIXEL_RATIO"] = "1"
    os.environ["QSG_RENDER_LOOP"] = "basic"
    os.environ["QT_OPENGL"] = "software"
    
    app = QApplication(sys.argv)
    
    # Show OS selection dialog
    os_dialog = OSSelectionDialog()
    if os_dialog.exec() == QDialog.Accepted:
        user_os = os_dialog.get_selected_os()
    else:
        user_os = "Windows"
    
    # Create and show main window
    window = BrainLinkCompanionTestBed(user_os)
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
