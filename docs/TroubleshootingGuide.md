# BrainLink Companion App - Security Troubleshooting Guide

If you're experiencing issues running the BrainLink Companion app or it can't connect to the server, follow these troubleshooting steps:

## 1. Unblock the Executable

When downloading .exe files from the internet, Windows often "blocks" them for security:

1. Right-click on `BrainCompanion.exe`
2. Select "Properties"
3. At the bottom of the General tab, look for a "Security" section with "This file came from another computer..." message
4. Check the "Unblock" box
5. Click "Apply" and "OK"

## 2. Run as Administrator

Running with administrator privileges can bypass some security restrictions:

1. Right-click on `BrainCompanion.exe`
2. Select "Run as administrator"

## 3. Add Firewall Exception

Your firewall might be blocking outgoing connections:

1. Open Windows Security (or your security software)
2. Go to "Firewall & network protection"
3. Click "Allow an app through firewall"
4. Click "Change settings" (requires admin rights)
5. Click "Allow another app..."
6. Browse to and select `BrainCompanion.exe`
7. Make sure both "Private" and "Public" networks are checked
8. Click "OK"

## 4. Temporarily Disable Anti-virus

Your anti-virus might be blocking network connections:

1. Temporarily disable your anti-virus protection
2. Test if the app works
3. Remember to re-enable your anti-virus after testing!

## 5. Check Your Network Connection

Ensure your network allows outgoing HTTPS connections:

- Can you access https://en.mindspeller.com in your browser?
- Is your company network blocking external API access?
- Are you connected to a VPN that might restrict traffic?

## 6. Run the Diagnostic Tool

The app includes a built-in diagnostic tool:

1. Launch the app
2. Click the "Run Diagnostics" button
3. Review the results, especially the "Network Connectivity" section
4. Send the generated `diagnostic_results.txt` file to your IT support team or the app developer

## 7. Certificate Issues

If you see SSL/certificate errors in the diagnostic results:

1. Ensure your Windows is up-to-date, including root certificates
2. If you're in a corporate environment, check with IT if SSL inspection is enabled

## 8. Create Specific URL Exceptions

If you have control of your security software, add exceptions for:
- https://en.mindspeller.com
- https://nl.mindspeller.com

## 9. Contact IT Support

If you're in a corporate environment with strict security policies, you might need IT support to:
- Whitelist the application
- Allow outgoing connections to the required URLs
- Update root certificates
- Grant necessary permissions

## Still Having Issues?

Please send the `diagnostic_results.txt` file to the app developer for further assistance.
