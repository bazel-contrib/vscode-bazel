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
  BazelLabel,
  BazelWorkspaceInfo,
  getTargetGenerator,
  getTargetsForBuildFile,
  QueryLocation,
} from "../bazel";
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

    const generatorSymbols = new Map<string, vscode.DocumentSymbol>();

    for (const target of queryResult.target) {
      const generator = getTargetGenerator(target);
      let symbolArrayToAppend = [];

      if (generator) {
        let generatorSymbol = generatorSymbols.get(generator.location);
        if (generatorSymbol === undefined) {
          const generatorLocation = new QueryLocation(generator.location);
          generatorSymbol = new vscode.DocumentSymbol(
            `${generator.function}("${generator.name}")`,
            "",
            vscode.SymbolKind.Function,
            generatorLocation.range,
            generatorLocation.range,
          );
          generatorSymbols.set(generator.location, generatorSymbol);
          result.push(generatorSymbol);
        }
        symbolArrayToAppend = generatorSymbol.children;
      } else {
        symbolArrayToAppend = result;
      }

      const location = new QueryLocation(target.rule.location);
      const label = BazelLabel.parse(target.rule.name);

      symbolArrayToAppend.push(
        new vscode.DocumentSymbol(
          `:${label.name}`,
          "",
          vscode.SymbolKind.Class,
          location.range,
          location.range,
        ),
      );
    }

    return result;
  }
}
