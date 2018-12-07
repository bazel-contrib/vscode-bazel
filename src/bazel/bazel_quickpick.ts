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

import { IBazelCommandAdapter, IBazelCommandArgs } from "./bazel_command";
import { BazelQuery } from "./bazel_query";
import { getBazelWorkspaceFolder } from "./bazel_utils";

import * as vscode from "vscode";

/**
 * Represents a Bazel target in a QuickPick items window. Implements the
 * IBazelCommandAdapter interface so that it can be given directly to any of the
 * registered bazel commands.
 */
export class BazelTargetQuickPick
  implements IBazelCommandAdapter, vscode.QuickPickItem {
  // The fully qualified bazel target label.
  private readonly targetLabel: string;
  // Path to the bazel workspace folder.
  private readonly workspace: string;

  /**
   * Initializes a new Bazel QuickPick target.
   * @param label The fully qualified bazel target label.
   * @param workspace Path to the bazel workspace folder.
   */
  constructor(label: string, workspace: string) {
    this.targetLabel = label;
    this.workspace = workspace;
  }

  get alwaysShow(): boolean {
    return true;
  }

  get label(): string {
    return this.targetLabel;
  }

  get picked(): boolean {
    return false;
  }

  public getBazelCommandArgs(): IBazelCommandArgs {
    return {
      options: [this.targetLabel],
      workingDirectory: this.workspace,
    };
  }
}

/**
 * Runs the given bazel query command in the given bazel workspace and returns
 * the resulting array of BazelTargetQuickPick as a promise.
 * @param workspace The bazel workspace to run the bazel command from.
 * @param query The bazel query string to run.
 */
async function queryWorkspaceQuickPickTargets(
  workspace: string,
  query: string,
): Promise<BazelTargetQuickPick[]> {
  const queryResult = await new BazelQuery(workspace, query, []).runAndParse();
  const result: BazelTargetQuickPick[] = [];
  for (const rule of queryResult.rules) {
    result.push(new BazelTargetQuickPick(rule.name, workspace));
  }
  return result;
}

/**
 * Runs the given bazel query command in an automatically determined bazel
 * workspace and returns the resulting array of BazelTargetQuickPick as a
 * promise. The workspace is determined by trying to determine the bazel
 * workspace the currently active text editor is in.
 * @param query The bazel query string to run.
 */
export async function queryQuickPickTargets(
  query: string,
): Promise<BazelTargetQuickPick[]> {
  // Use the active text editor's file to determine the directory of the Bazel
  // workspace.
  if (vscode.window.activeTextEditor === undefined) {
    vscode.window.showErrorMessage(
      "Unable to determine Bazel workspace. Open a file in the Bazel workspace",
    );
    return [];
  }
  const filePath = vscode.window.activeTextEditor.document.uri.fsPath;
  const workspace = getBazelWorkspaceFolder(filePath);

  if (workspace === undefined) {
    vscode.window.showErrorMessage(filePath + " is not in a Bazel workspace");
    return [];
  }

  return queryWorkspaceQuickPickTargets(workspace, query);
}
