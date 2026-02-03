# # pip install PyQt6
# import sys, numpy as np
# from PyQt6.QtCore import Qt, QTimer, QPointF
# from PyQt6.QtGui import QPen, QPainter
# from PyQt6.QtWidgets import QApplication
# from PyQt6.QtCharts import QChart, QChartView, QLineSeries

# class ChartDemo(QChartView):
#     def __init__(self):
#         super().__init__()
#         self.setRenderHint(QPainter.RenderHint.Antialiasing, True)

#         self.chart = QChart()
#         self.chart.setTitle("QtCharts visible line (PyQt6)")
#         self.chart.legend().hide()
#         self.setChart(self.chart)

#         # KEEP A REFERENCE TO THE SERIES!
#         self.series = QLineSeries()
#         pen = QPen(Qt.GlobalColor.red)
#         pen.setWidth(4)
#         pen.setCosmetic(True)  # visibility regardless of transforms/HiDPI
#         self.series.setPen(pen)
#         self.chart.addSeries(self.series)

#         self.chart.createDefaultAxes()
#         # Get axes using the correct PyQt6 method
#         axes = self.chart.axes()
#         if len(axes) >= 2:
#             x_axis = axes[0]  # First axis is typically X
#             y_axis = axes[1]  # Second axis is typically Y
#             x_axis.setRange(-1, 6)
#             y_axis.setRange(-100, 150)

#         # Seed data
#         x = np.array([0, 1, 2, 3, 4, 5], float)
#         y = np.array([0, 100, -50, 75, -25, 50], float)
#         self.series.replace([QPointF(float(a), float(b)) for a, b in zip(x, y)])

#         # Live update to prove visibility
#         self.t = 0
#         self.timer = QTimer(self)
#         self.timer.timeout.connect(self.tick)
#         self.timer.start(60)

#     def tick(self):
#         self.t += 1
#         # simple animation: shift Y by a tiny sine
#         pts = [p for p in self.series.pointsVector()]
#         if not pts: 
#             return
#         amp = 10.0
#         s = np.sin(self.t / 10.0)
#         new_pts = [QPointF(p.x(), p.y() + amp*s) for p in pts]
#         self.series.replace(new_pts)

# if __name__ == "__main__":
#     app = QApplication(sys.argv)
#     w = ChartDemo()
#     w.resize(900, 600)
#     w.show()
#     sys.exit(app.exec())


# pip install PyQt6 pyqtgraph
import sys, numpy as np, pyqtgraph as pg
from PyQt6 import QtWidgets, QtCore
from PyQt6.QtCore import Qt

pg.setConfigOption('background', 'w')
pg.setConfigOption('foreground', 'k')
pg.setConfigOption('antialias', True)

class PGDemo(QtWidgets.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("pyqtgraph visible line (PyQt6)")
        self.plot = pg.PlotWidget()
        self.setCentralWidget(self.plot)

        pi = self.plot.getPlotItem()
        pi.showGrid(x=True, y=True)
        pi.setLabel('bottom', 'X Value')
        pi.setLabel('left', 'Y Value')
        pi.setXRange(-1, 6)
        pi.setYRange(-100, 150)

        x = np.array([0, 1, 2, 3, 4, 5], float)
        y = np.array([0, 100, -50, 75, -25, 50], float)

        # Qt6-safe pen; COSMETIC ensures a visible width on HiDPI/transforms
        pen = pg.mkPen(width=4, style=Qt.PenStyle.SolidLine, cosmetic=True)
        self.curve = pi.plot(x, y, pen=pen, symbol='o', symbolBrush='b', symbolSize=12)

        # simple live update so you see movement
        self.t = 0
        self.timer = QtCore.QTimer(self)
        self.timer.timeout.connect(self.tick)
        self.timer.start(60)

    def tick(self):
        self.t += 1
        x = np.array([0, 1, 2, 3, 4, 5], float)
        base = np.array([0, 100, -50, 75, -25, 50], float)
        y = base + 10.0*np.sin(self.t/10.0)
        self.curve.setData(x, y)

if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    w = PGDemo()
    w.resize(900, 600)
    w.show()
    sys.exit(app.exec())
