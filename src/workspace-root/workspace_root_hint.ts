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

import {
  getActiveBazelRoot,
  getForeignBazelWorkspace,
} from "../bazel/bazel_utils";

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
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
  if (!folder) {
    return undefined;
  }
  const foreignWorkspace = getForeignBazelWorkspace(fsPath);
  if (foreignWorkspace === undefined) {
    return undefined;
  }
  const root = getActiveBazelRoot(folder);
  const active = root
    ? `uses the Bazel workspace at ${root}`
    : "has no Bazel workspace";
  return (
    `This file belongs to the Bazel workspace at ${foreignWorkspace}, but ` +
    `the VS Code folder "${folder.name}" ${active}, so Bazel features are ` +
    "unavailable for it. To use them, set bazel.workspace.path for this " +
    `folder, or add ${foreignWorkspace} as a folder of a multi-root ` +
    "workspace."
  );
}

/**
 * Explains to users whose files belong to a Bazel workspace other than their
 * folder's active root how to work with it. Only informs; never changes any
 * setting or the workspace. Shown at most once per Bazel workspace and session,
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
    const foreignWorkspace = getForeignBazelWorkspace(fsPath);
    if (foreignWorkspace === undefined || shown.has(foreignWorkspace)) {
      return;
    }
    const hint = getWorkspaceRootHint(fsPath);
    if (hint === undefined) {
      return;
    }
    shown.add(foreignWorkspace);
    void vscode.window
      .showInformationMessage(hint, DONT_SHOW_AGAIN)
      .then((action) => {
        if (action === DONT_SHOW_AGAIN) {
          void context.workspaceState.update(HINT_DISMISSED_KEY, true);
        }
      });
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(maybeShowHint),
  );
  maybeShowHint(vscode.window.activeTextEditor);
}
