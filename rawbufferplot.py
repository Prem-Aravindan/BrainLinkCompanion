import sys
import time
import threading
import os
import requests
import serial.tools.list_ports
import numpy as np
import pyqtgraph as pg  # Real-time plotting library
from cushy_serial import CushySerial
from BrainLinkParser.BrainLinkParser import BrainLinkParser
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QPushButton, QRadioButton, QComboBox, QButtonGroup
)
from PySide6.QtCore import Qt, QTimer

# Initialize raw data buffer with 2500 zeros
raw_data_buffer = [0] * 2500  # Circular buffer

# def addressTransfer(address):
#     return address[2:].replace(":", "").upper()

# DEVICE2 = addressTransfer(os.getenv('DEVICE2'))

# Globals
BACKEND_URL = None
SERIAL_PORT = None
SERIAL_BAUD = 115200
stop_thread_flag = False

def detect_brainlink():
    ports = serial.tools.list_ports.comports()
    brainlink_port = None

    for port in ports:
        if "5C3616327E59" in port.hwid:
            brainlink_port = port.device
            break

    return brainlink_port

def onRaw(raw):
    """ Handles raw EEG data and updates the buffer """
    global raw_data_buffer
    raw_value = int(raw)  # Convert to integer if needed

    # Drop first sample and append new sample
    raw_data_buffer.pop(0)
    raw_data_buffer.append(raw_value)

def onEEG(data):
    print("EEG -> attention:", data.attention, "meditation:", data.meditation)

def onExtendEEG(data):
    print("Extended EEG -> battery:", data.battery, "version:", data.version)

def onGyro(x, y, z):
    print(f"Gyro -> x={x}, y={y}, z={z}")

def onRR(rr1, rr2, rr3):
    print(f"RR -> rr1={rr1}, rr2={rr2}, rr3={rr3}")

def run_brainlink(serial_obj):
    global stop_thread_flag

    parser = BrainLinkParser(onEEG, onExtendEEG, onGyro, onRR, onRaw)

    @serial_obj.on_message()
    def handle_serial_message(msg: bytes):
        parser.parse(msg)

    if not serial_obj.is_open:
        serial_obj.open()

    print(f"Opened {SERIAL_PORT} at {SERIAL_BAUD} baud.")
    print("BrainLink local companion is running. Close the window or click Exit to stop.")

    try:
        while not stop_thread_flag:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Exiting local companion app (KeyboardInterrupt).")
    finally:
        if serial_obj.is_open:
            serial_obj.close()
        print("Serial closed. Thread exiting.")

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("BrainLink Companion (PySide6)")

        # Store references to the thread and the serial object
        self.brainlink_thread = None
        self.serial_obj = None

        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QVBoxLayout()
        central_widget.setLayout(main_layout)

        # Environment selection
        self.env_group = QButtonGroup(self)
        self.radio_en = QRadioButton("EN (www.mindspeller.com)")
        self.radio_nl = QRadioButton("NL (cas-nl.mindspeller.com)")
        self.radio_local = QRadioButton("Local (127.0.0.1:5000)")
        self.radio_en.setChecked(True)

        self.env_group.addButton(self.radio_en)
        self.env_group.addButton(self.radio_nl)
        self.env_group.addButton(self.radio_local)

        main_layout.addWidget(QLabel("Select Environment:"))
        main_layout.addWidget(self.radio_en)
        main_layout.addWidget(self.radio_nl)
        main_layout.addWidget(self.radio_local)

        global SERIAL_PORT
        SERIAL_PORT = detect_brainlink()
        if not SERIAL_PORT:
            print('No device found')
            global stop_thread_flag
            stop_thread_flag = True

        self.status_label = QLabel("Not running yet.")
        main_layout.addWidget(self.status_label)

        self.start_button = QPushButton("Start")
        self.start_button.clicked.connect(self.on_start_clicked)
        main_layout.addWidget(self.start_button)

        self.exit_button = QPushButton("Exit")
        self.exit_button.clicked.connect(self.close)
        main_layout.addWidget(self.exit_button)

        # Create a live plot
        self.plot_widget = pg.PlotWidget()
        main_layout.addWidget(self.plot_widget)
        self.plot_curve = self.plot_widget.plot([], [], pen='g')  # Green line plot

        # Setup a timer to update the plot continuously
        self.plot_timer = QTimer()
        self.plot_timer.timeout.connect(self.update_plot)
        self.plot_timer.start(50)  # Refresh every 50ms

        self.resize(600, 400)

    def update_plot(self):
        """ Updates the real-time plot with new raw EEG data """
        global raw_data_buffer
        self.plot_curve.setData(np.arange(len(raw_data_buffer)), raw_data_buffer)
        payload = { 'signal': raw_data_buffer }
        try:
            response = requests.post(BACKEND_URL, json=payload, timeout=2)
            if response.status_code == 200:
                print("Data sent successfully")
            else:
                print("Error sending data: ", response.status_code)
        except Exception as e:
            print("Error sending data: ", e)

    def on_start_clicked(self):
        global BACKEND_URL, SERIAL_PORT

        if self.radio_en.isChecked():
            BACKEND_URL = "https://stg-en.mindspell.be/api/cas/brainlink_data"
        elif self.radio_nl.isChecked():
            BACKEND_URL = "https://stg-nl.mindspell.be/api/cas/brainlink_data"
        else:
            BACKEND_URL = "http://127.0.0.1:5000/api/cas/brainlink_data"

        # Close the port if it's already open before opening it again
        if self.serial_obj and self.serial_obj.is_open:
            print(f"Closing already open serial port {SERIAL_PORT}")
            self.serial_obj.close()

        # Create the serial object here, store reference so we can forcibly close it later
        self.serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)

        # Create a non-daemon thread so we can join it on closeEvent
        self.brainlink_thread = threading.Thread(target=run_brainlink, args=(self.serial_obj,))
        self.brainlink_thread.start()

        self.start_button.setEnabled(False)
        self.status_label.setText(f"Running... Sending data to {BACKEND_URL}")

    def closeEvent(self, event):
        global stop_thread_flag
        stop_thread_flag = True
        print("Window closing. Setting stop_thread_flag to True.")

        # Force-close the port if it's open to unblock parse
        if self.serial_obj and self.serial_obj.is_open:
            print(f"Closing serial port {SERIAL_PORT} before exiting...")
            self.serial_obj.close()

        if self.brainlink_thread and self.brainlink_thread.is_alive():
            print("Joining background thread...")
            self.brainlink_thread.join()
            print("Background thread joined.")

        event.accept()  # Let PySide6 proceed with normal shutdown

def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()

    sys.exit(app.exec())

if __name__ == "__main__":
    main()
