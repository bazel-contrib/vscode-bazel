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
import { DocumentSymbolProvider } from "vscode";

import {
  BazelWorkspaceInfo,
  getTargetsForBuildFile,
  QueryLocation,
} from "../bazel";
import { getDefaultBazelExecutablePath } from "../extension/configuration";
import { blaze_query } from "../protos";

/** Provids Symbols for targets in Bazel BUILD files. */
export class BazelTargetSymbolProvider implements DocumentSymbolProvider {
  public async provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): Promise<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
    const workspaceInfo = BazelWorkspaceInfo.fromDocument(document);
    if (workspaceInfo === undefined) {
      vscode.window.showWarningMessage(
        "Bazel BUILD Symbols unavailable as currently opened file is not in " +
          "a Bazel workspace",
      );
      return [];
    }

    const queryResult = await getTargetsForBuildFile(
      getDefaultBazelExecutablePath(),
      workspaceInfo.bazelWorkspacePath,
      document.uri.fsPath,
    );

    return this.computeSymbols(queryResult);
  }

  /**
   * Takes the result of a Bazel query for targets defined in a package and
   * returns a list of Symbols for the BUILD file in that package.
   *
   * @param queryResult The result of the bazel query.
   */
  private computeSymbols(
    queryResult: blaze_query.QueryResult,
  ): vscode.DocumentSymbol[] {
    const result = [];

    for (const target of queryResult.target) {
      const location = new QueryLocation(target.rule.location);
      let targetName = target.rule.name;

      const colonIndex = targetName.indexOf(":");
      if (colonIndex !== -1) {
        targetName = targetName.substr(colonIndex + 1);
      }

      result.push(
        new vscode.DocumentSymbol(
          targetName,
          "",
          vscode.SymbolKind.Function,
          location.range,
          location.range,
        ),
      );
    }

    return result;
  }
}
