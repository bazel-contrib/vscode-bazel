import * as vscode from "vscode";

import { BaseExtensionFeature } from "../extension/extension_feature";
import {
  checkBazelIsAvailable,
  checkBazelWorkspaceAvailable,
} from "../bazel/bazel_availability";
import { BazelWorkspaceTreeProvider } from "./workspace_tree_provider";
import { Resources } from "../extension/resources";

/**
 * WorkspaceTree feature for Bazel BUILD files.
 * Responsible for:
 * - Extension activation
 * - Precondition checks
 * - Provider registration with VSCode
 */
export class WorkspaceTreeFeature extends BaseExtensionFeature {
  private workspaceTreeProvider?: BazelWorkspaceTreeProvider;

  constructor(context: vscode.ExtensionContext) {
    super("WorkspaceTree", context);
  }

  enable(context: vscode.ExtensionContext): boolean {
    // Precondition: bazel executable available
    if (!checkBazelIsAvailable()) {
      this.logWarn("Can not activate, no bazel executable found.");
      return false;
    }

    // Create and register the WorkspaceTree provider
    this.workspaceTreeProvider = new BazelWorkspaceTreeProvider(
      Resources.fromExtensionContext(context),
      this.getLogger(),
    );
    this.disposables.push(this.workspaceTreeProvider);

    // Create and register the tree view
    const treeView = vscode.window.createTreeView("bazelWorkspace", {
      treeDataProvider: this.workspaceTreeProvider,
      showCollapseAll: true,
    });
    this.disposables.push(treeView);
    this.workspaceTreeProvider.setTreeView(treeView);

    // Register command to manually refresh the tree view
    const refreshCommand = vscode.commands.registerCommand(
      "bazel.workspaceTree.refresh",
      () => {
        this.workspaceTreeProvider!.refresh();
      },
    );
    this.disposables.push(refreshCommand);

    // Register command to manually refresh the build targets
    const refreshTargetsCommand = vscode.commands.registerCommand(
      "bazel.refreshBazelBuildTargets",
      () => {
        this.workspaceTreeProvider!.refresh();
      },
    );
    this.disposables.push(refreshTargetsCommand);

    return true;
  }

  /**
   * Get the workspace tree provider for testing purposes.
   */
  getWorkspaceTreeProvider(): BazelWorkspaceTreeProvider | undefined {
    return this.workspaceTreeProvider;
  }
}
