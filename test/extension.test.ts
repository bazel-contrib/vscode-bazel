import * as assert from "assert";
import * as vscode from "vscode";

describe("Extension activation", () => {
  it("registers the bazel.showOutputChannel command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("bazel.showOutputChannel"),
      "bazel.showOutputChannel command should be registered",
    );
  });
});
