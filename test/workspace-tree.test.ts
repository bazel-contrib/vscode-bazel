import * as assert from "assert";
import * as vscode from "vscode";
import { BazelWorkspaceInfo } from "../src/bazel";
import { blaze_query } from "../src/protos";
import {
  BazelWorkspaceTreeProvider,
  IBazelQuerier,
} from "../src/workspace-tree";

class FakeBazelQuerier implements IBazelQuerier {
  constructor(
    private readonly packages: string[],
    private readonly targets: Map<string, blaze_query.IQueryResult>,
  ) {}

  queryWorkspace(
    workspaceFolder: vscode.WorkspaceFolder,
  ): Thenable<BazelWorkspaceInfo | undefined> {
    // Assuming query from root for simplest test case. (single root)
    return Promise.resolve(
      new BazelWorkspaceInfo(workspaceFolder.uri.fsPath, workspaceFolder),
    );
  }

  queryPackages(workspaceInfo: BazelWorkspaceInfo): Thenable<string[]> {
    void workspaceInfo;
    return Promise.resolve(this.packages);
  }

  queryChildrenTargets(
    workspaceInfo: BazelWorkspaceInfo,
    packagePath: string,
  ): Thenable<blaze_query.IQueryResult> {
    void workspaceInfo;
    return Promise.resolve(this.targets.get(packagePath));
  }
}

function fakeWorkspaceFolder(path: string): vscode.WorkspaceFolder {
  const uri = vscode.Uri.file(path);
  return {
    uri,
    name: path,
    index: 0,
  };
}

async function workspaceTreeProviderForTest(
  querier: IBazelQuerier,
  workspaceFolders: vscode.WorkspaceFolder[],
): Promise<BazelWorkspaceTreeProvider> {
  const provider = new BazelWorkspaceTreeProvider(querier);
  await provider.refresh(workspaceFolders);
  return provider;
}

describe("The Bazel workspace tree provider", () => {
  it("Returns nothing on empty workspace folders", async () => {
    const querier = new FakeBazelQuerier([], new Map());
    const workspaceFolders: vscode.WorkspaceFolder[] = [];
    const provider = await workspaceTreeProviderForTest(
      querier,
      workspaceFolders,
    );

    const topChildren = await provider.getChildren();
    assert.deepStrictEqual(topChildren, []);
  });

  it("Flatten on single workspace folder", async () => {
    const querier = new FakeBazelQuerier(
      ["//a"],
      new Map([
        ["", { target: [] }],
        ["//a", { target: [] }],
      ]),
    );
    const workspaceFolders: vscode.WorkspaceFolder[] = [
      fakeWorkspaceFolder("fake/path"),
    ];
    const provider = await workspaceTreeProviderForTest(
      querier,
      workspaceFolders,
    );

    const topChildren = await provider.getChildren();
    assert.equal(topChildren[0].getLabel(), "//a");
  });

  it("Not flatten on 2 workspace folders", async () => {
    const querier = new FakeBazelQuerier([], new Map([["", { target: [] }]]));
    const workspaceFolders: vscode.WorkspaceFolder[] = [
      fakeWorkspaceFolder("fake/path0"),
      fakeWorkspaceFolder("fake/path1"),
    ];
    const provider = await workspaceTreeProviderForTest(
      querier,
      workspaceFolders,
    );

    const topChildren = await provider.getChildren();
    assert.equal(topChildren[0].getLabel(), "fake/path0");
    assert.equal(topChildren[1].getLabel(), "fake/path1");
  });

  it("Can handle root package", async () => {
    const querier = new FakeBazelQuerier(
      ["//", "//a"],
      new Map([
        ["", { target: [] }],
        ["//", { target: [] }],
        ["//a", { target: [] }],
      ]),
    );
    const workspaceFolders: vscode.WorkspaceFolder[] = [
      fakeWorkspaceFolder("fake/path"),
    ];
    const provider = await workspaceTreeProviderForTest(
      querier,
      workspaceFolders,
    );

    const topChildren = await provider.getChildren();
    const root = topChildren[0];
    assert.equal(root.getLabel(), "//");
    const rootChildren = await root.getChildren();
    const a = rootChildren[0];
    assert.equal(a.getLabel(), "a");
  });

  it("Skips non-package folders", async () => {
    const querier = new FakeBazelQuerier(
      ["//a", "//a/b/c"],
      new Map([
        ["", { target: [] }],
        ["//a", { target: [] }],
        ["//a/b/c", { target: [] }],
      ]),
    );
    const workspaceFolders: vscode.WorkspaceFolder[] = [
      fakeWorkspaceFolder("fake/path"),
    ];
    const provider = await workspaceTreeProviderForTest(
      querier,
      workspaceFolders,
    );

    const topChildren = await provider.getChildren();
    const a = topChildren[0];
    assert.equal(a.getLabel(), "//a");
    const aChildren = await topChildren[0].getChildren();
    const bc = aChildren[0];
    assert.equal(bc.getLabel(), "b/c");
  });

  it("Handles external dependencies (single workspace)", async () => {
    const querier = new FakeBazelQuerier(
      [
        "@repo//",
        "@repo2//a",
        "@repo2//a/b",
        "@repo2//c",
        "@repo2//c/d/e",
        "@repo3//f",
      ],
      new Map([
        ["", { target: [] }],
        ["@repo//", { target: [] }],
        ["@repo2//a", { target: [] }],
        ["@repo2//a/b", { target: [] }],
        ["@repo2//c", { target: [] }],
        ["@repo2//c/d/e", { target: [] }],
        ["@repo3//f", { target: [] }],
      ]),
    );
    const workspaceFolders: vscode.WorkspaceFolder[] = [
      fakeWorkspaceFolder("fake/path"),
    ];
    const provider = await workspaceTreeProviderForTest(
      querier,
      workspaceFolders,
    );

    const topChildren = await provider.getChildren();
    const repo = topChildren[0];
    assert.strictEqual(repo.getLabel(), "@repo//");
    assert.strictEqual((await repo.getChildren()).length, 0);

    const repo2a = topChildren[1];
    assert.strictEqual(repo2a.getLabel(), "@repo2//a");
    const repo2aChildren = await repo2a.getChildren();
    const repo2ab = repo2aChildren[0];
    assert.strictEqual(repo2ab.getLabel(), "b");

    const repo2c = topChildren[2];
    assert.strictEqual(repo2c.getLabel(), "@repo2//c");
    const repo2cChildren = await repo2c.getChildren();
    const repo2cde = repo2cChildren[0];
    assert.strictEqual(repo2cde.getLabel(), "d/e");

    const repo3f = topChildren[3];
    assert.strictEqual(repo3f.getLabel(), "@repo3//f");
  });

  // TODO query target test cases.
});
