# Deploy Enhanced BrainLink App to Pixel 9 Pro
# Enhanced SDK Implementation with Service Ready Events and Retry Logic

Write-Host "🚀 Deploying Enhanced BrainLink App..." -ForegroundColor Green
Write-Host "📱 Target: Pixel 9 Pro (Real Device)" -ForegroundColor Cyan
Write-Host "🔧 Features: Enhanced MacrotellectLink SDK with service initialization" -ForegroundColor Yellow
Write-Host "⏰ Time: $(Get-Date)" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Magenta

# APK Location
$APK_PATH = "android\app\build\outputs\apk\debug\app-debug.apk"

# Check if APK exists
if (-not (Test-Path $APK_PATH)) {
    Write-Host "❌ APK not found at $APK_PATH" -ForegroundColor Red
    Write-Host "🔧 Building APK first..." -ForegroundColor Yellow
    Set-Location android
    .\gradlew assembleDebug
    Set-Location ..
}

Write-Host "📦 APK found: $APK_PATH" -ForegroundColor Green
$apkSize = (Get-Item $APK_PATH).Length / 1MB
Write-Host "📊 APK size: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Gray

# Installation options
Write-Host ""
Write-Host "🔧 Installation Options:" -ForegroundColor Yellow
Write-Host "1. Manual Installation (recommended for Pixel 9 Pro)" -ForegroundColor White
Write-Host "2. ADB Installation (if ADB in PATH)" -ForegroundColor White
Write-Host "3. Wireless Debugging" -ForegroundColor White

Write-Host ""
Write-Host "📋 Manual Installation Steps:" -ForegroundColor Cyan
Write-Host "1. Copy APK to device: $APK_PATH" -ForegroundColor White
Write-Host "2. On Pixel 9 Pro: Open file manager" -ForegroundColor White
Write-Host "3. Navigate to Downloads/APK location" -ForegroundColor White
Write-Host "4. Tap app-debug.apk" -ForegroundColor White
Write-Host "5. Allow 'Install unknown apps' if prompted" -ForegroundColor White
Write-Host "6. Install the app" -ForegroundColor White

Write-Host ""
Write-Host "🧪 After Installation - Run Tests:" -ForegroundColor Yellow
Write-Host "1. Open the app" -ForegroundColor White
Write-Host "2. Check Metro logs for enhanced SDK initialization" -ForegroundColor White
Write-Host "3. Look for 'Service ready event' messages" -ForegroundColor White
Write-Host "4. Test BrainLink device scanning" -ForegroundColor White
Write-Host "5. Verify retry logic and DirectBLE fallback" -ForegroundColor White

Write-Host ""
Write-Host "🔍 Key Log Messages to Watch For:" -ForegroundColor Cyan
Write-Host "- 'Early MacrotellectLink SDK initialization...'" -ForegroundColor Gray
Write-Host "- 'MacrotellectLink SDK service ready'" -ForegroundColor Gray
Write-Host "- 'Scan attempt X/5...'" -ForegroundColor Gray
Write-Host "- 'Service ready event received'" -ForegroundColor Gray
Write-Host "- 'Switching to direct BLE scanning...'" -ForegroundColor Gray

Write-Host ""
Write-Host "✅ Deployment script ready!" -ForegroundColor Green
Write-Host "📱 APK: $APK_PATH" -ForegroundColor Cyan
Write-Host "🎯 Ready for testing enhanced SDK implementation!" -ForegroundColor Magenta

# Optional: Try to open the APK location
if (Test-Path $APK_PATH) {
    Write-Host ""
    Write-Host "🔧 Opening APK location..." -ForegroundColor Yellow
    Start-Process "explorer.exe" -ArgumentList "/select,`"$(Resolve-Path $APK_PATH)`""
}
