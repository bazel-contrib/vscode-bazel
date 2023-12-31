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

import { getBazelWorkspaceFolder } from "./bazel_utils";

/**
 * Represents the Bazel workspace path containing a document as well as its
 * containing VS Code workspace folder, if there is one.
 */
export class BazelWorkspaceInfo {
  /**
   * Returns the VS Code and Bazel workspace info for the given text document.
   *
   * If the file is not in a Bazel workspace or in a VSCode workspace, this
   * function returns {@code undefined}.
   *
   * @param document The {@code vscode.TextDocument} whose workspace info should
   * be retrieved.
   */
  public static fromDocument(
    document: vscode.TextDocument,
  ): BazelWorkspaceInfo | undefined {
    const uri = document.uri;
    // Make sure the current document is from a workspace folder.
    const vscodeWorkspace = vscode.workspace.getWorkspaceFolder(uri);
    if (vscodeWorkspace === undefined) {
      return undefined;
    }
    const bazelWorkspace = getBazelWorkspaceFolder(uri.fsPath);
    if (bazelWorkspace) {
      return new BazelWorkspaceInfo(bazelWorkspace, vscodeWorkspace);
    }
    return undefined;
  }

  /**
   * Returns the VS Code and Bazel workspace info for the given VS Code
   * workspace folder.
   *
   * If the workspace folder is not a subdirectory in (or is not itself) a Bazel
   * workspace, this function returns {@code undefined}.
   *
   * @param workspaceFolder The {@code vscode.WorkspaceFolder} whose workspace
   * info should be retrieved.
   */
  public static fromWorkspaceFolder(
    workspaceFolder: vscode.WorkspaceFolder,
  ): BazelWorkspaceInfo | undefined {
    const bazelWorkspace = getBazelWorkspaceFolder(workspaceFolder.uri.fsPath);
    if (bazelWorkspace) {
      return new BazelWorkspaceInfo(bazelWorkspace, workspaceFolder);
    }
    return undefined;
  }

  /**
   * Returns a selected Bazel workspace from among the open VS workspace
   * folders. If there is only a single workspace folder open, it will be used.
   * If there are multiple workspace folders open, a quick-pick window will be
   * opened asking the user to choose one.
   */
  public static async fromWorkspaceFolders(): Promise<
    BazelWorkspaceInfo | undefined
  > {
    switch (vscode.workspace.workspaceFolders?.length) {
      case undefined:
      case 0:
        return undefined;
      case 1:
        return this.fromWorkspaceFolder(vscode.workspace.workspaceFolders[0]);
      default:
        const workspaceFolder = await vscode.window.showWorkspaceFolderPick();
        return workspaceFolder
          ? this.fromWorkspaceFolder(workspaceFolder)
          : undefined;
    }
  }

  /**
   * Initializes a new workspace info object.
   *
   * @param bazelWorkspacePath The closest directory to a document that contains
   * a Bazel WORKSPACE file.
   * @param workspaceFolder An object representing the VS Code workspace folder
   * that contains a document, or {@code undefined} if the file does not
   * belong to a workspace folder (for example, a standalone file loaded
   * into the editor).
   */
  private constructor(
    public readonly bazelWorkspacePath: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder | undefined,
  ) {}
}
