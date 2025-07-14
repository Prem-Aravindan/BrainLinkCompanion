const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Expo Config Plugin for MacrotellectLink SDK
 * 
 * This plugin:
 * 1. Copies MacrotellectLink_V1.4.3.jar to android/app/libs/
 * 2. Adds the JAR dependency to build.gradle using fileTree
 * 3. Copies BrainLinkModule.java to the correct location
 * 4. Registers the BrainLinkModule in MainApplication
 * 5. Adds required Bluetooth permissions to AndroidManifest.xml
 */

function withMacrotellectLink(config) {
  // Copy JAR file and Java module to android directories
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      
      // Look for JAR in assets directory
      const jarSourcePath = path.join(projectRoot, 'assets', 'MacrotellectLink_V1.4.3.jar');
      const targetLibsDir = path.join(platformProjectRoot, 'app', 'libs');
      const targetJarPath = path.join(targetLibsDir, 'MacrotellectLink_V1.4.3.jar');
      
      // Ensure libs directory exists
      if (!fs.existsSync(targetLibsDir)) {
        fs.mkdirSync(targetLibsDir, { recursive: true });
      }
      
      // Copy JAR file
      if (fs.existsSync(jarSourcePath)) {
        fs.copyFileSync(jarSourcePath, targetJarPath);
        console.log('✅ MacrotellectLink JAR copied to android/app/libs/');
      } else {
        console.warn('⚠️ MacrotellectLink JAR not found at:', jarSourcePath);
      }

      // Copy BrainLinkModule.java to the correct location
      const moduleSourcePath = path.join(projectRoot, 'native', 'BrainLinkModule.java');
      const moduleTargetDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'java', 'com', 'brainlinkreact');
      const moduleTargetPath = path.join(moduleTargetDir, 'BrainLinkModule.java');
      
      // Ensure module directory exists
      if (!fs.existsSync(moduleTargetDir)) {
        fs.mkdirSync(moduleTargetDir, { recursive: true });
      }
      
      // Copy module file
      if (fs.existsSync(moduleSourcePath)) {
        fs.copyFileSync(moduleSourcePath, moduleTargetPath);
        console.log('✅ BrainLinkModule.java copied to android project');
      } else {
        console.warn('⚠️ BrainLinkModule.java not found at:', moduleSourcePath);
      }
      
      return config;
    },
  ]);

  // Add JAR dependency to build.gradle using fileTree
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'build.gradle'
      );

      if (fs.existsSync(buildGradlePath)) {
        let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

        // Add fileTree dependency if not already present
        const fileTreeDependency = 'implementation fileTree(dir: "libs", include: ["*.jar"])';
        if (!buildGradleContent.includes(fileTreeDependency)) {
          const dependenciesMatch = buildGradleContent.match(/dependencies\s*\{/);
          if (dependenciesMatch) {
            const insertIndex = dependenciesMatch.index + dependenciesMatch[0].length;
            const jarDependency = `
    // MacrotellectLink SDK
    ${fileTreeDependency}`;
            
            buildGradleContent = 
              buildGradleContent.slice(0, insertIndex) +
              jarDependency +
              buildGradleContent.slice(insertIndex);

            fs.writeFileSync(buildGradlePath, buildGradleContent);
            console.log('✅ MacrotellectLink JAR dependency added to build.gradle');
          }
        }
      }

      return config;
    },
  ]);

  // Register BrainLinkModule in MainApplication.java
  config = withMainApplication(config, (config) => {
    const { modResults } = config;

    // Add import
    if (!modResults.contents.includes('import com.brainlinkreact.BrainLinkModule;')) {
      modResults.contents = modResults.contents.replace(
        /import com\.facebook\.react\.ReactApplication;/,
        `import com.facebook.react.ReactApplication;
import com.brainlinkreact.BrainLinkModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.uimanager.ViewManager;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;`
      );
    }

    // Add module to getPackages()
    if (!modResults.contents.includes('new BrainLinkModule')) {
      modResults.contents = modResults.contents.replace(
        /packages\.add\(new ModuleRegistryAdapter\(mModuleRegistryProvider\)\);/,
        `packages.add(new ModuleRegistryAdapter(mModuleRegistryProvider));
        packages.add(new ReactPackage() {
          @Override
          public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
            List<NativeModule> modules = new ArrayList<>();
            modules.add(new BrainLinkModule(reactContext));
            return modules;
          }

          @Override
          public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
            return Collections.emptyList();
          }
        });`
      );
    }

    console.log('✅ BrainLinkModule registered in MainApplication');
    return config;
  });

  // Add Bluetooth permissions to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;

    // Add required permissions for BLE and location
    const permissions = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
    ];

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    permissions.forEach((permission) => {
      const hasPermission = manifest['uses-permission'].some(
        (perm) => perm.$['android:name'] === permission
      );

      if (!hasPermission) {
        manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    console.log('✅ Bluetooth permissions added to AndroidManifest.xml');
    return config;
  });

  return config;
}

module.exports = withMacrotellectLink;
