"""
Test script to seed an EEG report to the API endpoint
This helps debug connection issues independently from the GUI
"""

import requests
import base64
import json
from datetime import datetime
import uuid

# Configuration
REPORT_FILE = "multi_task_report_20260114_123550.txt"
API_BASE = "http://127.0.0.1:5000/api/cas"
SEED_ENDPOINT = f"{API_BASE}/eeg-reports/seed"

# Authentication - replace with your actual JWT token
JWT_TOKEN = input("Enter your JWT token: ").strip()

# User info
EMAIL = input("Enter user email: ").strip()
PARTNER_ID = input("Enter partner ID (e.g., PARTNER_000001): ").strip()
PROTOCOL_TYPE = input("Enter protocol type (initial/advanced): ").strip() or "initial"

def read_report_file(filename):
    """Read the report file"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

def encode_report(report_text):
    """Encode report to base64"""
    report_bytes = report_text.encode('utf-8')
    return base64.b64encode(report_bytes).decode('utf-8')

def seed_report(report_text, email, jwt_token, partner_id, protocol_type):
    """Send the report to the seeding endpoint"""
    
    # Encode report
    report_base64 = encode_report(report_text)
    
    # Generate session ID
    session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    
    # Prepare payload
    payload = {
        "email": email,
        "report_text": report_base64,
        "is_base64": True,
        "protocol_type": protocol_type,
        "partner_id": partner_id,
        "session_id": session_id,
        "generation_meta": {
            "generated_at": datetime.now().isoformat(),
            "analyzer_version": "1.0",
            "workflow": "test_script",
            "task_count": 4
        }
    }
    
    # Prepare headers
    headers = {
        "X-Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    
    # Calculate payload size
    payload_json = json.dumps(payload)
    payload_size_kb = len(payload_json.encode('utf-8')) / 1024
    
    print("\n" + "="*60)
    print("SENDING REPORT TO API")
    print("="*60)
    print(f"URL: {SEED_ENDPOINT}")
    print(f"Email: {email}")
    print(f"Partner ID: {partner_id}")
    print(f"Protocol Type: {protocol_type}")
    print(f"Session ID: {session_id}")
    print(f"Payload Size: {payload_size_kb:.2f} KB")
    print(f"Report Length: {len(report_text)} characters")
    print(f"Base64 Length: {len(report_base64)} characters")
    print("="*60)
    
    try:
        print("\nSending request...")
        response = requests.post(
            SEED_ENDPOINT,
            json=payload,
            headers=headers,
            timeout=60,
            verify=False  # Disable SSL for localhost
        )
        
        print(f"\nResponse Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code in [200, 201]:
            result = response.json()
            print("\n✓ SUCCESS!")
            print("="*60)
            print("Response Data:")
            print(json.dumps(result, indent=2))
            print("="*60)
            return True
        else:
            print("\n✗ FAILED")
            print("="*60)
            print(f"Status Code: {response.status_code}")
            print(f"Response Text:\n{response.text}")
            print("="*60)
            return False
            
    except requests.exceptions.RequestException as e:
        print("\n✗ REQUEST EXCEPTION")
        print("="*60)
        print(f"Error: {e}")
        print("="*60)
        return False
    except Exception as e:
        print("\n✗ UNEXPECTED ERROR")
        print("="*60)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        print("="*60)
        return False

def main():
    print("="*60)
    print("EEG REPORT SEEDING TEST SCRIPT")
    print("="*60)
    
    # Read report file
    print(f"\nReading report file: {REPORT_FILE}")
    report_text = read_report_file(REPORT_FILE)
    
    if not report_text:
        print("Failed to read report file. Exiting.")
        return
    
    print(f"✓ Report loaded: {len(report_text)} characters")
    
    # Validate inputs
    if not JWT_TOKEN:
        print("Error: JWT token is required")
        return
    
    if not EMAIL:
        print("Error: Email is required")
        return
    
    if not PARTNER_ID:
        print("Error: Partner ID is required")
        return
    
    # Seed the report
    success = seed_report(report_text, EMAIL, JWT_TOKEN, PARTNER_ID, PROTOCOL_TYPE)
    
    if success:
        print("\n✓ Report seeded successfully!")
    else:
        print("\n✗ Report seeding failed. Check the error messages above.")

if __name__ == "__main__":
    # Disable SSL warnings for localhost testing
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    main()
