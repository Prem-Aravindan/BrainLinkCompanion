#!/usr/bin/env python3
"""
Sequential Workflow BrainLink Analyzer - Fully Integrated Version

This version uses the ACTUAL implementation from BrainLinkAnalyzer_GUI_Enhanced.py
but presents it in a guided sequential workflow with popup dialogs.

All functionality (device connection, authentication, EEG streaming, calibration,
task execution, analysis) is the REAL implementation, just reorganized into steps.
"""

import os
import sys
import platform

# Set Qt environment BEFORE any imports
os.environ.setdefault('PYQTGRAPH_QT_LIB', 'PySide6')

# Fix Qt plugin path
try:
    import PySide6
    pyside_dir = os.path.dirname(PySide6.__file__)
    plugins_dir = os.path.join(pyside_dir, 'plugins', 'platforms')
    if os.path.isdir(plugins_dir):
        os.environ['QT_QPA_PLATFORM_PLUGIN_PATH'] = plugins_dir
except Exception:
    pass

# Import the complete Enhanced GUI
from BrainLinkAnalyzer_GUI_Enhanced import (
    EnhancedBrainLinkAnalyzerWindow,
    EnhancedFeatureAnalysisEngine,
    EnhancedAnalyzerConfig,
    BL
)

# Import signal quality check functions from base GUI
import BrainLinkAnalyzer_GUI as BaseGUI


def assess_eeg_signal_quality(data_window, fs=512):
    """
    Professional multi-metric EEG signal quality assessment.
    
    Based on research-grade EEG quality control methods:
    1. Amplitude range check (EEG typically 10-100 µV, extreme values indicate artifacts)
    2. Line noise detection (50/60 Hz power should be minimal after filtering)
    3. Electrode contact via impedance proxy (variance and baseline wander)
    4. Motion artifacts (sudden large spikes or sustained high amplitude)
    5. Statistical properties (kurtosis for artifact detection)
    
    Returns: (quality_score: 0-100, status: str, details: dict)
    """
    arr = np.array(data_window)
    details = {}
    
    if arr.size < 256:
        return 0, "insufficient_data", {"reason": "need more samples"}
    
    # Metric 1: Amplitude range check (EEG should be 10-200 µV typically)
    arr_std = np.std(arr)
    arr_mean = np.mean(arr)
    arr_max = np.max(np.abs(arr))
    
    details['std'] = float(arr_std)
    details['mean'] = float(arr_mean)
    details['max_amplitude'] = float(arr_max)
    
    # Very low variance = not worn or poor contact
    if arr_std < 2.0:  # Less than 2 µV std is suspiciously low
        return 10, "not_worn", details
    
    # Extremely high variance = severe artifacts or not on head
    if arr_std > 500:  # More than 500 µV std is extreme noise
        return 15, "severe_artifacts", details
    
    # Metric 2: Check for realistic EEG amplitude range
    # Real EEG rarely exceeds 200 µV; values over 500 µV indicate poor contact/artifacts
    if arr_max > 500:
        return 25, "amplitude_artifacts", details
    
    # Metric 3: Check baseline stability (DC drift indicates poor contact)
    # Split window into 4 quarters and check mean shift
    quarter_size = len(arr) // 4
    quarters_means = [np.mean(arr[i*quarter_size:(i+1)*quarter_size]) for i in range(4)]
    baseline_drift = np.std(quarters_means)
    details['baseline_drift'] = float(baseline_drift)
    
    if baseline_drift > 30:  # Excessive drift
        return 35, "poor_contact", details
    
    # Metric 4: Check for motion artifacts using kurtosis
    # High kurtosis (>5) indicates spiky artifacts
    from scipy.stats import kurtosis
    kurt = kurtosis(arr, fisher=True)
    details['kurtosis'] = float(kurt)
    
    if abs(kurt) > 10:  # Very spiky signal
        return 40, "motion_artifacts", details
    
    # Metric 5: Frequency content analysis
    try:
        freqs, psd = BaseGUI.compute_psd(arr, fs)
        
        # Check 50/60 Hz line noise (should be minimal)
        idx_50hz = np.argmin(np.abs(freqs - 50))
        idx_60hz = np.argmin(np.abs(freqs - 60))
        line_noise_50 = psd[idx_50hz] if idx_50hz < len(psd) else 0
        line_noise_60 = psd[idx_60hz] if idx_60hz < len(psd) else 0
        line_noise = max(line_noise_50, line_noise_60)
        
        total_power = np.sum(psd)
        line_noise_ratio = line_noise / (total_power + 1e-12)
        details['line_noise_ratio'] = float(line_noise_ratio)
        
        # Check EEG band distribution (should have power in 1-30 Hz range)
        idx_eeg_band = (freqs >= 1) & (freqs <= 30)
        eeg_band_power = np.sum(psd[idx_eeg_band])
        eeg_band_ratio = eeg_band_power / (total_power + 1e-12)
        details['eeg_band_ratio'] = float(eeg_band_ratio)
        
        # If less than 30% power in EEG bands, likely not real EEG
        if eeg_band_ratio < 0.3:
            return 45, "non_eeg_signal", details
        
        # Check high frequency noise (>40 Hz)
        idx_high_freq = freqs >= 40
        high_freq_power = np.sum(psd[idx_high_freq])
        high_freq_ratio = high_freq_power / (total_power + 1e-12)
        details['high_freq_ratio'] = float(high_freq_ratio)
        
        if high_freq_ratio > 0.6:  # More than 60% high frequency
            return 50, "excessive_noise", details
        
    except Exception as e:
        details['psd_error'] = str(e)
    
    # Calculate overall quality score (0-100)
    # Start at 100 and deduct points for issues
    quality_score = 100
    
    # Deduct for non-optimal but acceptable conditions
    if arr_std < 5:  # Very low but not zero
        quality_score -= 20
    elif arr_std > 200:  # High but not extreme
        quality_score -= 15
    
    if baseline_drift > 15:
        quality_score -= 10
    
    if abs(kurt) > 5:
        quality_score -= 10
    
    if 'high_freq_ratio' in details and details['high_freq_ratio'] > 0.4:
        quality_score -= 15
    
    if 'eeg_band_ratio' in details and details['eeg_band_ratio'] < 0.5:
        quality_score -= 10
    
    # Determine status
    if quality_score >= 75:
        status = "good"
    elif quality_score >= 50:
        status = "acceptable"
    else:
        status = "poor"
    
    return max(0, quality_score), status, details

# Import Qt components directly from PySide6
from PySide6 import QtCore, QtWidgets, QtGui
from PySide6.QtWidgets import (
    QDialog,
    QLabel,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QTextEdit,
    QWidget,
    QComboBox,
    QRadioButton,
    QLineEdit,
    QFrame,
    QFormLayout,
    QMessageBox
)
from PySide6.QtCore import Qt, QSettings, QTimer
from PySide6.QtGui import QIcon
import pyqtgraph as pg
import numpy as np
from typing import Optional, Dict, Any


# ============================================================================
# WINDOW ICON HELPER
# ============================================================================

def set_window_icon(dialog: QDialog) -> None:
    """Set the application icon for a dialog window"""
    try:
        icon_path = BL.resource_path(os.path.join('assets', 'favicon.ico'))
        if os.path.isfile(icon_path):
            dialog.setWindowIcon(QIcon(icon_path))
    except Exception as e:
        print(f"Warning: Could not set window icon: {e}")


# ============================================================================
# MODERN DIALOG STYLING
# ============================================================================

MODERN_DIALOG_STYLESHEET = """
QDialog {
    background:#f8fafc;
}
QLabel#DialogTitle {
    font-size:18px;
    font-weight:600;
    color:#1f2937;
}
QLabel#DialogSubtitle {
    font-size:13px;
    color:#475569;
}
QLabel#DialogSectionTitle,
QLabel#DialogSectionLabel {
    font-size:13px;
    font-weight:600;
    color:#1f2937;
}
QFrame#DialogCard {
    background:#ffffff;
    border:1px solid #e2e8f0;
    border-radius:12px;
}
QLineEdit,
QComboBox,
QTextEdit {
    font-size:13px;
    padding:8px 10px;
    border:1px solid #cbd5e1;
    border-radius:8px;
    background:#f8fafc;
    color:#1f2937;
}
QLineEdit:focus,
QComboBox:focus,
QTextEdit:focus {
    border-color:#3b82f6;
    background:#ffffff;
}
QLineEdit::placeholder {
    color:#94a3b8;
}
QCheckBox,
QRadioButton {
    font-size:13px;
    color:#1f2937;
    spacing:8px;
}
QDialogButtonBox {
    border-top:1px solid transparent;
}
QPushButton {
    background-color:#2563eb;
    color:#ffffff;
    border-radius:8px;
    padding:8px 18px;
    font-size:13px;
    border:0;
}
QPushButton:hover {
    background-color:#1d4ed8;
}
QPushButton:pressed {
    background-color:#1e40af;
}
QPushButton:disabled {
    background-color:#dbeafe;
    color:#64748b;
}
"""

def apply_modern_dialog_theme(dialog: QDialog) -> None:
    """Apply the refreshed light theme to modal dialogs"""
    dialog.setStyleSheet(MODERN_DIALOG_STYLESHEET)


# ============================================================================
# STATUS BAR WIDGET (Shows EEG and Feature Extraction Status)
# ============================================================================

class MindLinkStatusBar(QFrame):
    """Status bar showing battery, EEG signal and feature extraction status"""
    
    def __init__(self, main_window, parent=None):
        super().__init__(parent)
        self.main_window = main_window
        
        # Style the status bar
        self.setStyleSheet("""
            QFrame {
                background: #1e40af;
                border-radius: 6px;
                padding: 6px 12px;
            }
            QLabel {
                color: #ffffff;
                font-size: 12px;
                font-weight: 600;
            }
        """)
        
        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 4, 8, 4)
        layout.setSpacing(12)
        
        # Battery indicator (using parent's _build_battery_indicator)
        try:
            battery_widget = self.main_window._build_battery_indicator()
            # Override battery widget styling to match status bar theme
            battery_widget.setStyleSheet("""
                QWidget#BatteryIndicator {
                    background: transparent;
                }
                QLabel {
                    color: #000;
                    font-size: 11px;
                    font-weight: 800;
                }
                QProgressBar {
                    background-color: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 6px;
                    padding: 0;
                }
                QProgressBar::chunk {
                    border-radius: 5px;
                }
            """)
            layout.addWidget(battery_widget)
        except Exception as e:
            # Fallback if battery widget fails
            battery_label = QLabel("🔋 Battery --%")
            # Ensure fallback battery label is bold and high-contrast
            battery_label.setStyleSheet("color: #000000; font-weight: 800;")
            layout.addWidget(battery_label)
        
        # Separator
        sep1 = QLabel("|")
        layout.addWidget(sep1)
        
        # EEG Signal status
        self.eeg_status = QLabel("EEG: Disconnected")
        layout.addWidget(self.eeg_status)
        
        # Separator
        sep2 = QLabel("|")
        layout.addWidget(sep2)
        
        # Signal quality indicator (replaces features pill)
        self.signal_quality = QLabel("Signal: Checking...")
        layout.addWidget(self.signal_quality)
        
        layout.addStretch()
        
        # Help button
        self.help_button = QPushButton("❓ Help")
        self.help_button.setStyleSheet("""
            QPushButton {
                background-color: #3b82f6;
                color: #ffffff;
                border-radius: 6px;
                padding: 4px 12px;
                font-size: 12px;
                font-weight: 600;
                border: 0;
            }
            QPushButton:hover {
                background-color: #2563eb;
            }
            QPushButton:pressed {
                background-color: #1d4ed8;
            }
        """)
        self.help_button.clicked.connect(self.show_help_dialog)
        layout.addWidget(self.help_button)
        
        # Update timer
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_status)
        self.update_timer.start(500)  # Update every 500ms
        
        # Quality tracking for sustained poor signal detection
        self.quality_history = []  # List of (timestamp, quality_score) tuples
        self.poor_quality_threshold = 45  # Below this is considered poor
        self.is_noisy = False  # Current state
        
        # Help dialog reference
        self.help_dialog = None
    
    def update_status(self):
        """Update the status display"""
        try:
            # Check EEG connection status
            if BL.live_data_buffer and len(BL.live_data_buffer) > 0:
                self.eeg_status.setText("EEG: ✓ Connected")
                self.eeg_status.setStyleSheet("color: #10b981; font-weight: 700;")
            else:
                self.eeg_status.setText("EEG: ✗ No Signal")
                self.eeg_status.setStyleSheet("color: #fbbf24; font-weight: 700;")
            
            # Professional multi-metric signal quality assessment
            if len(BL.live_data_buffer) >= 512:
                import numpy as np
                import time
                recent_data = np.array(list(BL.live_data_buffer)[-512:])
                
                quality_score, status, details = assess_eeg_signal_quality(recent_data, fs=512)
                
                # Track quality history (timestamp, score)
                current_time = time.time()
                self.quality_history.append((current_time, quality_score))
                
                # Remove entries older than 5 seconds
                self.quality_history = [(t, q) for t, q in self.quality_history if current_time - t <= 5.0]
                
                # Count how many times quality dropped below threshold in last 5 seconds
                poor_count = sum(1 for t, q in self.quality_history if q < self.poor_quality_threshold)
                
                # Update noisy state: need 5+ poor readings in 5 seconds to trigger
                if poor_count >= 5:
                    self.is_noisy = True
                elif poor_count == 0:  # All recent readings good - reset
                    self.is_noisy = False
                # Otherwise maintain current state (hysteresis)
                
                # Display only two states: Good or Noisy
                if self.is_noisy:
                    self.signal_quality.setText("Signal: ⚠ Noisy")
                    self.signal_quality.setStyleSheet("color: #f59e0b; font-weight: 700;")
                else:
                    self.signal_quality.setText("Signal: ✓ Good")
                    self.signal_quality.setStyleSheet("color: #10b981; font-weight: 700;")
            else:
                self.signal_quality.setText("Signal: Waiting...")
                self.signal_quality.setStyleSheet("color: #94a3b8; font-weight: 700;")
        except Exception:
            pass
    
    def show_help_dialog(self):
        """Show or bring to front the help dialog"""
        if self.help_dialog is None or not self.help_dialog.isVisible():
            self.help_dialog = HelpDialog(parent=self)
            self.help_dialog.show()
        else:
            # Bring existing dialog to front
            self.help_dialog.raise_()
            self.help_dialog.activateWindow()
    
    def cleanup(self):
        """Stop the update timer and close help dialog"""
        self.update_timer.stop()
        if self.help_dialog and self.help_dialog.isVisible():
            self.help_dialog.close()


def add_status_bar_to_dialog(dialog: QDialog, main_window) -> MindLinkStatusBar:
    """Helper to add MindLink status bar to any dialog"""
    # Get the dialog's main layout
    main_layout = dialog.layout()
    if main_layout:
        # Insert status bar at the top
        status_bar = MindLinkStatusBar(main_window)
        main_layout.insertWidget(0, status_bar)
        return status_bar
    return None


def add_help_button_to_dialog(dialog: QDialog) -> QPushButton:
    """Helper to add a simple Help button to early workflow dialogs (before main window is ready)"""
    # Get the dialog's main layout
    main_layout = dialog.layout()
    if main_layout:
        # Create help button with styling
        help_button = QPushButton("❓ Help")
        help_button.setStyleSheet("""
            QPushButton {
                background-color: #3b82f6;
                color: #ffffff;
                border-radius: 6px;
                padding: 6px 16px;
                font-size: 12px;
                font-weight: 600;
                border: 0;
            }
            QPushButton:hover {
                background-color: #2563eb;
            }
            QPushButton:pressed {
                background-color: #1d4ed8;
            }
        """)
        
        # Create a container for the help button (top-right corner)
        help_container = QWidget()
        help_layout = QHBoxLayout(help_container)
        help_layout.setContentsMargins(0, 0, 0, 8)
        help_layout.addStretch()
        help_layout.addWidget(help_button)
        
        # Store reference to help dialog on button
        help_button.help_dialog = None
        
        # Connect to show help dialog
        def show_help():
            if help_button.help_dialog is None or not help_button.help_dialog.isVisible():
                help_button.help_dialog = HelpDialog(dialog)
                help_button.help_dialog.show()
            else:
                help_button.help_dialog.raise_()
                help_button.help_dialog.activateWindow()
        
        help_button.clicked.connect(show_help)
        
        # Insert at the top of the dialog
        main_layout.insertWidget(0, help_container)
        return help_button
    return None


