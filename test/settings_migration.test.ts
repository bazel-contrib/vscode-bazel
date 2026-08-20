import * as vscode from "vscode";
import * as assert from "assert";
import { migrateRenamedSettings } from "../src/extension/settings_migration";

describe("migrateRenamedSettings", () => {
  afterEach(async () => {
    // Best-effort cleanup of every key this suite might have touched, at
    // both scopes, so a failing assertion can't leak config into other
    // test files.
    const resets: [string, string][] = [
      ["bazel", "enableBuildifier"],
      ["bazel.buildifier", "enable"],
      ["bazel", "buildifierExecutable"],
      ["bazel.buildifier", "executable"],
      ["bazel", "queryOutputBase"],
      ["bazel.commandLine", "queryOutputBase"],
    ];
    for (const [section, name] of resets) {
      const config = vscode.workspace.getConfiguration(section);
      await config.update(name, undefined, vscode.ConfigurationTarget.Global);
      await config.update(
        name,
        undefined,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  });

  it("does nothing when no renamed setting has an explicit value", async () => {
    const migrated = await migrateRenamedSettings();
    assert.deepStrictEqual(migrated, []);
  });

  it("copies a User-scope value and clears the old key", async () => {
    await vscode.workspace
      .getConfiguration("bazel")
      .update("enableBuildifier", false, vscode.ConfigurationTarget.Global);

    const migrated = await migrateRenamedSettings();

    assert.ok(
      migrated.includes("bazel.enableBuildifier -> bazel.buildifier.enable"),
    );
    // Use inspect(), not get(): a cleared setting still falls back to its
    // schema default via get(), which happens to also be `true` here.
    assert.strictEqual(
      vscode.workspace.getConfiguration("bazel").inspect("enableBuildifier")
        ?.globalValue,
      undefined,
    );
    assert.strictEqual(
      vscode.workspace.getConfiguration("bazel.buildifier").get("enable"),
      false,
    );
  });

  it("copies a Workspace-scope value and clears the old key", async () => {
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        "buildifierExecutable",
        "/custom/buildifier",
        vscode.ConfigurationTarget.Workspace,
      );

    const migrated = await migrateRenamedSettings();

    assert.ok(
      migrated.includes(
        "bazel.buildifierExecutable -> bazel.buildifier.executable",
      ),
    );
    assert.strictEqual(
      vscode.workspace.getConfiguration("bazel").inspect("buildifierExecutable")
        ?.workspaceValue,
      undefined,
    );
    assert.strictEqual(
      vscode.workspace.getConfiguration("bazel.buildifier").get("executable"),
      "/custom/buildifier",
    );
  });

  it("is a no-op the second time it runs (already migrated)", async () => {
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        "queryOutputBase",
        "/tmp/custom-base",
        vscode.ConfigurationTarget.Workspace,
      );

    const firstRun = await migrateRenamedSettings();
    assert.ok(
      firstRun.includes(
        "bazel.queryOutputBase -> bazel.commandLine.queryOutputBase",
      ),
    );

    const secondRun = await migrateRenamedSettings();
    assert.deepStrictEqual(secondRun, []);
    assert.strictEqual(
      vscode.workspace
        .getConfiguration("bazel.commandLine")
        .get("queryOutputBase"),
      "/tmp/custom-base",
    );
  });
});
