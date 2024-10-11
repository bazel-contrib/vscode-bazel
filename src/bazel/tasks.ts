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
import { IBazelCommandOptions } from "./bazel_command";
import { BazelWorkspaceInfo } from "./bazel_workspace_info";
import { exitCodeToUserString, parseExitCode } from "./bazel_exit_code";
import { BazelInfo } from "./bazel_info";
import { showLcovCoverage } from "../test-explorer";

export const TASK_TYPE = "bazel";

/** Information about a running Bazel task. */
export class BazelTaskInfo {
  /** start time (for internal performance tracking). */
  public startTime: [number, number];
}

/**
 * Definition of a Bazel task
 *
 * Must be kept in sync with the schema specified in the `taskDefinitions`
 * contribution in the `package.json`.
 */
export interface BazelTaskDefinition extends vscode.TaskDefinition {
  /** The Bazel command */
  command: "build" | "clean" | "coverage" | "test" | "run";
  /** The list of Bazel targets */
  targets: string[];
  /** Additional command line arguments */
  options?: string[];
  /** Information about the running task */
  bazelTaskInfo?: BazelTaskInfo;
}

/**
 * Returns a {@code ShellQuotedString} indicating how to quote the given flag
 * if it contains spaces or other characters that need escaping.
 */
function quotedOption(option: string): vscode.ShellQuotedString {
  return { value: option, quoting: vscode.ShellQuoting.Strong };
}

/**
 * Task provider for `bazel` tasks.
 */
class BazelTaskProvider implements vscode.TaskProvider {
  provideTasks(): vscode.ProviderResult<vscode.Task[]> {
    // We don't auto-detect any tasks
    return [];
  }
  async resolveTask(task: vscode.Task): Promise<vscode.Task | undefined> {
    // VSCode calls this
    //  * when rerunning a task from the task history in "Run Task"
    //  * for bazel tasks in the user's tasks.json,
    // We need to inform VSCode how to execute that command by creating
    // a ShellExecution for it.

    // Infer `BazelWorkspaceInfo` from `scope`
    const workspaceInfo = await getWorkspaceInfoFromTask(task.scope);
    if (!workspaceInfo) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showInformationMessage(
        "Please open a Bazel workspace folder to use this task.",
      );
      return;
    }

    return createBazelTaskFromDefinition(
      task.definition as BazelTaskDefinition,
      workspaceInfo,
    );
  }
}

async function getWorkspaceInfoFromTask(
  scope: vscode.WorkspaceFolder | vscode.TaskScope,
) {
  let workspaceInfo: BazelWorkspaceInfo;
  if (
    scope === vscode.TaskScope.Global ||
    scope === vscode.TaskScope.Workspace
  ) {
    workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
  } else if (scope) {
    workspaceInfo = BazelWorkspaceInfo.fromWorkspaceFolder(scope);
  }
  return workspaceInfo;
}

/**
 * Keep track of running Bazel tasks
 */
function onTaskStart(event: vscode.TaskStartEvent) {
  const task = event.execution.task;
  if (task.definition.type !== TASK_TYPE) {
    return;
  }
  const definition = task.definition as BazelTaskDefinition;
  const bazelTaskInfo = new BazelTaskInfo();
  bazelTaskInfo.startTime = process.hrtime();
  definition.bazelTaskInfo = bazelTaskInfo;
}

/**
 * Returns the number of seconds elapsed with a single decimal place.
 */
function measurePerformance(start: [number, number]) {
  const diff = process.hrtime(start);
  return (diff[0] + diff[1] / 1e9).toFixed(1);
}

/**
 * Display a notification whenever a Bazel task finished
 */
