import * as vscode from "vscode";
import * as path from "path";
import * as assert from "assert";
import { BuildifierDiagnosticsManager } from "../src/buildifier";

async function openSourceFile(sourceFile: string) {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(sourceFile),
  );
  await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
}

describe("buildifier", () => {
  let disposables: vscode.Disposable[] = [];

  afterEach(() => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
    disposables = [];
  });

  const workspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );

  it("diagnostics are added from buildifier", async () => {
    // Create DiagnosticsManager and open file
    const buildFile = path.join(workspacePath, "buildifier", "BUILD");
    await openSourceFile(buildFile);
    disposables.push(new BuildifierDiagnosticsManager());

    // Promise that resolves when diagnostics are added to the file.
    const diagnosticsPromise = new Promise<vscode.Diagnostic[]>((resolve) => {
      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        const uri = vscode.Uri.file(buildFile);
        const diags = vscode.languages.getDiagnostics(uri);
        disposable.dispose();
        resolve(diags.slice(0, 1)); // Return first diagnostic only
      });
    });
    // Wait for diagnostics for this file
    const diagnostics = await diagnosticsPromise;

    // Assert the diagnostic matches expectation
    assert.deepEqual(diagnostics, [
      {
        code: "unused-variable",
        message: 'Variable "_foo" is unused. Please remove it.',
        range: {
          a: {
            a: 1,
            b: 0,
          },
          b: {
            a: 1,
            b: 4,
          },
        },
        severity: 1,
        source: "buildifier",
      },
    ]);
  });
});
