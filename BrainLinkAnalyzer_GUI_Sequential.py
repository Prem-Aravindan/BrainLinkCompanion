#!/usr/bin/env python3
"""
Sequential Workflow Enhanced MindLink Feature Analysis GUI

This version implements a guided step-by-step journey through the entire analysis pipeline:
1. OS Selection → 2. Environment Selection → 3. Login → 4. Live EEG Signal → 
5. Calibration → 6. Task Selection → 7. Task Execution → 8. Multi-Task Analysis

Each step is a focused popup dialog with Forward/Back navigation.
"""

import os
import sys
import platform
from typing import Optional, Dict, Any, Callable
from dataclasses import dataclass

# Set Qt environment before imports
os.environ.setdefault('PYQTGRAPH_QT_LIB', 'PySide6')

# Fix Qt plugin path for PySide6
try:
    import PySide6
    pyside_dir = os.path.dirname(PySide6.__file__)
    plugins_dir = os.path.join(pyside_dir, 'plugins', 'platforms')
    if os.path.isdir(plugins_dir):
        os.environ['QT_QPA_PLATFORM_PLUGIN_PATH'] = plugins_dir
except Exception:
    pass

# Import Qt components
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QDialog, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QTextEdit, QComboBox, QRadioButton, QLineEdit,
    QFrame, QFormLayout, QDialogButtonBox, QMessageBox
)
from PySide6.QtCore import Qt, QTimer, QSettings, Signal
from PySide6.QtGui import QIcon, QFont

# Import pyqtgraph for EEG plotting
import pyqtgraph as pg
import numpy as np

# Configure pyqtgraph
pg.setConfigOption('useOpenGL', False)
pg.setConfigOption('antialias', True)
pg.setConfigOption('background', 'k')
pg.setConfigOption('foreground', 'w')

# Modern dialog stylesheet
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


# Simple config dataclass
@dataclass
class EnhancedAnalyzerConfig:
    """Configuration for the analyzer"""
    alpha: float = 0.05
    n_perm: int = 1000
    block_seconds: float = 8.0


# Available tasks (simplified)
AVAILABLE_TASKS = {
    'mental_math': {
        'name': 'Mental Math',
        'description': 'Perform mental arithmetic calculations',
        'duration': 60,
        'instructions': 'Count backwards from 1000 by 7s: 1000, 993, 986, 979...'
    },
    'attention_focus': {
        'name': 'Focused Attention',
        'description': 'Focus intensely on breathing',
        'duration': 60,
        'instructions': 'Focus all attention on your breathing. Count breaths 1–10 and repeat.'
    },
    'working_memory': {
        'name': 'Working Memory',
        'description': 'Remember and manipulate sequences',
        'duration': 60,
        'instructions': 'Remember this sequence: 3-8-2-9-5-1. Now add 2 to each number mentally.'
    },
    'visual_imagery': {
        'name': 'Visual Imagery',
        'description': 'Visualize a familiar place in detail',
        'duration': 60,
        'instructions': 'Close your eyes and visualize walking through your home in detail.'
    },
}


# ============================================================================
# WORKFLOW STATE MANAGER
# ============================================================================

class WorkflowStep:
    """Enumeration of workflow steps"""
    OS_SELECTION = 0
    ENVIRONMENT_SELECTION = 1
    LOGIN = 2
    LIVE_EEG = 3
    CALIBRATION = 4
    TASK_SELECTION = 5
    TASK_EXECUTION = 6
    MULTI_TASK_ANALYSIS = 7


