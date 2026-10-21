const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
  files: "dist/test/**/*.test.js",
  mocha: {
    ui: "bdd",
    timeout: 5000,
  },
  workspaceFolder: "test/bazel_workspace",
  version: "1.111.0",
  // Where to download VS Code to; defaults to .vscode-test/ next to this
  // file. `bazel test //test:unit` runs from a scratch copy and points this
  // at a cache that survives between runs.
  cachePath: process.env.VSCODE_TEST_CACHE_PATH,
});
