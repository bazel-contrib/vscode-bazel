import * as path from "path";
import * as vscode from "vscode";
import * as assert from "assert";
import { _workspaceTreeProvider } from "../src/extension/extension";
import * as fs from "fs";
import { IBazelTreeItem } from "../src/workspace-tree/bazel_tree_item";
import { BazelWorkspaceTreeProvider } from "../src/workspace-tree";

describe("Bazel Workspace Tree", function (this: Mocha.Suite) {
  this.timeout(10000);
  const extensionPath: string = path.join(__dirname, "..", "..");
  const workspacePath = path.join(extensionPath, "test", "bazel_workspace");
  const rootBuildFilePath = path.join(workspacePath, "BUILD");
  const workspaceTreeProvider: BazelWorkspaceTreeProvider =
    _workspaceTreeProvider;
  type ExpectedNodes = {
    [key: string]: ExpectedNodes | Record<string, never>;
  };

  /**
   * Recursively verifies that the actual tree structure matches the expected structure.
   *
   * This function compares a tree of IBazelTreeItem nodes against an expected structure
   * defined by the ExpectedNodes type. It checks:
   * 1. That the number of children matches the expected count
   * 2. That each node's label matches the expected label at the same position
   * 3. Recursively verifies the structure of child nodes
   */
  async function verifyTreeStructure(
    expectedNodes: ExpectedNodes,
    actualChildren: IBazelTreeItem[],
  ): Promise<void> {
    assert.strictEqual(
      actualChildren.length,
      Object.keys(expectedNodes).length,
    );

    for (let i = 0; i < actualChildren.length; i++) {
      const expectedNode = Object.keys(expectedNodes)[i];
      const actualNode = actualChildren[i];
      assert.strictEqual(actualNode.getLabel(), expectedNode);
      if (Object.keys(expectedNodes[expectedNode]).length > 0) {
        const actualGrandchildren = await actualNode.getChildren();
        await verifyTreeStructure(
          expectedNodes[expectedNode],
          actualGrandchildren,
        );
      }
    }
  }

  async function openSourceFile(sourceFile: string) {
    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.file(sourceFile),
    );
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One, false);
  }

  before(async () => {
    if (!workspaceTreeProvider) {
      throw new Error("Failed to get workspace tree provider from extension");
    }
  });

  afterEach(async () => {
    // Close all editors
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");

    // Clean up test files
    try {
      await fs.promises.unlink(rootBuildFilePath);
    } catch (e) {
      // ignore since not every test creates the file
    }
  });

  it("should match workspace structure", async () => {
    await verifyTreeStructure(
      {
        "//pkg1": {
          ":foo  (filegroup)": {},
          ":main  (py_binary)": {},
          ":pkg1  (py_library)": {},
          ":src_files  (filegroup)": {},
        },
        "//pkg2": {
          "sub-pkg": {
            ":foobar  (filegroup)": {},
          },
        },
      },
      await workspaceTreeProvider.getChildren(),
    );
  });

  it("should update tree when BUILD file is added", async () => {
    // WHEN
    await fs.promises.writeFile(
      rootBuildFilePath,
      'filegroup(name="bar",srcs=["non-pkg/bar.txt"])',
    );

    // THEN
    await verifyTreeStructure(
      {
        "//pkg1": {
          ":foo  (filegroup)": {},
          ":main  (py_binary)": {},
          ":pkg1  (py_library)": {},
          ":src_files  (filegroup)": {},
        },
        "//pkg2": {
          "sub-pkg": {
            ":foobar  (filegroup)": {},
          },
        },
        ":bar  (filegroup)": {},
      },
      await workspaceTreeProvider.getChildren(),
    );
  });

  it("selects the right tree item when file is opened", async () => {
    // GIVEN
    assert.strictEqual(
      workspaceTreeProvider.lastRevealedTreeItem?.getLabel(),
      undefined,
    );
    // WHEN opening a file in the workspace
    await openSourceFile(path.join(workspacePath, "pkg1", "BUILD"));
    // THEN the tree item is selected
    assert.strictEqual(
      workspaceTreeProvider.lastRevealedTreeItem?.getLabel(),
      "//pkg1",
    );
  });
});