class WorkflowManager:
    """Manages the sequential workflow state and navigation"""
    
    def __init__(self, parent_window):
        self.parent_window = parent_window
        self.current_step = WorkflowStep.OS_SELECTION
        self.step_history = []  # Track navigation for back button
        
        # Shared state across steps
        self.state = {
            'selected_os': None,
            'environment': None,
            'backend_url': None,
            'login_url': None,
            'username': None,
            'password': None,
            'token': None,
            'serial_port': None,
            'connected': False,
            'calibration_done': False,
            'completed_tasks': [],
            'task_results': {},
        }
        
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
        elif step == WorkflowStep.LIVE_EEG:
            self._show_live_eeg()
        elif step == WorkflowStep.CALIBRATION:
            self._show_calibration()
        elif step == WorkflowStep.TASK_SELECTION:
            self._show_task_selection()
        elif step == WorkflowStep.TASK_EXECUTION:
            self._show_task_execution()
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
    
    # Step-specific dialog launchers (to be implemented)
    def _show_os_selection(self):
        dialog = OSSelectionDialog(self)
        self.current_dialog = dialog
        dialog.exec()
    
    def _show_environment_selection(self):
        dialog = EnvironmentSelectionDialog(self)
        self.current_dialog = dialog
        dialog.exec()
    
    def _show_login(self):
        dialog = LoginDialog(self)
        self.current_dialog = dialog
        dialog.exec()
    
    def _show_live_eeg(self):
        dialog = LiveEEGDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Non-modal for live updates
    
    def _show_calibration(self):
        dialog = CalibrationDialog(self)
        self.current_dialog = dialog
        dialog.show()  # Non-modal for progress updates
    
    def _show_task_selection(self):
        dialog = TaskSelectionDialog(self)
        self.current_dialog = dialog
        dialog.exec()
    
    def _show_task_execution(self):
        # Task execution handled by existing task interface
        # After task completion, return to task selection
        self.go_to_step(WorkflowStep.TASK_SELECTION)
    
    def _show_multi_task_analysis(self):
        dialog = MultiTaskAnalysisDialog(self)
        self.current_dialog = dialog
        dialog.exec()


# ============================================================================
# STEP 1: OS SELECTION DIALOG
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
    
    def on_next(self):
        """Save OS selection and proceed to environment selection"""
        selected_os = "Windows" if self.radio_windows.isChecked() else "macOS"
        self.workflow.state['selected_os'] = selected_os
        self.accept()
        self.workflow.go_to_step(WorkflowStep.ENVIRONMENT_SELECTION)


# ============================================================================
# STEP 2: ENVIRONMENT SELECTION DIALOG
# ============================================================================

