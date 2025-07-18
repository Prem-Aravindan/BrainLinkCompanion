#!/bin/bash
# Deploy Enhanced BrainLink App to Pixel 9 Pro
# Enhanced SDK Implementation with Service Ready Events and Retry Logic

echo "🚀 Deploying Enhanced BrainLink App..."
echo "📱 Target: Pixel 9 Pro (Real Device)"
echo "🔧 Features: Enhanced MacrotellectLink SDK with service initialization"
echo "⏰ Time: $(date)"
echo "============================================================"

# APK Location
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

# Check if APK exists
if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK not found at $APK_PATH"
    echo "🔧 Building APK first..."
    cd android
    ./gradlew assembleDebug
    cd ..
fi

echo "📦 APK found: $APK_PATH"
echo "📊 APK size: $(du -h "$APK_PATH" | cut -f1)"

# Installation options
echo ""
echo "🔧 Installation Options:"
echo "1. Manual Installation (recommended for Pixel 9 Pro)"
echo "2. ADB Installation (if ADB in PATH)"
echo "3. Wireless Debugging"

echo ""
echo "📋 Manual Installation Steps:"
echo "1. Copy APK to device: $APK_PATH"
echo "2. On Pixel 9 Pro: Open file manager"
echo "3. Navigate to Downloads/APK location"
echo "4. Tap app-debug.apk"
echo "5. Allow 'Install unknown apps' if prompted"
echo "6. Install the app"

echo ""
echo "🧪 After Installation - Run Tests:"
echo "1. Open the app"
echo "2. Check Metro logs for enhanced SDK initialization"
echo "3. Look for 'Service ready event' messages"
echo "4. Test BrainLink device scanning"
echo "5. Verify retry logic and DirectBLE fallback"

echo ""
echo "🔍 Key Log Messages to Watch For:"
echo "- '🔥 Early MacrotellectLink SDK initialization...'"
echo "- '🔥 MacrotellectLink SDK service ready'"
echo "- '🔍 Scan attempt X/5...'"
echo "- '✅ Service ready event received'"
echo "- '🔄 Switching to direct BLE scanning...'"

echo ""
echo "✅ Deployment script ready!"
echo "📱 APK: $APK_PATH"
echo "🎯 Ready for testing enhanced SDK implementation!"
