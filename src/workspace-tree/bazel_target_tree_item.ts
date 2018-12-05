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

import * as path from "path";
import * as vscode from "vscode";
import { IBazelCommandAdapter, IBazelCommandArgs, QueriedRule } from "../bazel";
import { IBazelTreeItem } from "./bazel_tree_item";
import { getBazelRuleIcon } from "./icons";

/** A tree item representing a build target. */
export class BazelTargetTreeItem
  implements IBazelCommandAdapter, IBazelTreeItem {
  /**
   * Initializes a new tree item with the given query result representing a
   * build target.
   *
   * @param queriedRule An object representing a build target that was produced
   *     by a query.
   */
  constructor(private readonly queriedRule: QueriedRule) {}

  public mightHaveChildren(): boolean {
    return false;
  }

  public getChildren(): Thenable<IBazelTreeItem[]> {
    return Promise.resolve([]);
  }

  public getLabel(): string {
    const fullPath = this.queriedRule.name;
    const colonIndex = fullPath.lastIndexOf(":");
    const targetName = fullPath.substr(colonIndex);
    return `${targetName}  (${this.queriedRule.ruleClass})`;
  }

  public getIcon(): vscode.ThemeIcon | string {
    return getBazelRuleIcon(this.queriedRule);
  }

  public getTooltip(): string {
    return `${this.queriedRule.name}`;
  }

  public getCommand(): vscode.Command | undefined {
    const location = this.queriedRule.location;
    return {
      arguments: [
        vscode.Uri.file(location.path),
        { selection: location.range },
      ],
      command: "vscode.open",
      title: "Jump to Build Target",
    };
  }

  public getContextValue(): string {
    if (this.queriedRule.ruleClass.endsWith("_test")) {
      return "testRule";
    }
    return "rule";
  }

  public getBazelCommandArgs(): IBazelCommandArgs {
    const workingDirectory = path.dirname(this.queriedRule.location.path);
    return {
      options: [`${this.queriedRule.name}`],
      workingDirectory,
    };
  }
}
