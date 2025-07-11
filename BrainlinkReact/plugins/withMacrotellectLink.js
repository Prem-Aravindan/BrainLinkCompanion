const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withMacrotellectLink(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      
      // Paths
      const sourceJarPath = path.join(projectRoot, 'assets', 'jars', 'MacrotellectLink_V1.4.3.jar');
      const targetLibsDir = path.join(platformProjectRoot, 'app', 'libs');
      const targetJarPath = path.join(targetLibsDir, 'MacrotellectLink_V1.4.3.jar');
      
      // Ensure libs directory exists
      if (!fs.existsSync(targetLibsDir)) {
        fs.mkdirSync(targetLibsDir, { recursive: true });
      }
      
      // Copy JAR file if it exists
      if (fs.existsSync(sourceJarPath)) {
        fs.copyFileSync(sourceJarPath, targetJarPath);
        console.log('✅ MacrotellectLink JAR file copied to Android libs');
      } else {
        console.warn('⚠️ MacrotellectLink JAR file not found at:', sourceJarPath);
      }
      
      // Modify app/build.gradle to include the JAR
      const buildGradlePath = path.join(platformProjectRoot, 'app', 'build.gradle');
      if (fs.existsSync(buildGradlePath)) {
        let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
        
        // Add JAR dependency if not already present
        const jarDependency = "implementation files('libs/MacrotellectLink_V1.4.3.jar')";
        if (!buildGradleContent.includes(jarDependency)) {
          // Find the dependencies block and add our JAR
          const dependenciesRegex = /(dependencies\s*\{[^}]*)/;
          if (dependenciesRegex.test(buildGradleContent)) {
            buildGradleContent = buildGradleContent.replace(
              dependenciesRegex,
              `$1\n    ${jarDependency}`
            );
            fs.writeFileSync(buildGradlePath, buildGradleContent);
            console.log('✅ Added MacrotellectLink JAR dependency to build.gradle');
          }
        }
      }
      
      return config;
    },
  ]);
}

module.exports = withMacrotellectLink;
