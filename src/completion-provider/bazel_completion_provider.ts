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
import {
  BazelWorkspaceInfo,
  getPackageLabelForBuildFile,
  queryQuickPickTargets,
} from "../bazel";

function insertCompletionItemIfUnique(
  options: vscode.CompletionItem[],
  option: vscode.CompletionItem,
) {
  if (
    options.find((value: vscode.CompletionItem) => {
      return value.label === option.label && value.kind === option.kind;
    }) === undefined
  ) {
    options.push(option);
  }
}

function getCandidateTargetFromDocumentPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | undefined {
  const linePrefix = document
    .lineAt(position)
    .text.substring(0, position.character);
  const doubleSlashIndex = linePrefix.lastIndexOf("//");
  const colonIndex = linePrefix.lastIndexOf(":");
  const index = doubleSlashIndex !== -1 ? doubleSlashIndex : colonIndex;
  if (index === -1) {
    return undefined;
  }
  return linePrefix.substring(index);
}

function stripLastPackageOrTargetName(target: string) {
  const slashIndex = target.lastIndexOf("/");
  const colonIndex = target.lastIndexOf(":");
  const index = Math.max(slashIndex, colonIndex);
  if (index !== -1) {
    target = target.substring(0, index + 1);
  }
  return target;
}

function getNextPackage(target: string) {
  const nextPackage = target.split("/", 2);
  if (nextPackage.length > 1) {
    return nextPackage[0];
  } else if (nextPackage[0] !== "") {
    const withoutTarget = nextPackage[0].split(":", 2);
    if (withoutTarget.length > 1) {
      return withoutTarget[0];
    }
  }
  return undefined;
}

function getAbsoluteLabel(
  target: string,
  document: vscode.TextDocument,
): string {
  if (target.startsWith("//")) {
    return target;
  }
  const workspace = BazelWorkspaceInfo.fromDocument(document);
  if (!workspace) {
    return target;
  }
  const packageLabel = getPackageLabelForBuildFile(
    workspace.bazelWorkspacePath,
    document.uri.fsPath,
  );
  return `${packageLabel}${target}`;
}

export class BazelCompletionItemProvider
  implements vscode.CompletionItemProvider {
  private targets: string[] = [];

  /**
   * Returns completion items matching the given prefix.
   *
   * Only label started with `//` or `:` is supported at the moment.
   */
  public provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ) {
    let candidateTarget = getCandidateTargetFromDocumentPosition(
      document,
      position,
    );
    if (candidateTarget === undefined) {
      return [];
    }

    candidateTarget = getAbsoluteLabel(candidateTarget, document);

    if (!candidateTarget.endsWith("/") && !candidateTarget.endsWith(":")) {
      candidateTarget = stripLastPackageOrTargetName(candidateTarget);
    }

    const completionItems = new Array<vscode.CompletionItem>();
    this.targets.forEach((target) => {
      if (!target.startsWith(candidateTarget)) {
        return;
      }
      const suffix = target.replace(candidateTarget, "");

      let completionKind = vscode.CompletionItemKind.Folder;
      let label = getNextPackage(suffix);
      if (label === undefined) {
        completionKind = vscode.CompletionItemKind.Field;
        label = suffix;
      }
      insertCompletionItemIfUnique(
        completionItems,
        new vscode.CompletionItem(label, completionKind),
      );
    });
    return completionItems;
  }

  /**
   * Runs a bazel query command to acquire labels of all the targets in the
   * workspace.
   */
  public async refresh() {
    const queryTargets = await queryQuickPickTargets({
      query: "kind('.* rule', ...)",
    });
    if (queryTargets.length !== 0) {
      this.targets = queryTargets.map((queryTarget) => {
        return queryTarget.label;
      });
    }
  }
}
