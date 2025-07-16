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

log "🔍 Running quick pre-build validation..."

# Essential checks for CI/CD
CHECKS_PASSED=0
TOTAL_CHECKS=0

check() {
    local description="$1"
    local command="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log "Checking: $description"
    
    if eval "$command" &> /dev/null; then
        success "✓ $description"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        return 0
    else
        error "✗ $description"
        return 1
    fi
}

# Run essential checks (failures will exit)
check "Node.js available" "command -v node" || exit 1
check "npm available" "command -v npm" || exit 1
check "package.json exists" "[ -f package.json ]" || exit 1
check "node_modules exists" "[ -d node_modules ]" || exit 1
check "Fix scripts exist" "[ -f fix-expo-config.js ] && [ -f fix-kotlin-issues.js ] && [ -f fix-cpp20-issues.js ] && [ -f fix-android-resources.js ]" || exit 1

# Optional checks (warnings only)
if ! check "Expo CLI available" "command -v expo"; then
    warn "Expo CLI not found globally, will use npx expo"
fi

if ! check "Java available" "command -v java"; then
    warn "Java not found, Android builds may fail"
fi

if ! check "Git repository" "[ -d .git ]"; then
    warn "Not a git repository"
fi

# Network check
if ! check "Network connectivity" "ping -c 1 google.com"; then
    warn "Network connectivity issues detected"
fi

# Summary
log "📊 Quick validation summary:"
log "   Essential checks: All passed ✅"
success "✅ Ready for build process"
