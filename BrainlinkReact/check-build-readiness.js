#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 COMPREHENSIVE BUILD READINESS CHECK\n');

const checks = [];

// 1. Check JAR file
const jarPath = 'assets/MacrotellectLink_V1.4.3.jar';
if (fs.existsSync(jarPath)) {
    const stats = fs.statSync(jarPath);
    checks.push(`✅ JAR file exists: ${jarPath} (${Math.round(stats.size / 1024)}KB)`);
} else {
    checks.push(`❌ JAR file missing: ${jarPath}`);
}

// 2. Check BrainLinkModule.java
const modulePath = 'native/BrainLinkModule.java';
if (fs.existsSync(modulePath)) {
    const content = fs.readFileSync(modulePath, 'utf8');
    
    // Check imports
    const requiredImports = [
        'com.boby.bluetoothconnect.LinkManager',
        'com.boby.bluetoothconnect.callback.ScanCallBack',
        'com.boby.bluetoothconnect.classic.bean.BlueConnectDevice',
        'com.boby.bluetoothconnect.classic.listener.EEGPowerDataListener',
        'com.boby.bluetoothconnect.classic.listener.OnConnectListener',
        'com.boby.bluetoothconnect.bean.BrainWave',
        'com.boby.bluetoothconnect.bean.Gravity'
    ];
    
    const missingImports = requiredImports.filter(imp => !content.includes(imp));
    if (missingImports.length === 0) {
        checks.push('✅ All required imports present in BrainLinkModule.java');
    } else {
        checks.push(`❌ Missing imports: ${missingImports.join(', ')}`);
    }
    
    // Check method implementations
    const requiredMethods = [
        'onScaningDeviceFound',
        'onScanFinish',
        'onConnectStart',
        'onConnectting',
        'onConnectSuccess',
        'onConnectFailed',
        'onError',
        'onConnectionLost',
        'onBrainWavedata',
        'onRawData',
        'onGravity',
        'onRR'
    ];
    
    const missingMethods = requiredMethods.filter(method => !content.includes(method));
    if (missingMethods.length === 0) {
        checks.push('✅ All required interface methods implemented');
    } else {
        checks.push(`❌ Missing methods: ${missingMethods.join(', ')}`);
    }
    
    // Check for deprecated methods
    if (content.includes('onCatalystInstanceDestroy')) {
        checks.push('⚠️  Using deprecated onCatalystInstanceDestroy method');
    } else if (content.includes('invalidate')) {
        checks.push('✅ Using current invalidate method instead of deprecated one');
    }
    
    // Check field access (not getter methods)
    if (content.includes('brainWave.att') && content.includes('gravity.X')) {
        checks.push('✅ Using correct field access for BrainWave and Gravity classes');
    } else {
        checks.push('⚠️  Check field access - should use brainWave.att, gravity.X, etc.');
    }
    
} else {
    checks.push(`❌ BrainLinkModule.java missing: ${modulePath}`);
}

// 3. Check config plugin
const pluginPath = 'plugins/withMacrotellectLink.js';
if (fs.existsSync(pluginPath)) {
    const content = fs.readFileSync(pluginPath, 'utf8');
    if (content.includes('withDangerousMod') && content.includes('fileTree')) {
        checks.push('✅ Config plugin properly configured');
    } else {
        checks.push('⚠️  Config plugin may be missing required configurations');
    }
} else {
    checks.push(`❌ Config plugin missing: ${pluginPath}`);
}

// 4. Check app.config.js
const configPath = 'app.config.js';
if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    if (content.includes('./plugins/withMacrotellectLink')) {
        checks.push('✅ Config plugin registered in app.config.js');
    } else {
        checks.push('⚠️  Config plugin not registered in app.config.js');
    }
} else {
    checks.push(`❌ app.config.js missing`);
}

// 5. Check TypeScript module
const tsModulePath = 'modules/expo-macrotellect-link/src/index.ts';
if (fs.existsSync(tsModulePath)) {
    const content = fs.readFileSync(tsModulePath, 'utf8');
    if (content.includes('BrainLinkModule') && content.includes('NativeModules')) {
        checks.push('✅ TypeScript module properly configured');
    } else {
        checks.push('⚠️  TypeScript module may have issues');
    }
} else {
    checks.push(`❌ TypeScript module missing: ${tsModulePath}`);
}

// 6. Check package.json
const packagePath = 'package.json';
if (fs.existsSync(packagePath)) {
    const content = fs.readFileSync(packagePath, 'utf8');
    const pkg = JSON.parse(content);
    if (pkg.dependencies['@expo/config-plugins']) {
        checks.push('✅ Required dependency @expo/config-plugins present');
    } else {
        checks.push('❌ Missing dependency: @expo/config-plugins');
    }
} else {
    checks.push(`❌ package.json missing`);
}

// Print results
console.log('BUILD READINESS RESULTS:');
console.log('========================\n');
checks.forEach(check => console.log(check));

const hasErrors = checks.some(check => check.startsWith('❌'));
const hasWarnings = checks.some(check => check.startsWith('⚠️'));

console.log('\n========================');
if (hasErrors) {
    console.log('❌ BUILD NOT READY - Fix errors above');
    process.exit(1);
} else if (hasWarnings) {
    console.log('⚠️  BUILD READY WITH WARNINGS - Review warnings above');
} else {
    console.log('✅ BUILD READY - All checks passed!');
}
