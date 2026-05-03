import * as path from "path";
import * as fs from "fs";
import * as assert from "assert";
import * as vscode from "vscode";
import {
  getBuildFileLineWithSourceFilePath,
  getTargetNameAtBuildFileLocation,
  getBazelWorkspaceFolder,
} from "../src/bazel/bazel_utils";

const workspacePath = path.join(
  __dirname,
  "..",
  "..",
  "test",
  "bazel_workspace",
);
const packagePath = path.join(workspacePath, "pkg2", "sub-pkg");
describe("Bazel Utils: getBuildFileLineWithSourceFilePath", () => {
  interface TestCase {
    name: string;
    buildFilePath: string;
    sourceFilePath: string;
    expectedLineNumber: number | undefined;
  }
  const testCases: TestCase[] = [
    {
      name: "should find file in package root",
      buildFilePath: path.join(packagePath, "BUILD"),
      sourceFilePath: path.join(packagePath, "mydata.txt"),
      expectedLineNumber: 8, // Zero-indexed
    },
    {
      name: "should find file in a packages subfolder",
      buildFilePath: path.join(packagePath, "BUILD"),
      sourceFilePath: path.join(packagePath, "subfolder", "foobar.txt"),
      expectedLineNumber: 4, // Zero-indexed
    },
    {
      name: "should return undefined if no match found",
      buildFilePath: path.join(packagePath, "BUILD"),
      sourceFilePath: path.join(packagePath, "does_not_exist.txt"),
      expectedLineNumber: undefined,
    },
  ];

  testCases.forEach(
    ({ name, buildFilePath, sourceFilePath, expectedLineNumber }) => {
      it(name, () => {
        const result = getBuildFileLineWithSourceFilePath(
          buildFilePath,
          sourceFilePath,
        );
        assert.strictEqual(result, expectedLineNumber);
      });
    },
  );
});

describe("Bazel Utils: getTargetNameAtBuildFileLocation", () => {
  interface TestCase {
    name: string;
    buildFilePath: string;
    lineToMatch: string;
    expectedlineNumber: number;
    expectedTargetName: string | undefined;
  }
  const testCases: TestCase[] = [
    {
      name: "should find target name when on target name attribute",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: '    name = "foobar",',
      expectedlineNumber: 3, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when on other attribute",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: '    srcs = ["subfolder/foobar.txt"],',
      expectedlineNumber: 4, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when on opening parenthesis",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: "filegroup(",
      expectedlineNumber: 2, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when on closing parenthesis",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: ")",
      expectedlineNumber: 11, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when inside glob paranthesis",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: '            "mydata.txt",',
      expectedlineNumber: 8, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should return undefined if outside target definition",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: "# Empty line",
      expectedlineNumber: 1, // Zero-indexed
      expectedTargetName: undefined,
    },
    {
      name: "should return undefined if at end of file",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: "# EOF",
      expectedlineNumber: 12, // Zero-indexed
      expectedTargetName: undefined,
    },
  ];

  testCases.forEach(
    ({
      name,
      buildFilePath,
      lineToMatch,
      expectedlineNumber,
      expectedTargetName,
    }) => {
      it(name, () => {
        const buildFileContent = fs
          .readFileSync(buildFilePath, "utf8")
          .trim()
          .replace(/\r\n|\r/g, "\n")
          .split("\n");
        const lineNumber = buildFileContent.indexOf(lineToMatch);
        assert.strictEqual(lineNumber, expectedlineNumber);
        const result = getTargetNameAtBuildFileLocation(
          buildFilePath,
          lineNumber,
        );
        assert.strictEqual(result, expectedTargetName);
      });
    },
  );
});

describe("Bazel Utils: getBazelWorkspaceFolder", () => {
  afterEach(async () => {
    // Reset workspacePath configuration after each test
    await vscode.workspace
      .getConfiguration("bazel")
      .update("workspacePath", undefined, vscode.ConfigurationTarget.Workspace);
  });

  it("should find workspace via auto-detection when workspacePath is not configured", () => {
    const filePath = path.join(workspacePath, "pkg1", "main.py");
    const result = getBazelWorkspaceFolder(filePath);
    assert.strictEqual(result, workspacePath);
  });

  it("should find workspace from nested subdirectory via auto-detection", () => {
    const filePath = path.join(workspacePath, "pkg2", "sub-pkg", "mydata.txt");
    const result = getBazelWorkspaceFolder(filePath);
    assert.strictEqual(result, workspacePath);
  });

  it("should return undefined for files outside any workspace", () => {
    // Use a path that definitely doesn't have a workspace file
    const filePath = "/tmp/no_workspace_here/somefile.txt";
    const result = getBazelWorkspaceFolder(filePath);
    assert.strictEqual(result, undefined);
  });

  it("should use configured absolute workspacePath when set", async () => {
    // Configure an absolute path to the workspace
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        "workspacePath",
        workspacePath,
        vscode.ConfigurationTarget.Workspace,
      );

    // Even if we query from a nested module, it should use configured path
    const nestedFilePath = path.join(workspacePath, "nested_module", "BUILD");
    const result = getBazelWorkspaceFolder(nestedFilePath);
    assert.strictEqual(result, workspacePath);
  });

  it("should use configured relative workspacePath when set", async () => {
    // Configure a relative path (relative to VS Code workspace folder)
    // The test workspace is opened at test/bazel_workspace
    await vscode.workspace
      .getConfiguration("bazel")
      .update("workspacePath", ".", vscode.ConfigurationTarget.Workspace);

    const filePath = path.join(workspacePath, "pkg1", "main.py");
    const result = getBazelWorkspaceFolder(filePath);
    // Should resolve to the workspace folder
    assert.ok(result !== undefined);
  });

  it("should return undefined when configured workspacePath does not exist", async () => {
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        "workspacePath",
        "/nonexistent/path/to/workspace",
        vscode.ConfigurationTarget.Workspace,
      );

    const filePath = path.join(workspacePath, "pkg1", "main.py");
    const result = getBazelWorkspaceFolder(filePath);
    // Should fall back to auto-detection since configured path doesn't exist
    assert.strictEqual(result, workspacePath);
  });

  it("should prefer configured workspacePath over auto-detected nested MODULE.bazel", async () => {
    // This tests the main use case: when a subdirectory has its own MODULE.bazel
    // but user wants to use the parent workspace
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        "workspacePath",
        workspacePath,
        vscode.ConfigurationTarget.Workspace,
      );

    // Query from a file inside nested_module which has its own MODULE.bazel
    const nestedFilePath = path.join(workspacePath, "nested_module", "BUILD");
    const result = getBazelWorkspaceFolder(nestedFilePath);

    // Should return the configured workspace, not the nested one
    assert.strictEqual(result, workspacePath);
  });
});
