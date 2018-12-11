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
  getBazelWorkspaceFolder,
  getTargetsForBuildFile,
  QueryResult,
} from "../bazel";

/** Provids Symbols for targets in Bazel BUILD files. */
export class StarlarkSymbolProvider implements DocumentSymbolProvider {
  public async provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): Promise<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
    const workspace = getBazelWorkspaceFolder(document.uri.fsPath);
    if (workspace === undefined) {
      vscode.window.showWarningMessage(
        "Bazel BUILD Symbols unavailable as currently opened file is not in " +
          "a Bazel workspace",
      );
      return [];
    }

    const queryResult = await getTargetsForBuildFile(
      workspace,
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
  private computeSymbols(queryResult: QueryResult): vscode.DocumentSymbol[] {
    const result = [];

    for (const rule of queryResult.rules) {
      const loc = rule.location;
      const target = rule.name;

      const colonIndex = target.indexOf(":");
      let targetName: string;
      if (colonIndex !== -1) {
        targetName = target.substr(colonIndex + 1);
      } else {
        targetName = target;
      }

      const linePosition = new vscode.Position(loc.line, 0);
      const lineRangeStart = new vscode.Range(linePosition, linePosition);

      result.push(
        new vscode.DocumentSymbol(
          targetName,
          "",
          vscode.SymbolKind.Function,
          lineRangeStart,
          lineRangeStart,
        ),
      );
    }

    return result;
  }
}
