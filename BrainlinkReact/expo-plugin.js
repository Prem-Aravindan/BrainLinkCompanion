const { withAppBuildGradle, withProjectBuildGradle, withSettingsGradle } = require('@expo/config-plugins');

const withCustomGradleConfig = (config) => {
  // Fix app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    
    // Remove duplicate dependencies and fix JVM target
    const cleanedGradle = buildGradle
      .replace(/apply plugin: ["']com\.facebook\.react\.rootproject["']/g, '')
      .replace(/apply plugin: ["']com\.facebook\.react\.settings["']/g, '')
      .replace(/implementation project\([^)]+\)/g, '') // Remove all expo project implementations
      .replace(/compileOptions\s*\{[^}]*\}/g, '') // Remove existing compile options
      .replace(/kotlinOptions\s*\{[^}]*\}/g, '') // Remove existing kotlin options
      .replace(/\}\s*$/, `    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    
    kotlinOptions {
        jvmTarget = '17'
    }
}

dependencies {
    // MacrotellectLink SDK
    implementation fileTree(dir: "libs", include: ["*.jar"])
    // React Native
    implementation("com.facebook.react:react-android:0.79.5")
    // JavaScript Engine
    implementation jscFlavor
}

// Apply Expo modules autolinking
apply from: new File(["node", "--print", "require.resolve('expo/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/scripts/autolinking.gradle"
`);

    config.modResults.contents = cleanedGradle;
    return config;
  });

  // Fix settings.gradle
  config = withSettingsGradle(config, (config) => {
    const settingsGradle = config.modResults.contents;
    
    // Ensure clean settings.gradle
    const cleanedSettings = `rootProject.name = 'BrainlinkReact'

include ':app'
project(':app').projectDir = new File(rootDir, 'app')

apply from: new File(["node", "--print", "require.resolve('expo/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/scripts/autolinking-settings.gradle"

pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url "https://www.jitpack.io" }
    }
}
`;

    config.modResults.contents = cleanedSettings;
    return config;
  });

  return config;
};

module.exports = withCustomGradleConfig;
