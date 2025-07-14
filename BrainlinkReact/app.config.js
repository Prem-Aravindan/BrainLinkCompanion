module.exports = {
  expo: {
    name: "BrainlinkReact",
    slug: "BrainlinkReact",
    version: "1.0.0",
    newArchEnabled: true,
    android: {
      package: "com.mindspellerbv.BrainlinkReact"
    },
    plugins: [
      "./plugins/withMacrotellectLink"
    ],
    extra: {
      eas: {
        projectId: "ab127648-688e-48ea-9d92-fe3590125317"
      }
    }
  }
};
