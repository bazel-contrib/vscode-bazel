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
import * as fs from "fs/promises";
import { BazelWorkspaceInfo, QueryLocation } from "../bazel";
import { IBazelCommandAdapter, IBazelCommandOptions } from "../bazel";
import { blaze_query } from "../protos";
import { IBazelTreeItem } from "./bazel_tree_item";
import { getBazelRuleIcon } from "./icons";
import { BazelInfo } from "../bazel/bazel_info";
import { getDefaultBazelExecutablePath } from "../extension/configuration";
import { Resources } from "../extension/resources";

/** A tree item representing a build target. */
export class BazelTargetTreeItem
  implements IBazelCommandAdapter, IBazelTreeItem
{
  /**
   * Initializes a new tree item with the given query result representing a
   * build target.
   *
   * @param target An object representing a build target that was produced by a
   * query.
   */
  constructor(
    private readonly resources: Resources,
    private readonly workspaceInfo: BazelWorkspaceInfo,
    private readonly target: blaze_query.ITarget,
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

  public getIcon(): string | vscode.ThemeIcon {
    const bazelRuleIcon = getBazelRuleIcon(this.target);
    if (bazelRuleIcon) {
      return this.resources.getIconPath(bazelRuleIcon);
    }
    return vscode.ThemeIcon.File;
  }

  public getTooltip(): string {
    return this.target.rule.name;
  }

  public async getCommand(): Promise<vscode.Command | undefined> {
    // Resolve the prefix if prefix is
    // $(./prebuilts/bazel info output_base)/external/
    const location = new QueryLocation(this.target.rule.location);
    // Maybe we should cache this to prevent the repeating invocations.
    const outputBase = await new BazelInfo(
      getDefaultBazelExecutablePath(),
      this.workspaceInfo.workspaceFolder.uri.fsPath,
    ).getOne("output_base");
    let locationPath = location.path;
    // If location is in pattern `${execRoot}/external/<repo>/...`, then it
    // should be a file in local_repository(). Trying to remapping it back to
    // the origin source folder by resolve the symlink
    // ${execRoot}/external/<repo>.
    const outputBaseExternalPath = `${outputBase}/external/`;
    if (location.path.startsWith(outputBaseExternalPath)) {
      const repoPath = location.path.substring(outputBaseExternalPath.length);
      const repoPathMatch = repoPath.match(/^([^/]+)\/(.*)$/);
      if (repoPathMatch.length === 3) {
        const repo = repoPathMatch[1];
        const rest = repoPathMatch[2];
        const realRepo = await fs.realpath(`${outputBaseExternalPath}${repo}`);
        locationPath = `${realRepo}/${rest}`;
      }
    }
    return {
      arguments: [vscode.Uri.file(locationPath), { selection: location.range }],
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
      targets: [this.target.rule.name],
      workspaceInfo: this.workspaceInfo,
    };
  }
}
