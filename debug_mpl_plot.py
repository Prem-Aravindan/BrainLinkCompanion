#!/usr/bin/env python3
"""
Matplotlib QtAgg plot to verify that Qt paint pipeline is rendering lines.
"""
import sys
import numpy as np
from PySide6.QtWidgets import QApplication
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure

app = QApplication(sys.argv)
fig = Figure(figsize=(6,4), facecolor='white')
ax = fig.add_subplot(111)
ax.set_facecolor('white')
x = np.linspace(0, 2*np.pi, 200)
y = np.cos(x)*100
ax.plot(x, y, color='red', linewidth=3)
ax.set_xlim(0, 2*np.pi)
ax.set_ylim(-120, 120)
ax.grid(True)
canvas = FigureCanvas(fig)
canvas.resize(800, 600)
canvas.show()
print('Matplotlib window should show a red cosine line')
sys.exit(app.exec())
