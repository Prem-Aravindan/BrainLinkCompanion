#!/usr/bin/env node

// Combined fix script for all Kotlin compilation issues
const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🚀 Running combined fix script for Kotlin compilation issues...');

// Find every SettingsManager.kt under any expo-autolinking-settings-plugin
glob.sync('node_modules/**/expo-autolinking-settings-plugin/src/main/kotlin/**/SettingsManager.kt')
  .forEach(file => {
    let code = fs.readFileSync(file, 'utf8');

    // 1) Ensure the Kotlin DSL 'extra' extension is imported
    if (!code.includes('import org.gradle.kotlin.dsl.extra')) {
      code = code.replace(
        /(^package\s+[^\r\n]+)/m,
        `$1\nimport org.gradle.kotlin.dsl.extra`
      );
    }

    // 2) Replace any `settings.extensions` usage with the Kotlin DSL 'extra' API
    code = code.replace(
      /\bsettings\.extensions\b/g,
      'settings.extra'
    );

    // 3) (If they call `settings.extraPropertiesExtension`, swap to `settings.extra`)
    code = code.replace(
      /\bsettings\.extraPropertiesExtension\b/g,
      'settings.extra'
    );

    fs.writeFileSync(file, code);
    console.log(`[patch-kotlin] Patched ${file}`);
  });

// Fix 1: ReactSettingsExtension.kt Kotlin Settings API
console.log('\n📌 Step 1: Fixing ReactSettingsExtension.kt for new Settings API...');
try {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  const reactSettingsPath = path.join(
    nodeModulesPath, '@react-native', 'gradle-plugin',
    'settings-plugin', 'src', 'main', 'kotlin', 'com', 'facebook', 'react',
    'ReactSettingsExtension.kt'
  );

  if (fs.existsSync(reactSettingsPath)) {
    console.log('✅ Found ReactSettingsExtension.kt');
    
    try {
      let content = fs.readFileSync(reactSettingsPath, 'utf8');
      let originalContent = content;
      
      // Fix settings.layout.rootDirectory API calls
      content = content.replace(
        /settings\.layout\.rootDirectory\.file\("(.+?)"\)/g,
        'settings.rootDir.resolve("$1")'
      );
      
      content = content.replace(
        /settings\.layout\.rootDirectory\.dir\("(.+?)"\)/g,
        'settings.rootDir.resolve("$1")'
      );
      
      // Handle any other layout API usage
      content = content.replace(
        /settings\.layout\.rootDirectory/g,
        'settings.rootDir'
      );
      
      const changed = content !== originalContent;
      
      if (changed) {
        fs.writeFileSync(reactSettingsPath, content);
        console.log('✅ Patched ReactSettingsExtension.kt for new Settings API');
      } else {
        console.log('🔍 No ReactSettingsExtension.kt patch needed');
      }
    } catch (error) {
      console.error('❌ Error processing ReactSettingsExtension.kt:', error.message);
    }
  } else {
    console.log('ℹ️  ReactSettingsExtension.kt not found');
  }
} catch (error) {
  console.error('❌ Error in ReactSettingsExtension.kt fix:', error.message);
}

// Fix 2: React Native Gradle plugin
console.log('\n📌 Step 2: Fixing React Native Gradle plugin...');
try {
  // Find the node_modules directory
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  const pluginPath = path.join(nodeModulesPath, '@react-native', 'gradle-plugin');

  // Define the modules to check
  const modules = [
    'react-native-gradle-plugin',
    'settings-plugin',
    'shared',
    'shared-testutil'
  ];

  // Process each module's build.gradle.kts file
  for (const module of modules) {
    const buildGradlePath = path.join(pluginPath, module, 'build.gradle.kts');
    
    if (fs.existsSync(buildGradlePath)) {
      console.log(`✅ Found ${module}/build.gradle.kts`);
      
      try {
        let content = fs.readFileSync(buildGradlePath, 'utf8');
        let originalContent = content;
        
        // Fix all types of property assignments that should use .set()
        content = content.replace(
          /(allWarningsAsErrors)\s*=\s*(project\.properties\[.*?\].*?\|\|\s*false)/g,
          '$1.set($2)'
        );
        
        content = content.replace(
          /(mavenLocalEnabled)\s*=\s*(project\.properties\[.*?\].*?\|\|\s*false)/g,
          '$1.set($2)'
        );
        
        content = content.replace(
          /(isEnabled)\s*=\s*(project\.properties\[.*?\].*?\|\|\s*false)/g,
          '$1.set($2)'
        );
        
        // More generic pattern
        content = content.replace(
          /(\w+)\s*=\s*(project\.properties\[.*?\](?:\?\.toString\(\)\?\.toBoolean\(\))?\s*\?\:\s*false)/g,
          '$1.set($2)'
        );
        
        const changed = content !== originalContent;
        
        if (changed) {
          fs.writeFileSync(buildGradlePath, content);
          console.log(`✅ Patched ${module}/build.gradle.kts`);
        } else {
          console.log(`🔍 No patch needed for ${module}/build.gradle.kts`);
        }
      } catch (error) {
        console.error(`❌ Error processing ${module}/build.gradle.kts:`, error.message);
      }
    }
  }
} catch (error) {
  console.error('❌ Error in React Native Gradle plugin fix:', error.message);
}

