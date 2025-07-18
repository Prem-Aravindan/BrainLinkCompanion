#!/bin/bash

echo "🔧 Post-prebuild fixes starting..."

# Directory paths
ANDROID_DIR="android"
APP_BUILD_GRADLE="$ANDROID_DIR/app/build.gradle"
SETTINGS_GRADLE="$ANDROID_DIR/settings.gradle"
BUILD_GRADLE="$ANDROID_DIR/build.gradle"

# Create backup function
backup_file() {
    local file=$1
    if [ -f "$file" ]; then
        cp "$file" "$file.prebuild.backup"
        echo "✅ Backed up $file"
    fi
}

# Restore function for emergencies
restore_file() {
    local file=$1
    if [ -f "$file.prebuild.backup" ]; then
        cp "$file.prebuild.backup" "$file"
        echo "🔄 Restored $file from backup"
    fi
}

# Fix app/build.gradle
fix_app_build_gradle() {
    echo "🔨 Fixing app/build.gradle..."
    
    # Remove duplicate project dependencies and fix JVM target
    cat > "$APP_BUILD_GRADLE" << 'EOF'
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"

def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

def enableProguardInReleaseBuilds = (findProperty('android.enableProguardInReleaseBuilds') ?: false).toBoolean()
def jscFlavor = 'io.github.react-native-community:jsc-android:2026004.+'

android {
    ndkVersion "25.1.8937393"
    buildToolsVersion "35.0.0"
    compileSdk 35

    namespace 'com.mindspellerbv.BrainlinkReact'
    defaultConfig {
        applicationId 'com.mindspellerbv.BrainlinkReact'
        minSdkVersion 24
        targetSdkVersion 35
        versionCode 1
        versionName "1.0.0"
    }
    
    buildFeatures {
        buildConfig true
    }
    
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
            buildConfigField("boolean", "IS_NEW_ARCHITECTURE_ENABLED", "false")
            buildConfigField("boolean", "IS_HERMES_ENABLED", "false")
        }
        release {
            signingConfig signingConfigs.debug
            shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
            minifyEnabled enableProguardInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
            crunchPngs (findProperty('android.enablePngCrunchInReleaseBuilds')?.toBoolean() ?: true)
            buildConfigField("boolean", "IS_NEW_ARCHITECTURE_ENABLED", "false")
            buildConfigField("boolean", "IS_HERMES_ENABLED", "false")
        }
    }
    
    packagingOptions {
        jniLibs {
            useLegacyPackaging (findProperty('expo.useLegacyPackaging')?.toBoolean() ?: false)
        }
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    implementation fileTree(dir: "libs", include: ["*.jar"])
    implementation("com.facebook.react:react-android:0.79.5")
    implementation jscFlavor
}

apply from: new File(["node", "--print", "require.resolve('expo/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/scripts/autolinking.gradle"
EOF

    echo "✅ Fixed app/build.gradle"
}

# Fix settings.gradle
fix_settings_gradle() {
    echo "🔨 Fixing settings.gradle..."
    
    cat > "$SETTINGS_GRADLE" << 'EOF'
pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

rootProject.name = 'BrainlinkReact'

include ':app'
project(':app').projectDir = new File(rootDir, 'app')

apply from: new File(["node", "--print", "require.resolve('expo/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/scripts/autolinking.gradle"
EOF

    echo "✅ Fixed settings.gradle"
}

# Fix build.gradle
fix_build_gradle() {
    echo "🔨 Fixing build.gradle..."
    
    cat > "$BUILD_GRADLE" << 'EOF'
buildscript {
    ext {
        buildToolsVersion = "35.0.0"
        minSdkVersion = 24
        compileSdkVersion = 35
        targetSdkVersion = 35
        ndkVersion = "25.1.8937393"
        kotlinVersion = "1.9.24"
        frescoVersion = "2.5.0"
    }
    repositories {
        google()
        mavenCentral()
        maven { url "https://www.jitpack.io" }
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.5.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url "https://www.jitpack.io" }
    }
}
EOF

    echo "✅ Fixed build.gradle"
}

# Main execution
echo "🚀 Starting post-prebuild fixes..."

# Create backups
backup_file "$APP_BUILD_GRADLE"
backup_file "$SETTINGS_GRADLE"
backup_file "$BUILD_GRADLE"

# Apply fixes
fix_app_build_gradle
fix_settings_gradle
fix_build_gradle

# Update gradle.properties
echo "🔨 Updating gradle.properties..."
if ! grep -q "android.suppressUnsupportedCompileSdk=35" "$ANDROID_DIR/gradle.properties"; then
    echo "android.suppressUnsupportedCompileSdk=35" >> "$ANDROID_DIR/gradle.properties"
fi

echo "✅ All post-prebuild fixes applied!"
echo "🎉 Ready for gradle build!"
