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

describe("buildifier", () => {
  it("diagnostics are added from buildifier", async () => {
    const buildFile = path.join(workspacePath, "buildifier", "BUILD");
    await openSourceFile(buildFile);

    disposables.push(new BuildifierDiagnosticsManager());

    const diagnostics = vscode.languages.getDiagnostics(
      vscode.Uri.file(buildFile),
    );

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
