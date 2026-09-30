import * as vscode from "vscode";
import * as assert from "assert";
import { getRenamedSetting } from "../src/extension/settings_migration";

describe("getRenamedSetting", () => {
  const G = vscode.ConfigurationTarget.Global;
  const W = vscode.ConfigurationTarget.Workspace;
  const bazel = () => vscode.workspace.getConfiguration("bazel");
  const buildifier = () =>
    vscode.workspace.getConfiguration("bazel.buildifier");

  afterEach(async () => {
    for (const t of [G, W]) {
      await bazel().update("buildifierExecutable", undefined, t);
      await buildifier().update("executable", undefined, t);
    }
  });

  it("falls back to the old name without rewriting settings", async () => {
    await bazel().update("buildifierExecutable", "old/buildifier", W);
    assert.strictEqual(
      getRenamedSetting("bazel.buildifier", "executable"),
      "old/buildifier",
    );
    assert.strictEqual(
      bazel().inspect("buildifierExecutable")?.workspaceValue,
      "old/buildifier",
    );
  });

  it("prefers the new name when both are set in the same scope", async () => {
    await bazel().update("buildifierExecutable", "old/buildifier", W);
    await buildifier().update("executable", "new/buildifier", W);
    assert.strictEqual(
      getRenamedSetting("bazel.buildifier", "executable"),
      "new/buildifier",
    );
  });

  it("lets an old name in a narrower scope win over a new name", async () => {
    await buildifier().update("executable", "user/buildifier", G);
    await bazel().update("buildifierExecutable", "repo/buildifier", W);
    assert.strictEqual(
      getRenamedSetting("bazel.buildifier", "executable"),
      "repo/buildifier",
    );
  });
});
