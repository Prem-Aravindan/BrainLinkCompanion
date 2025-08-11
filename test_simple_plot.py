#!/usr/bin/env python3
"""
Test to create a simple, visible pyqtgraph plot that definitely shows a line.
"""
import sys
import numpy as np
import pyqtgraph as pg
from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
from PySide6.QtCore import QTimer

class TestPlotWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Test Plot Visibility")
        self.setGeometry(100, 100, 800, 600)
        
        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Create plot widget
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground('k')
        self.plot_widget.setLabel('left', 'Amplitude')
        self.plot_widget.setLabel('bottom', 'Time')
        self.plot_widget.setTitle('Test EEG-like Signal')
        self.plot_widget.showGrid(x=True, y=True)
        layout.addWidget(self.plot_widget)
        
        # Create the curve with extremely visible settings
        pen = pg.mkPen(color=(0, 255, 0), width=5, style=pg.QtCore.Qt.SolidLine)
        self.curve = self.plot_widget.plot([], [], pen=pen, symbol='o', symbolBrush=(255, 0, 0), symbolSize=5)
        self.curve.setZValue(100)
        
        # Set fixed ranges
        self.plot_widget.setXRange(0, 256)
        self.plot_widget.setYRange(-200, 200)
        
        # Generate test data similar to EEG
        self.t = 0
        self.data = []
        
        # Timer for updates
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_plot)
        self.timer.start(50)  # 20 FPS
        
    def update_plot(self):
        # Generate EEG-like data
        x = np.arange(256)
        signal = 50 * np.sin(2 * np.pi * 10 * x / 256 + self.t)  # 10 Hz sine
        signal += 20 * np.sin(2 * np.pi * 30 * x / 256 + self.t * 2)  # 30 Hz
        signal += np.random.normal(0, 10, 256)  # Noise
        
        print(f"Data range: {np.min(signal):.1f} to {np.max(signal):.1f}")
        
        # Update the curve
        self.curve.setData(x, signal, connect='all')
        
        # Force visibility
        self.curve.setVisible(True)
        
        self.t += 0.1

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = TestPlotWindow()
    window.show()
    sys.exit(app.exec())