# ============================================================================
# PROTOCOL FILTER METHOD FOR ENHANCED WINDOW
# ============================================================================

def add_protocol_filter_to_enhanced_window():
    """Add the _apply_protocol_filter method to EnhancedBrainLinkAnalyzerWindow
    
    Protocol tasks are now all implemented including order_surprise and num_form.
    """
    
    # Fix protocol groups - ensure all tasks exist in AVAILABLE_TASKS
    def _initialize_protocol_groups_fixed(self):
        """Initialize with all implemented protocol tasks"""
        self._protocol_groups = {
            'Personal Pathway': ['emotion_face', 'diverse_thinking'],
            'Connection': ['reappraisal', 'curiosity'],
            'Lifestyle': ['order_surprise', 'num_form'],
        }
        self._cognitive_tasks = [
            'visual_imagery', 'attention_focus', 'mental_math', 'working_memory',
            'language_processing', 'motor_imagery', 'cognitive_load'
        ]
    
    def _apply_protocol_filter(self):
        """Apply protocol filter to task_combo based on selected protocol"""
        # Rebuild task combo to include cognitive tasks + selected protocol tasks
        if not hasattr(self, 'task_combo') or self.task_combo is None:
            return
        
        self.task_combo.blockSignals(True)
        self.task_combo.clear()
        
        # Add cognitive tasks (present in AVAILABLE_TASKS)
        for key in self._cognitive_tasks:
            if key in getattr(BL, 'AVAILABLE_TASKS', {}):
                self.task_combo.addItem(key)
        
        # Add protocol-specific tasks
        if self._selected_protocol and self._selected_protocol in self._protocol_groups:
            for key in self._protocol_groups[self._selected_protocol]:
                if key in getattr(BL, 'AVAILABLE_TASKS', {}):
                    self.task_combo.addItem(key)
        
        # Select first item if available
        if self.task_combo.count() > 0:
            self.task_combo.setCurrentIndex(0)
            try:
                self.update_task_preview(self.task_combo.currentText())
            except Exception:
                pass
        
        self.task_combo.blockSignals(False)
    
    # Monkey-patch both methods onto the class
    EnhancedBrainLinkAnalyzerWindow._initialize_protocol_groups_fixed = _initialize_protocol_groups_fixed
    EnhancedBrainLinkAnalyzerWindow._apply_protocol_filter = _apply_protocol_filter

# Apply the monkey-patch at module load time
add_protocol_filter_to_enhanced_window()


# ============================================================================
# HELP DIALOG
# ============================================================================

