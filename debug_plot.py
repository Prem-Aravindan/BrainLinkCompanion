#!/usr/bin/env python3
# pip install PyQt6
import sys, math
import numpy as np
from PyQt6.QtWidgets import QApplication, QWidget
from PyQt6.QtGui import QPainter, QPen, QBrush, QFont
from PyQt6.QtCore import Qt, QRectF, QPointF

x = np.array([0, 1, 2, 3, 4, 5], dtype=float)
y = np.array([0, 100, -50, 75, -25, 50], dtype=float)

class Plot(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Pure PyQt plot")
        self.resize(900, 600)
        self.margin_left, self.margin_right = 80, 30
        self.margin_top, self.margin_bottom = 50, 70
        self.xmin, self.xmax = -1.0, 6.0
        self.ymin, self.ymax = -100.0, 150.0

    def plotRect(self):
        w, h = self.width(), self.height()
        return QRectF(self.margin_left, self.margin_top,
                      w - self.margin_left - self.margin_right,
                      h - self.margin_top - self.margin_bottom)

    def map(self, xv, yv):
        r = self.plotRect()
        sx = (xv - self.xmin) / (self.xmax - self.xmin)
        sy = (yv - self.ymin) / (self.ymax - self.ymin)
        px = r.left() + sx * r.width()
        py = r.bottom() - sy * r.height()
        return QPointF(px, py)

    def paintEvent(self, _):
        p = QPainter(self)
        p.fillRect(self.rect(), Qt.GlobalColor.white)
        r = self.plotRect()

        # Grid
        p.setRenderHint(QPainter.RenderHint.Antialiasing, True)
        p.setPen(QPen(Qt.GlobalColor.lightGray, 1))
        for xi in range(int(self.xmin)+1, int(self.xmax)):
            p.drawLine(self.map(xi, self.ymin), self.map(xi, self.ymax))
        for yi in range(int(self.ymin), int(self.ymax)+1, 25):
            p.drawLine(self.map(self.xmin, yi), self.map(self.xmax, yi))

        # Axes
        p.setPen(QPen(Qt.GlobalColor.black, 2))
        p.drawLine(self.map(self.xmin, 0), self.map(self.xmax, 0))
        p.drawLine(self.map(0, self.ymin), self.map(0, self.ymax))

        # Ticks/labels (use QPointF endpoints!)
        p.setFont(QFont("Sans Serif", 10))
        for xi in range(0, 6):
            pt = self.map(xi, 0)
            p.drawLine(QPointF(pt.x(), pt.y()-5), QPointF(pt.x(), pt.y()+5))
            p.drawText(int(pt.x()-10), int(r.bottom()+25), f"{xi}")

        for yi in range(int(self.ymin), int(self.ymax)+1, 25):
            pt = self.map(0, yi)
            p.drawLine(QPointF(pt.x()-5, pt.y()), QPointF(pt.x()+5, pt.y()))
            p.drawText(int(r.left()-55), int(pt.y()+5), f"{yi:>4}")

        # Labels
        f = QFont("Sans Serif", 12); f.setBold(True); p.setFont(f)
        p.drawText(int(r.center().x()-30), int(self.height()-25), "X Value")
        p.save(); p.translate(25, r.center().y()+40); p.rotate(-90)
        p.drawText(0, 0, "Y Value"); p.restore()
        p.drawText(int(r.left()), int(self.margin_top-15), "Debug Plot (Pure PyQt6)")

        # Data line + markers
        p.setPen(QPen(Qt.GlobalColor.red, 4))
        for i in range(len(x)-1):
            p.drawLine(self.map(x[i], y[i]), self.map(x[i+1], y[i+1]))
        p.setPen(QPen(Qt.GlobalColor.blue, 2))
        p.setBrush(QBrush(Qt.GlobalColor.blue))
        for xi, yi in zip(x, y):
            pt = self.map(xi, yi); r0 = 6
            p.drawEllipse(pt, r0, r0)

if __name__ == "__main__":
    app = QApplication(sys.argv)
    w = Plot()
    w.show()
    sys.exit(app.exec())
