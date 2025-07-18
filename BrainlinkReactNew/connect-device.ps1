# Script to help connect React Native app to Metro server
Write-Host "Setting up connection to Metro server..."

# Check if Metro server is running
$metroRunning = netstat -an | findstr ":8081"
if ($metroRunning) {
    Write-Host "Metro server is running on port 8081"
} else {
    Write-Host "Metro server is not running"
    exit 1
}

# Instructions for manual connection
Write-Host "Manual connection steps:"
Write-Host "1. Open the BrainLinkCompanion app on your device"
Write-Host "2. Shake the device or press the menu button"
Write-Host "3. Select 'Dev Settings'"
Write-Host "4. Select 'Debug server host & port for device'"
Write-Host "5. Enter: 10.0.2.2:8081 (for emulator) or your-computer-ip:8081 (for physical device)"
Write-Host "6. Go back and select 'Reload'"

# Get computer IP for physical device
$computerIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" | Where-Object {$_.IPAddress -notlike "127.*"}).IPAddress
Write-Host "Your computer IP address: $computerIp"
Write-Host "For physical device, use: ${computerIp}:8081"

# Try to establish connection using netsh (Windows port forwarding)
Write-Host "Attempting to set up port forwarding..."
try {
    netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=127.0.0.1
    Write-Host "Port forwarding set up successfully"
} catch {
    Write-Host "Port forwarding setup failed (might need admin rights)"
}

Write-Host "Metro server should now be accessible from your device"
Write-Host "Check Metro server logs for connection attempts"
