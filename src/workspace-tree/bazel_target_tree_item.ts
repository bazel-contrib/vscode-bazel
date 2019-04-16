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
import { QueryLocation } from "../bazel";
import {
  BazelWorkspaceInfo,
  IBazelCommandAdapter,
  IBazelCommandOptions,
} from "../bazel/bazellib";
import { blaze_query } from "../protos";
import { IBazelTreeItem } from "./bazel_tree_item";
import { getBazelRuleIcon } from "./icons";

/** A tree item representing a build target. */
export class BazelTargetTreeItem
  implements IBazelCommandAdapter, IBazelTreeItem {
  /**
   * Initializes a new tree item with the given query result representing a
   * build target.
   *
   * @param target An object representing a build target that was produced by a
   *     query.
   */
  constructor(
    private readonly workspaceInfo: BazelWorkspaceInfo,
    private readonly target: blaze_query.Target,
  ) {}

  public mightHaveChildren(): boolean {
    return false;
  }

  public getChildren(): Thenable<IBazelTreeItem[]> {
    return Promise.resolve([]);
  }

  public getLabel(): string {
    const fullPath = this.target.rule.name;
    const colonIndex = fullPath.lastIndexOf(":");
    const targetName = fullPath.substr(colonIndex);
    return `${targetName}  (${this.target.rule.ruleClass})`;
  }

  public getIcon(): vscode.ThemeIcon | string {
    return getBazelRuleIcon(this.target);
  }

  public getTooltip(): string {
    return `${this.target.rule.name}`;
  }

  public getCommand(): vscode.Command | undefined {
    const location = new QueryLocation(this.target.rule.location);
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
    const ruleClass = this.target.rule.ruleClass;
    if (ruleClass.endsWith("_test") || ruleClass === "test_suite") {
      return "testRule";
    }
    return "rule";
  }

  public getBazelCommandOptions(): IBazelCommandOptions {
    return {
      options: [],
      targets: [`${this.target.rule.name}`],
      workspaceInfo: this.workspaceInfo,
    };
  }
}
