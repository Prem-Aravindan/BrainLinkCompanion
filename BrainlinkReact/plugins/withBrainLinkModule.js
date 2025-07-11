/**
 * Expo Config Plugin for BrainLink Native Module
 * This plugin ensures the BrainLink native module is properly integrated with Expo builds
 */

const { withPlugins, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withBrainLinkModule(config) {
  return withPlugins(config, [
    // Add any required configurations
    withBrainLinkModuleConfig
  ]);
}

function withBrainLinkModuleConfig(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      // Add the JAR dependency to app/build.gradle
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        'app/build.gradle'
      );

      if (fs.existsSync(buildGradlePath)) {
        let content = fs.readFileSync(buildGradlePath, 'utf8');
        
        // Add MacrotellectLink JAR dependency if not already present
        if (!content.includes('MacrotellectLink_V1.4.3.jar')) {
          content = content.replace(
            /dependencies\s*\{/,
            `dependencies {
    implementation files('libs/MacrotellectLink_V1.4.3.jar')`
          );
          fs.writeFileSync(buildGradlePath, content);
        }
      }

      // Add the native module to MainApplication.java
      const mainApplicationPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java/com/mindspellerbv/brainlinkreact/MainApplication.java'
      );

      if (fs.existsSync(mainApplicationPath)) {
        let content = fs.readFileSync(mainApplicationPath, 'utf8');
        
        // Add import for BrainLinkPackage if not already present
        if (!content.includes('import com.brainlinkcompanion.BrainLinkPackage;')) {
          content = content.replace(
            /import com\.facebook\.react\.ReactApplication;/,
            `import com.facebook.react.ReactApplication;\nimport com.brainlinkcompanion.BrainLinkPackage;`
          );
        }
        
        // Add BrainLinkPackage to the packages list if not already present
        if (!content.includes('new BrainLinkPackage()')) {
          content = content.replace(
            /packages\.add\(new MainReactPackage\(\)\);/,
            `packages.add(new MainReactPackage());\n          packages.add(new BrainLinkPackage());`
          );
        }
        
        fs.writeFileSync(mainApplicationPath, content);
      } else {
        console.log('MainApplication.java not found, it will be created during build');
      }
      
      return config;
    },
  ]);
}

module.exports = withBrainLinkModule;
