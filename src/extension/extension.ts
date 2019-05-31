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
  createBazelTask,
  getBazelTaskInfo,
  queryQuickPickPackage,
  queryQuickPickTargets,
} from "../bazel";
import {
  exitCodeToUserString,
  IBazelCommandAdapter,
  parseExitCode,
} from "../bazel/bazellib";
import {
  BuildifierDiagnosticsManager,
  BuildifierFormatProvider,
  checkBuildifierIsAvailable,
} from "../buildifier";
import { BazelBuildCodeLensProvider } from "../codelens";
import { setupLoggingOutputChannel } from "../logging";
import { BazelTargetSymbolProvider } from "../symbols";
import { BazelWorkspaceTreeProvider } from "../workspace-tree";
import { getDefaultBazelExecutablePath } from "./configuration";

/**
 * Called when the extension is activated; that is, when its first command is
 * executed.
 *
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
  setupLoggingOutputChannel(context);

  const workspaceTreeProvider = new BazelWorkspaceTreeProvider(context);
  const codeLensProvider = new BazelBuildCodeLensProvider(context);
  const buildifierDiagnostics = new BuildifierDiagnosticsManager();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "bazelWorkspace",
      workspaceTreeProvider,
    ),
    // Commands
    vscode.commands.registerCommand("bazel.buildTarget", bazelBuildTarget),
    vscode.commands.registerCommand(
      "bazel.buildTargetWithDebugging",
      bazelBuildTargetWithDebugging,
    ),
    vscode.commands.registerCommand("bazel.buildAll", bazelbuildAll),
    vscode.commands.registerCommand(
      "bazel.buildAllRecursive",
      bazelbuildAllRecursive,
    ),
    vscode.commands.registerCommand("bazel.testTarget", bazelTestTarget),
    vscode.commands.registerCommand("bazel.testAll", bazelTestAll),
    vscode.commands.registerCommand(
      "bazel.testAllRecursive",
      bazelTestAllRecursive,
    ),
    vscode.commands.registerCommand("bazel.clean", bazelClean),
    vscode.commands.registerCommand("bazel.refreshBazelBuildTargets", () => {
      workspaceTreeProvider.refresh();
    }),
    vscode.commands.registerCommand(
      "bazel.copyTargetToClipboard",
      bazelCopyTargetToClipboard,
    ),
    // CodeLens provider for BUILD files
    vscode.languages.registerCodeLensProvider(
      [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
      codeLensProvider,
    ),
    // Buildifier formatting support
    vscode.languages.registerDocumentFormattingEditProvider(
      [
        { pattern: "**/BUILD" },
        { pattern: "**/BUILD.bazel" },
        { pattern: "**/WORKSPACE" },
        { pattern: "**/WORKSPACE.bazel" },
        { pattern: "**/*.BUILD" },
        { pattern: "**/*.bzl" },
        { pattern: "**/*.sky" },
      ],
      new BuildifierFormatProvider(),
    ),
    buildifierDiagnostics,
    // Symbol provider for BUILD files
    vscode.languages.registerDocumentSymbolProvider(
      [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
      new BazelTargetSymbolProvider(),
    ),
    // Task events.
    vscode.tasks.onDidStartTask(onTaskStart),
    vscode.tasks.onDidStartTaskProcess(onTaskProcessStart),
    vscode.tasks.onDidEndTaskProcess(onTaskProcessEnd),
  );

  // Notify the user if buildifier is not available on their path (or where
  // their settings expect it).
  checkBuildifierIsAvailable();
}

/** Called when the extension is deactivated. */
export function deactivate() {
  // Nothing to do here.
}

