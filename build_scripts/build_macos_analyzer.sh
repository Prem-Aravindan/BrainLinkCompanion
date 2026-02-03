#!/bin/bash
# macOS Build Script for MindLink Analyzer
# This script packages the application into a macOS .app bundle

set -e  # Exit on error

echo "=================================="
echo "MindLink Analyzer - macOS Build"
echo "=================================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    exit 1
fi

# Check if PyInstaller is installed
if ! python3 -m PyInstaller --version &> /dev/null; then
    echo "Error: PyInstaller is not installed"
    echo "Install it with: pip3 install pyinstaller"
    exit 1
fi

# Clean previous builds
echo ""
echo "Cleaning previous builds..."
rm -rf build dist

# Run PyInstaller
echo ""
echo "Building macOS application bundle..."
python3 -m PyInstaller --clean --noconfirm BrainLinkAnalyzer_macOS.spec

# Check if build was successful
if [ -d "dist/MindLinkAnalyzer.app" ]; then
    echo ""
    echo "=================================="
    echo "Build completed successfully!"
    echo "=================================="
    echo ""
    echo "Application bundle: dist/MindLinkAnalyzer.app"
    echo ""
    echo "To run the application:"
    echo "  open dist/MindLinkAnalyzer.app"
    echo ""
    echo "To create a DMG installer (optional):"
    echo "  hdiutil create -volname MindLinkAnalyzer -srcfolder dist/MindLinkAnalyzer.app -ov -format UDZO MindLinkAnalyzer.dmg"
else
    echo ""
    echo "Build failed! Check the error messages above."
    exit 1
fi
