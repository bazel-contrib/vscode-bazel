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
import { BazelWorkspaceInfo } from "../bazel";
import { IBazelTreeItem } from "./bazel_tree_item";
import { BazelWorkspaceFolderTreeItem } from "./bazel_workspace_folder_tree_item";
import { Resources } from "../extension/resources";

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
  private workspaceFolderTreeItems: BazelWorkspaceFolderTreeItem[] | undefined;

  private disposables: vscode.Disposable[] = [];

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
      buildFilesWatcher.onDidChange(() => this.onBuildFilesChanged()),
      buildFilesWatcher.onDidCreate(() => this.onBuildFilesChanged()),
      buildFilesWatcher.onDidDelete(() => this.onBuildFilesChanged()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()),
    );

    this.updateWorkspaceFolderTreeItems();
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

  /** Forces a re-query and refresh of the tree's contents. */
  public refresh() {
    this.updateWorkspaceFolderTreeItems();
    this.onDidChangeTreeDataEmitter.fire();
  }

  /**
   * Called to update the tree when a BUILD file is created, deleted, or
   * changed.
   *
   * @param uri The file system URI of the file that changed.
   */
  private onBuildFilesChanged() {
    // TODO(allevato): Look into firing the event only for tree items that are
    // affected by the change.
    this.refresh();
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
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.commands.executeCommand(
      "setContext",
      "bazel.haveWorkspace",
      haveBazelWorkspace,
    );
  }

  public dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
