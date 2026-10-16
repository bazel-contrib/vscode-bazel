// Bazel-side vscode-test configuration. //test:unit stages this as
// .vscode-test.js at the top of the runtime tree it assembles (see
// test/BUILD). Mirrors the top-level .vscode-test.js; the only difference
// is the download cache location, which the launcher provides.
const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
  files: "dist/test/**/*.test.js",
  mocha: {
    ui: "bdd",
    timeout: 5000,
  },
  workspaceFolder: "test/bazel_workspace",
  version: "1.111.0",
  cachePath: process.env.VSCODE_TEST_CACHE_PATH,
});
