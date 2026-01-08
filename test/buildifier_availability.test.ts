import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs/promises";

import { checkBuildifierIsAvailable } from "../src/buildifier/buildifier_availability";

describe("buildifier_availability", () => {
  const testWorkspace = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );
  const buildifierDirPath = path.join(testWorkspace, "buildifier");
  const buildifierGoodPath = path.join(buildifierDirPath, "buildifier_good");
  const buildifierDefaultPath = path.join(buildifierDirPath, "buildifier");
  const originalPath = process.env.PATH;

  async function setBuildifierExecutableConfig(
    configString: string,
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration("bazel")
      .update("buildifierExecutable", configString);
  }

  function addDummyExecutablesToPath(): void {
    process.env.PATH = buildifierDirPath + path.delimiter + process.env.PATH;
  }

  async function removeVscodeSettings(): Promise<void> {
    await fs.rm(path.join(testWorkspace, ".vscode"), {
      recursive: true,
      force: true,
    });
  }

  beforeEach(async () => {
    // Restore original PATH before each test
    process.env.PATH = originalPath;
    // Remove vscode settings
    await removeVscodeSettings();
  });
  afterEach(async () => {
    // Restore original PATH before each test
    process.env.PATH = originalPath;
    // Remove vscode settings
    await removeVscodeSettings();
  });

  describe("checkBuildifierIsAvailable", () => {
    describe("buildifier path resolution", () => {
      it("should use default when no custom path is configured", async () => {
        // No modification of config setting in this test
        addDummyExecutablesToPath();

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, buildifierDefaultPath);
      });
      it("should find executable in system PATH", async () => {
        await setBuildifierExecutableConfig("buildifier_good");
        addDummyExecutablesToPath();

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, buildifierGoodPath);
      });
      it("should handle absolute paths correctly", async () => {
        await setBuildifierExecutableConfig(buildifierGoodPath);

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, buildifierGoodPath);
      });
      it("should handle workspace relative paths correctly", async () => {
        const relativePath = path.relative(testWorkspace, buildifierGoodPath);
        await setBuildifierExecutableConfig(relativePath);

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, buildifierGoodPath);
      });
      it("should handle Bazel targets starting with @", async function () {
        this.timeout(10000); // Allow bazel to start
        await setBuildifierExecutableConfig("@//buildifier:buildifier");

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, "@//buildifier:buildifier");
      });
    });

    describe("failure cases", () => {
      it("should ignore outdated version of buildifier", async function () {
        this.timeout(10000); // Allow bazel to start
        await setBuildifierExecutableConfig(
          "@//buildifier:buildifier_outdated",
        );

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, null);
      });
      it("should handle executable not found as relative path", async () => {
        const relativePath = path.relative(testWorkspace, "nonexistent");
        await setBuildifierExecutableConfig(relativePath);

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, null);
      });
      it("should handle executable not found in PATH", async () => {
        await setBuildifierExecutableConfig("buildifier_good");
        // No modification of PATH in this test

        const result = await checkBuildifierIsAvailable();

        assert.strictEqual(result, null);
      });
    });
  });
});
