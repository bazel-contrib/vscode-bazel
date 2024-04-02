// Copyright 2019 The Bazel Authors. All rights reserved.
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
import { TASK_TYPE, type BazelTaskDefinition } from "./tasks";
import { exitCodeToUserString, parseExitCode } from "./bazel_exit_code";

/** Information about a Bazel task. */
export class BazelTaskInfo {
  /** start time (for internal performance tracking). */
  public startTime: [number, number];
}

export function onTaskStart(event: vscode.TaskStartEvent) {
  const definition = event.execution.task.definition;
  if (definition.type === TASK_TYPE) {
    const bazelTaskInfo = new BazelTaskInfo();
    bazelTaskInfo.startTime = process.hrtime();
    definition.bazelTaskInfo = bazelTaskInfo;
  }
}

export function onTaskProcessEnd(event: vscode.TaskProcessEndEvent) {
  const task = event.execution.task;
  const command = (task.definition as BazelTaskDefinition).command;
  const bazelTaskInfo = task.definition.bazelTaskInfo as BazelTaskInfo;
  if (bazelTaskInfo) {
    const rawExitCode = event.exitCode;

    const exitCode = parseExitCode(rawExitCode, command);
    if (rawExitCode !== 0) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showErrorMessage(
        `Bazel ${command} failed: ${exitCodeToUserString(exitCode)}`,
      );
    } else {
      const timeInSeconds = measurePerformance(bazelTaskInfo.startTime);
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showInformationMessage(
        `Bazel ${command} completed successfully in ${timeInSeconds} seconds.`,
      );
    }
  }
}

/**
 * Returns the number of seconds elapsed with a single decimal place.
 *
 */
function measurePerformance(start: [number, number]) {
  const diff = process.hrtime(start);
  return (diff[0] + diff[1] / 1e9).toFixed(1);
}