class EnvironmentSelectionDialog(QDialog):
    """Step 2: Select backend environment and connect"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Environment Selection")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(450)
        
        # Backend URLs
        self.backend_urls = {
            "English (en)": "https://stg-en.mindspell.be/api/cas/brainlink_data",
            "Dutch (nl)": "https://stg-nl.mindspell.be/api/cas/brainlink_data",
            "Local": "http://127.0.0.1:5000/api/cas/brainlink_data"
        }
        
        self.login_urls = {
            "English (en)": "https://en.mindspeller.com/api/cas/token/login",
            "Dutch (nl)": "https://nl.mindspeller.com/api/cas/token/login",
            "Local": "http://127.0.0.1:5000/api/cas/token/login"
        }
        
        # UI Elements
        title_label = QLabel("Select Environment")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 2 of 8: Choose your backend environment and connect to the device")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # Environment selection card
        env_card = QFrame()
        env_card.setObjectName("DialogCard")
        env_layout = QVBoxLayout(env_card)
        env_layout.setContentsMargins(16, 16, 16, 16)
        env_layout.setSpacing(10)
        
        env_label = QLabel("Backend Environment:")
        env_label.setObjectName("DialogSectionTitle")
        
        self.env_combo = QComboBox()
        self.env_combo.addItems(list(self.backend_urls.keys()))
        self.env_combo.currentTextChanged.connect(self.on_env_changed)
        
        env_layout.addWidget(env_label)
        env_layout.addWidget(self.env_combo)
        
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
        self.connect_button.setEnabled(True)
        
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
        self.next_button.setEnabled(False)  # Disabled until connected
        
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
    
    def on_env_changed(self, env_name: str):
        """Update backend URLs when environment changes"""
        self.workflow.state['environment'] = env_name
        self.workflow.state['backend_url'] = self.backend_urls[env_name]
        self.workflow.state['login_url'] = self.login_urls[env_name]
    
    def on_connect(self):
        """Attempt to connect to MindLink device"""
        # Here we'd call the actual device detection logic
        # For now, we'll simulate connection
        self.status_label.setText("Searching for device...")
        self.connect_button.setEnabled(False)
        
        QTimer.singleShot(1000, self._complete_connection)
    
    def _complete_connection(self):
        """Complete the connection process"""
        # In real implementation, call detect_brainlink() and setup serial
        self.workflow.state['connected'] = True
        self.status_label.setText("✓ Connected successfully")
        self.status_label.setStyleSheet("color: #10b981; font-size: 13px; font-weight: 600;")
        self.next_button.setEnabled(True)
    
    def on_back(self):
        """Navigate back to OS selection"""
        self.reject()
        self.workflow.go_back()
    
    def on_next(self):
        """Proceed to login"""
        self.accept()
        self.workflow.go_to_step(WorkflowStep.LOGIN)


# ============================================================================
# STEP 3: LOGIN DIALOG
# ============================================================================

class LoginDialog(QDialog):
    """Step 3: User authentication"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Sign In")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(400)
        
        self.settings = QSettings("MindLink", "FeatureAnalyzer")
        
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
        
        cred_layout.addRow("Email:", self.username_edit)
        cred_layout.addRow("Password:", self.password_edit)
        
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
    
    def on_login(self):
        """Attempt authentication"""
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
        
        self.workflow.state['username'] = username
        self.workflow.state['password'] = password
        
        # Simulate authentication (in real implementation, call API)
        QTimer.singleShot(1000, self._complete_login)
    
    def _complete_login(self):
        """Complete the login process"""
        # In real implementation, verify credentials with backend
        self.workflow.state['token'] = "dummy_token_12345"
        self.status_label.setText("✓ Login successful")
        self.status_label.setStyleSheet("color: #10b981; font-size: 12px; font-weight: 600;")
        
        QTimer.singleShot(500, self._proceed_to_eeg)
    
    def _proceed_to_eeg(self):
        """Proceed to live EEG viewer"""
        self.accept()
        self.workflow.go_to_step(WorkflowStep.LIVE_EEG)
    
    def on_back(self):
        """Navigate back to environment selection"""
        self.reject()
        self.workflow.go_back()


# ============================================================================
# STEP 4: LIVE EEG SIGNAL DIALOG
# ============================================================================

