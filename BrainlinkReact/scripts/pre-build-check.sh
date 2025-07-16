#!/usr/bin/env bash
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

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log "🔍 Running comprehensive pre-build diagnostics..."

# System checks
log "🖥️ System Environment:"
info "   OS: $(uname -s)"
info "   Architecture: $(uname -m)"
info "   Shell: $SHELL"
info "   Working Directory: $(pwd)"

# Node.js ecosystem
log "📦 Node.js Ecosystem:"
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
info "   Node.js: $NODE_VERSION"
info "   npm: $NPM_VERSION"

# Check for version managers
if command -v nvm &> /dev/null; then
    info "   nvm: Available"
elif command -v fnm &> /dev/null; then
    info "   fnm: Available"
elif command -v n &> /dev/null; then
    info "   n: Available"
else
    info "   Node Version Manager: None detected"
fi

# Java environment (for Android builds)
log "☕ Java Environment:"
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1)
    info "   Java: $JAVA_VERSION"
    
    if [ -n "$JAVA_HOME" ]; then
        info "   JAVA_HOME: $JAVA_HOME"
    else
        warn "   JAVA_HOME not set"
    fi
else
    warn "   Java not found"
fi

# Android SDK (if available)
log "🤖 Android SDK:"
if [ -n "$ANDROID_HOME" ]; then
    info "   ANDROID_HOME: $ANDROID_HOME"
    if [ -d "$ANDROID_HOME" ]; then
        success "   Android SDK directory exists"
    else
        error "   Android SDK directory not found"
    fi
else
    warn "   ANDROID_HOME not set"
fi

# Project structure analysis
log "📁 Project Structure Analysis:"
info "   Project root: $(pwd)"

# Check package.json
if [ -f "package.json" ]; then
    success "   ✓ package.json found"
    
    # Extract key information
    PROJECT_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "unknown")
    PROJECT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    info "   Project: $PROJECT_NAME v$PROJECT_VERSION"
    
    # Check for main dependencies
    EXPO_VERSION=$(node -p "require('./package.json').dependencies.expo" 2>/dev/null || echo "not found")
    RN_VERSION=$(node -p "require('./package.json').dependencies['react-native']" 2>/dev/null || echo "not found")
    REACT_VERSION=$(node -p "require('./package.json').dependencies.react" 2>/dev/null || echo "not found")
    
    info "   Expo: $EXPO_VERSION"
    info "   React Native: $RN_VERSION"
    info "   React: $REACT_VERSION"
else
    error "   ✗ package.json not found"
    exit 1
fi

# Check app configuration
log "⚙️ App Configuration:"
if [ -f "app.config.js" ]; then
    success "   ✓ app.config.js found"
elif [ -f "app.json" ]; then
    success "   ✓ app.json found"
    warn "   Consider migrating to app.config.js for better flexibility"
else
    error "   ✗ No app configuration file found"
    exit 1
fi

# Check fix scripts
log "🔧 Fix Scripts:"
FIX_SCRIPTS=(
    "fix-expo-config.js"
    "fix-kotlin-issues.js"
    "fix-cpp20-issues.js"
    "fix-android-resources.js"
)

for script in "${FIX_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        success "   ✓ $script"
    else
        error "   ✗ $script missing"
        exit 1
    fi
done

# Dependencies analysis
log "📚 Dependencies Analysis:"
if [ -d "node_modules" ]; then
    success "   ✓ node_modules exists"
    
    # Check node_modules size
    if command -v du &> /dev/null; then
        NODE_MODULES_SIZE=$(du -sh node_modules | cut -f1)
        info "   Size: $NODE_MODULES_SIZE"
    fi
    
    # Check for critical dependencies
    CRITICAL_DEPS=(
        "expo"
        "react-native"
        "@react-native/gradle-plugin"
        "@expo/config-plugins"
        "patch-package"
    )
    
    for dep in "${CRITICAL_DEPS[@]}"; do
        if [ -d "node_modules/$dep" ]; then
            success "   ✓ $dep"
        else
            error "   ✗ $dep missing"
            exit 1
        fi
    done
else
    error "   ✗ node_modules not found"
    log "   Run 'npm ci' to install dependencies"
    exit 1
fi

