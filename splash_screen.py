"""
Custom splash screen with progress bar for MindLink Analyzer
"""
from PySide6 import QtWidgets, QtCore, QtGui
import sys

class SplashScreen(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(QtCore.Qt.WindowType.FramelessWindowHint | QtCore.Qt.WindowType.WindowStaysOnTopHint)
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # Set size
        self.setFixedSize(600, 400)
        
        # Center on screen
        screen = QtWidgets.QApplication.primaryScreen().geometry()
        self.move((screen.width() - self.width()) // 2, (screen.height() - self.height()) // 2)
        
        # Main layout
        layout = QtWidgets.QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.setLayout(layout)
        
        # Container with background
        container = QtWidgets.QWidget()
        container.setStyleSheet("background-color: #1e293b; border-radius: 10px;")
        container_layout = QtWidgets.QVBoxLayout(container)
        container_layout.setContentsMargins(40, 40, 40, 40)
        container_layout.setSpacing(20)
        
        # Logo (favicon)
        logo_label = QtWidgets.QLabel()
        try:
            pixmap = QtGui.QPixmap("assets/favicon.ico")
            if not pixmap.isNull():
                pixmap = pixmap.scaled(80, 80, QtCore.Qt.AspectRatioMode.KeepAspectRatio, 
                                      QtCore.Qt.TransformationMode.SmoothTransformation)
                logo_label.setPixmap(pixmap)
        except:
            pass
        logo_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        container_layout.addWidget(logo_label)
        
        # Title
        title_label = QtWidgets.QLabel("MindLink")
        title_label.setStyleSheet("color: #60a5fa; font-size: 48px; font-weight: bold;")
        title_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        container_layout.addWidget(title_label)
        
        subtitle_label = QtWidgets.QLabel("Analyzer")
        subtitle_label.setStyleSheet("color: #60a5fa; font-size: 48px; font-weight: bold;")
        subtitle_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        container_layout.addWidget(subtitle_label)
        
        container_layout.addSpacing(20)
        
        # Status label
        self.status_label = QtWidgets.QLabel("Initializing...")
        self.status_label.setStyleSheet("color: #94a3b8; font-size: 14px;")
        self.status_label.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
        container_layout.addWidget(self.status_label)
        
        # Progress bar
        self.progress_bar = QtWidgets.QProgressBar()
        self.progress_bar.setMinimum(0)
        self.progress_bar.setMaximum(100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setFixedHeight(8)
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                background-color: #334155;
                border: none;
                border-radius: 4px;
            }
            QProgressBar::chunk {
                background-color: #60a5fa;
                border-radius: 4px;
            }
        """)
        container_layout.addWidget(self.progress_bar)
        
        layout.addWidget(container)
        
    def update_progress(self, value, message=""):
        """Update progress bar value and status message"""
        self.progress_bar.setValue(value)
        if message:
            self.status_label.setText(message)
        QtWidgets.QApplication.processEvents()
    
    def paintEvent(self, event):
        """Custom paint event for rounded corners"""
        painter = QtGui.QPainter(self)
        painter.setRenderHint(QtGui.QPainter.RenderHint.Antialiasing)
