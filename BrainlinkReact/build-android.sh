#!/bin/bash
# Build script for BrainLink React Native App

echo "🔧 Building BrainLink React Native App..."
echo "📱 Platform: Android"
echo "🏗️  Profile: Development (with Bluetooth support)"
echo ""

# Check EAS CLI
echo "Checking EAS CLI..."
eas --version

echo ""
echo "Starting build..."
eas build --platform android --profile development

echo ""
echo "✅ Build command completed!"
echo "📦 Check your EAS dashboard for build status: https://expo.dev/accounts/premjpa/projects/BrainlinkReact/builds"
