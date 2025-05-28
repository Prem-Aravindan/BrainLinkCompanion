const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure vector icons are properly resolved
config.resolver.assetExts = [...config.resolver.assetExts, 'ttf', 'otf'];

module.exports = config;
