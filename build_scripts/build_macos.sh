#!/bin/bash
# macOS build script for BrainCompanion

echo "Building BrainCompanion App for macOS with PyInstaller..."

# Clean up previous builds
if [ -d "./dist" ]; then
    echo "Cleaning previous dist folder..."
    rm -rf ./dist
fi
if [ -d "./build" ]; then
    echo "Cleaning previous build folder..."
    rm -rf ./build
fi

# Create version info file (this is used by the pyinstaller spec)
echo "Creating application version info..."

# Run PyInstaller
echo "Running PyInstaller with macOS configuration..."
pyinstaller BrainCompanion_macOS.spec

echo "Build complete! Application is in the dist folder."
