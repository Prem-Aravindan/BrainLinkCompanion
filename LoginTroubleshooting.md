# BrainLink Companion App - Login Issue Resolution

Based on your diagnostic results, the issue appears to be with **authentication**, not with network security blocks. Your app is able to connect to the server, but the login credentials are being rejected.

## Immediate Solutions:

### 1. Verify Credentials

The 401 "Bad username or password" error means the server is rejecting your login:

- Double-check your username and password for typos
- Ensure you're using the correct username format (email address vs. username)
- Check if you need to reset your password
- Verify the account is active and not locked

### 2. Try Using Saved Credentials

If the app worked on another computer with the same credentials:

1. On the working computer, enable the "Remember Me" option during login
2. Locate the saved credentials file (QSettings):
   - Windows: In Registry at `HKEY_CURRENT_USER\Software\MyCompany\BrainLinkApp`
   - Or copy the entire app folder from the working computer

### 3. Contact Your Account Administrator

If you're using a corporate account:
- Your account might need to be activated for API access
- There might be user permission issues
- The account might be limited to specific environments

### 4. Try a Different Environment

In the app:
1. Select a different environment (EN/NL/Local)
2. The diagnostic shows you tried both EN and NL environments - both gave the same error

## Advanced Troubleshooting:

### For API/Login Format Issues:

Your diagnostic shows the server returned different errors for different login formats:
- JSON format: 401 Bad username/password (authentication issue)
- Form data: 500 Internal Server Error (server processing issue)

This suggests the server expects the JSON format, but there might be additional requirements.

### For Developers:

If you have access to the API documentation, verify:
- The correct login endpoint URL
- Required request headers beyond Content-Type
- The exact JSON structure expected
- Any required tokens or API keys

## Further Assistance:

If you continue having issues:
1. Provide your username (not password) to the app developer
2. Ask if there's a test account you can use
3. Check if there are any special requirements for your organization's accounts

Remember: The network connection is working fine - it's specifically the authentication that's failing.
