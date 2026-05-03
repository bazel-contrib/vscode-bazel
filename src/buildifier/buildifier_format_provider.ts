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
import * as path from "path";
import { buildifierFormat } from "./buildifier";
import { BazelWorkspaceInfo } from "../bazel";
import { getBuildifierFixOnFormat } from "../extension/configuration";
import { ILogger } from "../extension/logger";

/**
 * Provides document formatting functionality for Bazel files by invoking
 * buildifier.
 */
export class BuildifierFormatProvider
  implements vscode.DocumentFormattingEditProvider
{
  private logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  public async provideDocumentFormattingEdits(
    document: vscode.TextDocument,
  ): Promise<vscode.TextEdit[]> {
    this.logger.logDebug(`Formatting document: ${document.uri.fsPath}`);

    const fileContent = document.getText();
    const workspaceInfo = BazelWorkspaceInfo.fromDocument(document);
    if (!workspaceInfo) {
      this.logger.logDebug(
        "No workspace info found for document during formatting",
        false,
        document.uri.fsPath,
      );
      return [];
    }
    const workspaceRelativePath = path.relative(
      workspaceInfo.bazelWorkspacePath,
      document.uri.fsPath,
    );
    try {
      const formattedContent = await buildifierFormat(
        fileContent,
        workspaceRelativePath,
        getBuildifierFixOnFormat(),
      );
      if (formattedContent === fileContent) {
        this.logger.logDebug("File did not change during formatting");
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
      this.logger.logDebug("Returning formatting edits");
      return edits;
    } catch (err: any) {
      this.logger.logError("Buildifier formatting failed", true, err);
      return [];
    }
  }
}