/**
 * Builds a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelBuildTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets("\"kind('.* rule', ...)\""),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      bazelBuildTarget(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const task = createBazelTask("build", commandOptions);
  vscode.tasks.executeTask(task);
}

/**
 * Builds a Bazel target and attaches the Starlark debugger.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelBuildTargetWithDebugging(
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets("\"kind('.* rule', ...)\""),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      bazelBuildTargetWithDebugging(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  vscode.debug.startDebugging(undefined, {
    args: commandOptions.targets.concat(commandOptions.options),
    bazelCommand: "build",
    bazelExecutablePath: getDefaultBazelExecutablePath(),
    cwd: commandOptions.workspaceInfo.bazelWorkspacePath,
    name: "On-demand Bazel Build Debug",
    request: "launch",
    type: "bazel-launch-build",
  });
}

/**
 * Builds a Bazel package and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelbuildAll(adapter: IBazelCommandAdapter | undefined) {
  buildPackage(":all", adapter);
}

/**
 * Builds a Bazel package recursively and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelbuildAllRecursive(
  adapter: IBazelCommandAdapter | undefined,
) {
  buildPackage("/...", adapter);
}

async function buildPackage(
  suffix: string,
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickPackage(),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      buildPackage(suffix, quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const allCommandOptions = {
    options: commandOptions.options,
    targets: commandOptions.targets.map((s) => s + suffix),
    workspaceInfo: commandOptions.workspaceInfo,
  };
  const task = createBazelTask("build", allCommandOptions);
  vscode.tasks.executeTask(task);
}

/**
 * Tests a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelTestTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick test targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets("\"kind('.*_test rule', ...)\""),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      bazelTestTarget(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const task = createBazelTask("test", commandOptions);
  vscode.tasks.executeTask(task);
}

/**
 * Tests a Bazel package and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelTestAll(adapter: IBazelCommandAdapter | undefined) {
  testPackage(":all", adapter);
}

/**
 * Tests a Bazel package recursively and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelTestAllRecursive(
  adapter: IBazelCommandAdapter | undefined,
) {
  testPackage("/...", adapter);
}

async function testPackage(
  suffix: string,
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickPackage(),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      testPackage(suffix, quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const allCommandOptions = {
    options: commandOptions.options,
    targets: commandOptions.targets.map((s) => s + suffix),
    workspaceInfo: commandOptions.workspaceInfo,
  };
  const task = createBazelTask("test", allCommandOptions);
  vscode.tasks.executeTask(task);
}

/**
 * Cleans a Bazel workspace.
 *
 * If there is only a single workspace open, it will be cleaned immediately. If
 * there are multiple workspace folders open, a quick-pick window will be opened
 * asking the user to choose one.
 */
async function bazelClean() {
  const workspaces = vscode.workspace.workspaceFolders;
  let workspaceFolder: vscode.WorkspaceFolder;

  switch (workspaces.length) {
    case 0:
      vscode.window.showInformationMessage(
        "Please open a Bazel workspace folder to use this command.",
      );
      return;
    case 1:
      workspaceFolder = workspaces[0];
      break;
    default:
      workspaceFolder = await vscode.window.showWorkspaceFolderPick();
      if (workspaceFolder === undefined) {
        return;
      }
  }

  const task = createBazelTask("clean", {
    options: [],
    targets: [],
    workspaceInfo: BazelWorkspaceInfo.fromWorkspaceFolder(workspaceFolder),
  });
  vscode.tasks.executeTask(task);
}

/**
 * Copies a target to the clipboard.
 */
async function bazelCopyTargetToClipboard(
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // This command should not be enabled in the commands palette, so adapter
    // should always be present.
    return;
  }
  // This can only be called on single targets, so we can assume there is only
  // one of them.
  const target = adapter.getBazelCommandOptions().targets[0];
  vscode.env.clipboard.writeText(target);
}

function onTaskStart(event: vscode.TaskStartEvent) {
  const bazelTaskInfo = getBazelTaskInfo(event.execution.task);
  if (bazelTaskInfo) {
    bazelTaskInfo.startTime = process.hrtime();
  }
}

function onTaskProcessStart(event: vscode.TaskProcessStartEvent) {
  const bazelTaskInfo = getBazelTaskInfo(event.execution.task);
  if (bazelTaskInfo) {
    bazelTaskInfo.processId = event.processId;
  }
}

function onTaskProcessEnd(event: vscode.TaskProcessEndEvent) {
  const bazelTaskInfo = getBazelTaskInfo(event.execution.task);
  if (bazelTaskInfo) {
    const rawExitCode = event.exitCode;
    bazelTaskInfo.exitCode = rawExitCode;

    const exitCode = parseExitCode(rawExitCode, bazelTaskInfo.command);
    if (rawExitCode !== 0) {
      vscode.window.showErrorMessage(
        `Bazel ${bazelTaskInfo.command} failed: ${exitCodeToUserString(
          exitCode,
        )}`,
      );
    } else {
      const timeInSeconds = measurePerformance(bazelTaskInfo.startTime);
      vscode.window.showInformationMessage(
        `Bazel ${
          bazelTaskInfo.command
        } completed successfully in ${timeInSeconds} seconds.`,
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
