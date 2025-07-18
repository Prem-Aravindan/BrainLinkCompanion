#!/usr/bin/env python3
"""
Simple test to check if BrainLinkAnalyzer GUI plot is working
"""

import sys
import numpy as np
import pyqtgraph as pg
from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget, QPushButton
from PySide6.QtCore import QTimer

class SimpleTestWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("EEG Plot Test")
        self.setMinimumSize(800, 600)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Test button
        self.test_button = QPushButton("Generate Test Data")
        self.test_button.clicked.connect(self.generate_test_data)
        layout.addWidget(self.test_button)
        
        # Plot widget
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground("#000")
        self.plot_widget.setLabel('left', 'Amplitude')
        self.plot_widget.setLabel('bottom', 'Samples')
        self.plot_widget.setTitle('Test EEG Signal')
        layout.addWidget(self.plot_widget)
        
        # Initialize plot curve
        self.live_curve = self.plot_widget.plot([], [], pen=pg.mkPen('g', width=2))
        
        # Data buffer
        self.data_buffer = []
        
        # Timer for updates
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_plot)
        self.timer.start(100)  # Update every 100ms
        
        print("Test window initialized")
    
    def generate_test_data(self):
        """Generate test EEG data"""
        # Generate sine wave test data
        t = np.linspace(0, 2*np.pi, 100)
        test_data = 50 * np.sin(t) + 20 * np.sin(3*t) + 10 * np.random.randn(100)
        
        # Add to buffer
        self.data_buffer.extend(test_data.tolist())
        
        print(f"Generated {len(test_data)} test samples. Buffer size: {len(self.data_buffer)}")
    
    def update_plot(self):
        """Update the plot"""
        if len(self.data_buffer) < 10:
            return
        
        # Use last 200 samples
        data = np.array(self.data_buffer[-200:])
        x_data = np.arange(len(data))
        
        # Update plot
        self.live_curve.setData(x_data, data)

def main():
    app = QApplication(sys.argv)
    
    # Set up PyQtGraph
    pg.setConfigOption('useOpenGL', False)
    pg.setConfigOption('antialias', True)
    pg.setConfigOption('background', 'k')
    pg.setConfigOption('foreground', 'w')
    
    window = SimpleTestWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
