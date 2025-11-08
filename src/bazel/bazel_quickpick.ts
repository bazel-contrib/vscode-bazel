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

import { getDefaultBazelExecutablePath } from "../extension/configuration";
import { IBazelCommandAdapter, IBazelCommandOptions } from "./bazel_command";
import { BazelQuery } from "./bazel_query";
import { blaze_query } from "../protos";
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
   * The full target information from the Bazel query.
   * This is optional as it might not always be available.
   */
  private readonly targetInfo?: blaze_query.ITarget;

  /**
   * Initializes a new Bazel QuickPick target.
   * @param label The fully qualified bazel target label.
   * @param workspaceInfo Information about the workspace in which the target
   * should be built.
   * @param targetInfo Optional full target information from the Bazel query.
   */
  constructor(
    label: string,
    workspaceInfo: BazelWorkspaceInfo,
    targetInfo?: blaze_query.ITarget,
  ) {
    this.targetLabel = label;
    this.workspaceInfo = workspaceInfo;
    this.targetInfo = targetInfo;
  }

  /**
   * Gets the full target information if available.
   * @returns The full target information or undefined if not available.
   */
  public getTargetInfo(): blaze_query.ITarget | undefined {
    return this.targetInfo;
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
  // The abort signal to use for the query.
  abortSignal?: AbortSignal;
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
  abortSignal,
}: QuickPickParams): Promise<BazelTargetQuickPick[]> {
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
  ).queryTargets(query ?? "//...:*", { abortSignal });

  // Sort the labels so the QuickPick is ordered.
  return queryResult.target
    .sort((a, b) => a.rule.name.localeCompare(b.rule.name))
    .map(
      (target) =>
        new BazelTargetQuickPick(target.rule.name, workspaceInfo, target),
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
  abortSignal,
}: QuickPickParams): Promise<BazelTargetQuickPick[]> {
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
  ).queryPackages(query ?? "//...", { abortSignal });

  // Sort the labels so the QuickPick is ordered.
  return packagePaths
    .sort()
    .map((target) => new BazelTargetQuickPick("//" + target, workspaceInfo));
}

/**
 * Shows a QuickPick of Bazel labels that dynamically updates its items based on the user's input.
 *
 * Configuration options:
 * @param options.initialPattern Initial pattern to use (e.g., "//...")
 * @param options.queryBuilder Function that builds a Bazel query from a pattern (e.g. `pattern => "kind('.* rule', ${pattern})"`)
 * @param options.queryFunctor Function that executes the query and returns the quick pick items
 * @param options.workspaceInfo Workspace information for the Bazel project
 * @returns A promise that resolves with the selected BazelTargetQuickPick, or undefined if no selection was made
 */
export function showDynamicQuickPick({
  initialPattern,
  queryBuilder,
  queryFunctor,
  workspaceInfo,
}: {
  initialPattern: string;
  queryBuilder: (pattern: string) => string;
  queryFunctor: (params: QuickPickParams) => Promise<BazelTargetQuickPick[]>;
  workspaceInfo?: BazelWorkspaceInfo;
}): Promise<BazelTargetQuickPick | undefined> {
  const quickPick = vscode.window.createQuickPick<BazelTargetQuickPick>();
  quickPick.title = "Select a Bazel target";
  quickPick.placeholder = "Start typing to search for targets...";
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  let abortController: AbortController | undefined = new AbortController();
  let timeout: NodeJS.Timeout | undefined;

  const updateQuickOptions = async (
    currentUserInput: string,
  ): Promise<void> => {
    // Cancel any previous query
    abortController?.abort();

    // Store the current abort controller to ensure we don't cancel a new query
    const currentAbortController = new AbortController();
    abortController = currentAbortController;

    // Show loading state
    quickPick.busy = true;
    quickPick.items = [];

    // Process the input: keep everything before the last separator (either / or :) and add '/...'
    let pattern = initialPattern;
    const lastSlashIndex = currentUserInput.lastIndexOf("/");
    const lastColonIndex = currentUserInput.lastIndexOf(":");
    const lastSeparatorIndex = Math.max(lastSlashIndex, lastColonIndex);
    if (lastSeparatorIndex !== -1) {
      pattern = `${currentUserInput.substring(0, lastSeparatorIndex)}/...`;
    }
    const newQuery = queryBuilder(pattern);

    try {
      const items = await queryFunctor({
        query: newQuery,
        workspaceInfo,
        abortSignal: currentAbortController.signal,
      });
      quickPick.items = items;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return; // Ignore abort errors
      }
      // For other errors, show an empty list
      // eslint-disable-next-line no-console
      console.error("Error querying Bazel targets:", error);
      quickPick.items = [];
    } finally {
      quickPick.busy = false;
    }
  };

  // Update items when the user types, but only after a short delay
  // to debounce the query execution after the last keystroke
  quickPick.onDidChangeValue((value) => {
    if (timeout) {
      clearTimeout(timeout); // Clear any pending updates
      timeout = undefined;
    }
    timeout = setTimeout(() => {
      void updateQuickOptions(value);
    }, 300); // wait 300ms before updating
  });

  // Show the QuickPick and trigger initial update
  quickPick.show();
  void updateQuickOptions("");

  // Return a promise that resolves when the picker is hidden or an item is selected
  return new Promise<BazelTargetQuickPick | undefined>((resolvePromise) => {
    quickPick.onDidAccept(() => {
      abortController?.abort();
      if (timeout) {
        clearTimeout(timeout);
      }
      const selectedItem = quickPick.activeItems[0];
      quickPick.hide();
      resolvePromise(selectedItem);
    });

    quickPick.onDidHide(() => {
      if (timeout) {
        clearTimeout(timeout);
      }
      quickPick.dispose();
      resolvePromise(undefined);
    });
  });
}
