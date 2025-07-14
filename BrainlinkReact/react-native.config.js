module.exports = {
  dependencies: {
    // Custom native module configuration for BrainLinkModule
    'BrainLinkModule': {
      platforms: {
        android: {
          sourceDir: '../android/app/src/main/java/com/brainlinkreact/',
          packageImportPath: 'com.brainlinkreact.BrainLinkPackage',
        },
      },
    },
  },
};
