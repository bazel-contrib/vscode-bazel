import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";

import {
  ActiveBazelRootChange,
  ActiveBazelRoots,
  ROOT_CHANGE_DELAY_MS,
} from "../src/bazel/active_bazel_roots";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("ActiveBazelRoots", () => {
  const workspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );
  let roots: ActiveBazelRoots;
  let changes: ActiveBazelRootChange[];

  async function pin(configuredPath: string | undefined): Promise<void> {
    await vscode.workspace
      .getConfiguration("bazel.workspace")
      .update("path", configuredPath, vscode.ConfigurationTarget.Workspace);
  }

  beforeEach(() => {
    roots = new ActiveBazelRoots();
    changes = [];
    roots.onDidChange((change) => changes.push(change));
  });

  afterEach(async () => {
    roots.dispose();
    await pin(undefined);
  });

  it("fires when the pin changes the root", async () => {
    await pin("nested_module");
    roots.update();

    assert.strictEqual(changes.length, 1);
    assert.deepStrictEqual(changes[0].previous, {
      path: workspacePath,
      pinned: false,
    });
    assert.deepStrictEqual(changes[0].current, {
      path: path.join(workspacePath, "nested_module"),
      pinned: true,
    });
  });

  it("does not fire when nothing changed", () => {
    roots.update();

    assert.deepStrictEqual(changes, []);
  });

  it("re-resolves on its own after a setting change", async () => {
    await pin("nested_module");
    await sleep(ROOT_CHANGE_DELAY_MS + 200);

    assert.strictEqual(changes.length, 1);
    assert.strictEqual(
      changes[0].current?.path,
      path.join(workspacePath, "nested_module"),
    );
  });

  it("ignores a setting change reverted within the delay", async () => {
    await pin("nested_module");
    await pin(undefined);
    await sleep(ROOT_CHANGE_DELAY_MS + 200);

    assert.deepStrictEqual(changes, []);
  });
});