class HelpDialog(QDialog):
    """Dialog displaying the user manual"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("MindLink Analyzer - User Manual")
        self.setModal(False)  # Non-modal so it can stay open while using the app
        
        # Set optimal size for readability
        self.setMinimumSize(1200, 850)
        
        # Try to set responsive size based on screen
        try:
            screen = QtWidgets.QApplication.primaryScreen()
            if screen:
                avail = screen.availableGeometry()
                # Use 92% of screen size for maximum content visibility
                target_w = min(int(avail.width() * 0.92), 1700)
                target_h = min(int(avail.height() * 0.92), 1050)
                self.resize(target_w, target_h)
            else:
                self.resize(1500, 1000)
        except Exception:
            self.resize(1500, 1000)
        
        # Set window icon
        set_window_icon(self)
        
        # Main layout
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        
        # Minimal header - super compact
        header = QFrame()
        header.setFixedHeight(35)  # Force maximum height
        header.setStyleSheet("""
            QFrame {
                background: #0ea5e9;
                padding: 0px;
                margin: 0px;
            }
        """)
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(12, 0, 12, 0)
        header_layout.setSpacing(0)
        
        title = QLabel("📖 User Manual")
        title.setStyleSheet("""
            font-size: 13px; 
            font-weight: 600; 
            color: #ffffff;
            padding: 0px;
            margin: 0px;
        """)
        header_layout.addWidget(title, 0, Qt.AlignVCenter)
        
        layout.addWidget(header)
        
        # Create horizontal splitter for TOC and content
        splitter = QtWidgets.QSplitter(Qt.Horizontal)
        
        # Table of Contents (left side)
        toc_frame = QFrame()
        toc_frame.setStyleSheet("""
            QFrame {
                background: #f1f5f9;
                border-right: 2px solid #cbd5e1;
            }
        """)
        toc_layout = QVBoxLayout(toc_frame)
        toc_layout.setContentsMargins(12, 12, 12, 12)
        toc_layout.setSpacing(8)
        
        toc_title = QLabel("📑 Contents")
        toc_title.setStyleSheet("""
            font-size: 14px; 
            font-weight: 700; 
            color: #0f172a; 
            padding-bottom: 8px;
            letter-spacing: 0.5px;
        """)
        toc_layout.addWidget(toc_title)
        
        # Scrollable TOC list
        self.toc_list = QtWidgets.QListWidget()
        self.toc_list.setStyleSheet("""
            QListWidget {
                background: #ffffff;
                border: 2px solid #cbd5e1;
                border-radius: 8px;
                padding: 6px;
                font-size: 13px;
                font-family: 'Segoe UI', Arial, sans-serif;
            }
            QListWidget::item {
                padding: 10px 12px;
                border-radius: 6px;
                color: #334155;
                margin: 2px 0px;
            }
            QListWidget::item:hover {
                background: #e0f2fe;
                color: #0369a1;
                font-weight: 500;
            }
            QListWidget::item:selected {
                background: #0ea5e9;
                color: #ffffff;
                font-weight: 600;
            }
        """)
        self.toc_list.itemClicked.connect(self.scroll_to_section)
        toc_layout.addWidget(self.toc_list)
        
        splitter.addWidget(toc_frame)
        
        # Text display area (right side, scrollable)
        self.text_display = QTextEdit()
        self.text_display.setReadOnly(True)
        self.text_display.setStyleSheet("""
            QTextEdit {
                background: #ffffff;
                color: #1e293b;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                padding: 16px 20px;
                border: none;
                line-height: 1.7;
            }
        """)
        
        splitter.addWidget(self.text_display)
        
        # Set initial splitter sizes (TOC: 22%, Content: 78%)
        # Using pixel values that work better with the larger window
        splitter.setSizes([330, 1170])
        
        # Load the user manual content
        self.load_manual_content()
        
        layout.addWidget(splitter)
        
        # Minimal footer with close button
        footer = QFrame()
        footer.setFixedHeight(50)  # Force compact footer
        footer.setStyleSheet("""
            QFrame {
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
                padding: 0px;
                margin: 0px;
            }
        """)
        footer_layout = QHBoxLayout(footer)
        footer_layout.setContentsMargins(16, 8, 16, 8)
        footer_layout.addStretch()
        
        close_button = QPushButton("✕ Close")
        close_button.setStyleSheet("""
            QPushButton {
                background-color: #0ea5e9;
                color: #ffffff;
                border-radius: 8px;
                padding: 10px 28px;
                font-size: 14px;
                font-weight: 600;
                border: 0;
            }
            QPushButton:hover {
                background-color: #0284c7;
            }
            QPushButton:pressed {
                background-color: #0369a1;
            }
        """)
        close_button.clicked.connect(self.close)
        footer_layout.addWidget(close_button)
        
        layout.addWidget(footer)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
    
    def load_manual_content(self):
        """Load the user manual from file and extract table of contents"""
        try:
            manual_path = BL.resource_path("MindLink_User_Manual.txt")
            
            if os.path.isfile(manual_path):
                with open(manual_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                self.text_display.setPlainText(content)
                
                # Extract sections for table of contents
                lines = content.split('\n')
                sections = []
                seen_titles = set()  # Track titles to avoid duplicates
                
                for i, line in enumerate(lines):
                    title = None
                    target_line = i
                    indent_level = 0
                    
                    # Skip "TABLE OF CONTENTS" section entirely
                    if 'TABLE OF CONTENTS' in line.upper():
                        continue
                    
                    # Detect main section headers (lines with === below them)
                    if line.strip().startswith('=') and len(line.strip()) > 10:
                        # The title is usually the line before the === line
                        if i > 0:
                            potential_title = lines[i-1].strip()
                            # Skip if it contains "TABLE OF CONTENTS" or is the header
                            if (potential_title and 
                                not potential_title.startswith('=') and
                                'TABLE OF CONTENTS' not in potential_title.upper() and
                                'MINDLINK ANALYZER' not in potential_title.upper() and
                                'Brain Wave' not in potential_title and
                                'Version' not in potential_title):
                                
                                # Check if this is a numbered section like "1. INTRODUCTION"
                                if potential_title and potential_title[0].isdigit():
                                    title = potential_title
                                    target_line = i - 1
                                    indent_level = 0
                    
                    # Detect numbered sections that appear without === underline
                    # ONLY match sections in ALL CAPS (main headers) or proper subsections
                    elif line.strip() and len(line.strip()) > 3:
                        stripped = line.strip()
                        
                        # Must start with a digit
                        if stripped[0].isdigit() and '.' in stripped[:5]:
                            # Split to check the numbering format
                            parts = stripped.split(maxsplit=1)
                            if len(parts) >= 2:
                                number_part = parts[0]
                                text_part = parts[1]
                                
                                # Parse the number part
                                num_parts = number_part.rstrip('.').split('.')
                                
                                # Main section: "1. INTRODUCTION" (must be ALL CAPS)
                                if (len(num_parts) == 1 and 
                                    num_parts[0].isdigit() and
                                    text_part.isupper()):
                                    title = stripped
                                    target_line = i
                                    indent_level = 0
                                
                                # Subsection: "5.1 STEP 1:" or "6.1 Device" (two numbers, ALL CAPS first word)
                                elif (len(num_parts) == 2 and 
                                      all(p.isdigit() for p in num_parts)):
                                    # Check if first word after number is uppercase or starts with uppercase
                                    first_word = text_part.split()[0] if text_part.split() else ""
                                    if first_word and (first_word.isupper() or first_word[0].isupper()):
                                        title = "  " + stripped  # Add indent for subsections
                                        target_line = i
                                        indent_level = 1
                                
                                # Skip everything else (sub-subsections, instruction lists, etc.)
                    
                    # Add to sections if we found a valid title and haven't seen it before
                    if title and title not in seen_titles:
                        seen_titles.add(title)
                        sections.append((title, target_line, indent_level))
                
                # Populate the TOC list
                self.toc_list.clear()
                self.section_positions = {}  # Map section title to line number
                
                for title, line_num, indent_level in sections:
                    # Keep the title as is (with indentation for hierarchy)
                    item = QtWidgets.QListWidgetItem(title)
                    self.toc_list.addItem(item)
                    self.section_positions[title] = line_num
                
                # If no sections found, add a note
                if not sections:
                    item = QtWidgets.QListWidgetItem("(No sections detected)")
                    item.setFlags(Qt.NoItemFlags)  # Make it non-clickable
                    self.toc_list.addItem(item)
                    
            else:
                # Fallback content if file not found
                self.text_display.setPlainText(
                    "User Manual Not Found\n\n"
                    "The user manual file could not be located.\n"
                    "Expected location: MindLink_User_Manual.txt\n\n"
                    "Please ensure the file is in the application directory.\n\n"
                    "For support, contact: support@mindspeller.com"
                )
                self.section_positions = {}
                
        except Exception as e:
            self.text_display.setPlainText(
                f"Error Loading User Manual\n\n"
                f"An error occurred while loading the manual:\n{str(e)}\n\n"
                f"For support, contact: support@mindspeller.com"
            )
            self.section_positions = {}
    
    def scroll_to_section(self, item):
        """Scroll to the selected section in the manual"""
        section_title = item.text()
        
        if section_title in self.section_positions:
            line_num = self.section_positions[section_title]
            
            # Get the document and create a cursor
            doc = self.text_display.document()
            cursor = QtGui.QTextCursor(doc)
            
            # Move to the start
            cursor.movePosition(QtGui.QTextCursor.Start)
            
            # Move down to the target line
            for _ in range(line_num):
                cursor.movePosition(QtGui.QTextCursor.Down)
            
            # Move to the start of the line for better visibility
            cursor.movePosition(QtGui.QTextCursor.StartOfLine)
            
            # Set the cursor
            self.text_display.setTextCursor(cursor)
            
            # Scroll to put the section at the TOP of the viewport
            # Get the scrollbar and calculate position
            scrollbar = self.text_display.verticalScrollBar()
            cursor_rect = self.text_display.cursorRect()
            
            # Move scrollbar so the cursor line appears at the top
            # We get the current cursor Y position and set scroll value to that
            doc = self.text_display.document()
            block = doc.findBlockByLineNumber(line_num)
            layout = block.layout()
            block_pos = layout.position().y()
            
            # Set scroll position to show section at top (with small margin)
            scrollbar.setValue(int(block_pos) - 10)  # 10px margin from top


# ============================================================================
# WORKFLOW STATE MANAGER
# ============================================================================# ============================================================================
# WORKFLOW STATE MANAGER
# ============================================================================

class WorkflowStep:
    """Enumeration of workflow steps"""
    OS_SELECTION = 0
    ENVIRONMENT_SELECTION = 1
    LOGIN = 2
    LIVE_EEG = 3
    PATHWAY_SELECTION = 4
    CALIBRATION = 5
    TASK_SELECTION = 6
    MULTI_TASK_ANALYSIS = 7


class WorkflowManager:
    """Manages the sequential workflow state and navigation"""
    
    def __init__(self, main_window):
        self.main_window = main_window  # Reference to the actual Enhanced GUI window
        self.current_step = WorkflowStep.OS_SELECTION
        self.step_history = []
        
        # Current active dialog reference
        self.current_dialog: Optional[QDialog] = None
    
    def go_to_step(self, step: int, from_back: bool = False):
        """Navigate to a specific workflow step"""
        if not from_back:
            self.step_history.append(self.current_step)
        
        # Close current dialog if exists
        if self.current_dialog and self.current_dialog.isVisible():
            self.current_dialog.close()
            self.current_dialog = None
        
        self.current_step = step
        
        # Launch the appropriate dialog for this step
        if step == WorkflowStep.OS_SELECTION:
            self._show_os_selection()
        elif step == WorkflowStep.ENVIRONMENT_SELECTION:
            self._show_environment_selection()
        elif step == WorkflowStep.LOGIN:
            self._show_login()
        elif step == WorkflowStep.PATHWAY_SELECTION:
            self._show_pathway_selection()
        elif step == WorkflowStep.LIVE_EEG:
            self._show_live_eeg()
        elif step == WorkflowStep.CALIBRATION:
            self._show_calibration()
        elif step == WorkflowStep.TASK_SELECTION:
            self._show_task_selection()
        elif step == WorkflowStep.MULTI_TASK_ANALYSIS:
            self._show_multi_task_analysis()
    
    def go_back(self):
        """Navigate to previous step"""
        if self.step_history:
            previous_step = self.step_history.pop()
            self.go_to_step(previous_step, from_back=True)
    
    def can_go_back(self) -> bool:
        """Check if back navigation is available"""
        return len(self.step_history) > 0
    
    # Step-specific dialog launchers
    def _show_os_selection(self):
        dialog = OSSelectionDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Use show() instead of exec() to keep event loop running
    
    def _show_environment_selection(self):
        dialog = EnvironmentSelectionDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Use show() instead of exec()
    
    def _show_login(self):
        dialog = LoginDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Use show() instead of exec()
    
    def _show_pathway_selection(self):
        dialog = PathwaySelectionDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Use show() instead of exec()
    
    def _show_live_eeg(self):
        dialog = LiveEEGDialog(self)
        self.current_dialog = dialog
        dialog.show()
    
    def _show_calibration(self):
        dialog = CalibrationDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Already using show()
    
    def _show_task_selection(self):
        dialog = TaskSelectionDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Use show() instead of exec()
    
    def _show_multi_task_analysis(self):
        dialog = MultiTaskAnalysisDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Use show() instead of exec()


# ============================================================================
# STEP 1: OS SELECTION (Same as before)
# ============================================================================

class OSSelectionDialog(QDialog):
    """Step 1: Select operating system"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Operating System")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(400)
        self._programmatic_close = False  # Flag to distinguish user vs programmatic close
        
        # Set window icon
        set_window_icon(self)
        
        # Detect default OS
        if sys.platform.startswith("win"):
            default_os = "Windows"
        elif sys.platform.startswith("darwin"):
            default_os = "macOS"
        else:
            default_os = "Windows"
        
        # UI Elements
        title_label = QLabel("Welcome to MindLink Analyzer")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 1 of 8: Choose your Operating System")
        subtitle_label.setObjectName("DialogSubtitle")
        
        card = QFrame()
        card.setObjectName("DialogCard")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(16, 16, 16, 16)
        card_layout.setSpacing(10)
        
        prompt_label = QLabel("Select your OS:")
        prompt_label.setObjectName("DialogSectionTitle")
        
        self.radio_windows = QRadioButton("Windows")
        self.radio_macos = QRadioButton("macOS")
        
        if default_os == "Windows":
            self.radio_windows.setChecked(True)
        else:
            self.radio_macos.setChecked(True)
        
        card_layout.addWidget(prompt_label)
        card_layout.addWidget(self.radio_windows)
        card_layout.addWidget(self.radio_macos)
        card_layout.addStretch()
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        nav_layout.addStretch()
        
        self.next_button = QPushButton("Next →")
        self.next_button.clicked.connect(self.on_next)
        nav_layout.addWidget(self.next_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(card)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add help button
        add_help_button_to_dialog(self)
    
    def closeEvent(self, event):
        """Handle dialog close - only trigger confirmation if user clicked X"""
        if hasattr(self, '_programmatic_close') and self._programmatic_close:
            # This is a programmatic close (from navigation), allow it
            event.accept()
        else:
            # This is user clicking X button - confirm and quit
            reply = QMessageBox.question(
                self,
                'Confirm Exit',
                'Are you sure you want to exit MindLink Analyzer?',
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                event.accept()
                QtWidgets.QApplication.quit()
            else:
                event.ignore()
    
    def on_next(self):
        """Save OS selection and proceed"""
        selected_os = "Windows" if self.radio_windows.isChecked() else "macOS"
        self.workflow.main_window.user_os = selected_os
        # Mark as programmatic close
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_to_step(WorkflowStep.ENVIRONMENT_SELECTION))


# ============================================================================
# STEP 2: ENVIRONMENT SELECTION (With REAL device detection)
# ============================================================================

class EnvironmentSelectionDialog(QDialog):
    """Step 2: Select region where the user has their Mindspeller account"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Region Selection")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(450)
        
        # Set window icon
        set_window_icon(self)
        
        # UI Elements
        title_label = QLabel("Select Region")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 2 of 8: Choose region and connect to device")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # Environment selection card
        env_card = QFrame()
        env_card.setObjectName("DialogCard")
        env_layout = QVBoxLayout(env_card)
        env_layout.setContentsMargins(16, 16, 16, 16)
        env_layout.setSpacing(10)
        
        env_label = QLabel("Region:")
        env_label.setObjectName("DialogSectionTitle")
        
        self.env_combo = QComboBox()
        self.env_combo.addItems(["English (en)", "Dutch (nl)"])
        self.env_combo.currentTextChanged.connect(self.on_env_changed)
        
        # Warning message
        warning_label = QLabel("⚠️ Please make sure the region selected is the region where the user has created their Mindspeller account")
        warning_label.setStyleSheet("font-size: 12px; color: #f59e0b; padding: 8px; background: #fffbeb; border-radius: 6px; border-left: 3px solid #f59e0b;")
        warning_label.setWordWrap(True)
        
        env_layout.addWidget(env_label)
        env_layout.addWidget(self.env_combo)
        env_layout.addWidget(warning_label)
        
        # Connection status card
        conn_card = QFrame()
        conn_card.setObjectName("DialogCard")
        conn_layout = QVBoxLayout(conn_card)
        conn_layout.setContentsMargins(16, 16, 16, 16)
        conn_layout.setSpacing(10)
        
        conn_label = QLabel("Device Connection:")
        conn_label.setObjectName("DialogSectionTitle")
        
        self.status_label = QLabel("Not connected")
        self.status_label.setStyleSheet("color: #64748b; font-size: 13px;")
        
        self.connect_button = QPushButton("Connect to Device")
        self.connect_button.clicked.connect(self.on_connect)
        
        conn_layout.addWidget(conn_label)
        conn_layout.addWidget(self.status_label)
        conn_layout.addWidget(self.connect_button)
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        
        self.back_button = QPushButton("← Back")
        self.back_button.clicked.connect(self.on_back)
        self.back_button.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        
        nav_layout.addWidget(self.back_button)
        nav_layout.addStretch()
        
        self.next_button = QPushButton("Next →")
        self.next_button.clicked.connect(self.on_next)
        self.next_button.setEnabled(False)
        
        nav_layout.addWidget(self.next_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(env_card)
        layout.addWidget(conn_card)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add help button
        add_help_button_to_dialog(self)
        
        # Initialize environment
        self.on_env_changed("English (en)")
        self._programmatic_close = False
    
    def closeEvent(self, event):
        """Handle dialog close - only trigger confirmation if user clicked X"""
        if self._programmatic_close:
            event.accept()
        else:
            reply = QMessageBox.question(
                self,
                'Confirm Exit',
                'Are you sure you want to exit MindLink Analyzer?',
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                event.accept()
                QtWidgets.QApplication.quit()
            else:
                event.ignore()
    
    def on_env_changed(self, env_name: str):
        """Update backend URLs when environment changes"""
        backend_urls = {
            "English (en)": "https://stg-en.mindspell.be/api/cas/brainlink_data",
            "Dutch (nl)": "https://stg-nl.mindspell.be/api/cas/brainlink_data",
            "Local": "http://127.0.0.1:5000/api/cas/brainlink_data"
        }
        
        login_urls = {
            "English (en)": "https://en.mindspeller.com/api/cas/token/login",
            "Dutch (nl)": "https://nl.mindspeller.com/api/cas/token/login",
            "Local": "http://127.0.0.1:5000/api/cas/token/login"
        }
        
        # Set GLOBAL variables used by the base GUI
        BL.BACKEND_URL = backend_urls[env_name]
        # Store login URL for later
        self.login_url = login_urls[env_name]
    
    def on_connect(self):
        """Attempt to connect to REAL MindLink device"""
        self.status_label.setText("Searching for device...")
        self.connect_button.setEnabled(False)
        
        # Use REAL device detection from base GUI
        QTimer.singleShot(500, self._detect_device)
    
    def _detect_device(self):
        """Run actual device detection"""
        try:
            # Call the REAL detect_brainlink function
            port = BL.detect_brainlink()
            
            if port:
                BL.SERIAL_PORT = port
                self.status_label.setText(f"✓ EEG headset registered to device: {port}\n\nPlease press Next & sign in to connect to the device.")
                self.status_label.setStyleSheet("color: #10b981; font-size: 13px; font-weight: 600;")
                self.next_button.setEnabled(True)
                
                # Device is detected but actual connection happens in Login step after authentication
            else:
                self.status_label.setText(
                    "✗ No headset found.\n\n"
                    "Please ensure:\n"
                    "1. The headset is added to device Bluetooth\n"
                    "2. The amplifier is paired (not necessarily powered on yet)\n\n"
                    "After pairing, please restart the application."
                )
                self.status_label.setStyleSheet("color: #dc2626; font-size: 12px;")
                self.connect_button.setEnabled(True)
        except Exception as e:
            self.status_label.setText(f"✗ Error: {str(e)}")
            self.status_label.setStyleSheet("color: #dc2626; font-size: 13px;")
            self.connect_button.setEnabled(True)
    
    def on_back(self):
        """Navigate back to OS selection"""
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_back())
    
    def on_next(self):
        """Proceed to login"""
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_to_step(WorkflowStep.LOGIN))


# ============================================================================
# STEP 3: LOGIN (Using REAL authentication)
# ============================================================================

class LoginDialog(QDialog):
    """Step 3: Real user authentication"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Sign In")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(400)
        
        # Set window icon
        set_window_icon(self)
        
        self.settings = QSettings("MindLink", "FeatureAnalyzer")
        
        # Get login URL from previous step
        env_dialog = None
        for dialog in self.workflow.step_history:
            if isinstance(dialog, EnvironmentSelectionDialog):
                env_dialog = dialog
                break
        
        # UI Elements
        title_label = QLabel("Sign In")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 3 of 8: Enter your credentials")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # Credentials card
        cred_card = QFrame()
        cred_card.setObjectName("DialogCard")
        cred_layout = QFormLayout(cred_card)
        cred_layout.setContentsMargins(16, 16, 16, 16)
        cred_layout.setSpacing(12)
        
        self.username_edit = QLineEdit()
        saved_username = self.settings.value("username", "")
        self.username_edit.setText(saved_username)
        self.username_edit.setPlaceholderText("you@example.com")
        self.username_edit.setClearButtonEnabled(True)
        
        self.password_edit = QLineEdit()
        saved_password = self.settings.value("password", "")
        self.password_edit.setText(saved_password)
        self.password_edit.setEchoMode(QLineEdit.Password)
        self.password_edit.setPlaceholderText("Password")
        self.password_edit.setClearButtonEnabled(True)
        self.password_edit.returnPressed.connect(self.on_login)
        
        # Password container with eye icon
        password_container = QWidget()
        password_layout = QHBoxLayout(password_container)
        password_layout.setContentsMargins(0, 0, 0, 0)
        password_layout.setSpacing(4)
        password_layout.addWidget(self.password_edit)
        
        # Eye icon toggle button
        self.password_toggle_btn = QPushButton("👁")
        self.password_toggle_btn.setFixedSize(32, 32)
        self.password_toggle_btn.setStyleSheet("""
            QPushButton {
                background-color: #f1f5f9;
                color: #64748b;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                font-size: 16px;
                padding: 0px;
            }
            QPushButton:hover {
                background-color: #e2e8f0;
                border-color: #94a3b8;
            }
            QPushButton:pressed {
                background-color: #cbd5e1;
            }
        """)
        self.password_toggle_btn.setCursor(Qt.PointingHandCursor)
        self.password_toggle_btn.clicked.connect(self.toggle_password_visibility)
        password_layout.addWidget(self.password_toggle_btn)
        
        cred_layout.addRow("Email:", self.username_edit)
        cred_layout.addRow("Password:", password_container)
        
        self.status_label = QLabel("")
        self.status_label.setStyleSheet("color: #dc2626; font-size: 12px;")
        self.status_label.setWordWrap(True)
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        
        self.back_button = QPushButton("← Back")
        self.back_button.clicked.connect(self.on_back)
        self.back_button.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        
        nav_layout.addWidget(self.back_button)
        nav_layout.addStretch()
        
        self.next_button = QPushButton("Next →")
        self.next_button.clicked.connect(self.on_next)
        self.next_button.setEnabled(False)  # Enable after successful login
        nav_layout.addWidget(self.next_button)
        
        self.login_button = QPushButton("Sign In")
        self.login_button.clicked.connect(self.on_login)
        nav_layout.addWidget(self.login_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(cred_card)
        layout.addWidget(self.status_label)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add MindLink status bar (includes Help button in header)
        self.status_bar = add_status_bar_to_dialog(self, self.workflow.main_window)
        self._programmatic_close = False
    
    def closeEvent(self, event):
        """Handle dialog close - only trigger confirmation if user clicked X"""
        if self.status_bar:
            self.status_bar.cleanup()
        if self._programmatic_close:
            event.accept()
        else:
            reply = QMessageBox.question(
                self,
                'Confirm Exit',
                'Are you sure you want to exit MindLink Analyzer?',
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                event.accept()
                QtWidgets.QApplication.quit()
            else:
                event.ignore()
    
    def toggle_password_visibility(self):
        """Toggle password visibility with eye icon"""
        if self.password_edit.echoMode() == QLineEdit.Password:
            self.password_edit.setEchoMode(QLineEdit.Normal)
            self.password_toggle_btn.setText("👁‍🗨")  # Crossed eye
        else:
            self.password_edit.setEchoMode(QLineEdit.Password)
            self.password_toggle_btn.setText("👁")  # Open eye
    
    def on_login(self):
        """Attempt REAL authentication"""
        username = self.username_edit.text().strip()
        password = self.password_edit.text()
        
        if not username or not password:
            self.status_label.setText("Please enter both email and password")
            return
        
        self.status_label.setText("Authenticating...")
        self.login_button.setEnabled(False)
        
        # Save credentials
        self.settings.setValue("username", username)
        self.settings.setValue("password", password)
        
        # Use REAL authentication - get login URL from environment
        login_urls = {
            "English (en)": "https://en.mindspeller.com/api/cas/token/login",
            "Dutch (nl)": "https://nl.mindspeller.com/api/cas/token/login",
            "Local": "http://127.0.0.1:5000/api/cas/token/login"
        }
        
        # Determine which backend URL is set
        current_backend = BL.BACKEND_URL
        login_url = None
        if "stg-en" in current_backend or "en.mindspell" in current_backend:
            login_url = login_urls["English (en)"]
        elif "stg-nl" in current_backend or "nl.mindspell" in current_backend:
            login_url = login_urls["Dutch (nl)"]
        else:
            login_url = login_urls["Local"]
        
        # Perform REAL authentication
        QTimer.singleShot(100, lambda: self._perform_login(username, password, login_url))
    
    def _perform_login(self, username, password, login_url):
        """Perform actual login"""
        import requests
        
        login_payload = {
            "username": username,
            "password": password
        }
        
        try:
            self.workflow.main_window.log_message(f"Connecting to {login_url}")
            
            # Try with certificate verification first
            try:
                login_response = requests.post(
                    login_url, 
                    json=login_payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10,
                    verify=True
                )
            except requests.exceptions.ProxyError as e:
                self.workflow.main_window.log_message(f"Proxy error, retrying without proxy...")
                direct_session = requests.Session()
                direct_session.proxies = {}
                login_response = direct_session.post(
                    login_url, 
                    json=login_payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10,
                    verify=True
                )
            
            if login_response.status_code == 200:
                data = login_response.json()
                jwt_token = data.get("x-jwt-access-token")
                hwid = data.get("hwid")
                
                if jwt_token:
                    self.workflow.main_window.jwt_token = jwt_token
                    self.workflow.main_window.log_message("✓ Login successful. JWT token obtained.")
                    
                    if hwid:
                        self.workflow.main_window.log_message(f"✓ Hardware ID received: {hwid}")
                        BL.ALLOWED_HWIDS = [hwid]
                    
                    # Fetch user HWIDs
                    self._fetch_user_hwids(jwt_token)
                    
                    # Start device connection
                    self._connect_device()
                    
                    self.status_label.setText("✓ Login successful")
                    self.status_label.setStyleSheet("color: #10b981; font-size: 12px; font-weight: 600;")
                    self.next_button.setEnabled(True)
                else:
                    self.status_label.setText("✗ Login response didn't contain token")
                    self.status_label.setStyleSheet("color: #dc2626; font-size: 12px;")
                    self.login_button.setEnabled(True)
            else:
                self.status_label.setText(f"✗ Login failed: {login_response.status_code}")
                self.status_label.setStyleSheet("color: #dc2626; font-size: 12px;")
                self.login_button.setEnabled(True)
                
        except Exception as e:
            self.status_label.setText(f"✗ Login error: {str(e)}")
            self.status_label.setStyleSheet("color: #dc2626; font-size: 12px;")
            self.login_button.setEnabled(True)
    
    def _fetch_user_hwids(self, jwt_token):
        """Fetch authorized HWIDs for user"""
        import requests
        
        api_base = BL.BACKEND_URL.replace("/brainlink_data", "")
        try:
            hwids_url = f"{api_base}/users/hwids"
            self.workflow.main_window.log_message(f"Fetching authorized device IDs from {hwids_url}")
            hwid_response = requests.get(
                hwids_url,
                headers={"X-Authorization": f"Bearer {jwt_token}"},
                timeout=5
            )
            if hwid_response.status_code == 200:
                raw_hwids = hwid_response.json().get("brainlink_hwid", [])
                if isinstance(raw_hwids, str):
                    BL.ALLOWED_HWIDS = [raw_hwids]
                elif isinstance(raw_hwids, list):
                    BL.ALLOWED_HWIDS = raw_hwids
                else:
                    BL.ALLOWED_HWIDS = []
                self.workflow.main_window.log_message(f"✓ Fetched {len(BL.ALLOWED_HWIDS)} authorized device IDs")
        except Exception as e:
            self.workflow.main_window.log_message(f"Error fetching HWIDs: {e}")
    
    def _connect_device(self):
        """Connect to the MindLink device"""
        import threading
        from cushy_serial import CushySerial
        
        port = BL.SERIAL_PORT
        if not port:
            port = BL.detect_brainlink()
            BL.SERIAL_PORT = port
        
        if not port:
            self.workflow.main_window.log_message("✗ No MindLink device found!")
            return
        
        self.workflow.main_window.log_message(f"✓ Connecting to MindLink device: {port}")
        
        # Start MindLink connection - EXACTLY like base GUI
        try:
            self.workflow.main_window.serial_obj = CushySerial(port, BL.SERIAL_BAUD)
            self.workflow.main_window.log_message("Starting MindLink thread...")
            
            BL.stop_thread_flag = False
            
            self.workflow.main_window.brainlink_thread = threading.Thread(
                target=BL.run_brainlink, 
                args=(self.workflow.main_window.serial_obj,)
            )
            self.workflow.main_window.brainlink_thread.daemon = True
            self.workflow.main_window.brainlink_thread.start()
            
            self.workflow.main_window.log_message("✓ MindLink connected successfully!")
        except Exception as e:
            self.workflow.main_window.log_message(f"✗ Failed to connect: {str(e)}")
    
    def _complete_login(self):
        """Complete login"""
        self.status_label.setText("✓ Login successful")
        self.status_label.setStyleSheet("color: #10b981; font-size: 12px; font-weight: 600;")
        self.login_button.setEnabled(True)
        self.login_button.setText("Sign In")
        # Enable Next button after successful login
        self.next_button.setEnabled(True)
    
    def on_next(self):
        """Proceed to Pathway Selection"""
        self._programmatic_close = True
        self.close()
        # After login, show Live EEG first (user requested ordering change)
        QTimer.singleShot(100, lambda: self.workflow.go_to_step(WorkflowStep.LIVE_EEG))
    
    def on_back(self):
        """Navigate back"""
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_back())


# ============================================================================
# STEP 3.5: PATHWAY SELECTION (Protocol Selection)
# ============================================================================

class PathwaySelectionDialog(QDialog):
    """Step 3.5: Select protocol pathway"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Choose Your Pathway")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(500)
        
        # Set window icon
        set_window_icon(self)
        
        # UI Elements
        title_label = QLabel("Choose Your Pathway")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 5 of 8: Select the flow type to tailor your task list")
        subtitle_label.setObjectName("DialogSubtitle")
        subtitle_label.setWordWrap(True)
        
        # Pathway options card
        pathway_card = QFrame()
        pathway_card.setObjectName("DialogCard")
        pathway_layout = QVBoxLayout(pathway_card)
        pathway_layout.setContentsMargins(16, 16, 16, 16)
        pathway_layout.setSpacing(14)
        
        pathway_label = QLabel("Select Protocol:")
        pathway_label.setObjectName("DialogSectionTitle")
        
        # Protocol options - MATCHING ORIGINAL Enhanced GUI
        self.radio_personal = QRadioButton("Personal Pathway")
        self.radio_personal.setChecked(True)
        
        personal_desc = QLabel("Career Flow related tasks")
        personal_desc.setStyleSheet("font-size: 12px; color: #64748b; margin-left: 24px; margin-bottom: 8px;")
        personal_desc.setWordWrap(True)
        
        self.radio_connection = QRadioButton("Connection")
        connection_desc = QLabel("Mind Flow related tasks")
        connection_desc.setStyleSheet("font-size: 12px; color: #64748b; margin-left: 24px; margin-bottom: 8px;")
        connection_desc.setWordWrap(True)
        
        self.radio_lifestyle = QRadioButton("Lifestyle")
        lifestyle_desc = QLabel("Style Flow related tasks")
        lifestyle_desc.setStyleSheet("font-size: 12px; color: #64748b; margin-left: 24px; margin-bottom: 8px;")
        lifestyle_desc.setWordWrap(True)
        
        pathway_layout.addWidget(pathway_label)
        pathway_layout.addWidget(self.radio_personal)
        pathway_layout.addWidget(personal_desc)
        pathway_layout.addWidget(self.radio_connection)
        pathway_layout.addWidget(connection_desc)
        pathway_layout.addWidget(self.radio_lifestyle)
        pathway_layout.addWidget(lifestyle_desc)
        
        # Info note
        info_label = QLabel("ℹ️ Baseline calibration and core cognitive tasks are included in all pathways")
        info_label.setStyleSheet("font-size: 12px; color: #3b82f6; padding: 12px; background: #eff6ff; border-radius: 6px;")
        info_label.setWordWrap(True)
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        
        self.back_button = QPushButton("← Back")
        self.back_button.clicked.connect(self.on_back)
        self.back_button.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        
        nav_layout.addWidget(self.back_button)
        nav_layout.addStretch()
        
        self.next_button = QPushButton("Next →")
        self.next_button.clicked.connect(self.on_next)
        nav_layout.addWidget(self.next_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(pathway_card)
        layout.addWidget(info_label)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add MindLink status bar
        self.status_bar = add_status_bar_to_dialog(self, self.workflow.main_window)
        self._programmatic_close = False
    
    def closeEvent(self, event):
        """Handle dialog close"""
        if self.status_bar:
            self.status_bar.cleanup()
        if hasattr(self, '_programmatic_close') and self._programmatic_close:
            event.accept()
        else:
            reply = QMessageBox.question(
                self,
                'Confirm Exit',
                'Are you sure you want to exit MindLink Analyzer?',
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                event.accept()
                QtWidgets.QApplication.quit()
            else:
                event.ignore()
    
    def on_next(self):
        """Save protocol selection and proceed"""
        # Determine selected protocol - MATCHING ORIGINAL Enhanced GUI
        if self.radio_connection.isChecked():
            protocol = "Connection"
        elif self.radio_lifestyle.isChecked():
            protocol = "Lifestyle"
        else:
            protocol = "Personal Pathway"
        
        # Save to main window
        self.workflow.main_window._selected_protocol = protocol
        
        # Apply protocol filter (same as original Enhanced GUI)
        try:
            self.workflow.main_window._apply_protocol_filter()
        except Exception:
            pass
        
        if self.status_bar:
            self.status_bar.cleanup()
        self._programmatic_close = True
        self.close()
        # After selecting a pathway, proceed to calibration (Live EEG already completed)
        QTimer.singleShot(100, lambda: self.workflow.go_to_step(WorkflowStep.CALIBRATION))
    
    def on_back(self):
        """Navigate back"""
        if self.status_bar:
            self.status_bar.cleanup()
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_back())


# ============================================================================
# STEP 5: LIVE EEG (Using REAL data stream)
# ============================================================================

class LiveEEGDialog(QDialog):
    """Step 5: Real-time EEG signal from actual device"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Live EEG Signal")
        self.setModal(False)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumSize(600, 450)
        
        # Set window icon
        set_window_icon(self)
        
        # UI Elements
        title_label = QLabel("Live EEG Signal")
        title_label.setObjectName("DialogTitle")
        title_label.setStyleSheet("font-size: 16px; font-weight: 600;")  # Reduced from 18px
        
        subtitle_label = QLabel("Step 4 of 8: Monitoring real brain activity")
        subtitle_label.setObjectName("DialogSubtitle")
        subtitle_label.setStyleSheet("font-size: 11px;")  # Reduced from 13px
        
        # EEG Plot card
        plot_card = QFrame()
        plot_card.setObjectName("DialogCard")
        plot_layout = QVBoxLayout(plot_card)
        plot_layout.setContentsMargins(4, 4, 4, 4)  # Reduced from 8, 8, 8, 8
        
        # Use the SAME plotting setup as the main GUI
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground('k')
        self.plot_widget.setLabel('left', 'Amplitude (µV)')
        self.plot_widget.setLabel('bottom', 'Time (samples)')
        self.plot_widget.setTitle('Raw EEG Signal', color='w', size='12pt')
        self.plot_widget.showGrid(x=True, y=True, alpha=0.3)
        
        self.curve = self.plot_widget.plot(pen=pg.mkPen(color='#3b82f6', width=2))
        
        plot_layout.addWidget(self.plot_widget)
        
        # Status info
        self.info_label = QLabel("Signal quality: Good | Ensure proper electrode contact")
        self.info_label.setStyleSheet("color: #10b981; font-size: 11px; padding: 6px;")  # Reduced from 13px, 8px
        self.info_label.setAlignment(Qt.AlignCenter)
        
        # Plotting delay information
        delay_info = QLabel(
            "ℹ️ Note: Visual display may lag 5-10 seconds behind real-time. "
            "This delay is purely visual and does NOT affect data recording. "
            "Task data is captured instantly through the feature engine as signals arrive. Please wait for upto 20 seconds for the signal to stabilize after wearing the headset."
        )
        delay_info.setStyleSheet(
            "color: #475569; font-size: 10px; padding: 4px 8px; "  # Reduced from 11px, 6px 12px
            "background: #f1f5f9; border-radius: 6px; "
            "border-left: 3px solid #3b82f6;"
        )
        delay_info.setWordWrap(True)
        delay_info.setAlignment(Qt.AlignLeft)
        
        # Device reconnection help button
        self.reconnect_help_button = QPushButton("🔄 Device Disconnected?")
        self.reconnect_help_button.setStyleSheet("""
            QPushButton {
                background-color: #fbbf24;
                color: #78350f;
                border-radius: 6px;
                padding: 6px 12px;  
                font-size: 11px;  
                font-weight: 600;
                border: 0;
            }
            QPushButton:hover {
                background-color: #f59e0b;
            }
        """)
        self.reconnect_help_button.clicked.connect(self.show_reconnect_guidance)
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        
        self.back_button = QPushButton("← Back")
        self.back_button.clicked.connect(self.on_back)
        self.back_button.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
                font-size: 11px;
                padding: 6px 12px;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        
        nav_layout.addWidget(self.back_button)
        nav_layout.addStretch()
        
        self.next_button = QPushButton("Next →")
        self.next_button.setStyleSheet("font-size: 11px; padding: 6px 12px;")
        self.next_button.clicked.connect(self.on_next)
        nav_layout.addWidget(self.next_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(16, 16, 16, 16)  # Reduced from 24
        layout.setSpacing(12)  # Reduced from 18
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(plot_card)
        layout.addWidget(self.info_label)
        layout.addWidget(delay_info)
        layout.addWidget(self.reconnect_help_button, alignment=Qt.AlignCenter)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add MindLink status bar
        self.status_bar = add_status_bar_to_dialog(self, self.workflow.main_window)
        
        # Start live update timer using REAL data
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_plot)
        self.update_timer.start(50)  # 20 Hz update rate
        
        # Quality tracking for sustained poor signal detection
        self.quality_history = []  # List of (timestamp, quality_score) tuples
        self.poor_quality_threshold = 45
        self.is_noisy = False
        
        self._programmatic_close = False
    
    def update_plot(self):
        """Update EEG plot with REAL data from live_data_buffer
        
        Note: This displays the most recent data for visual monitoring.
        The plotting delay does NOT affect task recording - tasks record data
        in real-time through the feature_engine which processes data immediately
        as it arrives via the onRaw callback. This plot is purely for visualization.
        """
        # Use the REAL data buffer from the base GUI
        if len(BL.live_data_buffer) >= 512:
            import time
            data = np.array(BL.live_data_buffer[-512:])
            self.curve.setData(data[-500:])  # Plot last 500 for display
            
            # Professional signal quality assessment
            quality_score, status, details = assess_eeg_signal_quality(data, fs=512)
            
            # Track quality history (timestamp, score)
            current_time = time.time()
            self.quality_history.append((current_time, quality_score))
            
            # Remove entries older than 5 seconds
            self.quality_history = [(t, q) for t, q in self.quality_history if current_time - t <= 5.0]
            
            # Count how many times quality dropped to or below threshold in last 5 seconds
            poor_count = sum(1 for t, q in self.quality_history if q <= self.poor_quality_threshold)
            
            # Update noisy state: need 5+ poor readings in 5 seconds to trigger
            if poor_count >= 5:
                self.is_noisy = True
            elif poor_count == 0:  # All recent readings good - reset
                self.is_noisy = False
            # Otherwise maintain current state (hysteresis)
            
            # Display only two states: Good or Noisy
            if self.is_noisy:
                self.info_label.setText("⚠ Signal quality: Noisy | Try: Adjust headset • Check electrode contact • Minimize movement")
                self.info_label.setStyleSheet("color: #f59e0b; font-size: 13px; padding: 8px;")
            else:
                self.info_label.setText(f"✓ Signal quality: Good ({quality_score}%) | Data flowing normally")
                self.info_label.setStyleSheet("color: #10b981; font-size: 13px; padding: 8px;")
        elif len(BL.live_data_buffer) == 0:
            # Device disconnected or no data
            self.info_label.setText("⚠ No signal detected | Device may be disconnected")
            self.info_label.setStyleSheet("color: #ef4444; font-size: 13px; padding: 8px;")
    
    def show_reconnect_guidance(self):
        """Show guidance for reconnecting device"""
        msg = QMessageBox(self)
        msg.setIcon(QMessageBox.Information)
        msg.setWindowTitle("Device Reconnection Guide")
        msg.setText("If your device is disconnected or signal stopped:")
        msg.setInformativeText(
            "<b>Quick Fix Steps:</b><br><br>"
            "1. <b>Switch off</b> the BrainLink amplifier<br>"
            "2. Wait 3-5 seconds<br>"
            "3. <b>Switch on</b> the amplifier<br>"
            "4. Click <b>Back</b> button below<br>"
            "5. Navigate back to <b>Login screen</b><br>"
            "6. <b>Log in again</b> to reconnect the device<br><br>"
            "<i>Note: The app needs to re-establish the connection "
            "after the device has been power-cycled.</i><br><br>"
            "<b>Alternative:</b> Close and restart the application."
        )
        msg.setStandardButtons(QMessageBox.Ok)
        msg.setStyleSheet("""
            QMessageBox {
                background-color: #f8fafc;
            }
            QLabel {
                color: #1f2937;
                font-size: 13px;
            }
        """)
        msg.exec()
    
    def on_back(self):
        """Navigate back"""
        self.update_timer.stop()
        self._programmatic_close = True
        self.close()
        self.workflow.go_back()
    
    def on_next(self):
        """Proceed to pathway selection (user requested ordering: Live EEG before Pathway)"""
        self.update_timer.stop()
        self._programmatic_close = True
        self.close()
        self.workflow.go_to_step(WorkflowStep.PATHWAY_SELECTION)
    
    def closeEvent(self, event):
        """Cleanup"""
        self.update_timer.stop()
        if self.status_bar:
            self.status_bar.cleanup()
        if hasattr(self, '_programmatic_close') and self._programmatic_close:
            event.accept()
        else:
            reply = QMessageBox.question(
                self,
                'Confirm Exit',
                'Are you sure you want to exit MindLink Analyzer?',
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                event.accept()
                QtWidgets.QApplication.quit()
            else:
                event.ignore()


# ============================================================================
# STEP 5: CALIBRATION (Using REAL calibration logic)
# ============================================================================

class CalibrationDialog(QDialog):
    """Step 6: Enhanced calibration with preparatory guidance"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Calibration")
        self.setModal(False)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(600)
        
        # Set window icon
        set_window_icon(self)
        
        # Get REAL feature engine
        self.feature_engine = self.workflow.main_window.feature_engine
        self.current_phase = None
        self.countdown_value = 0
        
        # UI Elements
        title_label = QLabel("Baseline Calibration")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 6 of 8: Establish your baseline brain activity")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # Instructions card
        instr_card = QFrame()
        instr_card.setObjectName("DialogCard")
        instr_layout = QVBoxLayout(instr_card)
        instr_layout.setContentsMargins(16, 16, 16, 16)
        instr_layout.setSpacing(12)
        
        # instr_text = QLabel(
        #     "<b>Calibration Overview:</b><br><br>"
        #     "We will record your baseline brain activity in two phases:<br><br>"
        #     "<b>1. Eyes Closed (30s)</b>: Relax with eyes closed<br>"
        #     "<b>2. Eyes Open (30s)</b>: Stay relaxed, eyes open<br><br>"
        #     "Each phase includes:<br>"
        #     "• Preparation guidance<br>"
        #     "• Audio countdown (5, 4, 3, 2, 1)<br>"
        #     "• 30-second silent recording<br>"
        #     "• Audio notification when complete<br><br>"
        #     "<i>Tip: Ensure your speakers/headphones are on!</i>"
        # )
        # instr_text.setWordWrap(True)
        # instr_text.setStyleSheet("font-size: 13px; color: #475569; line-height: 1.8;")
        
        # instr_layout.addWidget(instr_text)
        
        # Progress card
        progress_card = QFrame()
        progress_card.setObjectName("DialogCard")
        progress_layout = QVBoxLayout(progress_card)
        progress_layout.setContentsMargins(16, 16, 16, 16)
        progress_layout.setSpacing(10)
        
        self.status_label = QLabel("Ready to start")
        self.status_label.setObjectName("DialogSectionTitle")
        
        self.phase_label = QLabel("")
        self.phase_label.setStyleSheet("font-size: 13px; color: #64748b;")
        
        # Signal quality indicator
        self.signal_quality_label = QLabel("Signal quality: Checking...")
        self.signal_quality_label.setStyleSheet(
            "font-size: 12px; color: #6b7280; padding: 6px; "
            "background: #f3f4f6; border-radius: 4px;"
        )
        
        self.ec_button = QPushButton("🎯 Start Eyes Closed Calibration")
        self.ec_button.clicked.connect(self.show_eyes_closed_prep)
        self.ec_button.setStyleSheet(
            "padding: 12px; font-size: 14px; font-weight: 600;"
        )
        
        self.eo_button = QPushButton("🎯 Start Eyes Open Calibration")
        self.eo_button.clicked.connect(self.show_eyes_open_prep)
        self.eo_button.setEnabled(False)
        self.eo_button.setStyleSheet(
            "padding: 12px; font-size: 14px; font-weight: 600;"
        )
        
        progress_layout.addWidget(self.status_label)
        progress_layout.addWidget(self.phase_label)
        progress_layout.addWidget(self.signal_quality_label)
        progress_layout.addWidget(self.ec_button)
        progress_layout.addWidget(self.eo_button)
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        
        self.back_button = QPushButton("← Back")
        self.back_button.clicked.connect(self.on_back)
        self.back_button.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        
        nav_layout.addWidget(self.back_button)
        nav_layout.addStretch()
        
        self.next_button = QPushButton("Next →")
        self.next_button.clicked.connect(self.on_next)
        self.next_button.setEnabled(False)
        nav_layout.addWidget(self.next_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(instr_card)
        layout.addWidget(progress_card)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add MindLink status bar
        self.status_bar = add_status_bar_to_dialog(self, self.workflow.main_window)
        
        # Signal quality monitoring timer
        self.signal_timer = QTimer()
        self.signal_timer.timeout.connect(self.update_signal_quality)
        self.signal_timer.start(500)  # Update every 500ms
        
        # Auto-stop timer
        self.auto_stop_timer = QTimer()
        self.auto_stop_timer.setSingleShot(True)
        self.auto_stop_timer.timeout.connect(self.auto_stop_phase)
        
        # Countdown timer
        self.countdown_timer = QTimer()
        self.countdown_timer.timeout.connect(self.update_countdown)
        
        # Quality tracking for sustained poor signal detection
        self.quality_history = []  # List of (timestamp, quality_score) tuples
        self.poor_quality_threshold = 45
        self.is_noisy = False
        
        self._programmatic_close = False
    
    def update_signal_quality(self):
        """Update signal quality indicator using professional multi-metric assessment"""
        try:
            if len(BL.live_data_buffer) >= 512:
                import time
                # Use proper window size for signal analysis
                data = np.array(list(BL.live_data_buffer)[-512:])
                
                # Professional signal quality assessment
                quality_score, status, details = assess_eeg_signal_quality(data, fs=512)
                
                # Track quality history (timestamp, score)
                current_time = time.time()
                self.quality_history.append((current_time, quality_score))
                
                # Remove entries older than 5 seconds
                self.quality_history = [(t, q) for t, q in self.quality_history if current_time - t <= 5.0]
                
                # Count how many times quality dropped to or below threshold in last 5 seconds
                poor_count = sum(1 for t, q in self.quality_history if q <= self.poor_quality_threshold)
                
                # Update noisy state: need 5+ poor readings in 5 seconds to trigger
                if poor_count >= 5:
                    self.is_noisy = True
                elif poor_count == 0:  # All recent readings good - reset
                    self.is_noisy = False
                # Otherwise maintain current state (hysteresis)
                
                # Display only two states: Good or Noisy
                if self.is_noisy:
                    self.signal_quality_label.setText("⚠ Signal: Noisy")
                    self.signal_quality_label.setStyleSheet(
                        "font-size: 12px; color: #d97706; padding: 6px; "
                        "background: #fef3c7; border-radius: 4px; font-weight: 600;"
                    )
                else:
                    self.signal_quality_label.setText(f"✓ Signal: Good ({quality_score}%)")
                    self.signal_quality_label.setStyleSheet(
                        "font-size: 12px; color: #059669; padding: 6px; "
                        "background: #d1fae5; border-radius: 4px; font-weight: 600;"
                    )
            else:
                self.signal_quality_label.setText("○ Signal: Waiting...")
                self.signal_quality_label.setStyleSheet(
                    "font-size: 12px; color: #6b7280; padding: 6px; "
                    "background: #f3f4f6; border-radius: 4px;"
                )
        except Exception as e:
            # Fallback on error
            self.signal_quality_label.setText("⚠ Signal: Error")
            self.signal_quality_label.setStyleSheet(
                "font-size: 12px; color: #dc2626; padding: 6px; "
                "background: #fef2f2; border-radius: 4px;"
            )
    
    def show_eyes_closed_prep(self):
        """Show preparation dialog for eyes closed calibration"""
        prep_dialog = QDialog(self)
        prep_dialog.setWindowTitle("Eyes Closed Calibration - Get Ready")
        prep_dialog.setModal(True)
        prep_dialog.setMinimumWidth(500)
        set_window_icon(prep_dialog)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)
        
        # Title
        title = QLabel("🌙 Eyes Closed Baseline")
        title.setStyleSheet(
            "font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 8px;"
        )
        title.setAlignment(Qt.AlignCenter)
        
        # Instructions
        instructions = QLabel(
            "<b>Get ready to close your eyes and relax.</b><br><br>"
            "The sensors will record your baseline brainwave pattern for 30 seconds.<br><br>"
            "<b>What will happen:</b><br>"
            "1. Click 'Start Recording' below<br>"
            "2. You'll hear a countdown: <i>5, 4, 3, 2, 1 in beep sound</i><br>"
            "3. Close your eyes and relax for 30 seconds<br>"
            "4. Stay still and calm - don't think about anything specific<br>"
            "5. A sound will notify you when the 30 seconds are complete<br><br>"
            "<b style='color: #dc2626;'>⚠ Important: Check your speakers/headphones are ON!</b>"
        )
        instructions.setWordWrap(True)
        instructions.setStyleSheet(
            "font-size: 13px; color: #475569; line-height: 1.8; "
            "padding: 16px; background: #f8fafc; border-radius: 8px;"
        )
        
        # Signal quality in prep dialog - dynamic assessment
        signal_label = QLabel("Signal quality: Checking...")
        signal_label.setStyleSheet(
            "font-size: 13px; color: #6b7280; padding: 8px; "
            "background: #f3f4f6; border-radius: 6px; font-weight: 600;"
        )
        signal_label.setAlignment(Qt.AlignCenter)
        
        # Local quality history for prep dialog
        prep_quality_history = []
        
        # Update signal quality dynamically
        def update_prep_signal():
            import time
            if len(BL.live_data_buffer) >= 512:
                data = np.array(list(BL.live_data_buffer)[-512:])
                quality_score, status, details = assess_eeg_signal_quality(data, fs=512)
                
                # Track quality locally
                current_time = time.time()
                prep_quality_history.append((current_time, quality_score))
                # Remove entries older than 5 seconds
                while prep_quality_history and current_time - prep_quality_history[0][0] > 5.0:
                    prep_quality_history.pop(0)
                
                poor_count = sum(1 for t, q in prep_quality_history if q <= self.poor_quality_threshold)
                
                if poor_count >= 5:
                    signal_label.setText("⚠ Signal: Noisy")
                    signal_label.setStyleSheet(
                        "font-size: 13px; color: #d97706; padding: 8px; "
                        "background: #fef3c7; border-radius: 6px; font-weight: 600;"
                    )
                else:
                    signal_label.setText(f"✓ Signal: Good ({quality_score}%)")
                    signal_label.setStyleSheet(
                        "font-size: 13px; color: #059669; padding: 8px; "
                        "background: #d1fae5; border-radius: 6px; font-weight: 600;"
                    )
            else:
                signal_label.setText("○ Signal: Waiting...")
                signal_label.setStyleSheet(
                    "font-size: 13px; color: #6b7280; padding: 8px; "
                    "background: #f3f4f6; border-radius: 6px; font-weight: 600;"
                )
        
        # Timer to update signal quality in prep dialog
        prep_timer = QTimer(prep_dialog)
        prep_timer.timeout.connect(update_prep_signal)
        prep_timer.start(500)
        update_prep_signal()  # Initial update
        
        # Start button
        start_btn = QPushButton("▶ Start Recording")
        start_btn.setStyleSheet(
            "padding: 12px 24px; font-size: 14px; font-weight: 600; "
            "background-color: #2563eb; border-radius: 8px;"
        )
        start_btn.clicked.connect(lambda: (prep_dialog.accept(), self.start_eyes_closed()))
        
        # Cancel button
        cancel_btn = QPushButton("Cancel")
        cancel_btn.setStyleSheet(
            "padding: 10px 20px; font-size: 13px; "
            "background-color: #e2e8f0; color: #475569; border-radius: 6px;"
        )
        cancel_btn.clicked.connect(prep_dialog.reject)
        
        # Button layout
        btn_layout = QHBoxLayout()
        btn_layout.addWidget(cancel_btn)
        btn_layout.addStretch()
        btn_layout.addWidget(start_btn)
        
        layout.addWidget(title)
        layout.addWidget(instructions)
        layout.addWidget(signal_label)
        layout.addSpacing(8)
        layout.addLayout(btn_layout)
        
        prep_dialog.setLayout(layout)
        apply_modern_dialog_theme(prep_dialog)
        prep_dialog.exec()
    
    def start_eyes_closed(self):
        """Start eyes-closed calibration with countdown"""
        self.current_phase = 'eyes_closed'
        self.status_label.setText("⏳ Countdown starting...")
        self.phase_label.setText("Get ready! Listen for the countdown...")
        self.ec_button.setEnabled(False)
        self.back_button.setEnabled(False)
        
        print("[CalibrationDialog] Initiating eyes_closed calibration...")
        
        # Start audio countdown
        self.countdown_value = 5
        self.start_countdown_sequence('eyes_closed')
    
    def start_countdown_sequence(self, phase):
        """Run audio countdown sequence"""
        # Store the phase we're counting down for
        self.countdown_phase = phase
        self.countdown_timer.start(1000)  # 1 second intervals
    
    def update_countdown(self):
        """Update countdown display and play audio"""
        if self.countdown_value > 0:
            self.status_label.setText(f"⏳ Countdown: {self.countdown_value}")
            self.phase_label.setText(f"Listening to audio: {self.countdown_value}...")
            # Play countdown beep
            try:
                import winsound
                winsound.Beep(800, 200)  # 800Hz, 200ms
            except:
                pass
            self.countdown_value -= 1
        else:
            # Countdown finished, start actual recording
            self.countdown_timer.stop()
            # Use countdown_phase instead of current_phase to ensure correct phase starts
            if self.countdown_phase == 'eyes_closed':
                self.status_label.setText("🎬 Recording: Eyes Closed")
                self.phase_label.setText("Close your eyes and relax... (30 seconds)")
                self.feature_engine.start_calibration_phase('eyes_closed')
                print("[CalibrationDialog] Started eyes_closed phase")
            elif self.countdown_phase == 'eyes_open':
                self.status_label.setText("🎬 Recording: Eyes Open")
                self.phase_label.setText("Keep your eyes open and stay relaxed... (30 seconds)")
                self.feature_engine.start_calibration_phase('eyes_open')
                print("[CalibrationDialog] Started eyes_open phase")
            
            # Auto-stop after 30 seconds
            self.auto_stop_timer.start(30000)
    
    def show_eyes_open_prep(self):
        """Show preparation dialog for eyes open calibration"""
        prep_dialog = QDialog(self)
        prep_dialog.setWindowTitle("Eyes Open Calibration - Get Ready")
        prep_dialog.setModal(True)
        prep_dialog.setMinimumWidth(500)
        set_window_icon(prep_dialog)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)
        
        # Title
        title = QLabel("👁️ Eyes Open Baseline")
        title.setStyleSheet(
            "font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 8px;"
        )
        title.setAlignment(Qt.AlignCenter)
        
        # Instructions
        instructions = QLabel(
            "<b>Get ready to keep your eyes open and stay relaxed.</b><br><br>"
            "The sensors will record your eyes-open baseline for 30 seconds.<br><br>"
            "<b>What will happen:</b><br>"
            "1. Click 'Start Recording' below<br>"
            "2. You'll hear a countdown: <i>5, 4, 3, 2, 1 in beep sound</i><br>"
            "3. Keep your eyes open and relax for 30 seconds<br>"
            "4. Stay calm - look ahead calmly, minimize blinking<br>"
            "5. A sound will notify you when the 30 seconds are complete<br><br>"
            "<b style='color: #dc2626;'>⚠ Important: Keep eyes open but stay relaxed!</b>"
        )
        instructions.setWordWrap(True)
        instructions.setStyleSheet(
            "font-size: 13px; color: #475569; line-height: 1.8; "
            "padding: 16px; background: #f8fafc; border-radius: 8px;"
        )
        
        # Signal quality - dynamic assessment
        signal_label = QLabel("Signal quality: Checking...")
        signal_label.setStyleSheet(
            "font-size: 13px; color: #6b7280; padding: 8px; "
            "background: #f3f4f6; border-radius: 6px; font-weight: 600;"
        )
        signal_label.setAlignment(Qt.AlignCenter)
        
        # Local quality history for prep dialog
        prep_quality_history = []
        
        # Update signal quality dynamically
        def update_prep_signal():
            import time
            if len(BL.live_data_buffer) >= 512:
                data = np.array(list(BL.live_data_buffer)[-512:])
                quality_score, status, details = assess_eeg_signal_quality(data, fs=512)
                
                # Track quality locally
                current_time = time.time()
                prep_quality_history.append((current_time, quality_score))
                # Remove entries older than 5 seconds
                while prep_quality_history and current_time - prep_quality_history[0][0] > 5.0:
                    prep_quality_history.pop(0)
                
                poor_count = sum(1 for t, q in prep_quality_history if q <= self.poor_quality_threshold)
                
                if poor_count >= 5:
                    signal_label.setText("⚠ Signal: Noisy")
                    signal_label.setStyleSheet(
                        "font-size: 13px; color: #d97706; padding: 8px; "
                        "background: #fef3c7; border-radius: 6px; font-weight: 600;"
                    )
                else:
                    signal_label.setText(f"✓ Signal: Good ({quality_score}%)")
                    signal_label.setStyleSheet(
                        "font-size: 13px; color: #059669; padding: 8px; "
                        "background: #d1fae5; border-radius: 6px; font-weight: 600;"
                    )
            else:
                signal_label.setText("○ Signal: Waiting...")
                signal_label.setStyleSheet(
                    "font-size: 13px; color: #6b7280; padding: 8px; "
                    "background: #f3f4f6; border-radius: 6px; font-weight: 600;"
                )
        
        # Timer to update signal quality in prep dialog
        prep_timer = QTimer(prep_dialog)
        prep_timer.timeout.connect(update_prep_signal)
        prep_timer.start(500)
        update_prep_signal()  # Initial update
        
        # Start button
        start_btn = QPushButton("▶ Start Recording")
        start_btn.setStyleSheet(
            "padding: 12px 24px; font-size: 14px; font-weight: 600; "
            "background-color: #2563eb; border-radius: 8px;"
        )
        start_btn.clicked.connect(lambda: (prep_dialog.accept(), self.start_eyes_open()))
        
        # Cancel button
        cancel_btn = QPushButton("Cancel")
        cancel_btn.setStyleSheet(
            "padding: 10px 20px; font-size: 13px; "
            "background-color: #e2e8f0; color: #475569; border-radius: 6px;"
        )
        cancel_btn.clicked.connect(prep_dialog.reject)
        
        # Button layout
        btn_layout = QHBoxLayout()
        btn_layout.addWidget(cancel_btn)
        btn_layout.addStretch()
        btn_layout.addWidget(start_btn)
        
        layout.addWidget(title)
        layout.addWidget(instructions)
        layout.addWidget(signal_label)
        layout.addSpacing(8)
        layout.addLayout(btn_layout)
        
        prep_dialog.setLayout(layout)
        apply_modern_dialog_theme(prep_dialog)
        prep_dialog.exec()
    
    def start_eyes_open(self):
        """Start eyes-open calibration with countdown"""
        self.current_phase = 'eyes_open'
        self.status_label.setText("⏳ Countdown starting...")
        self.phase_label.setText("Get ready! Listen for the countdown...")
        self.eo_button.setEnabled(False)
        self.back_button.setEnabled(False)
        
        print("[CalibrationDialog] Initiating eyes_open calibration...")
        
        # Start audio countdown
        self.countdown_value = 5
        self.start_countdown_sequence('eyes_open')
    
    def auto_stop_phase(self):
        """Auto-stop current calibration phase with completion notification"""
        # Check if dialog is still valid (not closed)
        if not self.isVisible():
            print("Dialog not visible, skipping auto_stop_phase")
            return
        
        # Play completion sound (4 beeps)
        try:
            import winsound
            for _ in range(4):
                winsound.Beep(1000, 150)
                QTimer.singleShot(200, lambda: None)  # Brief pause
        except:
            pass
            
        try:
            # Stop the calibration phase
            self.feature_engine.stop_calibration_phase()
            
            if self.current_phase == 'eyes_closed':
                self.status_label.setText("✅ Eyes Closed Complete!")
                self.phase_label.setText("Great! Now let's record with eyes open.")
                self.eo_button.setEnabled(True)
                self.back_button.setEnabled(True)
                
                # Show completion message
                QMessageBox.information(
                    self,
                    "Eyes Closed Complete",
                    "<b>Eyes Closed calibration finished!</b><br><br>"
                    "You can now proceed to the Eyes Open calibration.<br><br>"
                    "Click 'Start Eyes Open Calibration' when ready.",
                    QMessageBox.Ok
                )
            elif self.current_phase == 'eyes_open':
                self.status_label.setText("✅ Calibration Complete!")
                self.phase_label.setText("Both baseline phases recorded successfully!")
                self.back_button.setEnabled(True)
                
                # Compute REAL baseline statistics
                try:
                    self.feature_engine.compute_baseline_statistics()
                    self.phase_label.setText("✓ Both phases complete. Baseline computed successfully.")
                except Exception as e:
                    print(f"Warning: Error computing baseline statistics: {e}")
                    self.phase_label.setText("Both phases complete. Baseline computed with warnings.")
                
                self.next_button.setEnabled(True)
                
                # Show completion message
                QMessageBox.information(
                    self,
                    "Calibration Complete",
                    "<b>Excellent! Baseline calibration is complete!</b><br><br>"
                    "Both Eyes Closed and Eyes Open baselines have been recorded.<br><br>"
                    "Click 'Next' to proceed to the task selection.",
                    QMessageBox.Ok
                )
        except Exception as e:
            print(f"Error in auto_stop_phase: {e}")
            import traceback
            traceback.print_exc()
            # Try to recover by enabling the next button anyway
            if self.current_phase in ['eyes_closed', 'eyes_open']:
                try:
                    self.next_button.setEnabled(True)
                except:
                    pass
    
    def on_back(self):
        """Navigate back"""
        if self.auto_stop_timer.isActive():
            self.auto_stop_timer.stop()
        if self.current_phase:
            self.feature_engine.stop_calibration_phase()
        
        if self.status_bar:
            self.status_bar.cleanup()
        
        self._programmatic_close = True
        self.close()
        self.workflow.go_back()
    
    def on_next(self):
        """Proceed to task selection"""
        if self.status_bar:
            self.status_bar.cleanup()
        
        self._programmatic_close = True
        self.close()
        self.workflow.go_to_step(WorkflowStep.TASK_SELECTION)
    
    def closeEvent(self, event):
        """Handle dialog close - distinguish between user X click and programmatic close"""
        try:
            # Stop all timers
            if hasattr(self, 'auto_stop_timer') and self.auto_stop_timer.isActive():
                self.auto_stop_timer.stop()
            if hasattr(self, 'countdown_timer') and self.countdown_timer.isActive():
                self.countdown_timer.stop()
            if hasattr(self, 'signal_timer') and self.signal_timer.isActive():
                self.signal_timer.stop()
            
            if hasattr(self, 'current_phase') and self.current_phase:
                try:
                    self.feature_engine.stop_calibration_phase()
                except Exception as e:
                    print(f"Warning: Error stopping calibration on close: {e}")
            
            if hasattr(self, 'status_bar') and self.status_bar:
                try:
                    self.status_bar.cleanup()
                except Exception as e:
                    print(f"Warning: Error cleaning up status bar: {e}")
            
            if hasattr(self, '_programmatic_close') and self._programmatic_close:
                # Programmatic close from navigation buttons - allow it
                event.accept()
            else:
                # User clicked X button - show confirmation
                reply = QMessageBox.question(
                    self, 'Confirm Exit',
                    'Calibration in progress. Are you sure you want to exit?',
                    QMessageBox.Yes | QMessageBox.No,
                    QMessageBox.No
                )
                if reply == QMessageBox.Yes:
                    event.accept()
                    # Close the entire application
                    QtWidgets.QApplication.quit()
                else:
                    event.ignore()
        except Exception as e:
            print(f"Error in CalibrationDialog closeEvent: {e}")
            import traceback
            traceback.print_exc()
            event.accept()  # Accept to prevent dialog freeze


# ============================================================================
# STEP 6: TASK SELECTION (Using REAL task interface)
# ============================================================================

class TaskSelectionDialog(QDialog):
    """Step 7: Select and launch REAL cognitive tasks"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Task Selection")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumSize(550, 500)
        
        # Set window icon
        set_window_icon(self)
        
        # Use FILTERED task list from main window's task_combo
        # This respects the protocol pathway selection made earlier
        self.available_task_ids = []
        if hasattr(self.workflow.main_window, 'task_combo') and self.workflow.main_window.task_combo:
            # Get the filtered task IDs from the main window's combo box
            # The _apply_protocol_filter() method already populated this with the correct tasks
            for i in range(self.workflow.main_window.task_combo.count()):
                task_id = self.workflow.main_window.task_combo.itemText(i)
                self.available_task_ids.append(task_id)
        
        # Fall back to all tasks if filtering failed
        if not self.available_task_ids:
            self.available_task_ids = list(BL.AVAILABLE_TASKS.keys())
        
        # UI Elements
        title_label = QLabel("Cognitive Tasks")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 7 of 8: Select tasks to perform")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # Task selection card
        task_card = QFrame()
        task_card.setObjectName("DialogCard")
        task_layout = QVBoxLayout(task_card)
        task_layout.setContentsMargins(16, 16, 16, 16)
        task_layout.setSpacing(12)
        
        task_label = QLabel("Choose a task:")
        task_label.setObjectName("DialogSectionTitle")
        
        self.task_combo = QComboBox()
        # Populate with task names as display text and task IDs as data
        for task_id in self.available_task_ids:
            if task_id in BL.AVAILABLE_TASKS:
                task_name = BL.AVAILABLE_TASKS[task_id].get('name', task_id)
                self.task_combo.addItem(task_name, task_id)  # Display name, store ID as data
        self.task_combo.currentIndexChanged.connect(self.update_task_preview)
        
        task_layout.addWidget(task_label)
        task_layout.addWidget(self.task_combo)
        
        # Task preview card
        preview_card = QFrame()
        preview_card.setObjectName("DialogCard")
        preview_layout = QVBoxLayout(preview_card)
        preview_layout.setContentsMargins(16, 16, 16, 16)
        preview_layout.setSpacing(10)
        
        preview_title = QLabel("Task Details:")
        preview_title.setObjectName("DialogSectionTitle")
        
        self.task_description = QLabel()
        self.task_description.setWordWrap(True)
        self.task_description.setStyleSheet("font-size: 13px; color: #475569;")
        
        self.start_task_button = QPushButton("Start This Task")
        self.start_task_button.clicked.connect(self.start_selected_task)
        self.start_task_button.setStyleSheet("padding: 10px; font-size: 14px; font-weight: 600;")
        
        preview_layout.addWidget(preview_title)
        preview_layout.addWidget(self.task_description)
        preview_layout.addWidget(self.start_task_button)
        
        # Completed tasks info
        self.completed_label = QLabel()
        self.completed_label.setStyleSheet("font-size: 12px; color: #64748b; padding: 8px;")
        self.update_completed_tasks_display()
        
        # Initial task preview update
        self.update_task_preview()
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        
        self.back_button = QPushButton("← Back")
        self.back_button.clicked.connect(self.on_back)
        self.back_button.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        
        nav_layout.addWidget(self.back_button)
        nav_layout.addStretch()
        
        self.next_button = QPushButton("Proceed to Analysis →")
        self.next_button.clicked.connect(self.on_next)
        # Enable if tasks have been completed
        completed_count = len([t for t in self.workflow.main_window.feature_engine.calibration_data.get('tasks', {}).keys() 
                               if t not in ['baseline', 'eyes_closed', 'eyes_open']])
        self.next_button.setEnabled(completed_count > 0)
        nav_layout.addWidget(self.next_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(task_card)
        layout.addWidget(preview_card)
        layout.addWidget(self.completed_label)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add MindLink status bar
        self.status_bar = add_status_bar_to_dialog(self, self.workflow.main_window)
        
        # Initialize preview
        self.update_task_preview()
        self._programmatic_close = False
    
    def _center_on_screen(self):
        """Center the dialog on the screen"""
        try:
            screen = QtWidgets.QApplication.primaryScreen()
            if screen:
                screen_geometry = screen.availableGeometry()
                dialog_geometry = self.frameGeometry()
                center_point = screen_geometry.center()
                dialog_geometry.moveCenter(center_point)
                self.move(dialog_geometry.topLeft())
        except Exception as e:
            print(f"Warning: Could not center dialog: {e}")
    
    def closeEvent(self, event):
        """Handle dialog close - distinguish between user X click and programmatic close"""
        if hasattr(self, '_programmatic_close') and self._programmatic_close:
            # Programmatic close from navigation buttons - allow it
            event.accept()
        else:
            # User clicked X button - show confirmation
            if self.status_bar:
                self.status_bar.cleanup()
            reply = QMessageBox.question(
                self,
                'Confirm Exit',
                'Are you sure you want to exit MindLink Analyzer?',
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                event.accept()
                QtWidgets.QApplication.quit()
            else:
                event.ignore()
    
    def update_task_preview(self):
        """Update task description preview"""
        # Get task ID from combo box data (not the display text)
        task_id = self.task_combo.currentData()
        
        # Get task info from BL.AVAILABLE_TASKS using task_id
        if task_id and task_id in BL.AVAILABLE_TASKS:
            task_info = BL.AVAILABLE_TASKS[task_id]
            task_name = task_info.get('name', task_id)
            desc = task_info.get('description', '')
            duration = task_info.get('duration', 60)
            instructions = task_info.get('instructions', '')
            
            preview_text = f"<b>{task_name}</b><br><br>"
            preview_text += f"Description: {desc}<br>"
            preview_text += f"Duration: ~{duration} seconds<br><br>"
            if instructions:
                preview_text += f"Instructions: {instructions}"
            
            self.task_description.setText(preview_text)
        else:
            self.task_description.setText("Task information not available")
    
    def start_selected_task(self):
        """Launch the REAL task using main window's start_task method"""
        # Get task ID from combo box data (not the display text)
        task_id = self.task_combo.currentData()
        
        # Verify task_id exists
        if not task_id or task_id not in BL.AVAILABLE_TASKS:
            QMessageBox.warning(self, "Invalid Task", f"Task '{task_id}' not found in available tasks.")
            return
        
        # Set the task in the combo box if the main window has one
        if hasattr(self.workflow.main_window, 'task_combo'):
            # Find the index for this task_id in the main window's combo
            for i in range(self.workflow.main_window.task_combo.count()):
                if self.workflow.main_window.task_combo.itemText(i) == task_id:
                    self.workflow.main_window.task_combo.setCurrentIndex(i)
                    break
        
        # Hide this dialog temporarily
        self.hide()
        
        # Use the REAL start_task method from Enhanced GUI
        # This method handles EVERYTHING: start_calibration_phase, show_task_interface, audio cues, etc.
        try:
            self.workflow.main_window.start_task()
            self.workflow.main_window.log_message(f"✓ Started task via start_task(): {task_id}")
        except Exception as e:
            self.workflow.main_window.log_message(f"Error starting task: {e}")
            QMessageBox.warning(self, "Task Start Error", f"Failed to start task:\n{str(e)}")
            self.show()
            return
        
        # After task completion, show this dialog again
        QTimer.singleShot(1000, self._check_task_completion)
    
    def _check_task_completion(self):
        """Check if task is complete and update UI"""
        # If task dialog is closed, show selection again
        if not self.workflow.main_window._task_dialog or not self.workflow.main_window._task_dialog.isVisible():
            # Debug: Check what was stored after task completion
            engine = self.workflow.main_window.feature_engine
            tasks = engine.calibration_data.get('tasks', {})
            print(f"\n=== TASK COMPLETION DEBUG ===")
            print(f"Task dialog closed. Checking stored data...")
            print(f"Tasks in 'tasks' dict: {list(tasks.keys())}")
            for task_name, task_data in tasks.items():
                print(f"  {task_name}: {len(task_data.get('features', []))} features")
            print(f"==============================\n")
            
            self.show()
            self._center_on_screen()  # Re-center after task completion
            self.update_completed_tasks_display()
            self.next_button.setEnabled(True)
        else:
            # Check again in 1 second
            QTimer.singleShot(1000, self._check_task_completion)
    
    def update_completed_tasks_display(self):
        """Update the completed tasks counter"""
        tasks_data = self.workflow.main_window.feature_engine.calibration_data.get('tasks', {})
        completed_tasks = [t for t in tasks_data.keys() if t not in ['baseline', 'eyes_closed', 'eyes_open']]
        count = len(completed_tasks)
        
        if count == 0:
            self.completed_label.setText("No tasks completed yet. Complete at least one task to proceed.")
        elif count == 1:
            self.completed_label.setText(f"✓ {count} task completed: {', '.join(completed_tasks)}")
        else:
            self.completed_label.setText(f"✓ {count} tasks completed: {', '.join(completed_tasks)}")
    
    def on_back(self):
        """Navigate back"""
        if self.status_bar:
            self.status_bar.cleanup()
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_back())
    
    def on_next(self):
        """Proceed to multi-task analysis"""
        if self.status_bar:
            self.status_bar.cleanup()
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_to_step(WorkflowStep.MULTI_TASK_ANALYSIS))


