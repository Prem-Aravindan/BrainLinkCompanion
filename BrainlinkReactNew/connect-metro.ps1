# Metro Connection Script for BrainLink App
# Ensures proper connection between device and Metro bundler

Write-Host "🔌 Connecting to Metro Bundler..." -ForegroundColor Green
Write-Host "📱 Device: Pixel 9 Pro" -ForegroundColor Cyan
Write-Host "⚡ Port: 8081" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Magenta

# Check if device is connected
Write-Host "📱 Checking device connection..." -ForegroundColor Yellow
$deviceCheck = C:\Users\conta\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
Write-Host $deviceCheck

if ($deviceCheck -match "device$") {
    Write-Host "✅ Device connected successfully!" -ForegroundColor Green
    
    # Set up port forwarding
    Write-Host "🔌 Setting up port forwarding..." -ForegroundColor Yellow
    $portResult = C:\Users\conta\AppData\Local\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
    Write-Host "Port forwarding result: $portResult" -ForegroundColor Gray
    
    # Check if Metro is running
    Write-Host "📡 Checking Metro status..." -ForegroundColor Yellow
    $metroCheck = netstat -ano | findstr ":8081.*LISTENING"
    if ($metroCheck) {
        Write-Host "✅ Metro is running on port 8081" -ForegroundColor Green
        Write-Host $metroCheck -ForegroundColor Gray
    } else {
        Write-Host "❌ Metro is not running! Please start Metro with: npx react-native start" -ForegroundColor Red
        exit 1
    }
    
    # Start or focus the app
    Write-Host "🚀 Starting BrainLink app..." -ForegroundColor Yellow
    $appResult = C:\Users\conta\AppData\Local\Android\Sdk\platform-tools\adb.exe shell am start -n com.brainlinkreactnew/com.brainlinkreactnew.MainActivity
    Write-Host $appResult -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "✅ Metro Connection Setup Complete!" -ForegroundColor Green
    Write-Host "📱 Your app should now be connected to Metro" -ForegroundColor Cyan
    Write-Host "🔄 To reload the app, press 'r' in the Metro terminal or shake the device" -ForegroundColor Yellow
    
} else {
    Write-Host "❌ No device connected! Please connect your Android device via USB" -ForegroundColor Red
    Write-Host "💡 Make sure USB debugging is enabled in Developer Options" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "🎯 Ready for development!" -ForegroundColor Magenta
