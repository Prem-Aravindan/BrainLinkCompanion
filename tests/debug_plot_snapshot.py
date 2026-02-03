#!/usr/bin/env python3
"""
Save a snapshot PNG of a test pyqtgraph plot to confirm rendering even if the window
is not visible or the GPU path is problematic.
"""
import sys
import numpy as np
from PySide6.QtWidgets import QApplication
import pyqtgraph as pg

pg.setConfigOption('useOpenGL', False)
pg.setConfigOption('antialias', True)
pg.setConfigOption('background', 'k')
pg.setConfigOption('foreground', 'w')

app = QApplication(sys.argv)
plt = pg.plot(title='Snapshot Test')
plt.setBackground('k')
plt.showGrid(x=True, y=True)

x = np.arange(256)
y = np.sin(x/10) * 100 + np.random.normal(0, 20, 256)
pen = pg.mkPen(color=(0, 255, 0, 255), width=3)
curve = plt.plot(x, y, pen=pen, symbol='o', symbolSize=2, symbolBrush=(0,255,0))

# Force ranges
plt.setYRange(np.min(y)-100, np.max(y)+100)
plt.setXRange(0, len(x))

# Render to QImage
img = plt.grab()
path = 'plot_snapshot.png'
img.save(path)
print(f"Saved snapshot to {path}")

# Optional: show the window briefly
plt.show()
# Exit after a short delay to ensure file is written
from PySide6.QtCore import QTimer
QTimer.singleShot(800, app.quit)
sys.exit(app.exec())
