const androidResourceFix = require('./plugins/android-resource-fix');
module.exports = {
  expo: {
    name: "BrainLink Companion",
    slug: "BrainlinkReact",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    assetBundlePatterns: [
      "**/*"
    ],
    newArchEnabled: false,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.mindspellerbv.BrainlinkReact"
    },
    android: {
      package: "com.mindspellerbv.BrainlinkReact",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#7878e9"
      },
      permissions: [
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH_ADVERTISE"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    scheme: "brainlinkreact",
    plugins: [
      androidResourceFix,
      "expo-dev-client",
      [
        "expo-build-properties",
        {
          "android": {
            "compileSdkVersion": 35,
            "targetSdkVersion": 35,
            "buildToolsVersion": "35.0.0",
            "minSdkVersion": 24,
            "ndkVersion": "25.1.8937393",
            "cmakeVersion": "3.22.1"
          }
        }
      ],
      "./plugins/withMacrotellectLink"
    ],
    extra: {
      eas: {
        projectId: "ab127648-688e-48ea-9d92-fe3590125317"
      }
    }
  }
};
