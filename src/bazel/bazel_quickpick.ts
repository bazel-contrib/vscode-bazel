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
  getQueryExpression,
} from "../extension/configuration";
import { IBazelCommandAdapter, IBazelCommandOptions } from "./bazel_command";
import { BazelQuery } from "./bazel_query";
import { blaze_query } from "../protos";
import { BazelWorkspaceInfo } from "./bazel_workspace_info";
import {
  getBazelPackageFile,
  getBazelWorkspaceFolder,
  getBuildFileLineWithSourceFilePath,
  getPackageLabelForBuildFile,
  getTargetNameAtBuildFileLocation,
} from "./bazel_utils";
import { logError } from "../extension/logger";

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

/**
 * Guesses the label of interest for the current active editor file and cursor position.
 * Returns undefined if not possible to determine.
 */
export function guessLabelOfInterest(
  currentFilePath: string | undefined,
  currentLine: number | undefined,
): string | undefined {
  // Do we have a file path?
  if (!currentFilePath) {
    return undefined;
  }

  // Are we in a Bazel workspace?
  const workspaceFolder = getBazelWorkspaceFolder(currentFilePath);
  if (!workspaceFolder) {
    return undefined;
  }

  // Can we find the corresponding BUILD file?
  const buildFile = getBazelPackageFile(currentFilePath);
  if (!buildFile) {
    return undefined;
  }
  const packageLabel = getPackageLabelForBuildFile(workspaceFolder, buildFile);

  // Can we find the relevant line inside the BUILD file?
  let lineOfInterest: number | undefined = undefined;
  if (currentFilePath === buildFile) {
    lineOfInterest = currentLine;
  } else {
    lineOfInterest = getBuildFileLineWithSourceFilePath(
      buildFile,
      currentFilePath,
    );
  }
  if (!lineOfInterest) {
    return packageLabel + ":";
  }

  // Determine target name based of line of interest
  const targetName = getTargetNameAtBuildFileLocation(
    buildFile,
    lineOfInterest,
  );
  if (targetName) {
    return `${packageLabel}:${targetName}`;
  }
  return packageLabel + ":";
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
    logError("Failed to find a Bazel workspace", true);
    return [];
  }

  const queryResult = await new BazelQuery(
    getDefaultBazelExecutablePath(),
    workspaceInfo.workspaceFolder.uri.fsPath,
  ).queryTargets(query ?? "//...:*", { abortSignal });

  // Sort the labels so the QuickPick is ordered.
  return queryResult.target
    .sort((a, b) => (a.rule?.name ?? "").localeCompare(b.rule?.name ?? ""))
    .map(
      (target) =>
        new BazelTargetQuickPick(
          target.rule?.name ?? "",
          workspaceInfo,
          target,
        ),
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
    logError("Failed to find a Bazel workspace", true);
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
 * @param options.queryBuilder Function that builds a Bazel query from a pattern (e.g. `pattern => "kind('.* rule', ${pattern})"`)
 * @param options.queryFunctor Function that executes the query and returns the quick pick items
 * @param options.workspaceInfo Workspace information for the Bazel project
 * @returns A promise that resolves with the selected BazelTargetQuickPick, or undefined if no selection was made
 */
export function showDynamicQuickPick({
  queryBuilder,
  queryFunctor,
  workspaceInfo,
}: {
  queryBuilder: (pattern: string) => string;
  queryFunctor: (params: QuickPickParams) => Promise<BazelTargetQuickPick[]>;
  workspaceInfo?: BazelWorkspaceInfo;
}): Promise<BazelTargetQuickPick | undefined> {
  const quickPick = vscode.window.createQuickPick<BazelTargetQuickPick>();
  quickPick.title = "Select a Bazel target";
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;

  // By default the quick pick is empty and we use the query expression from the settings.
  quickPick.placeholder = "Start typing to search for targets...";
  const initialPattern = getQueryExpression();
  // But if we can guess the label of interest from the current cursor position, we use it to improve the starting point
  const guessedLabelOfInterest = guessLabelOfInterest(
    vscode.window.activeTextEditor?.document.uri.fsPath,
    vscode.window.activeTextEditor?.selection.active.line,
  );
  if (guessedLabelOfInterest) {
    quickPick.value = guessedLabelOfInterest;
  }

  let abortController: AbortController | undefined = new AbortController();
  let timeout: NodeJS.Timeout | undefined;
  let statusBarMessage: vscode.Disposable | undefined;
  let isValidating: boolean = false;

  const executeQuery = async (
    query: string,
  ): Promise<BazelTargetQuickPick[] | undefined> => {
    // Cancel any previous query
    abortController?.abort();

    // Store the current abort controller to ensure we don't cancel a new query
    const currentAbortController = new AbortController();
    abortController = currentAbortController;

    try {
      const items = await queryFunctor({
        query,
        workspaceInfo,
        abortSignal: currentAbortController.signal,
      });
      return items;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return undefined; // Ignore abort errors
      }
      // For other errors, show an empty list
      logError("Error querying Bazel targets", true, error);
      return [];
    }
  };

  const updateQuickOptions = async (
    currentUserInput: string,
  ): Promise<BazelTargetQuickPick[] | undefined> => {
    quickPick.busy = true;

    // Process the input: keep everything before the last separator (either / or :) and add '/...'
    let pattern = initialPattern;
    if (isValidating) {
      // Edge case: User has given us a label before the quickpick was filled. Let's validate it.
      statusBarMessage?.dispose();
      statusBarMessage = vscode.window.setStatusBarMessage(
        `$(loading~spin) Bazel: Validating your label...`,
      );
      quickPick.enabled = false;
      pattern = currentUserInput;
    } else {
      // Normal case: user is typing in the quickpick, we update the list of items
      quickPick.enabled = true;
      statusBarMessage?.dispose();
      statusBarMessage = vscode.window.setStatusBarMessage(
        `$(loading~spin) Bazel: Querying for targets...`,
      );
      const lastSlashIndex = currentUserInput.lastIndexOf("/");
      const lastColonIndex = currentUserInput.lastIndexOf(":");
      const lastSeparatorIndex = Math.max(lastSlashIndex, lastColonIndex);
      if (lastSeparatorIndex !== -1) {
        pattern = `${currentUserInput.substring(0, lastSeparatorIndex)}/...`;
      }
    }
    const newQuery = queryBuilder(pattern);

    const items = await executeQuery(newQuery);
    if (items === undefined) {
      // Query was aborted. Restore quickpick
      quickPick.enabled = true;
    } else {
      // Happy path: update quickpick and cleanup
      quickPick.items = items;
      quickPick.busy = false;
      statusBarMessage?.dispose();
      statusBarMessage = undefined;
    }
    return items;
  };

  // Update items when the user types, but only after a short delay
  // to debounce the query execution after the last keystroke
  quickPick.onDidChangeValue((value) => {
    if (timeout) {
      clearTimeout(timeout); // Clear any pending updates
      timeout = undefined;
    }
    timeout = setTimeout(() => {
      if (!isValidating) {
        void updateQuickOptions(value);
      }
    }, 300); // wait 300ms before updating
  });

  // Show the QuickPick and trigger initial update
  quickPick.show();
  void updateQuickOptions("");

  // Return a promise that resolves when the picker is hidden or an item is selected
  return new Promise<BazelTargetQuickPick | undefined>((resolvePromise) => {
    const handleAccept = async () => {
      isValidating = true;
      abortController?.abort();
      if (timeout) {
        clearTimeout(timeout);
      }

      let selectedItem: BazelTargetQuickPick | undefined =
        quickPick.activeItems[0];
      if (!selectedItem) {
        // If no item is selected but there's user input, try to find a matching target
        const userInput = quickPick.value.trim();
        if (userInput) {
          const items = await updateQuickOptions(userInput);
          selectedItem = items?.[0];
        }
      }
      isValidating = false;
      if (selectedItem) {
        quickPick.hide();
        resolvePromise(selectedItem);
      }
    };

    quickPick.onDidAccept(handleAccept);

    quickPick.onDidHide(() => {
      statusBarMessage?.dispose();
      statusBarMessage = undefined;
      if (timeout) {
        clearTimeout(timeout);
      }
      quickPick.dispose();
      resolvePromise(undefined);
    });
  });
}

