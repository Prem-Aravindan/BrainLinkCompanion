"""
Modern splash screen with animations for MindLink Analyzer
Features: Gradient background, animated glow, glassmorphism, pulsing effects
"""
from PySide6 import QtWidgets, QtCore, QtGui
import sys
import math


class SplashScreen(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowFlags(QtCore.Qt.WindowType.FramelessWindowHint | QtCore.Qt.WindowType.WindowStaysOnTopHint)
        self.setAttribute(QtCore.Qt.WidgetAttribute.WA_TranslucentBackground)
        
        # Animation properties
        self._glow_intensity = 0.0
        self._pulse_phase = 0.0
        self._gradient_offset = 0.0
        
        # Set size
        self.setFixedSize(650, 450)
        
        # Center on screen
        screen = QtWidgets.QApplication.primaryScreen().geometry()
        self.move((screen.width() - self.width()) // 2, (screen.height() - self.height()) // 2)
        
        # Main layout - we'll draw everything in paintEvent for full control
        self.setLayout(QtWidgets.QVBoxLayout())
        
        # Progress value
        self._progress_value = 0
        self._status_text = "Initializing..."
        
        # Logo pixmap - use logo-no-text.png for cleaner look
        self._logo_pixmap = None
        try:
            pixmap = QtGui.QPixmap("assets/logo-no-text.png")
            if not pixmap.isNull():
                self._logo_pixmap = pixmap.scaled(80, 80, QtCore.Qt.AspectRatioMode.KeepAspectRatio, 
                                                  QtCore.Qt.TransformationMode.SmoothTransformation)
        except:
            pass
        
        # Animation timer
        self._animation_timer = QtCore.QTimer(self)
        self._animation_timer.timeout.connect(self._animate)
        self._animation_timer.start(30)  # ~33 FPS
        
    def _animate(self):
        """Update animation properties"""
        self._glow_intensity = (math.sin(self._pulse_phase) + 1) / 2  # 0 to 1
        self._pulse_phase += 0.08
        self._gradient_offset += 0.5
        if self._gradient_offset > 360:
            self._gradient_offset = 0
        self.update()
    
    def update_progress(self, value, message=""):
        """Update progress bar value and status message"""
        self._progress_value = value
        if message:
            self._status_text = message
        self.update()
        QtWidgets.QApplication.processEvents()
    
    def paintEvent(self, event):
        """Custom paint event for modern aesthetic design"""
        painter = QtGui.QPainter(self)
        painter.setRenderHint(QtGui.QPainter.RenderHint.Antialiasing)
        painter.setRenderHint(QtGui.QPainter.RenderHint.TextAntialiasing)
        
        width = self.width()
        height = self.height()
        margin = 15
        
        # Draw outer glow/shadow
        for i in range(margin, 0, -2):
            opacity = int(15 * (1 - i / margin))
            painter.setPen(QtCore.Qt.PenStyle.NoPen)
            painter.setBrush(QtGui.QColor(96, 165, 250, opacity))
            painter.drawRoundedRect(margin - i, margin - i, 
                                   width - 2 * (margin - i), height - 2 * (margin - i), 
                                   20, 20)
        
        # Main container with gradient background
        gradient = QtGui.QLinearGradient(0, 0, width, height)
        gradient.setColorAt(0, QtGui.QColor(15, 23, 42))      # slate-900
        gradient.setColorAt(0.5, QtGui.QColor(30, 41, 59))    # slate-800
        gradient.setColorAt(1, QtGui.QColor(15, 23, 42))      # slate-900
        
        painter.setPen(QtCore.Qt.PenStyle.NoPen)
        painter.setBrush(gradient)
        painter.drawRoundedRect(margin, margin, width - 2*margin, height - 2*margin, 20, 20)
        
        # Animated accent gradient overlay (subtle)
        accent_gradient = QtGui.QConicalGradient(width/2, height/2, self._gradient_offset)
        accent_gradient.setColorAt(0, QtGui.QColor(96, 165, 250, 20))   # blue-400
        accent_gradient.setColorAt(0.25, QtGui.QColor(139, 92, 246, 15))  # violet-500
        accent_gradient.setColorAt(0.5, QtGui.QColor(236, 72, 153, 20))   # pink-500
        accent_gradient.setColorAt(0.75, QtGui.QColor(34, 211, 238, 15))  # cyan-400
        accent_gradient.setColorAt(1, QtGui.QColor(96, 165, 250, 20))   # blue-400
        
        painter.setBrush(accent_gradient)
        painter.drawRoundedRect(margin, margin, width - 2*margin, height - 2*margin, 20, 20)
        
        # Inner glassmorphism container
        glass_margin = 40
        glass_rect = QtCore.QRectF(glass_margin, glass_margin, 
                                   width - 2*glass_margin, height - 2*glass_margin)
        
        # Glass background
        glass_gradient = QtGui.QLinearGradient(glass_rect.topLeft(), glass_rect.bottomRight())
        glass_gradient.setColorAt(0, QtGui.QColor(255, 255, 255, 8))
        glass_gradient.setColorAt(1, QtGui.QColor(255, 255, 255, 3))
        
        painter.setBrush(glass_gradient)
        painter.setPen(QtGui.QPen(QtGui.QColor(255, 255, 255, 20), 1))
        painter.drawRoundedRect(glass_rect, 16, 16)
        
        # Logo with glow effect - positioned higher for better spacing
        logo_y = 55
        if self._logo_pixmap and not self._logo_pixmap.isNull():
            logo_x = (width - self._logo_pixmap.width()) // 2
            
            # Animated glow behind logo
            glow_size = int(10 + 8 * self._glow_intensity)
            glow_color = QtGui.QColor(96, 165, 250, int(80 * self._glow_intensity))
            for i in range(glow_size, 0, -2):
                painter.setPen(QtCore.Qt.PenStyle.NoPen)
                painter.setBrush(QtGui.QColor(glow_color.red(), glow_color.green(), 
                                             glow_color.blue(), int(glow_color.alpha() * (1 - i/glow_size))))
                painter.drawEllipse(logo_x - i, logo_y - i, 
                                   self._logo_pixmap.width() + 2*i, 
                                   self._logo_pixmap.height() + 2*i)
            
            painter.drawPixmap(logo_x, logo_y, self._logo_pixmap)
        
        # Title "MindLink" with gradient text effect - positioned well below logo
        title_y = logo_y + 140
        title_font = QtGui.QFont("Segoe UI", 42, QtGui.QFont.Weight.Bold)
        painter.setFont(title_font)
        
        # Create gradient for title
        title_text = "MindLink"
        title_metrics = QtGui.QFontMetrics(title_font)
        title_width = title_metrics.horizontalAdvance(title_text)
        title_x = (width - title_width) // 2
        
        title_gradient = QtGui.QLinearGradient(title_x, 0, title_x + title_width, 0)
        title_gradient.setColorAt(0, QtGui.QColor(96, 165, 250))     # blue-400
        title_gradient.setColorAt(0.5, QtGui.QColor(139, 92, 246))   # violet-500
        title_gradient.setColorAt(1, QtGui.QColor(236, 72, 153))     # pink-500
        
        painter.setPen(QtGui.QPen(QtGui.QBrush(title_gradient), 0))
        painter.drawText(title_x, title_y, title_text)
        
        # Subtitle "Analyzer"
        subtitle_font = QtGui.QFont("Segoe UI", 28, QtGui.QFont.Weight.Light)
        painter.setFont(subtitle_font)
        subtitle_text = "Analyzer"
        subtitle_metrics = QtGui.QFontMetrics(subtitle_font)
        subtitle_width = subtitle_metrics.horizontalAdvance(subtitle_text)
        subtitle_x = (width - subtitle_width) // 2
        subtitle_y = title_y + 40
        
        painter.setPen(QtGui.QColor(148, 163, 184))  # slate-400
        painter.drawText(subtitle_x, subtitle_y, subtitle_text)
        
        # Status text
        status_font = QtGui.QFont("Segoe UI", 11)
        painter.setFont(status_font)
        status_metrics = QtGui.QFontMetrics(status_font)
        status_width = status_metrics.horizontalAdvance(self._status_text)
        status_x = (width - status_width) // 2
        status_y = height - 85
        
        painter.setPen(QtGui.QColor(148, 163, 184, 200))  # slate-400 with alpha
        painter.drawText(status_x, status_y, self._status_text)
        
        # Progress bar
        bar_margin = 80
        bar_height = 6
        bar_y = height - 60
        bar_width = width - 2 * bar_margin
        bar_radius = 3
        
        # Progress bar background
        painter.setPen(QtCore.Qt.PenStyle.NoPen)
        painter.setBrush(QtGui.QColor(51, 65, 85, 150))  # slate-700 with alpha
        painter.drawRoundedRect(bar_margin, bar_y, bar_width, bar_height, bar_radius, bar_radius)
        
        # Progress bar fill with gradient
        if self._progress_value > 0:
            fill_width = int((bar_width * self._progress_value) / 100)
            
            progress_gradient = QtGui.QLinearGradient(bar_margin, 0, bar_margin + fill_width, 0)
            progress_gradient.setColorAt(0, QtGui.QColor(96, 165, 250))     # blue-400
            progress_gradient.setColorAt(0.5, QtGui.QColor(139, 92, 246))   # violet-500
            progress_gradient.setColorAt(1, QtGui.QColor(192, 132, 252))    # violet-400
            
            painter.setBrush(progress_gradient)
            painter.drawRoundedRect(bar_margin, bar_y, fill_width, bar_height, bar_radius, bar_radius)
            
            # Animated shimmer on progress bar
            shimmer_pos = int((self._gradient_offset * 2) % (fill_width + 50)) - 25
            if shimmer_pos > 0 and shimmer_pos < fill_width:
                shimmer_gradient = QtGui.QLinearGradient(bar_margin + shimmer_pos - 25, 0, 
                                                         bar_margin + shimmer_pos + 25, 0)
                shimmer_gradient.setColorAt(0, QtGui.QColor(255, 255, 255, 0))
                shimmer_gradient.setColorAt(0.5, QtGui.QColor(255, 255, 255, 60))
                shimmer_gradient.setColorAt(1, QtGui.QColor(255, 255, 255, 0))
                
                painter.setBrush(shimmer_gradient)
                painter.drawRoundedRect(bar_margin + shimmer_pos - 25, bar_y, 50, bar_height, bar_radius, bar_radius)
        
        # Decorative particles/dots
        for i in range(5):
            dot_x = 60 + i * 130
            dot_y = height - 30
            dot_alpha = int(100 + 55 * math.sin(self._pulse_phase + i * 0.5))
            painter.setBrush(QtGui.QColor(96, 165, 250, dot_alpha))
            painter.setPen(QtCore.Qt.PenStyle.NoPen)
            painter.drawEllipse(dot_x, dot_y, 4, 4)
    
    def closeEvent(self, event):
        """Clean up timer on close"""
        self._animation_timer.stop()
        super().closeEvent(event)
