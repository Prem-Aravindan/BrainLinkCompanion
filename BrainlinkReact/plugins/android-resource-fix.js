const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidResourceFix = (config) => {
  return withAndroidManifest(config, (config) => {
    // Simple pass-through plugin to prevent resource conflicts
    return config;
  });
};

module.exports = withAndroidResourceFix;
