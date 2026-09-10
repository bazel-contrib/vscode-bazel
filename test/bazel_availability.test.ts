import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import { checkBazelIsAvailable } from "../src/bazel/bazel_availability";

describe("Bazel availability", () => {
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
    await configuration.update(
      "workspacePath",
      workspacePath,
      vscode.ConfigurationTarget.Workspace,
    );
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

  it("finds a relative executable from the configured Bazel root", async () => {
    await createExecutable(nestedWorkspacePath, relativeExecutable);
    await setBazelConfiguration(relativeExecutable, "nested_module");

    assert.strictEqual(checkBazelIsAvailable(), true);
  });

  it("checks every VS Code folder for a relative executable", async () => {
    const firstFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), "vscode-bazel-unavailable-"),
    );
    const secondFolder = await fs.mkdtemp(
      path.join(os.tmpdir(), "vscode-bazel-available-"),
    );
    temporaryDirectories.push(firstFolder, secondFolder);
    await createExecutable(secondFolder, path.join("tools", "bazel"));
    await setBazelConfiguration(path.join("tools", "bazel"), undefined);

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

    assert.strictEqual(checkBazelIsAvailable(), true);
  });

  it("falls back to the system PATH", async () => {
    const binDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "vscode-bazel-path-"),
    );
    temporaryDirectories.push(binDirectory);
    await createExecutable(binDirectory, relativeExecutable);
    process.env.PATH = `${binDirectory}${path.delimiter}${originalPath ?? ""}`;
    await setBazelConfiguration(relativeExecutable, undefined);

    assert.strictEqual(checkBazelIsAvailable(), true);
  });

  it("returns false when the executable cannot be found", async () => {
    await setBazelConfiguration(
      "bazel-executable-that-does-not-exist",
      undefined,
    );

    assert.strictEqual(checkBazelIsAvailable(), false);
  });
});