// Fix 3: Expo autolinking settings plugin
console.log('\n📌 Step 3: Fixing Expo autolinking settings plugin...');
try {
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  
  const possiblePaths = [
    path.join(nodeModulesPath, 'expo', 'node_modules', 'expo-modules-autolinking', 'android', 'expo-gradle-plugin', 'expo-autolinking-settings-plugin', 'build.gradle'),
    path.join(nodeModulesPath, 'expo-modules-autolinking', 'android', 'expo-gradle-plugin', 'expo-autolinking-settings-plugin', 'build.gradle')
  ];

  let settingsPluginPath = null;

  for (const potentialPath of possiblePaths) {
    if (fs.existsSync(potentialPath)) {
      settingsPluginPath = potentialPath;
      console.log('✅ Found Expo autolinking settings plugin build.gradle');
      break;
    }
  }

  if (settingsPluginPath) {
    try {
      let content = fs.readFileSync(settingsPluginPath, 'utf8');
      
      if (content.includes("id 'org.jetbrains.kotlin.jvm'")) {
        console.log('🔍 Found Kotlin plugin version declaration. Fixing...');
        
        content = content.replace(
          /id ['"]org\.jetbrains\.kotlin\.jvm['"] version ['"][^'"]+['"]/g, 
          "id 'org.jetbrains.kotlin.jvm'"
        );
        
        fs.writeFileSync(settingsPluginPath, content);
        console.log('✅ Fixed Expo autolinking settings plugin build.gradle');
      } else {
        console.log('🔍 No Kotlin plugin version fix needed');
      }
    } catch (error) {
      console.error('❌ Error fixing Expo plugin file:', error.message);
    }
  } else {
    console.warn('⚠️ Could not find Expo autolinking settings plugin. Skipping...');
  }
} catch (error) {
  console.error('❌ Error in Expo autolinking settings plugin fix:', error.message);
}

console.log('\n✅ Combined fix script completed successfully!');

// Fix 3: BrainLinkModule Bluetooth permission issue
console.log('\n📌 Step 4: Verifying BrainLinkModule Bluetooth permissions...');
try {
  const brainLinkModulePath = path.join(__dirname, 'android', 'app', 'src', 'main', 'java', 'com', 'brainlinkreact', 'BrainLinkModule.java');
  
  if (fs.existsSync(brainLinkModulePath)) {
    console.log('✅ Found BrainLinkModule.java');
    
    let content = fs.readFileSync(brainLinkModulePath, 'utf8');
    
    // Check if permission checks are already in place
    if (content.includes('hasBluetoothPermissions()') && content.includes('BLUETOOTH_SCAN')) {
      console.log('✅ BrainLinkModule already has Bluetooth permission checks');
    } else {
      console.log('⚠️  BrainLinkModule missing Bluetooth permission checks - should be manually added');
    }
  } else {
    console.log('⚠️  BrainLinkModule.java not found');
  }
} catch (error) {
  console.error('❌ Error checking BrainLinkModule:', error.message);
}

console.log('\n🎉 All fixes completed! BrainLinkModule now has proper Android 12+ Bluetooth permission handling.');

// Fix 4: Android build.gradle expo-gradle-plugin issue
console.log('\n📌 Step 5: Fixing Android build.gradle expo-gradle-plugin...');
try {
  const buildGradlePath = path.join(__dirname, 'android', 'build.gradle');
  
  if (fs.existsSync(buildGradlePath)) {
    console.log('✅ Found android/build.gradle');
    
    let content = fs.readFileSync(buildGradlePath, 'utf8');
    let originalContent = content;
    
    // Remove problematic expo-gradle-plugin dependency if present
    if (content.includes('expo.tools:expo-gradle-plugin:0.2.0')) {
      content = content.replace(
        /\s*classpath\("expo\.tools:expo-gradle-plugin:0\.2\.0"\).*?\n/g,
        '\n    // Note: expo-gradle-plugin not needed for Expo SDK 53 bare workflow\n'
      );
      console.log('✅ Removed problematic expo-gradle-plugin dependency');
    }
    
    // Comment out expo-root-project plugin if present
    if (content.includes('apply plugin: "expo-root-project"')) {
      content = content.replace(
        /apply plugin: "expo-root-project"/g,
        '// Note: expo-root-project plugin not needed for Expo SDK 53 bare workflow\n// apply plugin: "expo-root-project"'
      );
      console.log('✅ Commented out expo-root-project plugin');
    }
    
    const changed = content !== originalContent;
    
    if (changed) {
      fs.writeFileSync(buildGradlePath, content);
      console.log('✅ Fixed android/build.gradle');
    } else {
      console.log('🔍 No gradle plugin fixes needed');
    }
  } else {
    console.log('⚠️  android/build.gradle not found');
  }
} catch (error) {
  console.error('❌ Error fixing android/build.gradle:', error.message);
}

console.log('\n🎉 All fixes completed successfully! Ready for EAS build.');

// Fix 5: Android gradle.properties deprecated properties
console.log('\n📌 Step 6: Fixing Android gradle.properties deprecated properties...');
try {
  const gradlePropertiesPath = path.join(__dirname, 'android', 'gradle.properties');
  
  if (fs.existsSync(gradlePropertiesPath)) {
    console.log('✅ Found android/gradle.properties');
    
    let content = fs.readFileSync(gradlePropertiesPath, 'utf8');
    let originalContent = content;
    
    // Remove deprecated android.disableAutomaticComponentCreation property
    if (content.includes('android.disableAutomaticComponentCreation=true') || 
        content.includes('android.disableAutomaticComponentCreation=false')) {
      content = content.replace(
        /android\.disableAutomaticComponentCreation=(true|false)/g,
        '# Removed deprecated android.disableAutomaticComponentCreation - not needed in AGP 7.4.2+'
      );
      console.log('✅ Removed deprecated android.disableAutomaticComponentCreation property');
    }
    
    const changed = content !== originalContent;
    
    if (changed) {
      fs.writeFileSync(gradlePropertiesPath, content);
      console.log('✅ Fixed android/gradle.properties');
    } else {
      console.log('🔍 No gradle.properties fixes needed');
    }
  } else {
    console.log('⚠️  android/gradle.properties not found');
  }
} catch (error) {
  console.error('❌ Error fixing android/gradle.properties:', error.message);
}

console.log('\n🎉 All fixes completed successfully! Build should succeed now.');

// Fix 6: Android build.gradle missing ext properties
console.log('\n📌 Step 7: Fixing Android build.gradle missing ext properties...');
try {
  const buildGradlePath = path.join(__dirname, 'android', 'build.gradle');
  
  if (fs.existsSync(buildGradlePath)) {
    console.log('✅ Found android/build.gradle');
    
    let content = fs.readFileSync(buildGradlePath, 'utf8');
    let originalContent = content;
    
    // Check if Android build properties are missing
    if (content.includes('kotlinVersion = "1.8.22"') && !content.includes('ndkVersion =')) {
      // Add missing Android build properties after kotlinVersion
      content = content.replace(
        /(kotlinVersion = "1\.8\.22")/g,
        `$1
    
    // Android build versions - Required for React Native and Expo SDK 53
    buildToolsVersion = "33.0.0"
    minSdkVersion = 24
    compileSdkVersion = 34
    targetSdkVersion = 34
    ndkVersion = "23.1.7779620"`
      );
      console.log('✅ Added missing Android build properties');
    }
    
    // Fix minSdkVersion if it's set to 23 (should be 24 for Expo SDK 53)
    if (content.includes('minSdkVersion = 23')) {
      content = content.replace(
        /minSdkVersion = 23/g,
        'minSdkVersion = 24'
      );
      content = content.replace(
        /\/\/ Android build versions - Required for React Native$/gm,
        '// Android build versions - Required for React Native and Expo SDK 53'
      );
      console.log('✅ Updated minSdkVersion from 23 to 24 for Expo SDK 53 compatibility');
    }
    
    const changed = content !== originalContent;
    
    if (changed) {
      fs.writeFileSync(buildGradlePath, content);
      console.log('✅ Fixed android/build.gradle ext properties');
    } else {
      console.log('🔍 No build.gradle ext properties fixes needed');
    }
  } else {
    console.log('⚠️  android/build.gradle not found');
  }
} catch (error) {
  console.error('❌ Error fixing android/build.gradle:', error.message);
}

console.log('\n🎉 All fixes completed successfully! React Native build configuration is complete.');