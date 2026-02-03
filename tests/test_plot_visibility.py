#!/usr/bin/env python3
"""
Quick test to diagnose plot visibility issues
"""
import sys
import numpy as np
from PySide6.QtWidgets import QApplication, QMainWindow, QVBoxLayout, QWidget
import pyqtgraph as pg

# Set up PyQtGraph like in the main GUI
pg.setConfigOption('useOpenGL', False)
pg.setConfigOption('antialias', True)
pg.setConfigOption('background', 'k')
pg.setConfigOption('foreground', 'w')

class TestPlotWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Plot Visibility Test")
        self.setGeometry(100, 100, 800, 600)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)
        
        # Create plot widget like in main GUI
        self.plot_widget = pg.PlotWidget()
        self.plot_widget.setBackground("#000")
        self.plot_widget.setLabel('left', 'Amplitude (µV)')
        self.plot_widget.setLabel('bottom', 'Sample Index')
        self.plot_widget.setTitle('Plot Visibility Test')
        self.plot_widget.showGrid(x=True, y=True)
        layout.addWidget(self.plot_widget)
        
        # Try multiple curve styles to see what works
        self.test_curves()
    
    def test_curves(self):
        # Test data similar to what we see in the real GUI
        x = np.arange(256)
        y = np.sin(x/10) * 100 + np.random.normal(0, 20, 256)  # Simulate EEG-like data
        
        print(f"Test data: x range {x.min():.1f} to {x.max():.1f}")
        print(f"Test data: y range {y.min():.1f} to {y.max():.1f}")
        
        # Test 1: Simple bright line
        pen1 = pg.mkPen(color=(0, 255, 0, 255), width=3, style=pg.QtCore.Qt.SolidLine)
        curve1 = self.plot_widget.plot(x, y, pen=pen1, name="Bright Green Line")
        curve1.setZValue(10)
        print("Added bright green line")
        
        # Test 2: Line with symbols
        pen2 = pg.mkPen(color=(255, 0, 0, 255), width=2)
        curve2 = self.plot_widget.plot(x, y + 50, pen=pen2, symbol='o', symbolSize=3, 
                                      symbolBrush=(255, 0, 0), name="Red Line + Symbols")
        curve2.setZValue(11)
        print("Added red line with symbols")
        
        # Test 3: Thick yellow line
        pen3 = pg.mkPen(color=(255, 255, 0, 255), width=5)
        curve3 = self.plot_widget.plot(x, y - 50, pen=pen3, name="Thick Yellow Line")
        curve3.setZValue(12)
        print("Added thick yellow line")
        
        # Set ranges explicitly
        y_min = y.min() - 100
        y_max = y.max() + 100
        self.plot_widget.setYRange(y_min, y_max)
        self.plot_widget.setXRange(0, len(x))
        
        print(f"Set Y range: {y_min:.1f} to {y_max:.1f}")
        print(f"Set X range: 0 to {len(x)}")
        
        # Also try PlotItem level range setting
        pi = self.plot_widget.getPlotItem()
        pi.setYRange(y_min, y_max, padding=0)
        pi.setXRange(0, len(x), padding=0)
        print("Also set ranges via PlotItem")
        
        # Hide auto-range buttons
        try:
            pi.hideButtons()
            print("Hid auto-range buttons")
        except Exception as e:
            print(f"Could not hide buttons: {e}")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = TestPlotWindow()
    window.show()
    print("Window should be visible with 3 colored lines")
    print("Close the window to exit")
    sys.exit(app.exec())