class LiveEEGDialog(QDialog):
    """Step 4: Real-time EEG signal visualization"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Live EEG Signal")
        self.setModal(False)  # Non-modal for live updates
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumSize(600, 450)
        
        # UI Elements
        title_label = QLabel("Live EEG Signal")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 4 of 8: Monitoring brain activity in real-time")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # EEG Plot card
        plot_card = QFrame()
        plot_card.setObjectName("DialogCard")
        plot_layout = QVBoxLayout(plot_card)
        plot_layout.setContentsMargins(8, 8, 8, 8)
        
        # Create pyqtgraph plot
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground('k')
        self.plot_widget.setLabel('left', 'Amplitude (µV)')
        self.plot_widget.setLabel('bottom', 'Time (samples)')
        self.plot_widget.setTitle('Raw EEG Signal (upto 10s visual delay)', color='w', size='12pt')
        self.plot_widget.showGrid(x=True, y=True, alpha=0.3)
        
        self.curve = self.plot_widget.plot(pen=pg.mkPen(color='#3b82f6', width=2))
        self.data_buffer = np.zeros(500)
        
        plot_layout.addWidget(self.plot_widget)
        
        # Status info
        info_label = QLabel("Signal quality: Good | Ensure proper electrode contact")
        info_label.setStyleSheet("color: #10b981; font-size: 13px; padding: 8px;")
        info_label.setAlignment(Qt.AlignCenter)
        
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
        layout.addWidget(plot_card)
        layout.addWidget(info_label)
        layout.addLayout(nav_layout)
        
        self.setLayout(layout)
        apply_modern_dialog_theme(self)
        
        # Start live update timer
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_plot)
        self.update_timer.start(50)  # 20 Hz update rate
    
    def update_plot(self):
        """Update EEG plot with simulated or real data"""
        # Simulate data (in real implementation, get from live_data_buffer)
        new_sample = np.random.randn() * 50
        self.data_buffer = np.roll(self.data_buffer, -1)
        self.data_buffer[-1] = new_sample
        self.curve.setData(self.data_buffer)
    
    def on_back(self):
        """Navigate back to login"""
        self.update_timer.stop()
        self.close()
        self.workflow.go_back()
    
    def on_next(self):
        """Proceed to calibration"""
        self.update_timer.stop()
        self.close()
        self.workflow.go_to_step(WorkflowStep.CALIBRATION)
    
    def closeEvent(self, event):
        """Cleanup when dialog closes"""
        self.update_timer.stop()
        super().closeEvent(event)


# ============================================================================
# STEP 5: CALIBRATION DIALOG
# ============================================================================

class CalibrationDialog(QDialog):
    """Step 5: Eyes-closed and eyes-open calibration"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Calibration")
        self.setModal(False)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumWidth(500)
        
        self.calibration_engine = self.workflow.parent_window.feature_engine if hasattr(self.workflow.parent_window, 'feature_engine') else None
        self.current_phase = None
        
        # UI Elements
        title_label = QLabel("Baseline Calibration")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 5 of 8: Establish your baseline brain activity")
        subtitle_label.setObjectName("DialogSubtitle")
        
        # Instructions card
        instr_card = QFrame()
        instr_card.setObjectName("DialogCard")
        instr_layout = QVBoxLayout(instr_card)
        instr_layout.setContentsMargins(16, 16, 16, 16)
        instr_layout.setSpacing(12)
        
        instr_text = QLabel(
            "We will record your baseline brain activity in two phases:\n\n"
            "1. Eyes Closed (60s): Close your eyes and relax\n"
            "2. Eyes Open (60s): Keep eyes open, stay relaxed\n\n"
            "Click 'Start Eyes Closed' to begin."
        )
        instr_text.setWordWrap(True)
        instr_text.setStyleSheet("font-size: 13px; color: #475569; line-height: 1.6;")
        
        instr_layout.addWidget(instr_text)
        
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
        
        self.ec_button = QPushButton("Start Eyes Closed (60s)")
        self.ec_button.clicked.connect(self.start_eyes_closed)
        self.ec_button.setStyleSheet("padding: 10px;")
        
        self.eo_button = QPushButton("Start Eyes Open (60s)")
        self.eo_button.clicked.connect(self.start_eyes_open)
        self.eo_button.setEnabled(False)
        self.eo_button.setStyleSheet("padding: 10px;")
        
        progress_layout.addWidget(self.status_label)
        progress_layout.addWidget(self.phase_label)
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
        
        # Auto-stop timer
        self.auto_stop_timer = QTimer()
        self.auto_stop_timer.setSingleShot(True)
        self.auto_stop_timer.timeout.connect(self.auto_stop_phase)
    
    def start_eyes_closed(self):
        """Start eyes-closed calibration"""
        self.current_phase = 'eyes_closed'
        self.status_label.setText("Recording: Eyes Closed")
        self.phase_label.setText("Close your eyes and relax... (60 seconds)")
        self.ec_button.setEnabled(False)
        
        # Start calibration
        if self.calibration_engine:
            self.calibration_engine.start_calibration_phase('eyes_closed')
        
        # Auto-stop after 60 seconds
        self.auto_stop_timer.start(60000)
    
    def start_eyes_open(self):
        """Start eyes-open calibration"""
        self.current_phase = 'eyes_open'
        self.status_label.setText("Recording: Eyes Open")
        self.phase_label.setText("Keep your eyes open and stay relaxed... (60 seconds)")
        self.eo_button.setEnabled(False)
        
        # Start calibration
        if self.calibration_engine:
            self.calibration_engine.start_calibration_phase('eyes_open')
        
        # Auto-stop after 60 seconds
        self.auto_stop_timer.start(60000)
    
    def auto_stop_phase(self):
        """Auto-stop current calibration phase"""
        if self.calibration_engine:
            self.calibration_engine.stop_calibration_phase()
        
        if self.current_phase == 'eyes_closed':
            self.status_label.setText("✓ Eyes Closed Complete")
            self.phase_label.setText("Phase 1 complete. Ready for phase 2.")
            self.eo_button.setEnabled(True)
        elif self.current_phase == 'eyes_open':
            self.status_label.setText("✓ Calibration Complete")
            self.phase_label.setText("Both phases complete. Computing baseline statistics...")
            
            # Compute baseline
            if self.calibration_engine:
                self.calibration_engine.compute_baseline_statistics()
            
            self.workflow.state['calibration_done'] = True
            self.next_button.setEnabled(True)
    
    def on_back(self):
        """Navigate back to live EEG"""
        if self.auto_stop_timer.isActive():
            self.auto_stop_timer.stop()
        if self.calibration_engine and self.current_phase:
            self.calibration_engine.stop_calibration_phase()
        
        self.close()
        self.workflow.go_back()
    
    def on_next(self):
        """Proceed to task selection"""
        self.close()
        self.workflow.go_to_step(WorkflowStep.TASK_SELECTION)