/** Maximum length for target display names before truncation */
const MAX_TARGET_DISPLAY_LENGTH = 80;

/**
 * Creates a formatted display name for a target with proper truncation
 */
function formatTargetDisplayName(
  target: string,
  maxLabelLength: number = MAX_TARGET_DISPLAY_LENGTH,
): string {
  const shortName = target.includes(":") ? target.split(":")[1] : target;
  // Truncate from the beginning if the name is too long (keep the end visible)
  return shortName.length > maxLabelLength
    ? "..." + shortName.slice(-(maxLabelLength - 3))
    : shortName;
}

/**
 * Creates QuickPick items for targets with consistent formatting
 */
export function createTargetQuickPickItems(targets: string[]): {
  label: string;
  description: string;
  target: string;
}[] {
  return targets.map((target) => ({
    label: formatTargetDisplayName(target),
    description: target, // Full target path as description
    target,
  }));
}

/**
 * Shows a QuickPick for multiple targets and returns the selected target
 * @param targets Array of target strings to choose from
 * @param commandName Name of the command for display purposes
 * @returns Promise that resolves to the selected target string, or undefined if cancelled
 */
export async function showTargetQuickPick(
  targets: string[],
  commandName: string,
): Promise<string | undefined> {
  if (targets.length === 0) {
    return undefined;
  }

  if (targets.length === 1) {
    return targets[0];
  }

  // Show QuickPick for multiple targets
  const quickPickItems = createTargetQuickPickItems(targets);

  const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
    placeHolder: `Select target to ${commandName.toLowerCase()}`,
    canPickMany: false,
  });

  return selectedItem?.target;
}
