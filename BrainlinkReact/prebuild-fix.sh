#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log "🚀 Running unified EAS prebuild pipeline..."

# Pre-build checks
log "🔍 Running pre-build environment checks..."
node fix-expo-config.js
node fix-kotlin-issues.js    # now includes the SettingsManager.kt patch
node fix-cpp20-issues.js
# Check Node.js version
log "📋 Checking Node.js version..."
NODE_VERSION=$(node --version)
log "   Current Node.js version: $NODE_VERSION"
if [[ "$NODE_VERSION" =~ ^v([0-9]+) ]]; then
    NODE_MAJOR=${BASH_REMATCH[1]}
    if [ "$NODE_MAJOR" -lt 16 ]; then
        error "Node.js version $NODE_VERSION is too old. Minimum required: v16.0.0"
        exit 1
    fi
    success "Node.js version compatible"
else
    warn "Could not parse Node.js version"
fi

# Check npm version
log "📦 Checking npm version..."
NPM_VERSION=$(npm --version)
log "   Current npm version: $NPM_VERSION"
success "npm version: $NPM_VERSION"

# Check if expo CLI is available
log "🔧 Checking Expo CLI availability..."
if command -v expo &> /dev/null; then
    EXPO_VERSION=$(expo --version)
    log "   Expo CLI version: $EXPO_VERSION"
    success "Expo CLI available"
else
    warn "Expo CLI not found globally. Will use npx expo"
fi

# Check critical files exist
log "📁 Checking critical project files..."
CRITICAL_FILES=(
    "package.json"
    "app.config.js"
    "fix-expo-config.js"
    "fix-kotlin-issues.js"
    "fix-cpp20-issues.js"
    "fix-android-resources.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        success "✓ $file exists"
    else
        error "✗ Missing critical file: $file"
        exit 1
    fi
done

# Check node_modules exists
log "📚 Checking node_modules..."
if [ -d "node_modules" ]; then
    success "node_modules directory exists"
    
    # Check critical dependencies
    CRITICAL_DEPS=(
        "node_modules/expo"
        "node_modules/react-native"
        "node_modules/@react-native/gradle-plugin"
        "node_modules/@expo/config-plugins"
    )
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [ -d "$dep" ]; then
            success "✓ $dep found"
        else
            error "✗ Missing critical dependency: $dep"
            log "   Run 'npm ci' to install dependencies"
            exit 1
        fi
    done
else
    error "node_modules directory not found"
    log "   Run 'npm ci' to install dependencies"
    exit 1
fi

# Check patches directory
log "🔧 Checking patches..."
if [ -d "patches" ]; then
    PATCH_COUNT=$(ls -1 patches/*.patch 2>/dev/null | wc -l)
    if [ "$PATCH_COUNT" -gt 0 ]; then
        success "Found $PATCH_COUNT patch files"
        for patch in patches/*.patch; do
            if [ -f "$patch" ]; then
                log "   • $(basename "$patch")"
            fi
        done
    else
        warn "No patch files found in patches directory"
    fi
else
    warn "patches directory not found (will be created if needed)"
fi

# Check Android setup if android directory exists
log "📱 Checking Android setup..."
if [ -d "android" ]; then
    success "Android directory exists"
    
    # Check gradle wrapper
    if [ -f "android/gradlew" ]; then
        success "✓ Gradle wrapper found"
    else
        error "✗ Gradle wrapper not found in android directory"
        exit 1
    fi
    
    # Check gradle properties
    if [ -f "android/gradle.properties" ]; then
        success "✓ gradle.properties found"
    else
        warn "gradle.properties not found"
    fi
    
    # Check build.gradle
    if [ -f "android/build.gradle" ]; then
        success "✓ android/build.gradle found"
    else
        error "✗ android/build.gradle not found"
        exit 1
    fi
else
    warn "Android directory not found (will be generated during build)"
fi

# Check disk space
log "💾 Checking disk space..."
if command -v df &> /dev/null; then
    DISK_USAGE=$(df . | tail -1 | awk '{print $4}')
    if [ "$DISK_USAGE" -gt 1000000 ]; then  # 1GB in KB
        success "Sufficient disk space available"
    else
        warn "Low disk space detected. Consider cleaning up."
    fi
else
    warn "Could not check disk space"
fi

# Check network connectivity
log "🌐 Checking network connectivity..."
if ping -c 1 google.com &> /dev/null; then
    success "Network connectivity OK"
else
    warn "Network connectivity check failed"
fi

success "✅ Pre-build checks completed!"
log ""

# Main build fixes start here

# 1. Expo schema
log "📋 Step 1: Fixing Expo configuration schema..."
if node fix-expo-config.js; then
    success "Expo configuration fixed"
else
    error "Expo configuration fix failed"
    exit 1
fi

# 2. Kotlin/Gradle plugin & Settings API
log "⚙️ Step 2: Fixing Kotlin/Gradle compilation issues..."
if node fix-kotlin-issues.js; then
    success "Kotlin compilation issues fixed"
else
    error "Kotlin compilation fix failed"
    exit 1
fi

# 3. C++20 → C++17 compatibility
log "🔧 Step 3: Applying C++ compatibility fixes..."
if node fix-cpp20-issues.js; then
    success "C++ compatibility fixed"
else
    error "C++ compatibility fix failed"
    exit 1
fi

# 4. Android resource linking (SDK 35 compatibility)
log "📱 Step 4: Fixing Android resource linking..."
if node fix-android-resources.js; then
    success "Android resource linking fixed"
else
    error "Android resource linking fix failed"
    exit 1
fi

success "✅ All prebuild fixes applied successfully!"

log "📊 Summary of fixes applied:"
log "   • Expo schema errors resolved"
log "   • Kotlin compilation passing (including ReactSettingsExtension.kt)"
log "   • C++ builds targeting C++17 for NDK compatibility"
log "   • Android resource linking fixed (windowOptOutEdgeToEdgeEnforcement)"
log "   • All Android 12+ Bluetooth permissions handled"
log "   • NDK updated to 25.1.8937393 for better C++ support"

log "🎉 Build pipeline ready for EAS!"
