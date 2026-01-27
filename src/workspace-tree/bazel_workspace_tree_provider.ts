// Copyright 2018 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as vscode from "vscode";
import * as path from "path";
import { BazelWorkspaceInfo } from "../bazel";
import { IBazelTreeItem } from "./bazel_tree_item";
import { BazelWorkspaceFolderTreeItem } from "./bazel_workspace_folder_tree_item";
import { BazelPackageTreeItem } from "./bazel_package_tree_item";
import { Resources } from "../extension/resources";
import { logError } from "../extension/logger";

/**
 * Provides a tree of Bazel build packages and targets for the VS Code explorer
 * interface.
 */
export class BazelWorkspaceTreeProvider
  implements vscode.TreeDataProvider<IBazelTreeItem>, vscode.Disposable
{
  /** Fired when BUILD files change in the workspace. */
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<IBazelTreeItem | void>();
  public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  /** The cached toplevel items. */
  public workspaceFolderTreeItems: BazelWorkspaceFolderTreeItem[] | undefined =
    undefined;
  private treeView: vscode.TreeView<IBazelTreeItem> | undefined = undefined;
  private disposables: vscode.Disposable[] = [];

  // Track the last selected file URI to avoid unnecessary updates
  private lastSelectedUri: vscode.Uri | undefined = undefined;
  // For testing, keep track of last revealed tree item
  public lastRevealedTreeItem: IBazelTreeItem | undefined = undefined;

  // Debouncing timeout to reduce refresh frequency
  private refreshTimeout: NodeJS.Timeout | undefined = undefined;
  // Flag to avoid running multiple refreshes in parallel
  private isCurrentlyRefreshing: boolean = false;
  // Flag to track if a refresh is necessary when the tree view becomes visible
  private runRefreshWhenTreeViewBecomesVisible: boolean = false;

  public static fromExtensionContext(
    context: vscode.ExtensionContext,
  ): BazelWorkspaceTreeProvider {
    return new BazelWorkspaceTreeProvider(
      Resources.fromExtensionContext(context),
    );
  }

  /**
   * Initializes a new tree provider with the given extension context.
   *
   * @param context The VS Code extension context.
   */
  constructor(private readonly resources: Resources) {
    const buildFilesWatcher = vscode.workspace.createFileSystemWatcher(
      "**/{BUILD,BUILD.bazel}",
      false,
      false,
      false,
    );

    this.disposables.push(
      buildFilesWatcher,
      buildFilesWatcher.onDidChange(() => this.queueRefresh()),
      buildFilesWatcher.onDidCreate(() => this.queueRefresh()),
      buildFilesWatcher.onDidDelete(() => this.queueRefresh()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()),
      vscode.window.onDidChangeActiveTextEditor(() =>
        this.syncSelectedTreeItem(),
      ),
      vscode.workspace.onDidOpenTextDocument(() => this.syncSelectedTreeItem()),
    );

    this.updateWorkspaceFolderTreeItems();
  }

  public getParent(
    element: IBazelTreeItem,
  ): vscode.ProviderResult<IBazelTreeItem> {
    if (element) {
      return element.getParent();
    }
    return undefined;
  }

  public getChildren(element?: IBazelTreeItem): Thenable<IBazelTreeItem[]> {
    // If we're given an element, we're not asking for the top-level elements,
    // so just delegate to that element to get its children.
    if (element) {
      return element.getChildren();
    }

    if (this.workspaceFolderTreeItems === undefined) {
      this.updateWorkspaceFolderTreeItems();
    }

    if (this.workspaceFolderTreeItems && vscode.workspace.workspaceFolders) {
      // If the user has a workspace open and there's only one folder in it,
      // then don't show the workspace folder; just show its packages at the top
      // level.
      if (vscode.workspace.workspaceFolders.length === 1) {
        const folderItem = this.workspaceFolderTreeItems[0];
        return folderItem.getChildren();
      }

      // If the user has multiple workspace folders open, then show them as
      // individual top level items.
      return Promise.resolve(this.workspaceFolderTreeItems);
    }

    // If the user doesn't have a folder open in the workspace, or none of them
    // have Bazel workspaces, don't show anything.
    return Promise.resolve([]);
  }

  public getTreeItem(element: IBazelTreeItem): vscode.TreeItem {
    const label = element.getLabel();
    const collapsibleState = element.mightHaveChildren()
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    const treeItem = new vscode.TreeItem(label, collapsibleState);
    treeItem.contextValue = element.getContextValue();
    treeItem.iconPath = element.getIcon();
    treeItem.tooltip = element.getTooltip();
    treeItem.command = element.getCommand();
    return treeItem;
  }

  /**
   * Forces a re-query and refresh of the tree's contents.
   * This method is called both directly and through the debounced queue.
   * Handles lazy loading by checking tree visibility.
   */
  public refresh() {
    if (!this.isTreeViewVisible()) {
      this.runRefreshWhenTreeViewBecomesVisible = true;
      return;
    }

    try {
      this.isCurrentlyRefreshing = true;
      this.runRefreshWhenTreeViewBecomesVisible = false;
      this.updateWorkspaceFolderTreeItems();
      this.onDidChangeTreeDataEmitter.fire();
    } finally {
      this.isCurrentlyRefreshing = false;
    }
  }

  /**
   * Queues a refresh operation with debouncing to handle rapid file changes.
   * This ensures that the last change is always picked up while avoiding
   * excessive refresh operations during bulk operations like git checkout.
   * Called when BUILD files are created, deleted, or changed.
   */
  private queueRefresh(): void {
    // Clear and restart any existing timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    // Set a timeout to perform refresh after a short delay
    // This avoids excessive refreshes during bulk operations like git checkout
    this.refreshTimeout = setTimeout(() => {
      this.refreshTimeout = undefined;
      if (this.isCurrentlyRefreshing) {
        // We don't want to run multiple refreshes in parallel,
        // but we want to ensure that the last change is always picked up,
        // so just queue another refresh.
        this.queueRefresh();
      } else {
        this.refresh();
      }
    }, 500); // Wait 500ms after the last change
  }

  /**
   * Checks if the tree view is currently visible.
   * Used for lazy loading to avoid unnecessary refreshes.
   */
  private isTreeViewVisible(): boolean {
    return this.treeView?.visible === true;
  }

  /** Refresh the cached BazelWorkspaceFolderTreeItems. */
  private updateWorkspaceFolderTreeItems() {
    if (vscode.workspace.workspaceFolders) {
      this.workspaceFolderTreeItems = vscode.workspace.workspaceFolders
        .map((folder) => {
          const workspaceInfo = BazelWorkspaceInfo.fromWorkspaceFolder(folder);
          if (workspaceInfo) {
            return new BazelWorkspaceFolderTreeItem(
              this.resources,
              workspaceInfo,
            );
          }
          return undefined;
        })
        .filter((folder) => folder !== undefined);
    } else {
      this.workspaceFolderTreeItems = [];
    }

    // All the UI to update based on having items.
    const haveBazelWorkspace = this.workspaceFolderTreeItems.length !== 0;

    vscode.commands.executeCommand(
      "setContext",
      "bazel.haveWorkspace",
      haveBazelWorkspace,
    );
  }

  public dispose() {
    // Clear any pending timeout
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  /**
   * Sets the tree view instance for this provider.
   * This should be called after creating the tree view in the extension's activate function.
   */
  public setTreeView(treeView: vscode.TreeView<IBazelTreeItem>): void {
    this.treeView = treeView;

    // Set up visibility change handler for lazy loading
    this.disposables.push(
      this.treeView.onDidChangeVisibility(() => {
        this.onTreeViewVisibilityChanged();
      }),
    );
  }

  /**
   * Handles tree view visibility changes for lazy loading.
   * When the tree becomes visible and there's a pending refresh, performs the refresh.
   */
  private onTreeViewVisibilityChanged(): void {
    if (this.isTreeViewVisible() && this.runRefreshWhenTreeViewBecomesVisible) {
      // Tree became visible and we have a pending refresh
      this.refresh();
    }
  }

  /**
   * Reveals and selects the given tree item in the tree view.
   */
  private async revealTreeItem(treeItem: IBazelTreeItem): Promise<void> {
    try {
      this.lastRevealedTreeItem = treeItem;
      await this.treeView?.reveal(treeItem, {
        select: true,
        focus: false,
        expand: true,
      });
    } catch (error) {
      logError("Failed to reveal tree item:", error);
      this.lastRevealedTreeItem = undefined;
    }
  }

  /**
   * Gets the package tree item for the given file URI.
   * Uses the workspace folder's package cache for lookups.
   */
  private getPackageTreeItemFromUri(
    fileUri: vscode.Uri,
  ): BazelPackageTreeItem | undefined {
    const workspaceFolderVSCode = vscode.workspace.getWorkspaceFolder(fileUri);
    if (!workspaceFolderVSCode) {
      return undefined; // File does not belong to any vscode workspace folder
    }

    const workspaceFolderTreeItem = this.workspaceFolderTreeItems.find(
      (item) =>
        item.getWorkspaceInfo().workspaceFolder.uri.toString() ===
        workspaceFolderVSCode.uri.toString(),
    );
    if (!workspaceFolderTreeItem) {
      return undefined; // File does not belong to a detected bazel workspace
    }

    const relativeFilePath = path.relative(
      workspaceFolderVSCode.uri.fsPath,
      fileUri.fsPath,
    );
    if (!relativeFilePath) {
      return undefined; // Sanity check, should never happen
    }

    return workspaceFolderTreeItem.getClosestPackageTreeItem(relativeFilePath);
  }

  /**
   * Synchronizes the tree view selection with the currently active editor.
   */
  public async syncSelectedTreeItem(): Promise<void> {
    if (!this.isTreeViewVisible()) {
      return; // Do not sync if the Bazel tree view is not visible
    }

    if (!this.workspaceFolderTreeItems?.length) {
      return; // No workspace folders
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return; // No active editor
    }

    const fileUri = activeEditor.document.uri;
    if (fileUri.scheme !== "file") {
      return; // Non-file URI
    }

    if (this.lastSelectedUri?.toString() === fileUri.toString()) {
      return; // Already processed this file
    }

    try {
      const packageItem = this.getPackageTreeItemFromUri(fileUri);
      if (packageItem) {
        this.lastSelectedUri = fileUri;
        await this.revealTreeItem(packageItem);
      }
    } catch (error) {
      logError("Error syncing selected tree item:", error);
    }
  }
}
