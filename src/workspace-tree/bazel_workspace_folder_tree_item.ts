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
import { BazelQuery } from "../bazel";
import { getDefaultBazelExecutablePath } from "../extension/configuration";
import { blaze_query } from "../protos";
import { BazelPackageTreeItem } from "./bazel_package_tree_item";
import { BazelTargetTreeItem } from "./bazel_target_tree_item";
import { IBazelTreeItem } from "./bazel_tree_item";

/** A tree item representing a workspace folder. */
export class BazelWorkspaceFolderTreeItem implements IBazelTreeItem {
  /**
   * Initializes a new tree item with the given workspace folder.
   *
   * @param workspaceFolder The workspace folder that the tree item represents.
   */
  constructor(private workspaceInfo: BazelWorkspaceInfo) {}

  public mightHaveChildren(): boolean {
    return true;
  }

  public getChildren(): Promise<IBazelTreeItem[]> {
    return this.getDirectoryItems();
  }

  public getLabel(): string {
    return this.workspaceInfo.workspaceFolder.name;
  }

  public getIcon(): vscode.ThemeIcon {
    return vscode.ThemeIcon.Folder;
  }

  public getTooltip(): string {
    return this.workspaceInfo.workspaceFolder.uri.fsPath;
  }

  public getCommand(): vscode.Command | undefined {
    return undefined;
  }

  public getContextValue(): string {
    return "workspaceFolder";
  }

  /**
   * Recursively creates the tree items that represent packages found in a Bazel
   * query.
   *
   * @param packagePaths The array of package paths that were found under the
   * folder in which the Bazel query was executed.
   * @param startIndex The starting index within the package paths where common
   * prefixes should be searched.
   * @param endIndex The ending index (exclusive) within the package paths where
   * common prefixes should be searched.
   * @param treeItems An array into which the tree items created at this level
   * in the tree will be pushed.
   * @param parentPackagePath The parent package path of the items being created
   * by this call, which is used to trim the package prefix from labels in
   * the tree items.
   */
  private buildPackageTree(
    packagePaths: string[],
    startIndex: number,
    endIndex: number,
    treeItems: BazelPackageTreeItem[],
    parentPackagePath: string,
  ) {
    // We can assume that the caller has sorted the packages, so we scan them to
    // find groupings into which we should traverse more deeply. For example, if
    // we have the following structure:
    //
    //   foo
    //   foo/bar
    //   foo/baz
    //
    // ...then groupStart will point to "foo" and groupEnd will point to the
    // index after "foo/baz", indicating that they share a common prefix, that
    // "foo" should be its own node, and then we should recurse into that group
    // to create child nodes. Then, if we have the following structure:
    //
    //   foo/bar
    //   foo/baz
    //
    // ...then groupStart will point to "foo/bar", but since it's not a prefix
    // of "foo/baz", then it becomes its own group (and thus node) at that
    // level, and the same happens subsequently for "foo/bar".
    //
    // This means we only create intermediate tree nodes for directories that
    // actually represent packages (i.e., contain a BUILD file), and collapse
    // intermediate directories that don't.
    let groupStart = startIndex;
    while (groupStart < endIndex) {
      const packagePath = packagePaths[groupStart];

      let groupEnd = groupStart + 1;
      // Make sure to check for a slash after the prefix so that we don't
      // erroneously collapse something like "foo" and "foobar".
      while (
        groupEnd < endIndex &&
        packagePaths[groupEnd].startsWith(packagePath + "/")
      ) {
        groupEnd++;
      }

      // At this point, groupStart points to a prefix and the elements at
      // (groupStart + 1) to groupEnd are preceded by that prefix. We create a
      // tree node for the element at groupStart and then recursively call the
      // algorithm again to group its children.
      const item = new BazelPackageTreeItem(
        this.workspaceInfo,
        packagePath,
        parentPackagePath,
      );
      treeItems.push(item);
      this.buildPackageTree(
        packagePaths,
        groupStart + 1,
        groupEnd,
        item.directSubpackages,
        packagePath,
      );

      // Move our index to start looking for more groups in the next iteration
      // of the loop.
      groupStart = groupEnd;
    }
  }

  /**
   * Returns a promise for an array of tree items representing build items.
   */
  private async getDirectoryItems(): Promise<IBazelTreeItem[]> {
    // Retrieve the list of all packages underneath the current workspace
    // folder. Note that if the workspace folder is not the root of a Bazel
    // workspace but is instead a folder underneath it, we query for *only* the
    // packages under that folder (including the folder itself). This lets us
    // have a VS Code workspace that is pointed at a subpackage of a large
    // workspace without the performance penalty of querying the entire
    // workspace.
    if (!this.workspaceInfo) {
      return Promise.resolve([] as IBazelTreeItem[]);
    }
    const workspacePath = this.workspaceInfo.workspaceFolder.uri.fsPath;
    const packagePaths = await new BazelQuery(
      getDefaultBazelExecutablePath(),
      workspacePath,
    ).queryPackages(
      vscode.workspace
        .getConfiguration("bazel.commandLine")
        .get("queryExpression"),
    );
    const topLevelItems: BazelPackageTreeItem[] = [];
    this.buildPackageTree(
      packagePaths,
      0,
      packagePaths.length,
      topLevelItems,
      "",
    );

    // Now collect any targets in the directory also (this can fail since
    // there might not be a BUILD files at this level (but down levels)).
    const queryResult = await new BazelQuery(
      getDefaultBazelExecutablePath(),
      workspacePath,
    ).queryTargets(`:all`, {
      ignoresErrors: true,
      sortByRuleName: true,
    });
    const targets = queryResult.target.map((target: blaze_query.Target) => {
      return new BazelTargetTreeItem(this.workspaceInfo, target);
    });

    return Promise.resolve((topLevelItems as IBazelTreeItem[]).concat(targets));
  }
}
