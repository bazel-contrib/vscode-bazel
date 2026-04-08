import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs/promises";

import { ExternalToolsManager } from "../src/external-tools/tool_manager";

describe("external_tools_availability", () => {
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

  let mockContext: vscode.ExtensionContext;
  let manager: ExternalToolsManager;

  function addDummyExecutablesToPath(): void {
    process.env.PATH = buildifierDirPath + path.delimiter + process.env.PATH;
  }

  beforeEach(async () => {
    // Create mock extension context
    mockContext = {
      globalStorageUri: { fsPath: path.join(testWorkspace, ".vscode") },
      subscriptions: [],
    } as any;

    manager = new ExternalToolsManager(mockContext);

    // Restore original PATH before each test
    process.env.PATH = originalPath;
    // Restore vscode settings
    await vscode.workspace
      .getConfiguration("bazel")
      .update("buildifierExecutable", undefined);
  });

  afterEach(async () => {
    // Restore original PATH before each test
    process.env.PATH = originalPath;
    // Restore vscode settings
    await vscode.workspace
      .getConfiguration("bazel")
      .update("buildifierExecutable", undefined);
  });

  describe("ExternalToolsManager", () => {
    describe("getToolPath for Buildifier", () => {
      it("should use default when no custom path is configured", async () => {
        // No modification of config setting in this test
        addDummyExecutablesToPath();

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, buildifierDefaultPath);
      });

      it("should find executable in system PATH", async () => {
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", "buildifier_good");
        addDummyExecutablesToPath();

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, buildifierGoodPath);
      });

      it("should handle absolute paths correctly", async () => {
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", buildifierGoodPath);

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, buildifierGoodPath);
      });

      it("should handle workspace relative paths correctly", async () => {
        const relativePath = path.relative(testWorkspace, buildifierGoodPath);
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", relativePath);

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, buildifierGoodPath);
      });

      it("should handle Bazel targets starting with @", async function () {
        this.timeout(10000); // Allow bazel to start
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", "@//buildifier:buildifier");

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, "@//buildifier:buildifier");
      });
    });

    describe("failure cases", () => {
      it("should ignore outdated version of buildifier", async function () {
        this.timeout(10000); // Allow bazel to start
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", "@//buildifier:buildifier_outdated");

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, null);
      });

      it("should handle executable not found as relative path", async () => {
        const relativePath = path.relative(testWorkspace, "nonexistent");
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", relativePath);

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, null);
      });

      it("should handle executable not found in PATH", async () => {
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", "buildifier_good");
        // No modification of PATH in this test

        const result = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result, null);
      });
    });

    describe("caching", () => {
      it("should cache tool locations", async () => {
        addDummyExecutablesToPath();

        const result1 = await manager.getToolPathByName("Buildifier");
        const result2 = await manager.getToolPathByName("Buildifier");

        assert.strictEqual(result1, buildifierDefaultPath);
        assert.strictEqual(result2, buildifierDefaultPath);
        // Should be the same object reference due to caching
        assert.strictEqual(result1, result2);
      });
    });

    describe("executeTool", () => {
      it("should execute tool with arguments", async () => {
        addDummyExecutablesToPath();

        const result = await manager.executeTool("Buildifier", ["--version"]);

        assert.ok(result.stdout);
        assert.ok(typeof result.stdout === "string");
      });

      it("should handle Bazel targets", async function () {
        this.timeout(10000); // Allow bazel to start
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", "@//buildifier:buildifier");

        const result = await manager.executeTool("Buildifier", ["--version"]);

        assert.ok(result.stdout);
      });

      it("should throw error for unavailable tool", async () => {
        await vscode.workspace
          .getConfiguration("bazel")
          .update("buildifierExecutable", "nonexistent");

        await assert.rejects(
          () => manager.executeTool("Buildifier", ["--version"]),
          /Buildifier is not available/,
        );
      });
    });
  });
});
