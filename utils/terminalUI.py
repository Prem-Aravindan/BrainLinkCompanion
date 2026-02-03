import requests
from cushy_serial import CushySerial
from BrainLinkParser.BrainLinkParser import BrainLinkParser
import time
import threading

def choose_backend_url():
    """
    Prompt the user to choose which environment (EN, NL, or Local).
    Returns the chosen backend URL.
    """
    print("Select environment to send EEG data:")
    print("1) EN (www.mindspeller.com)")
    print("2) NL (cas-nl.mindspeller.com)")
    print("3) Localhost (127.0.0.1:5000)")
    choice = input("Enter your choice (1-3): ").strip()

    if choice == '1':
        return "https://www.mindspeller.com/api/cas/brainlink_data"
    elif choice == '2':
        return "https://cas-nl.mindspeller.com/api/cas/brainlink_data"
    else:
        return "http://127.0.0.1:5000/api/cas/brainlink_data"

def choose_com_port():
    """
    Prompt the user to enter the COM port (Windows) or device path (macOS/Linux).
    Returns the user input (e.g., 'COM5', '/dev/tty.Something').
    """
    port = input("Enter your COM port (e.g., COM5 or /dev/ttyS0): ").strip()
    return port

def onRaw(raw):
    # Raw EEG data callback
    pass

def onEEG(data):
    """
    EEG data callback. 'data' is a BrainLinkData object:
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

# We'll store these in global variables after user input
BACKEND_URL = None
SERIAL_PORT = None
SERIAL_BAUD = 115200

def run_brainlink():
    """
    Sets up the BrainLinkParser, assigns callbacks, opens the serial port, and loops.
    """
    # Create BrainLinkParser with the 5 callbacks
    parser = BrainLinkParser(
        onEEG,       # EEG callback
        onExtendEEG, # Extended EEG callback
        onGyro,      # Gyro callback
        onRR,        # RR callback
        onRaw        # Raw callback
    )

    # Use CushySerial to open the chosen port at 115200
    serial = CushySerial(SERIAL_PORT, SERIAL_BAUD)

    @serial.on_message()
    def handle_serial_message(msg: bytes):
        parser.parse(msg)

    # Open the port
    serial.open()
    print(f"Opened {SERIAL_PORT} at {SERIAL_BAUD} baud.")
    print("BrainLink local companion is running. Press Ctrl+C to exit.")

    # Keep the thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Exiting local companion app.")
        serial.close()

def main():
    global BACKEND_URL, SERIAL_PORT

    # 1) Prompt for environment
    BACKEND_URL = choose_backend_url()

    # 2) Prompt for COM port
    SERIAL_PORT = choose_com_port()

    # 3) Start the BrainLink parser in a background thread
    t = threading.Thread(target=run_brainlink, daemon=True)
    t.start()

    # 4) Keep main thread alive
    try:
        while True:
            time.sleep(2)
    except KeyboardInterrupt:
        print("Shutting down...")

if __name__ == "__main__":
    main()
