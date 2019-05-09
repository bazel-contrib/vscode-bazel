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
import { getDefaultBazelExecutablePath } from "../extension/configuration";
import { BazelTaskInfo, setBazelTaskInfo } from "./bazel_task_info";
import { IBazelCommandOptions } from "./bazellib";

/**
 * Returns a {@code ShellQuotedString} indicating how to quote the given flag
 * if it contains spaces or other characters that need escaping.
 */
function quotedOption(option: string): vscode.ShellQuotedString {
  return { value: option, quoting: vscode.ShellQuoting.Strong };
}

/**
 * Creates a new task that invokes a build or test action.
 *
 * @param command The Bazel command to execute.
 * @param options Describes the options used to launch Bazel.
 */
export function createBazelTask(
  command: "build" | "clean" | "test",
  options: IBazelCommandOptions,
): vscode.Task {
  const args = [command as string]
    .concat(options.targets)
    .concat(options.options)
    .map(quotedOption);

  let commandDescription: string;
  switch (command) {
    case "build":
      commandDescription = "Build";
      break;
    case "clean":
      commandDescription = "Clean";
      break;
    case "test":
      commandDescription = "Test";
      break;
  }

  const targetsDescription = options.targets.join(", ");
  const task = new vscode.Task(
    { type: "bazel", command, targets: options.targets },
    // TODO(allevato): Change Workspace to Global once the fix for
    // Microsoft/vscode#63951 is in a stable release.
    options.workspaceInfo.workspaceFolder || vscode.TaskScope.Workspace,
    `${commandDescription} ${targetsDescription}`,
    "bazel",
    new vscode.ShellExecution(getDefaultBazelExecutablePath(), args, {
      cwd: options.workspaceInfo.bazelWorkspacePath,
    }),
  );
  setBazelTaskInfo(task, new BazelTaskInfo(command, options));
  return task;
}
