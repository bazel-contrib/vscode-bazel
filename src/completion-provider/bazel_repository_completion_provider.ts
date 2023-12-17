// Copyright 2023 The Bazel Authors. All rights reserved.
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
import { queryQuickPickTargets } from "../bazel";

function isCompletingInsideRepositoryLabel(
  document: vscode.TextDocument,
  position: vscode.Position,
) {
  const linePrefix = document
    .lineAt(position)
    .text.substring(0, position.character);
  const startOfRepo = linePrefix.lastIndexOf("@");
  const endOfRepo = linePrefix.lastIndexOf("//");
  return startOfRepo !== -1 && (endOfRepo === -1 || endOfRepo < startOfRepo);
}

function getTargetName(label: string) {
  const colonIndex = label.lastIndexOf(":");
  if (colonIndex === -1) {
    return undefined;
  }
  return label.substring(colonIndex + 1);
}

export class BazelRepositoryCompletionItemProvider
  implements vscode.CompletionItemProvider {
  private repositories?: Promise<string[]>;

  /**
   * Returns completion items matching the given prefix.
   */
  public async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ) {
    const bazelConfig = vscode.workspace.getConfiguration("bazel");
    const enableExternalTargetCompletion = bazelConfig.get<boolean>(
      "enableExternalTargetCompletion",
    );
    if (!enableExternalTargetCompletion) {
      return [];
    }

    if (!isCompletingInsideRepositoryLabel(document, position)) {
      return [];
    }

    const repos = await this.getRepos();
    const completionItems = repos.map(
      (repo) =>
        new vscode.CompletionItem(repo, vscode.CompletionItemKind.Folder),
    );
    return completionItems;
  }

  /**
   * Runs a bazel query command to acquire all the repositories in the
   * workspace.
   */
  public async refresh(): Promise<void> {
    await this.queryAndCacheRepos();
  }

  private async getRepos(): Promise<string[]> {
    if (this.repositories) {
      return await this.repositories;
    }
    return await this.queryAndCacheRepos();
  }

  private async queryAndCacheRepos(): Promise<string[]> {
    const queryRepos = async () => {
      const targets = await queryQuickPickTargets(
        "kind('.* rule', //external:*)",
      );
      return targets.map((target) => getTargetName(target.label));
    };
    const deferred = queryRepos();
    this.repositories = deferred;
    return await deferred;
  }
}