# Patches analysis
log "🩹 Patches Analysis:"
if [ -d "patches" ]; then
    success "   ✓ patches directory exists"
    
    PATCH_FILES=($(ls patches/*.patch 2>/dev/null))
    if [ ${#PATCH_FILES[@]} -gt 0 ]; then
        success "   Found ${#PATCH_FILES[@]} patch files:"
        for patch in "${PATCH_FILES[@]}"; do
            PATCH_NAME=$(basename "$patch")
            PATCH_SIZE=$(wc -l < "$patch")
            info "     • $PATCH_NAME ($PATCH_SIZE lines)"
        done
    else
        warn "   No patch files found"
    fi
else
    warn "   patches directory not found"
fi

# Android project analysis
log "📱 Android Project Analysis:"
if [ -d "android" ]; then
    success "   ✓ android directory exists"
    
    # Check gradle wrapper
    if [ -f "android/gradlew" ]; then
        success "   ✓ Gradle wrapper found"
        
        # Check gradle version
        cd android
        GRADLE_VERSION=$(./gradlew --version | grep "Gradle" | head -1)
        info "   $GRADLE_VERSION"
        cd ..
    else
        error "   ✗ Gradle wrapper not found"
    fi
    
    # Check important Android files
    ANDROID_FILES=(
        "android/build.gradle"
        "android/gradle.properties"
        "android/settings.gradle"
        "android/app/build.gradle"
    )
    
    for file in "${ANDROID_FILES[@]}"; do
        if [ -f "$file" ]; then
            success "   ✓ $(basename "$file")"
        else
            warn "   ✗ $(basename "$file") not found"
        fi
    done
else
    warn "   android directory not found (will be generated during build)"
fi

# Git status
log "🔄 Git Status:"
if [ -d ".git" ]; then
    success "   ✓ Git repository detected"
    
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    info "   Current branch: $CURRENT_BRANCH"
    
    # Check for uncommitted changes
    if git diff --quiet 2>/dev/null; then
        success "   ✓ Working directory clean"
    else
        warn "   Working directory has uncommitted changes"
    fi
    
    # Check for untracked files
    UNTRACKED_COUNT=$(git ls-files --others --exclude-standard | wc -l)
    if [ "$UNTRACKED_COUNT" -gt 0 ]; then
        warn "   $UNTRACKED_COUNT untracked files"
    fi
else
    warn "   Not a git repository"
fi

# Network and connectivity
log "🌐 Network Connectivity:"
if ping -c 1 registry.npmjs.org &> /dev/null; then
    success "   ✓ npm registry accessible"
else
    error "   ✗ npm registry not accessible"
fi

if ping -c 1 github.com &> /dev/null; then
    success "   ✓ GitHub accessible"
else
    warn "   GitHub not accessible"
fi

# Disk space
log "💾 Disk Space:"
if command -v df &> /dev/null; then
    DISK_INFO=$(df -h . | tail -1)
    info "   $DISK_INFO"
    
    AVAILABLE_SPACE=$(echo $DISK_INFO | awk '{print $4}')
    info "   Available space: $AVAILABLE_SPACE"
else
    warn "   Could not check disk space"
fi

# Memory usage
log "🧠 Memory Usage:"
if command -v free &> /dev/null; then
    MEMORY_INFO=$(free -h | grep "Mem:")
    info "   $MEMORY_INFO"
elif command -v vm_stat &> /dev/null; then
    # macOS
    info "   macOS memory info available via vm_stat"
else
    warn "   Could not check memory usage"
fi

# Configuration validation
log "🔍 Configuration Validation:"

# Check for common issues
if [ -f "app.json" ] && [ -f "app.config.js" ]; then
    warn "   Both app.json and app.config.js found - potential conflict"
fi

# Check for package-lock.json
if [ -f "package-lock.json" ]; then
    success "   ✓ package-lock.json found (npm)"
elif [ -f "yarn.lock" ]; then
    success "   ✓ yarn.lock found (yarn)"
else
    warn "   No lock file found"
fi

# Final summary
log "📋 Diagnostic Summary:"
success "✅ Pre-build diagnostics completed"
log ""
log "🎯 Next steps:"
log "   1. Review any warnings or errors above"
log "   2. Run 'npm ci' if dependencies are missing"
log "   3. Run 'bash prebuild-fix.sh' to apply fixes"
log "   4. Run 'npm run validate-build' for full validation"
