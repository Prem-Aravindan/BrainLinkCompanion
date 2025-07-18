#!/bin/bash
set -e

echo "🚀 Running unified prebuild pipeline..."
node unified-gradle-fix.js

echo "🔄 Normalizing React plugin ID..."
# In-place replace any stray rootproject plugin ID
sed -i \
  -e 's/apply plugin: *"com.facebook.react.rootproject"/apply plugin: "com.facebook.react"/g' \
  -e 's/id("com.facebook.react.rootproject")/id("com.facebook.react")/g' \
  android/build.gradle android/app/build.gradle

echo "✅ All fixes applied."
echo "🔨 Ready for gradlew assembleDebug"
