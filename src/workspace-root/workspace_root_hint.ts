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

import * as vscode from "vscode";

import { describeUnsupportedFile, locateFile } from "../bazel/bazel_utils";
import { OPEN_WORKSPACE_PATH_SETTING_COMMAND } from "./workspace_root_status";

export const OPEN_SETTING = "Open Setting";
export const DONT_SHOW_AGAIN = "Don't Show Again";
export const HINT_DISMISSED_KEY = "bazel.workspaceRootHint.dismissed";

/**
 * Builds the hint for a file inside a VS Code workspace folder that belongs to
 * a different Bazel workspace than the folder's active root (e.g. a nested,
 * independent project, which earlier versions treated as its own root).
 *
 * Files outside every folder (e.g. in Bazel's repository cache) get no hint:
 * neither a setting nor a multi-root workspace is the answer for them.
 *
 * @returns The message, or undefined if the file needs no hint.
 */
export function getWorkspaceRootHint(fsPath: string): string | undefined {
  const location = locateFile(fsPath);
  if (location.kind !== "inactiveWorkspace" || !location.folder) {
    return undefined;
  }
  return (
    `${describeUnsupportedFile(location)} To use them, set ` +
    "bazel.workspace.path for this folder, or add " +
    `${location.workspace} as a folder of a multi-root workspace.`
  );
}

/**
 * Explains to users whose files belong to a Bazel workspace other than their
 * folder's active root how to work with it. Only informs (and offers to open
 * the `bazel.workspace.path` setting); never changes any setting or the
 * workspace. Shown at most once per Bazel workspace and session,
 * and never again once dismissed for this VS Code workspace.
 */
export function registerWorkspaceRootHint(
  context: vscode.ExtensionContext,
): void {
  const shown = new Set<string>();

  const maybeShowHint = (editor: vscode.TextEditor | undefined) => {
    if (
      !editor ||
      editor.document.uri.scheme !== "file" ||
      context.workspaceState.get<boolean>(HINT_DISMISSED_KEY)
    ) {
      return;
    }
    const fsPath = editor.document.uri.fsPath;
    const location = locateFile(fsPath);
    if (
      location.kind !== "inactiveWorkspace" ||
      shown.has(location.workspace)
    ) {
      return;
    }
    const hint = getWorkspaceRootHint(fsPath);
    if (hint === undefined) {
      return;
    }
    shown.add(location.workspace);
    void vscode.window
      .showInformationMessage(hint, OPEN_SETTING, DONT_SHOW_AGAIN)
      .then((action) => {
        if (action === OPEN_SETTING) {
          void vscode.commands.executeCommand(
            OPEN_WORKSPACE_PATH_SETTING_COMMAND,
          );
        } else if (action === DONT_SHOW_AGAIN) {
          void context.workspaceState.update(HINT_DISMISSED_KEY, true);
        }
      });
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(maybeShowHint),
  );
  maybeShowHint(vscode.window.activeTextEditor);
}
