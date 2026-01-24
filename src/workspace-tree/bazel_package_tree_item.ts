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
import {
  BazelQuery,
  IBazelCommandAdapter,
  IBazelCommandOptions,
} from "../bazel";
import {
  getDefaultBazelExecutablePath,
  areBazelQueriesEnabled,
} from "../extension/configuration";
import { blaze_query } from "../protos";
import { BazelTargetTreeItem } from "./bazel_target_tree_item";
import { IBazelTreeItem } from "./bazel_tree_item";
import { Resources } from "../extension/resources";

/** A tree item representing a build package. */
export class BazelPackageTreeItem
  implements IBazelCommandAdapter, IBazelTreeItem
{
  /**
   * The array of subpackages that should be shown directly under this package
   * item.
   */
  public directSubpackages: BazelPackageTreeItem[] = [];

  /**
   * Initializes a new tree item with the given workspace path and package path.
   *
   * @param resources The resources for the extension.
   * @param workspaceInfo The workspace information.
   * @param parent The parent tree item of this item.
   * @param packagePath The path to the build package that this item represents.
   */
  constructor(
    private readonly resources: Resources,
    private readonly workspaceInfo: BazelWorkspaceInfo,
    private readonly parent: IBazelTreeItem,
    private readonly packagePath: string,
  ) {}

  public mightHaveChildren(): boolean {
    return true;
  }

  public async getChildren(): Promise<IBazelTreeItem[]> {
    // If queries are disabled, just return subpackages
    if (!areBazelQueriesEnabled()) {
      return this.directSubpackages as IBazelTreeItem[];
    }

    const queryResult = await new BazelQuery(
      getDefaultBazelExecutablePath(),
      this.workspaceInfo.bazelWorkspacePath,
    ).queryTargets(`//${this.packagePath}:all`, {
      ignoresErrors: true,
      sortByRuleName: true,
    });
    const targets = queryResult.target.map((target: blaze_query.ITarget) => {
      return new BazelTargetTreeItem(
        this.resources,
        this.workspaceInfo,
        this,
        target,
      );
    });
    return (this.directSubpackages as IBazelTreeItem[]).concat(targets);
  }

  public getParent(): vscode.ProviderResult<IBazelTreeItem> {
    return this.parent;
  }

  public getLabel(): string {
    // If this is a top-level package, include the leading double-slash on the
    // label.
    const parentPackagePath = this.parent.getPackagePath();
    if (parentPackagePath.length === 0) {
      return `//${this.packagePath}`;
    }
    // Otherwise, strip off the part of the package path that came from the
    // parent item (along with the slash).
    return this.packagePath.substring(parentPackagePath.length + 1);
  }

  public getIcon(): vscode.ThemeIcon {
    return vscode.ThemeIcon.Folder;
  }

  public getTooltip(): string {
    return `//${this.packagePath}`;
  }

  public getCommand(): vscode.Command | undefined {
    return undefined;
  }

  public getContextValue(): string {
    return "package";
  }

  public getBazelCommandOptions(): IBazelCommandOptions {
    return {
      options: [],
      targets: [`//${this.packagePath}`],
      workspaceInfo: this.workspaceInfo,
    };
  }

  public getPackagePath(): string {
    return this.packagePath;
  }
}
