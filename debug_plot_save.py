#!/usr/bin/env python3
"""
Headless-like plot save to PNG to verify the line renders.
"""
import sys
import numpy as np
from PySide6.QtWidgets import QApplication
from PySide6.QtCore import Qt, QCoreApplication
import pyqtgraph as pg

QCoreApplication.setAttribute(Qt.AA_UseSoftwareOpenGL, True)
pg.setConfigOption('useOpenGL', False)
pg.setConfigOption('antialias', False)
pg.setConfigOption('background', 'w')
pg.setConfigOption('foreground', 'k')

app = QApplication(sys.argv)
pw = pg.PlotWidget()
pw.setBackground('w')
pw.resize(800, 600)

x = np.linspace(0, 2*np.pi, 200)
y = np.sin(x) * 100
pen = pg.mkPen(color=(0, 128, 0, 255), width=6, cosmetic=False)
pw.plot(x, y, pen=pen, symbol='o', symbolSize=6, symbolBrush=(0, 0, 255, 255))
pw.setXRange(0, 2*np.pi)
pw.setYRange(-120, 120)

img = pw.grab()
out = 'debug_plot_output.png'
ok = img.save(out)
print(f"Saved: {out}, ok={ok}")
sys.exit(0)
