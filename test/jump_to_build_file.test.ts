import * as path from "path";
import * as vscode from "vscode";
import * as assert from "assert";

async function openSourceFile(sourceFile: string) {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(sourceFile),
  );
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
}

function assertEditorIsActive(expectedPath: string) {
  const activeEditorBefore = vscode.window.activeTextEditor;
  if (!activeEditorBefore) {
    throw new Error("No active editor found");
  }
  assert.strictEqual(activeEditorBefore.document.uri.fsPath, expectedPath);
}

interface TestCase {
  name: string;
  sourceFile: string;
  expectedBuildFile: string | null; // null means no BUILD file should be found
}

describe("Jump to Build File", () => {
  const workspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );

  const testCases: TestCase[] = [
    {
      name: "should find BUILD file from package root",
      sourceFile: path.join(workspacePath, "pkg1", "main.py"),
      expectedBuildFile: path.join(workspacePath, "pkg1", "BUILD"),
    },
    {
      name: "should find BUILD file from a packages subfolder",
      sourceFile: path.join(workspacePath, "pkg1", "subfolder", "foo.txt"),
      expectedBuildFile: path.join(workspacePath, "pkg1", "BUILD"),
    },
    {
      name: "should find BUILD file from a subpackage folder",
      sourceFile: path.join(
        workspacePath,
        "pkg2",
        "sub-pkg",
        "subfolder",
        "foobar.txt",
      ),
      expectedBuildFile: path.join(workspacePath, "pkg2", "sub-pkg", "BUILD"),
    },
    {
      name: "should not change active file if already at BUILD file",
      sourceFile: path.join(workspacePath, "pkg1", "BUILD"),
      expectedBuildFile: null,
    },
    {
      name: "should not change active file if no parent BUILD file",
      sourceFile: path.join(workspacePath, "non-pkg", "bar.txt"),
      expectedBuildFile: null,
    },
    {
      name: "should not change active file if outside a Bazel workspace",
      sourceFile: __filename,
      expectedBuildFile: null,
    },
  ];

  beforeEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  testCases.forEach(({ name, sourceFile, expectedBuildFile }) => {
    it(name, async () => {
      // GIVEN
      await openSourceFile(sourceFile);
      assertEditorIsActive(sourceFile);

      // WHEN
      await vscode.commands.executeCommand("bazel.jumpToBuildFile");

      // THEN
      const expectedFile = expectedBuildFile || sourceFile;
      assertEditorIsActive(expectedFile);
    });
  });

  it("should show error when no editor is active", async () => {
    // GIVEN
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    // WHEN
    let errorShown = false;
    const disposable = vscode.window.onDidChangeActiveTextEditor(() => {
      errorShown = true;
    });

    await vscode.commands.executeCommand("bazel.jumpToBuildFile");

    // THEN
    assert.strictEqual(
      errorShown,
      false,
      "No editor should be opened when no file is active",
    );

    // Clean up
    disposable.dispose();
  });
});