# ============================================================================
# STEP 7: MULTI-TASK ANALYSIS (Using REAL analysis engine)
# ============================================================================

class MultiTaskAnalysisDialog(QDialog):
    """Step 8: Real multi-task analysis and report generation"""
    
    # Define signal for thread-safe communication
    analysis_complete_signal = QtCore.Signal()
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Multi-Task Analysis")
        self.setModal(False)  # Changed to False so Enhanced GUI's progress dialog works
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumSize(700, 600)
        
        # Set window icon
        set_window_icon(self)
        
        # Center the dialog on screen after showing
        QTimer.singleShot(0, self._center_on_screen)
        
        # Connect signal to slot for thread-safe GUI updates
        self.analysis_complete_signal.connect(self._display_results)
        
        # UI Elements
        title_label = QLabel("Multi-Task Analysis")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 8 of 8: Analyze all completed tasks")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # Analysis actions card
        actions_card = QFrame()
        actions_card.setObjectName("DialogCard")
        actions_layout = QVBoxLayout(actions_card)
        actions_layout.setContentsMargins(16, 16, 16, 16)
        actions_layout.setSpacing(12)
        
        actions_label = QLabel("Analysis Actions:")
        actions_label.setObjectName("DialogSectionTitle")
        
        button_layout = QHBoxLayout()
        
        self.analyze_button = QPushButton("Analyze All Tasks")
        self.analyze_button.clicked.connect(self.analyze_all_tasks)
        self.analyze_button.setStyleSheet("padding: 10px;")
        
        self.report_button = QPushButton("Generate Report")
        self.report_button.clicked.connect(self.generate_report)
        self.report_button.setEnabled(False)
        self.report_button.setStyleSheet("padding: 10px;")
        
        self.seed_button = QPushButton("Seed Report")
        self.seed_button.clicked.connect(self.seed_report)
        self.seed_button.setEnabled(False)
        self.seed_button.setStyleSheet("""
            padding: 10px;
            background-color: #1e3a8a;
        """)
        self.seed_button.setToolTip("Seed report to Mindspeller API")
        
        button_layout.addWidget(self.analyze_button)
        button_layout.addWidget(self.report_button)
        button_layout.addWidget(self.seed_button)
        
        actions_layout.addWidget(actions_label)
        actions_layout.addLayout(button_layout)
        
        # Detect selected region from backend URL
        selected_region = "Unknown"
        if "stg-en" in BL.BACKEND_URL or "en.mindspell" in BL.BACKEND_URL:
            selected_region = "English (en)"
        elif "stg-nl" in BL.BACKEND_URL or "nl.mindspell" in BL.BACKEND_URL:
            selected_region = "Dutch (nl)"
        elif "127.0.0.1" in BL.BACKEND_URL or "localhost" in BL.BACKEND_URL:
            selected_region = "Local"
        
        # Add informational text about the buttons with selected region
        info_text = QLabel(
            f"📄 Generate Report: Save locally & share via superadmin panel\n"
            f"☁️  Seed Report: Send directly to Mindspeller database\n"
            f"    Selected Region: {selected_region} (from Step 2)"
        )
        info_text.setStyleSheet("""
            font-size: 11px; 
            color: #64748b; 
            padding: 8px 12px; 
            background: #f1f5f9; 
            border-radius: 6px;
            margin-top: 8px;
        """)
        info_text.setWordWrap(True)
        actions_layout.addWidget(info_text)
        
        # Store generated report text for seeding
        self.generated_report_text = None
        
        # Results display card
        results_card = QFrame()
        results_card.setObjectName("DialogCard")
        results_layout = QVBoxLayout(results_card)
        results_layout.setContentsMargins(16, 16, 16, 16)
        results_layout.setSpacing(10)
        
        results_label = QLabel("Results:")
        results_label.setObjectName("DialogSectionTitle")
        
        self.results_text = QTextEdit()
        self.results_text.setReadOnly(True)
        self.results_text.setMinimumHeight(200)  # Reduced from 300 to make room for action buttons
        self.results_text.setMaximumHeight(250)  # Add max height to keep dialog compact
        self.results_text.setPlainText("Click 'Analyze All Tasks' to begin analysis...")
        
        results_layout.addWidget(results_label)
        results_layout.addWidget(self.results_text)
        
        # Navigation buttons
        nav_layout = QHBoxLayout()
        
        self.back_button = QPushButton("← Back")
        self.back_button.clicked.connect(self.on_back)
        self.back_button.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        
        nav_layout.addWidget(self.back_button)
        nav_layout.addStretch()
        
        self.finish_button = QPushButton("Finish")
        self.finish_button.clicked.connect(self.on_finish)
        self.finish_button.setEnabled(False)  # Disabled until analysis completes
        nav_layout.addWidget(self.finish_button)
        
        # Layout assembly
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        layout.addWidget(actions_card)
        layout.addWidget(results_card)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Add MindLink status bar
        self.status_bar = add_status_bar_to_dialog(self, self.workflow.main_window)
        self._programmatic_close = False
    
    def closeEvent(self, event):
        """Handle dialog close - distinguish between user X click and programmatic close"""
        if hasattr(self, '_programmatic_close') and self._programmatic_close:
            # Programmatic close from navigation buttons - allow it
            event.accept()
        else:
            # User clicked X button - show confirmation
            if self.status_bar:
                self.status_bar.cleanup()
            reply = QMessageBox.question(
                self,
                'Confirm Exit',
                'Are you sure you want to exit MindLink Analyzer?\\n\\nAll unsaved analysis data will be lost.',
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            if reply == QMessageBox.Yes:
                event.accept()
                QtWidgets.QApplication.quit()
            else:
                event.ignore()
    
    def _center_on_screen(self):
        """Center the dialog on the screen"""
        try:
            # Get the screen geometry
            screen = QtWidgets.QApplication.primaryScreen()
            if screen:
                screen_geometry = screen.availableGeometry()
                dialog_geometry = self.frameGeometry()
                
                # Calculate center position
                center_x = screen_geometry.center().x() - dialog_geometry.width() // 2
                center_y = screen_geometry.center().y() - dialog_geometry.height() // 2
                
                # Move to center
                self.move(center_x, center_y)
        except Exception as e:
            print(f"Warning: Could not center dialog: {e}")
    
    def analyze_all_tasks(self):
        """Run REAL multi-task analysis"""
        self.results_text.setPlainText("Analyzing all tasks...\n\nThis may take a moment.")
        self.analyze_button.setEnabled(False)
        
        # Debug: Check what tasks are available
        engine = self.workflow.main_window.feature_engine
        tasks = engine.calibration_data.get('tasks', {})
        
        print(f"\n=== PRE-ANALYSIS DEBUG ===")
        print(f"calibration_data keys: {list(engine.calibration_data.keys())}")
        print(f"Available tasks in 'tasks': {list(tasks.keys())}")
        for task_name, task_data in tasks.items():
            print(f"  {task_name}: {len(task_data.get('features', []))} features")
        
        # Also check the legacy 'task' bucket (singular)
        legacy_task = engine.calibration_data.get('task', {})
        if legacy_task.get('features'):
            print(f"WARNING: Found features in legacy 'task' bucket: {len(legacy_task.get('features', []))} features")
            print(f"  This means tasks were stored in the wrong location!")
        
        print(f"Baseline stats exist: {bool(engine.baseline_stats)}")
        print(f"Current state: {engine.current_state}")
        print(f"Current task: {engine.current_task}")
        print(f"=========================\n")
        
        if not tasks:
            self.results_text.setPlainText(
                "No tasks have been recorded yet.\n\n"
                "Please:\n"
                "1. Ensure the device is connected and streaming EEG\n"
                "2. Start a task from the Task Selection step\n"
                "3. Wait at least 10-15 seconds for data collection\n"
                "4. Press 'Stop Now' to end the task\n"
                "5. Then return here to analyze"
            )
            self.analyze_button.setEnabled(True)
            return
        
        # ROBUST FIX: Run analyze_all_tasks_data() in background thread
        # Cannot run in main thread - it's CPU-intensive and will freeze the GUI
        # But we avoid the Enhanced GUI's modal dialog by managing our own progress display
        
        import threading
        
        # Show initial progress message
        self.results_text.setPlainText(
            "Analysis in progress...\n\n"
            "⏳ Initializing analysis engine...\n"
            "⏳ Computing baseline statistics...\n"
            "⏳ Preparing task comparisons...\n\n"
            "Please wait, this may take 3-5 minutes. Wait for the Generate Report button to be enabled.."
        )
        
        # Track analysis state
        self.analysis_running = True
        self.progress_dots = 0
        
        # Progress update timer (updates UI every second)
        self.progress_timer = QTimer()
        self.progress_timer.timeout.connect(self._update_progress_display)
        self.progress_timer.start(1000)  # Update every second
        
        # Set up permutation progress callback for real-time updates
        def _permutation_progress(current, total):
            """Called from background thread during permutation testing"""
            try:
                # Calculate progress percentage
                progress_pct = int((current / total) * 100)
                
                # Update progress message (thread-safe via Qt invoke)
                progress_msg = (
                    f"Analysis in progress...\n\n"
                    f"📊 Permutation testing: {current:,}/{total:,} ({progress_pct}%)\n\n"
                    f"Statistical validation is running. This may take 3-5 minutes. Wait for the Generate Report button to be enabled.."
                )
                
                # Use QMetaObject.invokeMethod for thread-safe GUI update
                QtCore.QMetaObject.invokeMethod(
                    self.results_text,
                    "setPlainText",
                    QtCore.Qt.ConnectionType.QueuedConnection,
                    QtCore.Q_ARG(str, progress_msg)
                )
            except Exception as e:
                print(f"[Permutation Progress] Error updating UI: {e}")
        
        # Register the callback with the feature engine
        engine.set_permutation_progress_callback(_permutation_progress)
        print(f">>> Permutation progress callback registered <<<")
        
        # Background worker thread
        def _worker():
            try:
                print(f"\n>>> [WORKER THREAD] CALLING analyze_all_tasks_data() <<<\n")
                
                # Run the analysis in background thread
                results = engine.analyze_all_tasks_data()
                
                print(f"\n>>> [WORKER THREAD] analyze_all_tasks_data() RETURNED <<<\n")
                print(f"Results type: {type(results)}")
                if isinstance(results, dict):
                    print(f"Results keys: {list(results.keys())}")
                    print(f"engine.multi_task_results is now: {hasattr(engine, 'multi_task_results')}")
                
                # Clear the permutation progress callback
                engine.clear_permutation_progress_callback()
                print(f">>> Permutation progress callback cleared <<<")
                
                # Mark analysis as complete
                self.analysis_running = False
                print(f">>> [WORKER THREAD] Set analysis_running = False <<<")
                
                # Stop progress timer from main thread
                print(f">>> [WORKER THREAD] Scheduling timer stop <<<")
                QTimer.singleShot(0, self.progress_timer.stop)
                
                # Emit signal for thread-safe GUI update
                print(f">>> [WORKER THREAD] Emitting analysis_complete_signal <<<")
                self.analysis_complete_signal.emit()
                print(f">>> [WORKER THREAD] Signal emitted <<<")
                
            except Exception as e:
                print(f"\n>>> [WORKER THREAD] EXCEPTION: {e} <<<\n")
                import traceback
                traceback.print_exc()
                
                # Clear the permutation progress callback on error
                try:
                    engine.clear_permutation_progress_callback()
                    print(f">>> Permutation progress callback cleared (after error) <<<")
                except:
                    pass
                
                # Mark analysis as complete (even on error)
                self.analysis_running = False
                
                # Stop progress timer from main thread
                QTimer.singleShot(0, self.progress_timer.stop)
                
                # Update GUI from main thread (thread-safe) using signal
                def _show_error():
                    self.results_text.setPlainText(f"Error during analysis:\n{str(e)}\n\nSee console for details.")
                    self.analyze_button.setEnabled(True)
                
                # Emit via main thread
                QtCore.QMetaObject.invokeMethod(
                    self,
                    "_show_error_callback",
                    QtCore.Qt.QueuedConnection,
                    QtCore.Q_ARG(str, str(e))
                )
        
        # Start background thread
        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()
        
        print(f"\n>>> [MAIN THREAD] Background analysis thread started <<<\n")
    
    @QtCore.Slot()
    def _update_progress_display(self):
        """Update progress display with animated dots (only when no permutation progress)"""
        if not self.analysis_running:
            return
        
        # Check if current text contains "Permutation testing" - if so, don't override it
        current_text = self.results_text.toPlainText()
        if "Permutation testing:" in current_text:
            # Permutation progress is being shown, don't override
            return
        
        self.progress_dots = (self.progress_dots + 1) % 4
        dots = "." * self.progress_dots
        spaces = " " * (3 - self.progress_dots)
        
        self.results_text.setPlainText(
            f"Analysis in progress{dots}{spaces}\n\n"
            f"⏳ Computing features and statistics...\n\n"
            f"Please wait, this may take 3-5 minutes. Wait for the Generate Report button to be enabled.."
        )
    
    @QtCore.Slot()
    def _display_results(self):
        """Display the analysis results from multi_task_results"""
        print(f"\n>>> [MAIN THREAD] _display_results() CALLED <<<\n")
        
        engine = self.workflow.main_window.feature_engine
        
        print(f"\n=== FINAL RESULTS CHECK ===")
        print(f"hasattr(engine, 'multi_task_results'): {hasattr(engine, 'multi_task_results')}")
        if hasattr(engine, 'multi_task_results'):
            print(f"engine.multi_task_results is None: {engine.multi_task_results is None}")
            if engine.multi_task_results:
                print(f"engine.multi_task_results.keys(): {list(engine.multi_task_results.keys())}")
                print(f"per_task keys: {list(engine.multi_task_results.get('per_task', {}).keys())}")
        print(f"==========================\n")
        
        if hasattr(engine, 'multi_task_results') and engine.multi_task_results:
            res = engine.multi_task_results
            
            results = "✅ ANALYSIS COMPLETE!\n"
            results += "=" * 60 + "\n\n"
            results += "=== MULTI-TASK ANALYSIS RESULTS ===\n\n"
            
            # Per-task results
            per_task = res.get('per_task', {})
            if per_task:
                results += "Per-Task Analysis:\n"
                results += "-" * 40 + "\n"
                for task_name, data in sorted(per_task.items()):
                    summary = data.get('summary', {}) or {}
                    fisher = summary.get('fisher', {})
                    sum_p = summary.get('sum_p', {})
                    feature_sel = summary.get('feature_selection', {}) or {}
                    
                    results += f"\n{task_name}:\n"
                    results += f"  Fisher KM p-value: {fisher.get('km_p', 'N/A')}\n"
                    results += f"  Fisher significant: {fisher.get('significant', False)}\n"
                    results += f"  SumP p-value: {sum_p.get('perm_p', 'N/A')}\n"
                    results += f"  SumP significant: {sum_p.get('significant', False)}\n"
                    results += f"  Significant features: {feature_sel.get('sig_feature_count', 0)}\n"
                results += "\n"
            
            # Combined analysis results
            combined = res.get('combined', {})
            combined_summary = combined.get('summary', {})
            if combined_summary:
                results += "All Tasks Combined:\n"
                results += "-" * 40 + "\n"
                fisher_c = combined_summary.get('fisher', {})
                sum_p_c = combined_summary.get('sum_p', {})
                results += f"  Fisher KM p-value: {fisher_c.get('km_p', 'N/A')}\n"
                results += f"  Fisher significant: {fisher_c.get('significant', False)}\n"
                results += f"  SumP p-value: {sum_p_c.get('perm_p', 'N/A')}\n"
                results += f"  SumP significant: {sum_p_c.get('significant', False)}\n"
                results += "\n"
            
            # Across-task significant features
            across = res.get('across_task', {})
            features = across.get('features', {})
            sig_features = [f for f, info in features.items() if info.get('omnibus_sig')]
            if sig_features:
                results += "Across-Task Significant Features:\n"
                results += "-" * 40 + "\n"
                for feat in sig_features:
                    results += f"  - {feat}\n"
            
            # Add completion message
            results += "\n" + "=" * 60 + "\n"
            results += "✅ Analysis complete! Click 'Generate Report' to save detailed results.\n"
            
            print(f">>> [MAIN THREAD] Setting results text (length: {len(results)} chars) <<<")
            self.results_text.setPlainText(results)
            print(f">>> [MAIN THREAD] Enabling report buttons and finish button <<<")
            self.report_button.setEnabled(True)
            self.seed_button.setEnabled(True)
            self.finish_button.setEnabled(True)  # Enable finish button after successful analysis
            print(f">>> [MAIN THREAD] Results displayed successfully <<<")
        else:
            print(f">>> [MAIN THREAD] No results found - showing error message <<<")
            self.results_text.setPlainText("❌ No analysis results found.\n\nPlease ensure tasks have been recorded and try analyzing again.")
            self.report_button.setEnabled(False)
            self.seed_button.setEnabled(False)
        
        print(f">>> [MAIN THREAD] Re-enabling analyze button <<<")
        self.analyze_button.setEnabled(True)
        print(f">>> [MAIN THREAD] _display_results() COMPLETE <<<\n")
    
    @QtCore.Slot(str)
    def _show_error_callback(self, error_msg):
        """Show error message in UI (called from main thread)"""
        print(f">>> [MAIN THREAD] _show_error_callback() CALLED <<<")
        self.results_text.setPlainText(f"Error during analysis:\n{error_msg}\n\nSee console for details.")
        self.analyze_button.setEnabled(True)
    
    def generate_report(self):
        """Generate REAL full report - delegates to Enhanced GUI which opens save dialog"""
        # Check if analysis was done first
        engine = self.workflow.main_window.feature_engine
        if not hasattr(engine, 'multi_task_results') or not engine.multi_task_results:
            QMessageBox.warning(
                self,
                "Analysis Required",
                "No analysis results available.\n\nPlease run 'Analyze All Tasks' first."
            )
            return
        
        try:
            # Generate report text for seeding
            from io import StringIO
            import sys
            
            # Capture report output
            old_stdout = sys.stdout
            sys.stdout = report_buffer = StringIO()
            
            try:
                # Generate the report text using the feature engine
                report_lines = []
                report_lines.append("=" * 80)
                report_lines.append("MULTI-TASK EEG ANALYSIS REPORT")
                report_lines.append("=" * 80)
                report_lines.append("")
                
                # Add results from multi_task_results
                for task_name, results in engine.multi_task_results.items():
                    report_lines.append(f"\n{'='*60}")
                    report_lines.append(f"Task: {task_name}")
                    report_lines.append(f"{'='*60}")
                    
                    if isinstance(results, dict):
                        for key, value in results.items():
                            report_lines.append(f"{key}: {value}")
                    else:
                        report_lines.append(str(results))
                
                self.generated_report_text = "\n".join(report_lines)
                
            finally:
                sys.stdout = old_stdout
            
            # Call REAL report generation from main window (opens save dialog)
            self.workflow.main_window.generate_report_all_tasks()
            
            # Enable seed button now that report is generated
            self.seed_button.setEnabled(True)
            
            # The method itself shows success/error messages via log_message
        except Exception as e:
            QMessageBox.warning(
                self,
                "Report Error",
                f"Error generating report:\n{str(e)}"
            )
    
    def seed_report(self):
        """Seed the generated report to the database via API"""
        if not self.generated_report_text:
            QMessageBox.warning(
                self,
                "No Report",
                "Please generate a report first before seeding."
            )
            return
        
        # Create confirmation dialog with email input
        dialog = QDialog(self)
        dialog.setWindowTitle("Seed Report to Database")
        dialog.setModal(True)
        dialog.setMinimumWidth(450)
        
        # Set window icon
        set_window_icon(dialog)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(18)
        
        # Title
        title = QLabel("Confirm Report Seeding")
        title.setObjectName("DialogTitle")
        
        # Info text
        info = QLabel("Enter the email address for which this EEG report should be seeded in the database:")
        info.setWordWrap(True)
        info.setStyleSheet("font-size: 13px; color: #475569; margin-bottom: 8px;")
        
        # Email input
        email_label = QLabel("Email Address:")
        email_label.setStyleSheet("font-size: 13px; font-weight: 600; color: #1f2937;")
        
        email_input = QLineEdit()
        email_input.setPlaceholderText("user@example.com")
        email_input.setClearButtonEnabled(True)
        
        # Get saved username as default
        settings = QSettings("MindLink", "FeatureAnalyzer")
        saved_email = settings.value("username", "")
        email_input.setText(saved_email)
        
        # Button layout
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        
        cancel_btn = QPushButton("Cancel")
        cancel_btn.setStyleSheet("""
            QPushButton {
                background-color: #e2e8f0;
                color: #475569;
                padding: 8px 18px;
            }
            QPushButton:hover {
                background-color: #cbd5e1;
            }
        """)
        cancel_btn.clicked.connect(dialog.reject)
        
        confirm_btn = QPushButton("Confirm & Seed")
        confirm_btn.setStyleSheet("padding: 8px 18px;")
        confirm_btn.clicked.connect(dialog.accept)
        
        button_layout.addWidget(cancel_btn)
        button_layout.addWidget(confirm_btn)
        
        # Assembly
        layout.addWidget(title)
        layout.addWidget(info)
        layout.addWidget(email_label)
        layout.addWidget(email_input)
        layout.addLayout(button_layout)
        
        dialog.setLayout(layout)
        apply_modern_dialog_theme(dialog)
        
        # Show dialog
        if dialog.exec() == QDialog.Accepted:
            email = email_input.text().strip()
            
            if not email:
                QMessageBox.warning(self, "Invalid Email", "Please enter a valid email address.")
                return
            
            # Send report to API
            self._send_report_to_api(email)
    
    def _send_report_to_api(self, email):
        """Send the report to the seeding API endpoint"""
        import requests
        import uuid
        import base64
        from datetime import datetime
        
        # Get JWT token
        jwt_token = BL.JWT_TOKEN
        if not jwt_token:
            QMessageBox.warning(
                self,
                "Authentication Required",
                "No authentication token found. Please log in first."
            )
            return
        
        # Determine API endpoint
        api_base = BL.BACKEND_URL.replace("/brainlink_data", "")
        seed_url = f"{api_base}/eeg-reports/seed"
        
        # Prepare payload with base64 encoded report
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        # Encode the report text to base64
        report_bytes = self.generated_report_text.encode('utf-8')
        report_base64 = base64.b64encode(report_bytes).decode('utf-8')
        
        payload = {
            "email": email,
            "report_text": report_base64,
            "session_id": session_id,
            "generation_meta": {
                "generated_at": datetime.now().isoformat(),
                "analyzer_version": "1.0",
                "workflow": "sequential_integrated"
            }
        }
        
        # Show progress
        progress = QMessageBox(self)
        progress.setWindowTitle("Seeding Report")
        progress.setText("Sending report to database...")
        progress.setStandardButtons(QMessageBox.NoButton)
        progress.setModal(True)
        progress.show()
        QtWidgets.QApplication.processEvents()
        
        try:
            headers = {
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json"
            }
            
            response = requests.post(seed_url, json=payload, headers=headers, timeout=30)
            
            progress.close()
            
            if response.status_code == 200 or response.status_code == 201:
                result = response.json()
                
                # Create a success dialog with enhanced styling
                success_dialog = QMessageBox(self)
                success_dialog.setWindowTitle("✓ Report Seeded Successfully")
                success_dialog.setIcon(QMessageBox.Information)
                
                success_message = (
                    "🎉 Your EEG report has been successfully sent to the Mindspeller database!\n\n"
                    "Report Details:\n"
                    f"• User ID: {result.get('user_id', 'N/A')}\n"
                    f"• Session ID: {result.get('session_id', 'N/A')}\n"
                    f"• Report ID: {result.get('report_id', 'N/A')}\n\n"
                    "✓ Your neuroprofiling report is now available in your Mindspeller account.\n"
                    "✓ You can access it immediately at mindspeller.com\n"
                    "✓ You can safely close this application now.\n\n"
                    "Thank you for using MindLink Analyzer!"
                )
                
                success_dialog.setText(success_message)
                success_dialog.setStandardButtons(QMessageBox.Ok)
                
                # Style the dialog
                success_dialog.setStyleSheet("""
                    QMessageBox {
                        background-color: #f0fdf4;
                    }
                    QLabel {
                        color: #166534;
                        font-size: 13px;
                    }
                    QPushButton {
                        background-color: #10b981;
                        color: white;
                        padding: 8px 24px;
                        border-radius: 6px;
                        font-weight: 600;
                    }
                    QPushButton:hover {
                        background-color: #059669;
                    }
                """)
                
                success_dialog.exec()
                
                # Show a toast notification as well
                try:
                    self.workflow.main_window.log_message(
                        f"✓ Report seeded successfully! User ID: {result.get('user_id')}, "
                        f"Session ID: {result.get('session_id')}, Report ID: {result.get('report_id')}"
                    )
                except:
                    pass
                
            else:
                error_msg = response.json().get('error', 'Unknown error') if response.content else 'Unknown error'
                QMessageBox.warning(
                    self,
                    "Seeding Failed",
                    f"Failed to seed report.\n\n"
                    f"Status: {response.status_code}\n"
                    f"Error: {error_msg}"
                )
                
        except requests.exceptions.RequestException as e:
            progress.close()
            QMessageBox.critical(
                self,
                "Network Error",
                f"Failed to connect to API:\n{str(e)}"
            )
        except Exception as e:
            progress.close()
            QMessageBox.critical(
                self,
                "Error",
                f"Unexpected error while seeding report:\n{str(e)}"
            )
    
    def on_back(self):
        """Navigate back"""
        if self.status_bar:
            self.status_bar.cleanup()
        self._programmatic_close = True
        self.close()
        QTimer.singleShot(100, lambda: self.workflow.go_back())
    
    def on_finish(self):
        """Complete the workflow"""
        # Ask if user wants to exit or restart
        reply = QMessageBox.question(
            self,
            'Workflow Complete',
            'Analysis complete!\n\nWould you like to:\n• Yes: Exit application\n• No: Return to task selection',
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if self.status_bar:
            self.status_bar.cleanup()
        self._programmatic_close = True
        self.close()
        
        if reply == QMessageBox.Yes:
            # Close the application
            QTimer.singleShot(100, lambda: self.workflow.main_window.close())
        else:
            # Return to task selection
            QTimer.singleShot(100, lambda: self.workflow.go_to_step(WorkflowStep.TASK_SELECTION))


# ============================================================================
# MAIN WINDOW (Enhanced GUI with Sequential Workflow)
# ============================================================================

class SequentialBrainLinkAnalyzerWindow(EnhancedBrainLinkAnalyzerWindow):
    """Enhanced GUI with sequential workflow overlay"""
    
    def __init__(self, user_os, config: Optional[EnhancedAnalyzerConfig] = None):
        # Initialize the REAL Enhanced GUI
        super().__init__(user_os, config=config)
        
        # Ensure protocol groups use the correct Lifestyle tasks (now implemented)
        self._protocol_groups = {
            'Personal Pathway': ['emotion_face', 'diverse_thinking'],
            'Connection': ['reappraisal', 'curiosity'],
            'Lifestyle': ['order_surprise', 'num_form'],
        }
        
        # Hide the main window initially (workflow is popup-driven)
        self.hide()
        
        # Initialize workflow manager
        self.workflow = WorkflowManager(self)
        
        # Start the workflow
        QTimer.singleShot(100, self.start_workflow)
    
    def start_workflow(self):
        """Begin the sequential workflow"""
        self.workflow.go_to_step(WorkflowStep.OS_SELECTION)
    
    def closeEvent(self, event):
        """Handle window close with confirmation"""
        # Ask for confirmation before closing
        reply = QMessageBox.question(
            self,
            'Confirm Exit',
            'Are you sure you want to exit MindLink Analyzer?\n\nAll unsaved data will be lost.',
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            # Close any open workflow dialogs (force close without recursion)
            if self.workflow.current_dialog:
                try:
                    # Disconnect the closeEvent to prevent recursion
                    self.workflow.current_dialog.closeEvent = lambda e: e.accept()
                    self.workflow.current_dialog.close()
                except Exception:
                    pass
            
            # Clean up serial connection properly
            try:
                BL.stop_thread_flag = True
                if hasattr(self, 'serial_obj') and self.serial_obj and hasattr(self.serial_obj, 'is_open') and self.serial_obj.is_open:
                    self.serial_obj.close()
                if hasattr(self, 'brainlink_thread') and self.brainlink_thread and self.brainlink_thread.is_alive():
                    self.brainlink_thread.join(timeout=2)
            except Exception:
                pass
            
            # Clean up any timers
            try:
                if hasattr(self, '_calibration_timer'):
                    self._calibration_timer.stop()
            except Exception:
                pass
            
            # Accept the close event
            event.accept()
            
            # Force quit the application since we disabled automatic quit on last window close
            QTimer.singleShot(100, lambda: QtWidgets.QApplication.quit())
        else:
            # Ignore the close event
            event.ignore()


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import sys
    
    app = QtWidgets.QApplication(sys.argv)
    app.setStyle('Fusion')
    
    # Prevent app from quitting when last visible window closes
    # This is critical for the sequential workflow where the main window is hidden
    app.setQuitOnLastWindowClosed(False)
    
    # Start with OS selection workflow
    window = SequentialBrainLinkAnalyzerWindow("Windows")
    
    sys.exit(app.exec())
