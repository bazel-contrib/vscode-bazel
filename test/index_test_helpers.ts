import * as path from "path";
import * as vscode from "vscode";

/** Absolute path of the fixture workspace opened by the test runner. */
export const fixtureWorkspacePath = path.join(
  __dirname,
  "..",
  "..",
  "test",
  "bazel_workspace",
);

/** Opens a fixture document without showing it. */
export async function openFixture(
  ...segments: string[]
): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument(
    vscode.Uri.file(path.join(fixtureWorkspacePath, ...segments)),
  );
}

/** Finds the position of the first occurrence of `needle` in a document. */
export function positionOf(
  document: vscode.TextDocument,
  needle: string,
  offsetInNeedle = 1,
): vscode.Position {
  const index = document.getText().indexOf(needle);
  if (index === -1) {
    throw new Error(`"${needle}" not found in ${document.uri.fsPath}`);
  }
  return document.positionAt(index + offsetInNeedle);
}