# ============================================================================
# STEP 6: TASK SELECTION DIALOG
# ============================================================================

class TaskSelectionDialog(QDialog):
    """Step 6: Select and launch cognitive tasks"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Task Selection")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumSize(550, 500)
        
        # Use global AVAILABLE_TASKS
        self.available_tasks = AVAILABLE_TASKS
        
        # UI Elements
        title_label = QLabel("Cognitive Tasks")
        title_label.setObjectName("DialogTitle")
        
        subtitle_label = QLabel("Step 6 of 8: Select tasks to perform")
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
        task_names = [info['name'] for info in self.available_tasks.values()]
        self.task_combo.addItems(task_names)
        self.task_combo.currentTextChanged.connect(self.update_task_preview)
        
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
        self.next_button.setEnabled(len(self.workflow.state['completed_tasks']) > 0)
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
        
        # Initialize preview
        self.update_task_preview()
    
    def update_task_preview(self):
        """Update task description preview"""
        task_name = self.task_combo.currentText()
        for task_id, task_info in self.available_tasks.items():
            if task_info['name'] == task_name:
                desc = task_info.get('description', '')
                duration = task_info.get('duration', 60)
                instructions = task_info.get('instructions', '')
                
                preview_text = f"<b>{task_name}</b><br><br>"
                preview_text += f"Description: {desc}<br>"
                preview_text += f"Duration: {duration} seconds<br><br>"
                if instructions:
                    preview_text += f"Instructions: {instructions}"
                
                self.task_description.setText(preview_text)
                break
    
    def start_selected_task(self):
        """Launch the selected task"""
        task_name = self.task_combo.currentText()
        
        # Find task ID
        task_id = None
        for tid, tinfo in self.available_tasks.items():
            if tinfo['name'] == task_name:
                task_id = tid
                break
        
        if not task_id:
            return
        
        # Launch task using parent window's method
        # (This would integrate with existing task interface)
        QMessageBox.information(
            self,
            "Task Started",
            f"Task '{task_name}' would start now.\n\n"
            "In the full implementation, this would launch the task interface dialog.\n"
            "After completion, you would return here."
        )
        
        # Simulate task completion
        self.workflow.state['completed_tasks'].append(task_id)
        self.workflow.state['task_results'][task_id] = {'status': 'completed'}
        
        self.update_completed_tasks_display()
        self.next_button.setEnabled(True)
    
    def update_completed_tasks_display(self):
        """Update the completed tasks counter"""
        count = len(self.workflow.state['completed_tasks'])
        if count == 0:
            self.completed_label.setText("No tasks completed yet. Complete at least one task to proceed.")
        elif count == 1:
            self.completed_label.setText(f"✓ {count} task completed")
        else:
            self.completed_label.setText(f"✓ {count} tasks completed")
    
    def on_back(self):
        """Navigate back to calibration"""
        self.reject()
        self.workflow.go_back()
    
    def on_next(self):
        """Proceed to multi-task analysis"""
        self.accept()
        self.workflow.go_to_step(WorkflowStep.MULTI_TASK_ANALYSIS)


# ============================================================================
# STEP 8: MULTI-TASK ANALYSIS DIALOG
# ============================================================================

class MultiTaskAnalysisDialog(QDialog):
    """Step 8: Analyze all tasks and generate report"""
    
    def __init__(self, workflow: WorkflowManager, parent=None):
        super().__init__(parent)
        self.workflow = workflow
        self.setWindowTitle("MindLink - Multi-Task Analysis")
        self.setModal(True)
        self.setWindowFlag(Qt.WindowContextHelpButtonHint, False)
        self.setMinimumSize(700, 600)
        
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
        
        button_layout.addWidget(self.analyze_button)
        button_layout.addWidget(self.report_button)
        
        actions_layout.addWidget(actions_label)
        actions_layout.addLayout(button_layout)
        
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
        self.results_text.setMinimumHeight(300)
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
    
    def analyze_all_tasks(self):
        """Run multi-task analysis"""
        self.results_text.setPlainText("Analyzing all tasks...\n\nThis may take a moment.")
        self.analyze_button.setEnabled(False)
        
        # In real implementation, call the analysis engine
        QTimer.singleShot(2000, self._complete_analysis)
    
    def _complete_analysis(self):
        """Complete the analysis"""
        completed_tasks = self.workflow.state['completed_tasks']
        
        results = "=== MULTI-TASK ANALYSIS RESULTS ===\n\n"
        results += f"Tasks analyzed: {len(completed_tasks)}\n\n"
        
        for task_id in completed_tasks:
            results += f"Task: {task_id}\n"
            results += "  Status: Completed\n"
            results += "  Significance: p < 0.05\n"
            results += "  Effect size: d = 0.8\n\n"
        
        results += "\n=== SUMMARY ===\n"
        results += "Overall significance: p < 0.001\n"
        results += "Composite score: 42.5\n"
        
        self.results_text.setPlainText(results)
        self.report_button.setEnabled(True)
        self.analyze_button.setEnabled(True)
    
    def generate_report(self):
        """Generate and display full report"""
        # In real implementation, call the report generator
        QMessageBox.information(
            self,
            "Report Generated",
            "Full analysis report has been generated.\n\n"
            "In the full implementation, this would create a detailed text report."
        )
    
    def on_back(self):
        """Navigate back to task selection"""
        self.reject()
        self.workflow.go_back()
    
    def on_finish(self):
        """Complete the workflow"""
        self.accept()
        # Could return to task selection or exit application


# ============================================================================
# MAIN WINDOW (Hidden container for workflow)
# ============================================================================

class SequentialBrainLinkAnalyzerWindow(QMainWindow):
    """Main window that manages the sequential workflow"""
    
    def __init__(self, user_os, config: Optional[EnhancedAnalyzerConfig] = None):
        super().__init__()
        self.user_os = user_os
        self.config = config or EnhancedAnalyzerConfig()
        
        # Feature engine placeholder (would be initialized in full implementation)
        self.feature_engine = None
        
        # Hide the main window (workflow is popup-driven)
        self.setWindowTitle("MindLink Analyzer")
        self.setMinimumSize(400, 300)
        
        # Create a minimal central widget
        central = QWidget()
        layout = QVBoxLayout(central)
        
        label = QLabel("MindLink Analyzer\n\nWorkflow in progress...")
        label.setAlignment(Qt.AlignCenter)
        label.setStyleSheet("font-size: 16px; color: #64748b;")
        
        layout.addWidget(label)
        self.setCentralWidget(central)
        
        # Initialize workflow manager
        self.workflow = WorkflowManager(self)
        
        # Start the workflow
        QTimer.singleShot(100, self.start_workflow)
    
    def start_workflow(self):
        """Begin the sequential workflow"""
        self.hide()  # Hide main window
        self.workflow.go_to_step(WorkflowStep.OS_SELECTION)


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    import sys
    
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    # Start with a default OS (could be auto-detected)
    window = SequentialBrainLinkAnalyzerWindow("Windows")
    
    sys.exit(app.exec())
