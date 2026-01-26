// Copyright 2021 The Bazel Authors. All rights reserved.
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

import {
  Definition,
  DefinitionLink,
  DefinitionProvider,
  Position,
  TextDocument,
  Uri,
} from "vscode";
import { Utils } from "vscode-uri";
import { BazelQuery, BazelWorkspaceInfo, QueryLocation } from "../bazel";
import { getDefaultBazelExecutablePath } from "../extension/configuration";
import { blaze_query } from "../protos";

// LABEL_REGEX matches label strings, e.g. @r//x/y/z:abc
const LABEL_REGEX = /"((?:@\w+)?\/\/|(?:.+\/)?[^:]*(?::[^:]+)?)"/;

export async function targetToUri(
  targetText: string,
  workingDirectory: Uri,
): Promise<QueryLocation | undefined> {
  const match = LABEL_REGEX.exec(targetText);

  if (!match) {
    return undefined;
  }

  const targetName = match[1];
  // don't try to process visibility targets.
  if (targetName.startsWith("//visibility")) {
    return undefined;
  }

  const queryResult = await new BazelQuery(
    getDefaultBazelExecutablePath(),
    workingDirectory.fsPath,
  ).queryTargets(`kind(rule, "${targetName}") + kind(file, "${targetName}")`);

  if (!queryResult.target.length) {
    return undefined;
  }
  const result = queryResult.target[0];

  let location: QueryLocation;
  if (result.type === blaze_query.Target.Discriminator.RULE) {
    if (result.rule?.location == null) {
      return undefined;
    }

    location = new QueryLocation(result.rule.location);
  } else {
    if (result.sourceFile?.location == null) {
      return undefined;
    }

    location = new QueryLocation(result.sourceFile.location);
  }

  return location;
}

export class BazelGotoDefinitionProvider implements DefinitionProvider {
  public async provideDefinition(
    document: TextDocument,
    position: Position,
  ): Promise<Definition | DefinitionLink[] | null> {
    const workspaceInfo = BazelWorkspaceInfo.fromDocument(document);
    if (workspaceInfo === undefined) {
      // Not in a Bazel Workspace.
      return null;
    }

    const range = document.getWordRangeAtPosition(position, LABEL_REGEX);
    const targetText = document.getText(range);

    const location = await targetToUri(targetText, Utils.dirname(document.uri));

    return location
      ? [
          {
            originSelectionRange: range,
            targetUri: Uri.file(location.path).with({
              fragment: `${location.line}:${location.column}`,
            }),
            targetRange: location.range,
          },
        ]
      : null;
  }
}
