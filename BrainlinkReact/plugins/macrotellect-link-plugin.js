const { withAndroidManifest, withMainApplication } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Expo Config Plugin for MacrotellectLink SDK V1.4.3
 * 
 * This plugin:
 * 1. Adds the MacrotellectLink JAR to the Android project
 * 2. Configures Android manifest permissions
 * 3. Sets up the native module bridge
 */

function withMacrotellectLink(config) {
  // Add Android manifest permissions
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    // Ensure uses-permission elements exist
    if (!androidManifest.manifest["uses-permission"]) {
      androidManifest.manifest["uses-permission"] = [];
    }
    
    const permissions = [
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN", 
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_ADVERTISE"
    ];
    
    permissions.forEach(permission => {
      const exists = androidManifest.manifest["uses-permission"].some(
        p => p.$["android:name"] === permission
      );
      
      if (!exists) {
        androidManifest.manifest["uses-permission"].push({
          $: { "android:name": permission }
        });
      }
    });
    
    return config;
  });
  
  // Add native module setup
  config = withMainApplication(config, (config) => {
    const mainApplication = config.modResults;
    
    // Add import for the native module
    const importLine = "import com.macrotellectlink.BrainLinkPackage;";
    if (!mainApplication.contents.includes(importLine)) {
      mainApplication.contents = mainApplication.contents.replace(
        /import com\.facebook\.react\.ReactApplication;/,
        `import com.facebook.react.ReactApplication;\n${importLine}`
      );
    }
    
    // Add package to the packages list
    const packageLine = "new BrainLinkPackage()";
    if (!mainApplication.contents.includes(packageLine)) {
      mainApplication.contents = mainApplication.contents.replace(
        /new MainReactPackage\(\)/,
        `new MainReactPackage(),\n            ${packageLine}`
      );
    }
    
    return config;
  });
  
  return config;
}

module.exports = withMacrotellectLink;
