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

import * as vscode from 'vscode';
import { BazelCommandAdapter, BazelCommandArgs } from '../bazel/commands';
import { BazelQuery, QueriedRule } from '../bazel/query';
import * as path from 'path';

/** An interface implemented by items in the Bazel tree provider. */
interface BazelTreeItem {
  /**
   * Indicates whether or not the item _may_ have children.
   * 
   * This method is used to control the collapsible state of the tree item. If this function returns
   * false, then the item definitively does _not_ have children (for example, an item representing a
   * build target). If it returns true, then it _may_ have children, but the actual computation of
   * those children is deferred until {@link #getChildren()} is called.
   * 
   * @returns True if the item may have children, or false if it definitively does not.
   */
  mightHaveChildren(): boolean;

  /** Returns a promise for the children of the tree item. */
  getChildren(): Thenable<BazelTreeItem[]>;

  /** Returns the text label of the tree item. */
  getLabel(): string;

  /** Returns the icon that should be shown next to the tree item. */
  getIcon(): vscode.ThemeIcon | undefined;

  /** Returns the tooltip that should be displayed when the user hovers over the tree item. */
  getTooltip(): string | undefined;

  /** Returns the command that should be executed when the item is selected. */
  getCommand(): vscode.Command | undefined;

  /**
   * Returns an identifying string that is used to filter which commands are available for the item.
   */
  getContextValue(): string | undefined;
}

/** A tree item representing a workspace folder. */
class BazelWorkspaceFolderTreeItem implements BazelTreeItem {
  /**
   * Initializes a new tree item with the given workspace folder.
   * 
   * @param workspaceFolder The workspace folder that the tree item represents.
   */
  constructor(private workspaceFolder: vscode.WorkspaceFolder) { }

  mightHaveChildren(): boolean { return true; }

  getChildren(): Promise<BazelTreeItem[]> {
    return this.getPackages();
  }

  getLabel(): string {
    return this.workspaceFolder.name;
  }

  getIcon(): vscode.ThemeIcon | undefined {
    return vscode.ThemeIcon.Folder;
  }

  getTooltip(): string {
    return this.workspaceFolder.uri.fsPath;
  }

  getCommand(): vscode.Command | undefined {
    return undefined;
  }

  getContextValue(): string {
    return "workspaceFolder";
  }

  /**
   * Recursively creates the tree items that represent packages found in a Bazel query.
   *
   * @param packagePaths The array of package paths that were found under the folder in which the
   *     Bazel query was executed.
   * @param startIndex The starting index within the package paths where common prefixes should be
   *     searched.
   * @param endIndex The ending index (exclusive) within the package paths where common prefixes
   *     should be searched.
   * @param treeItems An array into which the tree items created at this level in the tree will be
   *     pushed.
   * @param parentPackagePath The parent package path of the items being created by this call, which
   *     is used to trim the package prefix from labels in the tree items.
   */
  private buildPackageTree(
    packagePaths: string[],
    startIndex: number,
    endIndex: number,
    treeItems: BazelPackageTreeItem[],
    parentPackagePath: string
  ) {
    // We can assume that the caller has sorted the packages, so we scan them to find groupings into
    // which we should traverse more deeply. For example, if we have the following structure:
    //
    //   foo
    //   foo/bar
    //   foo/baz
    //
    // ...then groupStart will point to "foo" and groupEnd will point to the index after "foo/baz",
    // indicating that they share a common prefix, that "foo" should be its own node, and then
    // we should recurse into that group to create child nodes. Then, if we have the following
    // structure:
    //
    //   foo/bar
    //   foo/baz
    //
    // ...then groupStart will point to "foo/bar", but since it's not a prefix of "foo/baz", then
    // it becomes its own group (and thus node) at that level, and the same happens subsequently for
    // "foo/bar".
    //
    // This means we only create intermediate tree nodes for directories that actually represent
    // packages (i.e., contain a BUILD file), and collapse intermediate directories that don't.
    let groupStart = startIndex;
    while (groupStart < endIndex) {
      const packagePath = packagePaths[groupStart];

      let groupEnd = groupStart + 1;
      while (groupEnd < endIndex && packagePaths[groupEnd].startsWith(packagePath)) {
        groupEnd++;
      }

      // At this point, groupStart points to a prefix and the elements at (groupStart + 1) to
      // groupEnd are preceded by that prefix. We create a tree node for the element at groupStart
      // and then recursively call the algorithm again to group its children.
      const item = new BazelPackageTreeItem(
        this.workspaceFolder.uri.fsPath, packagePath, parentPackagePath);
      treeItems.push(item);
      this.buildPackageTree(
        packagePaths, groupStart + 1, groupEnd, item.directSubpackages, packagePath);

      // Move our index to start looking for more groups in the next iteration of the loop.
      groupStart = groupEnd;
    }
  }

  /** Returns a promise for an array of tree items representing build packages. */
  private async getPackages(): Promise<BazelPackageTreeItem[]> {
    // Retrieve the list of all packages underneath the current workspace folder. Note that if the
    // workspace folder is not the root of a Bazel workspace but is instead a folder underneath it,
    // we query for *only* the packages under that folder (including the folder itself). This lets
    // us have a VS Code workspace that is pointed at a subpackage of a large workspace without
    // the performance penalty of querying the entire workspace.
    const workspacePath = this.workspaceFolder.uri.fsPath;
    const queryResult = await new BazelQuery(workspacePath, "...", ["--output=package"]).run();
    let packagePaths = queryResult.trim().split("\n");
    packagePaths.sort();

    const topLevelItems: BazelPackageTreeItem[] = [];
    this.buildPackageTree(packagePaths, 0, packagePaths.length, topLevelItems, "");
    return Promise.resolve(topLevelItems);
  }
}

