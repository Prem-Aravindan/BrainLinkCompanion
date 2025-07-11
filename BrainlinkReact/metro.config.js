const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure vector icons are properly resolved
config.resolver.assetExts = [...config.resolver.assetExts, 'ttf', 'otf'];

// Add polyfills for Node.js modules
config.resolver.alias = {
  ...config.resolver.alias,
  'buffer': require.resolve('buffer'),
};

module.exports = config;
