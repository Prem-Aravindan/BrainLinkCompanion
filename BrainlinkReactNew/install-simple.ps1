# Quick Install Enhanced BrainLink App (PowerShell)
# This script installs the newly built APK with enhanced post-reload connection handling

Write-Host "Installing Enhanced BrainLink App..." -ForegroundColor Green
Write-Host "Target: Connected Android Device" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date)" -ForegroundColor Gray
Write-Host "============================================================"

# Set Android SDK path (common locations)
$AndroidSdkPaths = @(
    "$env:ANDROID_HOME\platform-tools",
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
    "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk\platform-tools"
)

$AdbPath = $null
foreach ($path in $AndroidSdkPaths) {
    if (Test-Path "$path\adb.exe") {
        $AdbPath = "$path\adb.exe"
        break
    }
}

if (-not $AdbPath) {
    Write-Host "ADB not found in common SDK locations" -ForegroundColor Red
    Write-Host "Please ensure Android SDK is installed and ANDROID_HOME is set" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found ADB: $AdbPath" -ForegroundColor Green

# Navigate to Android build output
$ApkPath = "android\app\build\outputs\apk\debug\app-debug.apk"

# Check if APK exists
if (Test-Path $ApkPath) {
    Write-Host "Found APK: $ApkPath" -ForegroundColor Green
    
    # Check device connection
    Write-Host "Checking device connection..." -ForegroundColor Yellow
    $DeviceCheck = & $AdbPath devices
    if ($DeviceCheck -match "device$") {
        Write-Host "Device connected" -ForegroundColor Green
        
        # Install APK
        Write-Host "Installing APK to device..." -ForegroundColor Yellow
        $InstallResult = & $AdbPath install -r $ApkPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Installation successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Enhanced Features Installed:" -ForegroundColor Cyan
            Write-Host "   • Multi-layer post-reload detection" -ForegroundColor White
            Write-Host "   • Connection state restoration" -ForegroundColor White
            Write-Host "   • Enhanced BLE recovery (3s timeout)" -ForegroundColor White
            Write-Host "   • Manual BLE reset functionality" -ForegroundColor White
            Write-Host "   • Visual post-reload mode indicator" -ForegroundColor White
            Write-Host ""
            Write-Host "See POST_RELOAD_CONNECTION_TEST_GUIDE.md for testing instructions" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Launch app and check for 'Post-Reload Mode' indicator in debug panel" -ForegroundColor Magenta
        } else {
            Write-Host "Installation failed" -ForegroundColor Red
            Write-Host "Error output: $InstallResult" -ForegroundColor Yellow
        }
    } else {
        Write-Host "No device connected" -ForegroundColor Red
        Write-Host "Connect device with USB debugging enabled" -ForegroundColor Yellow
        Write-Host "Available devices:" -ForegroundColor Gray
        Write-Host $DeviceCheck -ForegroundColor Gray
    }
} else {
    Write-Host "APK not found: $ApkPath" -ForegroundColor Red
    Write-Host "Build APK first with: cd android; .\gradlew.bat assembleDebug" -ForegroundColor Yellow
}

Write-Host "============================================================"
