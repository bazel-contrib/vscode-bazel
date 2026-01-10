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

function assertCursorPosition(expectedLine: number) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    throw new Error("No active editor found");
  }
  const position = activeEditor.selection.active;
  assert.strictEqual(
    position.line + 1, // Convert 0-based to 1-based for readability
    expectedLine,
    `Expected cursor to be on line ${expectedLine}, but found on line ${position.line + 1}`,
  );
}

interface TestCase {
  name: string;
  sourceFile: string;
  expectedBuildFile: string | null; // null means no BUILD file should be found
  expectedLineNumber?: number; // line number where the file should be referenced (1-based)
}

describe("Go to Build File", () => {
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
      expectedLineNumber: 10, // line with srcs=["main.py"]
    },
    {
      name: "should find BUILD file from a packages subfolder",
      sourceFile: path.join(workspacePath, "pkg1", "subfolder", "foo.txt"),
      expectedBuildFile: path.join(workspacePath, "pkg1", "BUILD"),
      expectedLineNumber: 20, // line with srcs=["subfolder/foo.txt"]
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
      expectedLineNumber: 3, // line with srcs=["subfolder/foobar.txt"]
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

  testCases.forEach(
    ({ name, sourceFile, expectedBuildFile, expectedLineNumber }) => {
      it(name, async () => {
        // GIVEN
        await openSourceFile(sourceFile);
        assertEditorIsActive(sourceFile);

        // WHEN
        await vscode.commands.executeCommand("bazel.goToBuildFile");

        // THEN
        const expectedFile = expectedBuildFile || sourceFile;
        assertEditorIsActive(expectedFile);

        // If we found a BUILD file, verify the cursor is on the correct line
        if (expectedBuildFile && expectedLineNumber !== undefined) {
          assertCursorPosition(expectedLineNumber);
        }
      });
    },
  );

  it("should show error when no editor is active", async () => {
    // GIVEN
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    // WHEN
    let errorShown = false;
    const disposable = vscode.window.onDidChangeActiveTextEditor(() => {
      errorShown = true;
    });

    await vscode.commands.executeCommand("bazel.goToBuildFile");

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
