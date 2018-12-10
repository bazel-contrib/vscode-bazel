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
import { buildifierFormat, getBuildifierFileType } from "./buildifier";

/**
 * Provides document formatting functionality for Bazel files by invoking
 * buildifier.
 */
export class BuildifierFormatProvider
  implements vscode.DocumentFormattingEditProvider {
  public async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
    options: vscode.FormattingOptions,
    token: vscode.CancellationToken,
  ): Promise<vscode.TextEdit[]> {
    const bazelConfig = vscode.workspace.getConfiguration("bazel");
    const applyLintFixes = bazelConfig.buildifierFixOnFormat as boolean;

    const fileContent = document.getText();
    const type = getBuildifierFileType(document.uri.fsPath);
    try {
      const formattedContent = await buildifierFormat(
        fileContent,
        type,
        applyLintFixes,
      );
      if (formattedContent === fileContent) {
        // If the file didn't change, return any empty array of edits.
        return [];
      }

      const edits = [
        new vscode.TextEdit(
          new vscode.Range(
            document.positionAt(0),
            document.positionAt(fileContent.length),
          ),
          formattedContent,
        ),
      ];
      return edits;
    } catch (err) {
      vscode.window.showErrorMessage(`${err}`);
    }
  }
}