/** A tree item representing a build package. */
class BazelPackageTreeItem implements BazelTreeItem {
  /** The array of subpackages that should be shown directly under this package item. */
  directSubpackages: BazelPackageTreeItem[] = []

  /**
   * Initializes a new tree item with the given workspace path and package path.
   * 
   * @param workspacePath The path to the VS Code workspace folder.
   * @param packagePath The path to the build package that this item represents.
   * @param parentPackagePath The path to the build package of the tree item that is this item's
   *     parent, which indicates how much of {@code packagePath} should be stripped for the item's
   *     label.
   */
  constructor(
    private readonly workspacePath: string,
    private readonly packagePath: string,
    private readonly parentPackagePath: string
  ) { }

  mightHaveChildren(): boolean { return true; }

  async getChildren(): Promise<BazelTreeItem[]> {
    const queryResult = await new BazelQuery(
      this.workspacePath, `//${this.packagePath}:all`, [], true).runAndParse();
    let targets = queryResult.rules.map((rule: QueriedRule) => {
      return new BazelTargetTreeItem(rule);
    });
    return (<BazelTreeItem[]>this.directSubpackages).concat(targets);
  }

  getLabel(): string {
    // If this is a top-level package, include the leading double-slash on the label.
    if (this.parentPackagePath.length == 0) {
      return `//${this.packagePath}`;
    }
    // Otherwise, strip off the part of the package path that came from the parent item (along with
    // the slash).
    return this.packagePath.substring(this.parentPackagePath.length + 1);
  }

  getIcon(): vscode.ThemeIcon | undefined {
    return vscode.ThemeIcon.Folder;
  }

  getTooltip(): string {
    return `//${this.packagePath}`;
  }

  getCommand(): vscode.Command | undefined {
    return undefined;
  }

  getContextValue(): string {
    return "package";
  }
}

/** A tree item representing a build target. */
class BazelTargetTreeItem implements BazelCommandAdapter, BazelTreeItem {
  /**
   * Initializes a new tree item with the given query result representing a build target.
   * 
   * @param queriedRule An object representing a build target that was produced by a query.
   */
  constructor(private readonly queriedRule: QueriedRule) { }

  mightHaveChildren(): boolean { return false; }

  getChildren(): Thenable<BazelTreeItem[]> {
    return Promise.resolve([]);
  }

  getLabel(): string {
    const fullPath = this.queriedRule.name;
    const colonIndex = fullPath.lastIndexOf(":");
    const targetName = fullPath.substr(colonIndex);
    return `${targetName}  (${this.queriedRule.ruleClass})`;
  }

  getIcon(): vscode.ThemeIcon | undefined {
    // TODO(allevato): Use different icons based on the rule class.
    return vscode.ThemeIcon.File;
  }

  getTooltip(): string {
    return `//${this.queriedRule.name}`;
  }

  getCommand(): vscode.Command | undefined {
    const location = this.queriedRule.location;
    return {
      command: "vscode.open",
      title: "Jump to Build Target",
      arguments: [vscode.Uri.file(location.path), { selection: location.range }],
    };
  }

  getContextValue(): string {
    if (this.queriedRule.ruleClass.endsWith("_test")) {
      return "testRule";
    }
    return "rule";
  }

  getBazelCommandArgs(): BazelCommandArgs {
    const workingDirectory = path.dirname(this.queriedRule.location.path)
    return { "workingDirectory": workingDirectory, "options": [`${this.queriedRule.name}`] };
  }
}

/** Provides a tree of Bazel build packages and targets for the VS Code explorer interface. */
export class BazelWorkspaceTreeProvider implements vscode.TreeDataProvider<BazelTreeItem> {
  /**
   * Initializes a new tree provider with the given extension context.
   * 
   * @param context The VS Code extension context.
   */
  constructor(private context: vscode.ExtensionContext) { }

  getChildren(element?: BazelTreeItem): Thenable<BazelTreeItem[]> {
    // If we're given an element, we're not asking for the top-level elements, so just delegate to
    // that element to get its children.
    if (element) {
      return element.getChildren();
    }

    if (vscode.workspace.workspaceFolders) {
      // If the user has a workspace open and there's only one folder in it, then don't show the
      // workspace folder; just show its packages at the top level.
      if (vscode.workspace.workspaceFolders.length == 1) {
        const folderItem = new BazelWorkspaceFolderTreeItem(vscode.workspace.workspaceFolders[0]);
        return folderItem.getChildren()
      }

      // If the user has multiple workspace folders open, then show them as individual top level
      // items.
      return Promise.resolve(vscode.workspace.workspaceFolders.map((folder) => {
        return new BazelWorkspaceFolderTreeItem(folder)
      }));
    }

    // If the user doesn't have a folder open in the workspace, don't show anything.
    return Promise.resolve([]);
  }

  getTreeItem(element: BazelTreeItem): vscode.TreeItem {
    const label = element.getLabel()
    const collapsibleState = element.mightHaveChildren()
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    let treeItem = new vscode.TreeItem(label, collapsibleState);
    treeItem.contextValue = element.getContextValue();
    treeItem.iconPath = element.getIcon();
    treeItem.tooltip = element.getTooltip();
    treeItem.command = element.getCommand();
    return treeItem;
  }
}
