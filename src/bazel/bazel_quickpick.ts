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

import {
  getDefaultBazelExecutablePath,
  areBazelQueriesEnabled,
} from "../extension/configuration";
import { IBazelCommandAdapter, IBazelCommandOptions } from "./bazel_command";
import { BazelQuery } from "./bazel_query";
import { BazelWorkspaceInfo } from "./bazel_workspace_info";

/**
 * Represents a Bazel target in a QuickPick items window. Implements the
 * IBazelCommandAdapter interface so that it can be given directly to any of the
 * registered bazel commands.
 */
export class BazelTargetQuickPick
  implements IBazelCommandAdapter, vscode.QuickPickItem
{
  /** The fully qualified bazel target label. */
  private readonly targetLabel: string;

  /** Information about the workspace in which the target should be built. */
  private readonly workspaceInfo: BazelWorkspaceInfo;

  /**
   * Initializes a new Bazel QuickPick target.
   * @param label The fully qualified bazel target label.
   * @param workspaceInfo Information about the workspace in which the target
   * should be built.
   */
  constructor(label: string, workspaceInfo: BazelWorkspaceInfo) {
    this.targetLabel = label;
    this.workspaceInfo = workspaceInfo;
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

  public getBazelCommandOptions(): IBazelCommandOptions {
    return {
      options: [],
      targets: [this.targetLabel],
      workspaceInfo: this.workspaceInfo,
    };
  }
}

/**
 * Use the active text editor's file to determine the directory of the Bazel
 * workspace, otherwise have them pick one.
 */
async function pickBazelWorkspace(): Promise<BazelWorkspaceInfo | undefined> {
  if (vscode.window.activeTextEditor === undefined) {
    return BazelWorkspaceInfo.fromWorkspaceFolders();
  } else {
    const document = vscode.window.activeTextEditor.document;
    return BazelWorkspaceInfo.fromDocument(document);
  }
}

export interface QuickPickParams {
  // The bazel query string to run.
  query?: string;
  // The bazel workspace to run the bazel command from.
  workspaceInfo?: BazelWorkspaceInfo;
}

/**
 * Runs the given bazel query command in the given bazel workspace and returns
 * the resulting array of BazelTargetQuickPick.
 *
 * If no workspace is given, uses an automatically determined bazel
 * workspace. The workspace is determined by trying to determine the bazel
 * workspace the currently active text editor is in.
 */
export async function queryQuickPickTargets({
  query,
  workspaceInfo,
}: QuickPickParams): Promise<BazelTargetQuickPick[]> {
  if (!areBazelQueriesEnabled()) {
    return [];
  }

  if (workspaceInfo === undefined) {
    // Ask the user to pick a workspace, if we don't have one, yet
    workspaceInfo = await pickBazelWorkspace();
  }

  if (workspaceInfo === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showErrorMessage("Failed to find a Bazel workspace");
    return [];
  }

  const queryResult = await new BazelQuery(
    getDefaultBazelExecutablePath(),
    workspaceInfo.workspaceFolder.uri.fsPath,
  ).queryTargets(query ?? "//...:*");

  // Sort the labels so the QuickPick is ordered.
  const labels = queryResult.target.map((target) => target.rule.name);
  labels.sort();
  return labels.map(
    (target) => new BazelTargetQuickPick(target, workspaceInfo),
  );
}

/**
 * Runs the given bazel query command in the given bazel workspace and returns
 * the resulting array of BazelTargetQuickPick.
 *
 * If no workspace is given, uses an automatically determined bazel
 * workspace. The workspace is determined by trying to determine the bazel
 * workspace the currently active text editor is in.
 */
export async function queryQuickPickPackage({
  query,
  workspaceInfo,
}: QuickPickParams): Promise<BazelTargetQuickPick[]> {
  if (!areBazelQueriesEnabled()) {
    return [];
  }

  if (workspaceInfo === undefined) {
    // Ask the user to pick a workspace, if we don't have one, yet
    workspaceInfo = await pickBazelWorkspace();
  }

  if (workspaceInfo === undefined) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showErrorMessage("Failed to find a Bazel workspace");
    return [];
  }

  const packagePaths = await new BazelQuery(
    getDefaultBazelExecutablePath(),
    workspaceInfo.workspaceFolder.uri.fsPath,
  ).queryPackages(query ?? "//...");

  return packagePaths.map(
    (target) => new BazelTargetQuickPick("//" + target, workspaceInfo),
  );
}
