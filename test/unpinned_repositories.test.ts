import * as assert from "assert";
import * as vscode from "vscode";
import { openFixture } from "./index_test_helpers";

describe("unpinned repository warnings", function (this: Mocha.Suite) {
  this.timeout(20000);

  afterEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  it("warns about unpinned repository declarations", async () => {
    const document = await openFixture("pkg1", "unpinned.bzl");
    await vscode.window.showTextDocument(document);
    // Other sources (e.g. buildifier) may publish first; wait for ours.
    const ours = () =>
      vscode.languages
        .getDiagnostics(document.uri)
        .filter((d) => d.code === "unpinned-repository");
    const deadline = Date.now() + 5000;
    let diagnostics = ours();
    while (diagnostics.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      diagnostics = ours();
    }
    const names = diagnostics
      .map((d) => /"([^"]+)"/.exec(d.message)?.[1])
      .sort();
    assert.deepStrictEqual(names, [
      "unpinned_archive",
      "unpinned_file",
      "unpinned_git",
      "unpinned_via_maybe",
    ]);
    assert.ok(
      diagnostics.every(
        (d) => d.severity === vscode.DiagnosticSeverity.Warning,
      ),
    );
  });
});