async function onTaskProcessEnd(event: vscode.TaskProcessEndEvent) {
  const task = event.execution.task;
  if (task.definition.type !== TASK_TYPE) {
    return;
  }
  const taskDefinition = task.definition as BazelTaskDefinition;
  const command = taskDefinition.command;
  const rawExitCode = event.exitCode;
  const exitCode = parseExitCode(rawExitCode, command);
  const bazelTaskInfo = taskDefinition.bazelTaskInfo;

  // Show a notification that the build is finished
  if (bazelTaskInfo) {
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

  // For coverage runs: Display the coverage results
  if (taskDefinition.command === "coverage" && rawExitCode === 0) {
    // Find the coverage file and load it.
    const workspaceInfo = await getWorkspaceInfoFromTask(task.scope);
    const bazelInfo = new BazelInfo(
      getDefaultBazelExecutablePath(),
      workspaceInfo.bazelWorkspacePath,
    );
    const outputPath = await bazelInfo.getOne("output_path");
    const executionRoot = await bazelInfo.getOne("execution_root");

    // Build a description string which will be displayed as part of the test run.
    const execution = task.execution as vscode.ShellExecution;
    const bazelCommandStr = JSON.stringify(
      [execution.command]
        .concat(execution.args)
        .map((a) => (typeof a === "string" ? a : a.value)),
    );
    const description = `Coverage info from:\n  ${bazelCommandStr}\n`;

    const covFilePath = outputPath + "/_coverage/_coverage_report.dat";
    const covFileUri = vscode.Uri.file(covFilePath);
    try {
      const covFileBytes = await vscode.workspace.fs.readFile(covFileUri);
      const covFileStr = new TextDecoder("utf8").decode(covFileBytes);
      if (covFileStr.trim() === "") {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        vscode.window.showWarningMessage(
          "The generated LCOV coverage file was empty.\n" +
            "Please ensure your toolchain is correctly setup and " +
            "the instrumentation filters are set correctly.",
        );
      } else {
        // The `bazel coverage` runs the build/test/coverage in sandboxes with
        // the similar/same layout of execution root, thus making it as the base
        // for mapping the source files.
        await showLcovCoverage(description, executionRoot, covFileStr);
      }
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showErrorMessage(
        `Unable to open coverage report from ${covFilePath}:\n${e}`,
      );
    }
  }
}

/**
 * Activate support for `bazel` tasks
 */
export function activateTaskProvider(): vscode.Disposable[] {
  return [
    // Task provider
    vscode.tasks.registerTaskProvider(TASK_TYPE, new BazelTaskProvider()),
    // Task events
    vscode.tasks.onDidStartTask(onTaskStart),
    vscode.tasks.onDidEndTaskProcess(onTaskProcessEnd),
  ];
}

/**
 * Creates a new task that invokes a build or test action.
 *
 * @param command The Bazel command to execute.
 * @param options Describes the options used to launch Bazel.
 */
export function createBazelTaskFromDefinition(
  taskDefinition: BazelTaskDefinition,
  workspaceInfo: BazelWorkspaceInfo,
): vscode.Task {
  const command = taskDefinition.command;
  const bazelConfigCmdLine =
    vscode.workspace.getConfiguration("bazel.commandLine");
  const startupOptions = bazelConfigCmdLine.get<string[]>("startupOptions");
  const addCommandArgs =
    command === "build" ||
    command === "test" ||
    command === "coverage" ||
    command === "run";
  const commandArgs = addCommandArgs
    ? bazelConfigCmdLine.get<string[]>("commandArgs")
    : [];

  const implicitArgs = [] as string[];
  let commandDescription: string;
  let group: vscode.TaskGroup | undefined;
  switch (command) {
    case "build":
      commandDescription = "Build";
      group = vscode.TaskGroup.Build;
      break;
    case "clean":
      commandDescription = "Clean";
      group = vscode.TaskGroup.Clean;
      break;
    case "coverage":
      commandDescription = "Coverage";
      group = vscode.TaskGroup.Test;
      // Coverage for cached tests doesn't work as expected :/
      // Disable caching.
      implicitArgs.push("--nocache_test_results");
      // We only support lcov formats, so request this format
      implicitArgs.push("--combined_report=lcov");
      break;
    case "test":
      commandDescription = "Test";
      group = vscode.TaskGroup.Test;
      break;
    case "run":
      commandDescription = "Run";
      break;
  }

  const args = startupOptions
    .concat([command as string])
    .concat(commandArgs)
    .concat(implicitArgs)
    .concat(taskDefinition.options ?? [])
    .concat(taskDefinition.targets)
    .map(quotedOption);

  const targetsDescription = taskDefinition.targets.join(", ");
  const task = new vscode.Task(
    taskDefinition,
    // TODO(allevato): Change Workspace to Global once the fix for
    // Microsoft/vscode#63951 is in a stable release.
    workspaceInfo.workspaceFolder || vscode.TaskScope.Workspace,
    `${commandDescription} ${targetsDescription}`,
    "bazel",
    new vscode.ShellExecution(getDefaultBazelExecutablePath(), args, {
      cwd: workspaceInfo.bazelWorkspacePath,
    }),
  );
  task.group = group;
  return task;
}

/**
 * Creates a new task that invokes a build or test action.
 *
 * @param command The Bazel command to execute.
 * @param options Describes the options used to launch Bazel.
 */
export function createBazelTask(
  command: "build" | "clean" | "coverage" | "test" | "run",
  options: IBazelCommandOptions,
): vscode.Task {
  const taskDefinition: BazelTaskDefinition = {
    type: TASK_TYPE,
    command,
    targets: options.targets,
    options: options.options,
  };
  return createBazelTaskFromDefinition(taskDefinition, options.workspaceInfo);
}
