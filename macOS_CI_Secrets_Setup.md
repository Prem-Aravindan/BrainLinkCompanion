# Setting Up Apple Developer Credentials for macOS Codesigning & Notarization in GitHub Actions

This guide explains how to generate, encode, and add your Apple Developer ID certificate and API key as GitHub secrets for automated codesigning and notarization of the BrainCompanion macOS app in CI.

---

## 1. Prerequisites
- An active Apple Developer account with access to Certificates, Identifiers & Profiles.
- Access to your GitHub repository (admin rights to add secrets).

---

## 2. Generate & Export Your Apple Developer ID Certificate

1. **Create a Developer ID Application certificate** in the Apple Developer portal (https://developer.apple.com/account/resources/certificates/list).
   - Type: "Developer ID Application"
   - Download the `.cer` file.
2. **Export the certificate and private key as a .p12 file**:
   - Open Keychain Access on your Mac.
   - Find your "Developer ID Application" certificate.
   - Right-click > Export. Choose `.p12` format. Set a strong password (e.g., `apple-cert-password`).
   - Save as `developer_id.p12`.

---

## 3. Generate an App-Specific Password (for notarization)

1. Go to https://appleid.apple.com/account/manage.
2. Under "App-Specific Passwords", generate a new password. Save it securely.

---

## 4. Create an App Store Connect API Key (for notarytool, recommended)

1. Go to https://appstoreconnect.apple.com/access/api.
2. Click "+" to create a new API key.
   - Download the `.p8` key file (e.g., `AuthKey_XXXXXXXXXX.p8`).
   - Note the **Issuer ID** and **Key ID** shown in the portal.

---

## 5. Encode Files for GitHub Secrets

GitHub secrets must be text. Encode binary files as base64:

### On macOS/Linux:
```sh
base64 -i developer_id.p12 | pbcopy  # Copies base64 to clipboard
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy
```

### On Windows (PowerShell):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('developer_id.p12')) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes('AuthKey_XXXXXXXXXX.p8')) | Set-Clipboard
```

---

## 6. Add GitHub Secrets

In your GitHub repository, go to **Settings > Secrets and variables > Actions** and add the following secrets:

| Secret Name                | Value (what to paste)                |
|----------------------------|--------------------------------------|
| APPLE_DEV_ID_P12           | (base64 of developer_id.p12)         |
| APPLE_DEV_ID_P12_PASSWORD  | (password you set for .p12)          |
| APPLE_API_KEY              | (base64 of AuthKey_XXXXXXXXXX.p8)    |
| APPLE_API_KEY_ID           | (Key ID from App Store Connect)      |
| APPLE_API_ISSUER_ID        | (Issuer ID from App Store Connect)   |
| APPLE_TEAM_ID              | (Your Apple Developer Team ID)       |

*If using app-specific password for legacy notarization, add:*
- `APPLE_ID` (your Apple ID email)
- `APPLE_APP_SPECIFIC_PASSWORD` (the app-specific password)

---

## 7. Update Workflow Placeholders

Ensure your `.github/workflows/main.yml` uses the above secret names. If not, update the workflow or secret names to match.

---

## 8. Troubleshooting
- If notarization fails, check that all secrets are correct and not expired.
- Make sure the .p12 password is correct and matches the exported file.
- For more details, see the Apple documentation:
  - [Exporting Certificates](https://developer.apple.com/documentation/security/distributing_apps_using_your_developer_id)
  - [App Store Connect API Keys](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)

---

## 9. Security
- Never commit your certificate, private key, or API key to the repository.
- Only store them as encrypted GitHub secrets.

---

## 10. After Setup
- Push a commit or trigger the workflow to test codesigning and notarization.
- Download the `.app` artifact and verify it runs on a clean macOS system without Gatekeeper warnings.

---

*This file: `macOS_CI_Secrets_Setup.md`*
