import tkinter as tk
from tkinter import ttk
import requests
import time
import threading
import serial.tools.list_ports

from cushy_serial import CushySerial
from BrainLinkParser.BrainLinkParser import BrainLinkParser

# Global variables for environment and COM port
BACKEND_URL = None
SERIAL_PORT = None
SERIAL_BAUD = 115200

# --- BrainLink Callbacks ---
def onRaw(raw):
    # Raw EEG data callback
    pass

def onEEG(data):
    """
    EEG data callback. 'data' is a BrainLinkData object with fields like:
      data.attention, data.meditation, data.delta, data.theta,
      data.lowAlpha, data.highAlpha, data.lowBeta, data.highBeta,
      data.lowGamma, data.highGamma
    """
    # Print or log if desired
    print("EEG -> attention:", data.attention, "meditation:", data.meditation)

    # Send data to the chosen backend
    try:
        payload = {
            "attention": data.attention,
            "meditation": data.meditation,
            "delta": data.delta,
            "theta": data.theta,
            "lowAlpha": data.lowAlpha,
            "highAlpha": data.highAlpha,
            "lowBeta": data.lowBeta,
            "highBeta": data.highBeta,
            "lowGamma": data.lowGamma,
            "highGamma": data.highGamma
        }
        response = requests.post(BACKEND_URL, json=payload, timeout=2)
        print(f"Sent EEG data to backend. Status code: {response.status_code}")
    except Exception as e:
        print(f"Failed to send EEG data to {BACKEND_URL}: {e}")

def onExtendEEG(data):
    # Extended EEG data callback (battery, version, etc.)
    print("Extended EEG -> battery:", data.battery, "version:", data.version)

def onGyro(x, y, z):
    print(f"Gyro -> x={x}, y={y}, z={z}")

def onRR(rr1, rr2, rr3):
    print(f"RR -> rr1={rr1}, rr2={rr2}, rr3={rr3}")

# --- BrainLink Thread (same logic as console code) ---
def run_brainlink():
    """
    1) Create BrainLinkParser with 5 callbacks.
    2) Create CushySerial, open the port at 115200.
    3) Continuously parse incoming data in a loop.
    """
    parser = BrainLinkParser(onEEG, onExtendEEG, onGyro, onRR, onRaw)

    serial_obj = CushySerial(SERIAL_PORT, SERIAL_BAUD)

    @serial_obj.on_message()
    def handle_serial_message(msg: bytes):
        parser.parse(msg)

    # Open the port (no forced close logic, same as your console version)
    serial_obj.open()
    print(f"Opened {SERIAL_PORT} at {SERIAL_BAUD} baud.")
    print("BrainLink local companion is running. Press Ctrl+C (console) or close the GUI to exit.")

    # Keep the thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Exiting local companion app.")
    finally:
        serial_obj.close()
        print("Serial closed.")

# --- Tkinter UI ---
def start_brainlink(env_var, com_var, start_button, status_label):
    """
    When the user clicks "Start":
    1) Set global BACKEND_URL, SERIAL_PORT from the GUI.
    2) Spawn run_brainlink() in a background thread.
    3) Disable "Start" to prevent duplicates.
    """
    global BACKEND_URL, SERIAL_PORT

    # Determine environment from radio selection
    if env_var.get() == "EN":
        BACKEND_URL = "https://www.en-mindspeller.com/api/cas/brainlink_data"
    elif env_var.get() == "NL":
        BACKEND_URL = "https://www.nl-mindspeller.com/api/cas/brainlink_data"
    else:
        BACKEND_URL = "http://127.0.0.1:5000/api/cas/brainlink_data"

    SERIAL_PORT = com_var.get()

    # Start the BrainLink parser in a background thread
    t = threading.Thread(target=run_brainlink, daemon=True)
    t.start()

    start_button.config(state=tk.DISABLED)
    status_label.config(text=f"Running... Sending data to {BACKEND_URL}")
    
def main():
    root = tk.Tk()
    root.title("BrainLink Companion (Tkinter)")

    frame = ttk.Frame(root, padding="10 10 10 10")
    frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

    # Radio buttons for environment
    env_var = tk.StringVar(value="EN")
    ttk.Label(frame, text="Select Environment:").grid(column=1, row=1, columnspan=2, sticky=tk.W)
    ttk.Radiobutton(frame, text="EN (www.mindspeller.com)", variable=env_var, value="EN").grid(column=1, row=2, sticky=tk.W)
    ttk.Radiobutton(frame, text="NL (cas-nl.mindspeller.com)", variable=env_var, value="NL").grid(column=1, row=3, sticky=tk.W)
    ttk.Radiobutton(frame, text="Local (127.0.0.1:5000)", variable=env_var, value="LOCAL").grid(column=1, row=4, sticky=tk.W)

    # === Auto-Detect COM Ports ===
    ports = list(serial.tools.list_ports.comports())
    port_choices = [p.device for p in ports]

    # Try to find a port describing "BrainLink"
    brainlink_port = None
    for p in ports:
        desc = (p.description or "").lower()
        if "brainlink" in desc:
            brainlink_port = p.device
            break

    # If we found a BrainLink port, default to that; otherwise default to first in the list (if any)
    if not brainlink_port and port_choices:
        brainlink_port = port_choices[0]

    # If no ports at all, default to empty string
    if not port_choices:
        port_choices = ["(No COM ports found)"]
        brainlink_port = "(No COM ports found)"

    port_var = tk.StringVar(value=brainlink_port)

    ttk.Label(frame, text="Select COM Port:").grid(column=1, row=5, sticky=tk.W)
    # Use a Combobox to list all available ports
    port_combo = ttk.Combobox(frame, textvariable=port_var, values=port_choices, state="readonly", width=20)
    port_combo.grid(column=2, row=5, sticky=tk.W)

    # Status label
    status_label = ttk.Label(frame, text="Not running yet.")
    status_label.grid(column=1, row=7, columnspan=2, pady=10, sticky=tk.W)

    # Start button
    start_button = ttk.Button(
        frame, text="Start",
        command=lambda: start_brainlink(env_var, port_var, start_button, status_label)
    )
    start_button.grid(column=1, row=6, columnspan=2, pady=5)

    # Exit button
    exit_button = ttk.Button(frame, text="Exit", command=root.destroy)
    exit_button.grid(column=1, row=8, columnspan=2, pady=5)

    for child in frame.winfo_children():
        child.grid_configure(padx=5, pady=5)

    root.mainloop()

if __name__ == "__main__":
    main()
