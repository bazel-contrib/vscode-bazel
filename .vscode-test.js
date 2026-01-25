const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
  files: "dist/test/**/*.test.js",
  mocha: {
    ui: "bdd",
    timeout: 5000,
  },
  workspaceFolder: "test/bazel_workspace",
});
