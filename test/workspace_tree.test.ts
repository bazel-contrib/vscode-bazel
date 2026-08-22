import * as path from "path";
import * as vscode from "vscode";
import * as assert from "assert";
import * as sinon from "sinon";
import { getWorkspaceTreeProviderForTesting } from "../src/extension/extension";
import * as fs from "fs";
import { BazelQuery } from "../src/bazel";
import { ILogger } from "../src/extension/logger";
import { Resources } from "../src/extension/resources";
import { blaze_query } from "../src/protos";
import {
  BazelWorkspaceTreeProvider,
  IBazelTreeItem,
} from "../src/workspace-tree";

describe("Bazel Workspace Tree", function (this: Mocha.Suite) {
  this.timeout(10000);
  const extensionPath: string = path.join(__dirname, "..", "..");
  const workspacePath = path.join(extensionPath, "test", "bazel_workspace");
  const rootBuildFilePath = path.join(workspacePath, "BUILD");
  const workspaceTreeProvider: BazelWorkspaceTreeProvider =
    getWorkspaceTreeProviderForTesting()!;
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

    await vscode.workspace
      .getConfiguration("bazel")
      .update("workspacePath", undefined, vscode.ConfigurationTarget.Workspace);
  });

  it("should match workspace structure", async () => {
    await verifyTreeStructure(
      {
        "//buildifier": {},
        "//nested_module": {},
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
        "//buildifier": {},
        "//nested_module": {},
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

  describe("queryExpression filtering", () => {
    afterEach(async () => {
      await vscode.workspace
        .getConfiguration("bazel.commandLine")
        .update(
          "queryExpression",
          undefined,
          vscode.ConfigurationTarget.Workspace,
        );
    });

    it("should filter targets by rule kind", async () => {
      await vscode.workspace
        .getConfiguration("bazel.commandLine")
        .update(
          "queryExpression",
          "kind('py_.*', //...)",
          vscode.ConfigurationTarget.Workspace,
        );

      await verifyTreeStructure(
        {
          "//pkg1": {
            ":main  (py_binary)": {},
            ":pkg1  (py_library)": {},
          },
        },
        await workspaceTreeProvider.getChildren(),
      );
    });

    it("should filter to filegroup targets only", async () => {
      await vscode.workspace
        .getConfiguration("bazel.commandLine")
        .update(
          "queryExpression",
          "kind('filegroup', //...)",
          vscode.ConfigurationTarget.Workspace,
        );

      await verifyTreeStructure(
        {
          "//pkg1": {
            ":foo  (filegroup)": {},
            ":src_files  (filegroup)": {},
          },
          "//pkg2/sub-pkg": {
            ":foobar  (filegroup)": {},
          },
        },
        await workspaceTreeProvider.getChildren(),
      );
    });

    it("should filter to a single target", async () => {
      await vscode.workspace
        .getConfiguration("bazel.commandLine")
        .update(
          "queryExpression",
          "//pkg1:main",
          vscode.ConfigurationTarget.Workspace,
        );

      await verifyTreeStructure(
        {
          "//pkg1": {
            ":main  (py_binary)": {},
          },
        },
        await workspaceTreeProvider.getChildren(),
      );
    });

    it("should show empty tree when expression matches nothing", async () => {
      await vscode.workspace
        .getConfiguration("bazel.commandLine")
        .update(
          "queryExpression",
          "kind('java_library', //...)",
          vscode.ConfigurationTarget.Workspace,
        );

      await verifyTreeStructure({}, await workspaceTreeProvider.getChildren());
    });
  });

  it("queries a Bazel root nested below the VS Code folder", async () => {
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        "workspacePath",
        "nested_module",
        vscode.ConfigurationTarget.Workspace,
      );

    const sandbox = sinon.createSandbox();
    const queryPackages = sandbox
      .stub(BazelQuery.prototype, "queryPackages")
      .resolves([]);
    const queryTargets = sandbox
      .stub(BazelQuery.prototype, "queryTargets")
      .resolves(blaze_query.QueryResult.create());
    const logger: ILogger = {
      logDebug: sandbox.stub(),
      logInfo: sandbox.stub(),
      logWarn: sandbox.stub(),
      logError: sandbox.stub(),
    };
    const provider = new BazelWorkspaceTreeProvider(
      new Resources(extensionPath),
      logger,
    );

    try {
      await provider.getChildren();

      const configuredRoot = path.join(workspacePath, "nested_module");
      assert.strictEqual(provider.workspaceFolderTreeItems?.length, 1);
      assert.strictEqual(
        provider.workspaceFolderTreeItems?.[0].getWorkspaceInfo()
          .bazelWorkspacePath,
        configuredRoot,
      );
      assert.strictEqual(queryPackages.callCount, 1);
      assert.strictEqual(queryTargets.callCount, 1);
      assert.strictEqual(queryPackages.firstCall.args[0], "...:*");
      assert.strictEqual(
        queryTargets.firstCall.args[0],
        "(...:*) intersect (:all)",
      );
      assert.strictEqual(
        queryPackages.firstCall.thisValue.workingDirectory,
        configuredRoot,
      );
      assert.strictEqual(
        queryTargets.firstCall.thisValue.workingDirectory,
        configuredRoot,
      );
    } finally {
      provider.dispose();
      sandbox.restore();
    }
  });

  it("does not select tree item when bazel view is hidden", async () => {
    // GIVEN another view is active (Search) instead of the Explorer
    await vscode.commands.executeCommand("workbench.view.search");
    assert.strictEqual(
      workspaceTreeProvider.lastRevealedTreeItem?.getLabel(),
      undefined,
    );

    // WHEN opening a file in the workspace
    await openSourceFile(path.join(workspacePath, "pkg1", "BUILD"));

    // THEN the Bazel workspace tree selection should not change
    assert.strictEqual(
      workspaceTreeProvider.lastRevealedTreeItem?.getLabel(),
      undefined,
    );
  });
});
