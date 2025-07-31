const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
  files: "out/test/**/*.test.js",
  mocha: { ui: "bdd" },
  workspaceFolder: "test/bazel_workspace",
});
