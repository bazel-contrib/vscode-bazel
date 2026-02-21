// Copyright 2024 The Bazel Authors. All rights reserved.
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
import { BazelWorkspaceInfo, QueryLocation } from "../bazel";
import { blaze_query } from "../protos";
import { CodeLensCommandAdapter } from "./code_lens_command_adapter";

/**
 * Groups of Bazel targets organized by the actions they support.
 */
interface ActionGroups {
  copy: string[];
  build: string[];
  test: string[];
  run: string[];
}

/**
 * Builds CodeLens items for Bazel targets.
 */
export class CodeLensBuilder {
  /**
   * Takes the result of a Bazel query for targets defined in a package and
   * returns a list of CodeLens for the BUILD file in that package.
   */
  buildCodeLenses(
    bazelWorkspaceInfo: BazelWorkspaceInfo,
    queryResult: blaze_query.QueryResult,
  ): vscode.CodeLens[] {
    const result: vscode.CodeLens[] = [];

    // Sort targets alphabetically
    const sortedTargets = [...queryResult.target].sort((a, b) => {
      return a.rule.name.localeCompare(b.rule.name);
    });

    // Group targets by line number to handle multiple targets on same line
    const targetsByLine = new Map<number, typeof sortedTargets>();
    for (const target of sortedTargets) {
      const location = new QueryLocation(target.rule.location);
      const line = location.line;
      if (!targetsByLine.has(line)) {
        targetsByLine.set(line, []);
      }
      targetsByLine.get(line)?.push(target);
    }

    // Process each line's targets
    for (const [, targets] of targetsByLine) {
      this.createCodeLensesForTargetsOnSameLine(
        targets,
        bazelWorkspaceInfo,
        result,
      );
    }

    return result;
  }

  /**
   * Creates CodeLens objects for targets on the same line.
   */
  private createCodeLensesForTargetsOnSameLine(
    targets: blaze_query.ITarget[],
    bazelWorkspaceInfo: BazelWorkspaceInfo,
    result: vscode.CodeLens[],
  ): void {
    const location = new QueryLocation(targets[0].rule.location);
    const actionGroups = this.groupTargetsByAction(targets);

    this.createCodeLens(
      "Copy",
      "bazel.copyLabelToClipboard",
      actionGroups.copy,
      location,
      bazelWorkspaceInfo,
      result,
    );
    this.createCodeLens(
      "Build",
      "bazel.buildTarget",
      actionGroups.build,
      location,
      bazelWorkspaceInfo,
      result,
    );
    this.createCodeLens(
      "Test",
      "bazel.testTarget",
      actionGroups.test,
      location,
      bazelWorkspaceInfo,
      result,
    );
    this.createCodeLens(
      "Run",
      "bazel.runTarget",
      actionGroups.run,
      location,
      bazelWorkspaceInfo,
      result,
    );
  }

  /**
   * Groups targets by the actions they support based on Bazel rule types.
   */
  private groupTargetsByAction(targets: blaze_query.ITarget[]): ActionGroups {
    const copyTargets: string[] = [];
    const buildTargets: string[] = [];
    const testTargets: string[] = [];
    const runTargets: string[] = [];

    for (const target of targets) {
      const targetName = target.rule.name;
      const ruleClass = target.rule.ruleClass;

      // All targets support copying and building
      copyTargets.push(targetName);
      buildTargets.push(targetName);

      // Only test targets support testing.
      if (ruleClass.endsWith("_test") || ruleClass === "test_suite") {
        testTargets.push(targetName);
      }

      // Targets which are not libraries may support running.
      const ruleIsLibrary = ruleClass.endsWith("_library");
      if (!ruleIsLibrary) {
        runTargets.push(targetName);
      }
    }

    return {
      copy: copyTargets,
      build: buildTargets,
      test: testTargets,
      run: runTargets,
    };
  }

  /**
   * Creates a CodeLens for a specific action type if targets are available.
   */
  private createCodeLens(
    actionName: string,
    command: string,
    targets: string[],
    location: QueryLocation,
    bazelWorkspaceInfo: BazelWorkspaceInfo,
    result: vscode.CodeLens[],
  ): void {
    if (targets.length === 0) {
      return;
    }

    const title =
      targets.length === 1 ? actionName : `${actionName} (${targets.length})`;

    result.push(
      new vscode.CodeLens(location.range, {
        arguments: [new CodeLensCommandAdapter(bazelWorkspaceInfo, targets)],
        command,
        title,
        tooltip: `${actionName} target - ${targets.length} targets available`,
      }),
    );
  }
}
