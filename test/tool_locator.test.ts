import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { validateBuildifierExecutable } from "../src/buildifier/buildifier_availability";
import { loadToolsConfig } from "../src/external-tools/tool_config";
import {
  getConfiguredToolValue,
  locateConfiguredTool,
  locateToolOnPath,
} from "../src/external-tools/tool_locator";

describe("tool_locator", () => {
  const testWorkspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );
  const nestedWorkspacePath = path.join(testWorkspacePath, "nested_module");
  const relativeExecutable = "bazel-availability-test";
  const nestedExecutablePath = path.join(
    nestedWorkspacePath,
    relativeExecutable,
  );
  const buildifierDirPath = path.join(testWorkspacePath, "buildifier");
  const buildifierGoodPath = path.join(buildifierDirPath, "buildifier_good");
  const buildifierDefaultPath = path.join(buildifierDirPath, "buildifier");
  const toolsConfig = loadToolsConfig();
  const originalPath = process.env.PATH;
  let sandbox: sinon.SinonSandbox;
  let temporaryDirectories: string[];

  async function setBazelConfiguration(
    executable: string | undefined,
    workspacePath: string | undefined,
  ): Promise<void> {
    const configuration = vscode.workspace.getConfiguration("bazel");
    await configuration.update(
      "executable",
      executable,
      vscode.ConfigurationTarget.Workspace,
    );
    await vscode.workspace
      .getConfiguration("bazel.workspace")
      .update("path", workspacePath, vscode.ConfigurationTarget.Workspace);
  }

  async function createExecutable(
    directory: string,
    name: string,
  ): Promise<string> {
    const executablePath = path.join(directory, name);
    await fs.mkdir(path.dirname(executablePath), { recursive: true });
    await fs.writeFile(executablePath, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    return executablePath;
  }

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    temporaryDirectories = [];
    process.env.PATH = originalPath;
    await setBazelConfiguration(undefined, undefined);
  });

  afterEach(async () => {
    sandbox.restore();
    process.env.PATH = originalPath;
    await setBazelConfiguration(undefined, undefined);
    await fs.rm(nestedExecutablePath, { force: true });
    await Promise.all(
      temporaryDirectories.map((directory) =>
        fs.rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  describe("getConfiguredToolValue", () => {
    it("treats the default as automatic", () => {
      assert.strictEqual(
        getConfiguredToolValue(toolsConfig.Bazelisk),
        undefined,
      );
    });

    it("treats the plain executable name as automatic", async () => {
      await setBazelConfiguration("bazel", undefined);

      assert.strictEqual(
        getConfiguredToolValue(toolsConfig.Bazelisk),
        undefined,
      );
    });

    it("returns an explicit value", async () => {
      await setBazelConfiguration("tools/bazel", undefined);

      assert.strictEqual(
        getConfiguredToolValue(toolsConfig.Bazelisk),
        "tools/bazel",
      );
    });
  });

  describe("Bazel", () => {
    it("finds a relative executable from the Bazel root", async () => {
      await createExecutable(nestedWorkspacePath, relativeExecutable);
      await setBazelConfiguration(undefined, "nested_module");

      const tool = await locateConfiguredTool("Bazelisk", relativeExecutable);

      // Relative values are kept, they are resolved per Bazel root.
      assert.strictEqual(tool?.command, relativeExecutable);
      assert.strictEqual(tool?.location, nestedExecutablePath);
      assert.strictEqual(tool?.source, "setting");
    });

    it("checks every VS Code folder for a relative executable", async () => {
      const firstFolder = await fs.mkdtemp(
        path.join(os.tmpdir(), "vscode-bazel-unavailable-"),
      );
      const secondFolder = await fs.mkdtemp(
        path.join(os.tmpdir(), "vscode-bazel-available-"),
      );
      temporaryDirectories.push(firstFolder, secondFolder);
      const executable = await createExecutable(
        secondFolder,
        path.join("tools", "bazel"),
      );

      sandbox.stub(vscode.workspace, "workspaceFolders").value([
        {
          index: 0,
          name: "unavailable",
          uri: vscode.Uri.file(firstFolder),
        },
        {
          index: 1,
          name: "available",
          uri: vscode.Uri.file(secondFolder),
        },
      ]);

      const tool = await locateConfiguredTool(
        "Bazelisk",
        path.join("tools", "bazel"),
      );

      assert.strictEqual(tool?.location, executable);
    });

    it("falls back to the system PATH", async () => {
      const binDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), "vscode-bazel-path-"),
      );
      temporaryDirectories.push(binDirectory);
      const executable = await createExecutable(
        binDirectory,
        relativeExecutable,
      );
      process.env.PATH = `${binDirectory}${path.delimiter}${originalPath ?? ""}`;

      const tool = await locateConfiguredTool("Bazelisk", relativeExecutable);

      assert.strictEqual(tool?.command, relativeExecutable);
      assert.strictEqual(tool?.location, executable);
    });

    it("returns undefined when the executable cannot be found", async () => {
      const tool = await locateConfiguredTool(
        "Bazelisk",
        "bazel-executable-that-does-not-exist",
      );

      assert.strictEqual(tool, undefined);
    });
  });

  describe("Buildifier", () => {
    function addDummyExecutablesToPath(): void {
      process.env.PATH = buildifierDirPath + path.delimiter + process.env.PATH;
    }

    it("finds the default executable on the system PATH", async () => {
      addDummyExecutablesToPath();

      const tool = await locateToolOnPath(toolsConfig.Buildifier);

      assert.strictEqual(tool?.command, "buildifier");
      assert.strictEqual(tool?.location, buildifierDefaultPath);
      assert.strictEqual(tool?.source, "path");
    });

    it("finds a configured name on the system PATH", async () => {
      addDummyExecutablesToPath();

      const tool = await locateConfiguredTool("Buildifier", "buildifier_good");

      assert.strictEqual(tool?.location, buildifierGoodPath);
    });

    it("handles absolute paths", async () => {
      const tool = await locateConfiguredTool("Buildifier", buildifierGoodPath);

      assert.strictEqual(tool?.command, buildifierGoodPath);
    });

    it("resolves workspace relative paths", async () => {
      const relativePath = path.relative(testWorkspacePath, buildifierGoodPath);

      const tool = await locateConfiguredTool("Buildifier", relativePath);

      assert.strictEqual(tool?.command, buildifierGoodPath);
    });

    it("keeps Bazel targets starting with @", async () => {
      const tool = await locateConfiguredTool(
        "Buildifier",
        "@//buildifier:buildifier",
      );

      assert.strictEqual(tool?.command, "@//buildifier:buildifier");
    });

    it("returns undefined for a missing relative path", async () => {
      const tool = await locateConfiguredTool("Buildifier", "nonexistent");

      assert.strictEqual(tool, undefined);
    });

    it("returns undefined for a name not on the system PATH", async () => {
      const tool = await locateConfiguredTool("Buildifier", "buildifier_good");

      assert.strictEqual(tool, undefined);
    });

    it("accepts a compatible buildifier target", async function () {
      this.timeout(10000); // Allow bazel to start

      assert.strictEqual(
        await validateBuildifierExecutable("@//buildifier:buildifier"),
        true,
      );
    });

    it("rejects an outdated buildifier", async function () {
      this.timeout(10000); // Allow bazel to start

      assert.strictEqual(
        await validateBuildifierExecutable("@//buildifier:buildifier_outdated"),
        false,
      );
    });
  });
});
