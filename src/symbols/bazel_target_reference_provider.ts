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

import * as path from "path";
import * as vscode from "vscode";
import { BazelQuery, QueryLocation } from "../bazel";
import { blaze_query } from "../protos";

/**
 * Provides find/peek references functionality for BUILD target labels by using
 * an {@code allrdeps} query.
 */
export class BazelTargetReferenceProvider implements vscode.ReferenceProvider {
  public async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.Location[]> {
    const line = document.lineAt(position.line);
    const pattern = /"((?:@|\/\/|:)[^"]+)"/g;
    let match: RegExpExecArray;

    do {
      match = pattern.exec(line.text);
      if (match === undefined) {
        break;
      }

      // Ignore the label if it's not the one the user selected.
      const matchStart = match.index + 1;
      const matchEnd = match.index + match[0].length - 1;
      if (position.character < matchStart || position.character >= matchEnd) {
        continue;
      }

      const label = match[1];

      const query = new BazelQuery(
        path.dirname(document.uri.fsPath),
        // A query depth of 1 ensures that we only get direct deps.
        `'allrdeps("${label}", 1)'`,
        ["--universe_scope=//...", "--order_output=no"],
      );

      try {
        const result = await query.queryTargets();
        return this.getTargetLocations(result.target);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error finding references to "${label}": ${error}`,
        );
        break;
      }
    } while (match);

    return [];
  }

  /**
   * Returns the locations of the given targets in their BUILD files.
   *
   * @param targets The list of targets whose locations should be returned.
   */
  private getTargetLocations(
    targets: blaze_query.ITarget[],
  ): vscode.Location[] {
    const locations = [];
    for (const target of targets) {
      // Some target types, like SourceFiles, don't have location information.
      // Ignore those.
      if (target.rule) {
        const location = new QueryLocation(target.rule.location);
        locations.push(
          new vscode.Location(vscode.Uri.file(location.path), location.range),
        );
      }
    }
    return locations;
  }
}
