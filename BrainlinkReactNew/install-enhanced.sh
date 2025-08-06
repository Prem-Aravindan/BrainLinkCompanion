#!/bin/bash

# 🚀 Quick Install Enhanced BrainLink App
# This script installs the newly built APK with enhanced post-reload connection handling

echo "🔧 Installing Enhanced BrainLink App..."
echo "📱 Target: Connected Android Device"
echo "⏰ Time: $(date)"
echo "============================================================"

# Navigate to Android build output
cd "android/app/build/outputs/apk/debug"

# Check if APK exists
if [ -f "app-debug.apk" ]; then
    echo "✅ Found APK: app-debug.apk"
    
    # Install APK
    echo "📲 Installing APK to device..."
    adb install -r app-debug.apk
    
    if [ $? -eq 0 ]; then
        echo "✅ Installation successful!"
        echo "🎯 Enhanced Features Installed:"
        echo "   • Multi-layer post-reload detection"
        echo "   • Connection state restoration"
        echo "   • Enhanced BLE recovery (3s timeout)"
        echo "   • Manual BLE reset functionality"
        echo "   • Visual post-reload mode indicator"
        echo ""
        echo "📖 See POST_RELOAD_CONNECTION_TEST_GUIDE.md for testing instructions"
        echo ""
        echo "🔗 Launch app and check for 'Post-Reload Mode' indicator in debug panel"
    else
        echo "❌ Installation failed"
        echo "🔧 Try: adb devices (check device connection)"
    fi
else
    echo "❌ APK not found"
    echo "🔧 Run: ./gradlew assembleDebug first"
fi

echo "============================================================"
