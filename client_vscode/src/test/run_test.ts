// import * as path from "path";
// import { runTests } from "vscode-test";

import { run } from "./suite";

async function main() {
  try {
    // TODO: Add support for integration tests
    // // The folder containing the Extension Manifest package.json
    // // Passed to `--extensionDevelopmentPath`
    // const extensionDevelopmentPath = path.resolve(__dirname, "../../");
    // // The path to test runner
    // // Passed to --extensionTestsPath
    // const extensionTestsPath = path.resolve(__dirname, "./suite/index");
    // // Download VS Code, unzip it and run the integration test
    // await runTests({ extensionDevelopmentPath, extensionTestsPath });

    // For now just do simple unit tests
    await run();
  } catch (err) {
    // tslint:disable-next-line: no-console
    console.error("Failed to run tests");
    process.exit(1);
  }
}

main();
