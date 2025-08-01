import * as path from "path";
import * as vscode from "vscode";
import * as assert from "assert";

// Simple mock that implements the required interface
class MockTargetInfo {
  constructor(
    public rule: {
      name: string;
      location: string;
    },
  ) {}
}

function assertEditorIsActive(
  expectedPath: string,
  expectedLine: number,
  expectedCharacter: number,
) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    throw new Error("No active editor found");
  }
  assert.strictEqual(activeEditor.document.uri.fsPath, expectedPath);

  const position = activeEditor.selection.active;
  assert.strictEqual(
    position.line + 1,
    expectedLine,
    `Expected cursor to be on line ${expectedLine} but was on line ${position.line + 1}`,
  );

  assert.strictEqual(
    position.character + 1,
    expectedCharacter,
    `Expected cursor to be at character ${expectedCharacter} but was at ${position.character + 1}`,
  );
}

describe("Jump to Label", () => {
  const workspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );

  beforeEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("should jump to correct line in BUILD file", async () => {
    // GIVEN
    const targetLabel = "//pkg1:main";
    const expectedFile = path.join(workspacePath, "pkg1", "BUILD");
    const expectedLine = 1;
    const expectedCharacter = 10;

    // Mock the quick pick to return our target
    const mockTargetInfo = new MockTargetInfo({
      name: targetLabel,
      location: `${expectedFile}:${expectedLine}:${expectedCharacter}`,
    });

    // WHEN
    await vscode.commands.executeCommand("bazel.jumpToLabel", mockTargetInfo);

    // THEN
    assertEditorIsActive(expectedFile, expectedLine, expectedCharacter);
  });
});
