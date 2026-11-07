// Copyright 2026 The Bazel Authors. All rights reserved.
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

import { onDidChangeActiveBazelRoot } from "../bazel/active_bazel_roots";
import {
  describeUnsupportedFile,
  locateFile,
  resolveActiveBazelRoot,
} from "../bazel/bazel_utils";

export const OPEN_WORKSPACE_PATH_SETTING_COMMAND =
  "bazel.openWorkspacePathSetting";

/** The status bar text and tooltip for one editor. */
export interface WorkspaceRootStatus {
  readonly text: string;
  readonly tooltip: string;
}

/**
 * Describes the active Bazel root for the given document, or returns
 * undefined if the status bar item should be hidden (not a Bazel file).
 */
export function describeWorkspaceRoot(
  document: vscode.TextDocument | undefined,
): WorkspaceRootStatus | undefined {
  if (
    !document ||
    document.uri.scheme !== "file" ||
    document.languageId !== "starlark"
  ) {
    return undefined;
  }
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  const root = folder ? resolveActiveBazelRoot(folder) : undefined;
  const location = locateFile(document.uri.fsPath);
  // Empty only for a file in the active root.
  const unsupported = describeUnsupportedFile(location) ?? "";

  if (!folder || !root) {
    return {
      text: "$(circle-slash) Bazel",
      tooltip: folder
        ? `No Bazel workspace found for folder "${folder.name}". ` +
          `Set bazel.workspace.path to select one.\n\n${unsupported}`
        : unsupported,
    };
  }

  const origin = root.pinned
    ? "pinned by bazel.workspace.path"
    : "detected from the folder";
  const outside =
    location.kind === "inactiveWorkspace" || location.kind === "noWorkspace";
  let icon = "";
  if (outside) {
    icon = "$(warning) ";
  } else if (root.pinned) {
    icon = "$(pin) ";
  }
  return {
    text: `${icon}Bazel: ${path.basename(root.path)}`,
    tooltip:
      `Active Bazel workspace: ${root.path} (${origin})` +
      (unsupported && `\n\n${unsupported}`),
  };
}

/**
 * Shows the active Bazel root of the focused Bazel file's folder in the status
 * bar. Clicking it opens the `bazel.workspace.path` setting; it never writes
 * any setting itself.
 */
export function registerWorkspaceRootStatus(
  context: vscode.ExtensionContext,
): void {
  const item = vscode.window.createStatusBarItem(
    "bazel.workspaceRoot",
    vscode.StatusBarAlignment.Left,
  );
  item.name = "Bazel Workspace";
  item.command = OPEN_WORKSPACE_PATH_SETTING_COMMAND;

  const update = () => {
    const status = describeWorkspaceRoot(
      vscode.window.activeTextEditor?.document,
    );
    if (!status) {
      item.hide();
      return;
    }
    item.text = status.text;
    item.tooltip = status.tooltip;
    item.show();
  };

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand(OPEN_WORKSPACE_PATH_SETTING_COMMAND, () =>
      vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "bazel.workspace.path",
      ),
    ),
    vscode.window.onDidChangeActiveTextEditor(update),
    onDidChangeActiveBazelRoot(update),
  );
  update();
}
