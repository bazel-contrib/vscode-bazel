const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
  files: "dist/test/**/*.test.js",
  mocha: {
    ui: "bdd",
    timeout: 5000,
  },
  workspaceFolder: "test/bazel_workspace",
  version: "1.111.0",
  // The built-in JSON language client throws uncaught timer errors when
  // settings change in quick succession. Mocha attributes those to whichever
  // test is running, so disable it; no test depends on JSON language features.
  launchArgs: ["--disable-extension", "vscode.json-language-features"],
});
