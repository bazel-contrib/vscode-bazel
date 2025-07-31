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

import { IBazelCommandAdapter } from "../bazel/bazel_command";
import { BazelWorkspaceInfo } from "../bazel/bazel_workspace_info";
import { getDefaultBazelExecutablePath } from "./configuration";
import { getBazelPackageFile } from "../bazel/bazel_utils";
import {
  queryQuickPickTargets,
  queryQuickPickPackage,
  showDynamicQuickPick,
} from "../bazel/bazel_quickpick";
import { createBazelTask } from "../bazel/tasks";
import { blaze_query } from "../protos";

/**
 * Builds a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelBuildTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await showDynamicQuickPick({
      query: "kind('.* rule', //...)",
      queryFunctor: queryQuickPickTargets,
      workspaceInfo: await BazelWorkspaceInfo.fromWorkspaceFolders(),
    });
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await bazelBuildTarget(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const task = createBazelTask("build", commandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Builds a Bazel target and attaches the Starlark debugger.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelBuildTargetWithDebugging(
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await showDynamicQuickPick({
      query: "kind('.* rule', //...)",
      queryFunctor: queryQuickPickTargets,
      workspaceInfo: await BazelWorkspaceInfo.fromWorkspaceFolders(),
    });
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      bazelBuildTargetWithDebugging(quickPick);
    }
    return;
  }
  const bazelConfigCmdLine =
    vscode.workspace.getConfiguration("bazel.commandLine");
  const startupOptions = bazelConfigCmdLine.get<string[]>("startupOptions");
  const commandArgs = bazelConfigCmdLine.get<string[]>("commandArgs");

  const commandOptions = adapter.getBazelCommandOptions();

  const fullArgs = commandArgs
    .concat(commandOptions.targets)
    .concat(commandOptions.options);

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.debug.startDebugging(undefined, {
    args: fullArgs,
    bazelCommand: "build",
    bazelExecutablePath: getDefaultBazelExecutablePath(),
    bazelStartupOptions: startupOptions,
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
 * which the command's arguments will be determined.
 */
async function bazelbuildAll(adapter: IBazelCommandAdapter | undefined) {
  await buildPackage(":all", adapter);
}

/**
 * Builds a Bazel package recursively and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelbuildAllRecursive(
  adapter: IBazelCommandAdapter | undefined,
) {
  await buildPackage("/...", adapter);
}

async function buildPackage(
  suffix: string,
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await showDynamicQuickPick({
      queryFunctor: queryQuickPickPackage,
      workspaceInfo: await BazelWorkspaceInfo.fromWorkspaceFolders(),
    });
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await buildPackage(suffix, quickPick);
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
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Runs a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelRunTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick test targets for
    // the user to choose from.
    const quickPick = await showDynamicQuickPick({
      query: "kind('.* rule', //...)",
      queryFunctor: queryQuickPickTargets,
      workspaceInfo: await BazelWorkspaceInfo.fromWorkspaceFolders(),
    });
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await bazelRunTarget(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const task = createBazelTask("run", commandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Tests a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelTestTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick test targets for
    // the user to choose from.
    const quickPick = await showDynamicQuickPick({
      query: "kind('.*_test rule', //...)",
      queryFunctor: queryQuickPickTargets,
      workspaceInfo: await BazelWorkspaceInfo.fromWorkspaceFolders(),
    });
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await bazelTestTarget(quickPick);
    }
    return;
  }
  const commandOptions = adapter.getBazelCommandOptions();
  const task = createBazelTask("test", commandOptions);
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Tests a Bazel package and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelTestAll(adapter: IBazelCommandAdapter | undefined) {
  await testPackage(":all", adapter);
}

/**
 * Tests a Bazel package recursively and streams output to the terminal.
 *
 * @param adapter An object that implements {@link IBazelCommandAdapter} from
 * which the command's arguments will be determined.
 */
async function bazelTestAllRecursive(
  adapter: IBazelCommandAdapter | undefined,
) {
  await testPackage("/...", adapter);
}

async function testPackage(
  suffix: string,
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await showDynamicQuickPick({
      queryFunctor: queryQuickPickPackage,
      workspaceInfo: await BazelWorkspaceInfo.fromWorkspaceFolders(),
    });
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      await testPackage(suffix, quickPick);
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
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
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
  const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
  if (!workspaceInfo) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage(
      "Please open a Bazel workspace folder to use this command.",
    );

    return;
  }
  const task = createBazelTask("clean", {
    options: [],
    targets: [],
    workspaceInfo,
  });
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.tasks.executeTask(task);
}

/**
 * Navigates to the BUILD file for the current package.
 *
 * This command finds the nearest BUILD or BUILD.bazel file in the current file's
 * directory or any parent directory and opens it in the editor. The search is
 * limited to the current Bazel workspace.
 */
async function bazelGoToBuildFile() {
  const currentEditor = vscode.window.activeTextEditor;
  if (!currentEditor) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage(
      "Please open a file to go to its BUILD file.",
    );
    return;
  }

  const filePath = currentEditor.document.uri.fsPath;
  const buildFilePath = getBazelPackageFile(filePath);
  if (!buildFilePath) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage(
      "No BUILD or BUILD.bazel file found in any parent directory.",
    );
    return;
  }

  // Open the BUILD file
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  await vscode.window.showTextDocument(vscode.Uri.file(buildFilePath));
}

/**
 * Navigates to the BUILD file location for the specified label.
 *
 * This command finds the BUILD file location for the specified label and opens
 * it in the editor.
 * @param target_info Optional target information to go to directly, bypassing the quick pick
 */
async function bazelGoToLabel(target_info?: blaze_query.ITarget | undefined) {
  if (!target_info) {
    const quickPick = await showDynamicQuickPick({
      query: "kind('.* rule', //...)",
      queryFunctor: queryQuickPickTargets,
      workspaceInfo: await BazelWorkspaceInfo.fromWorkspaceFolders(),
    });
    // If the result was undefined, the user cancelled the quick pick
    if (!quickPick) {
      return;
    }
    target_info = quickPick.getTargetInfo();
  }

  const location = target_info.rule.location;
  const [filePath, line, column] = location.split(":");
  const position = new vscode.Position(
    parseInt(line, 10) - 1, // Convert to 0-based line number
    parseInt(column || "0", 10) - 1, // Convert to 0-based column number, default to 0
  );

  // Open the document and reveal the position
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(filePath),
  );
  await vscode.window.showTextDocument(document, {
    selection: new vscode.Range(position, position),
  });
}

/**
 * Activate all user-facing commands which simply wrap Bazel commands
 * such as `build`, `clean`, etc.
 */
export function activateWrapperCommands(): vscode.Disposable[] {
  return [
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
    vscode.commands.registerCommand("bazel.runTarget", bazelRunTarget),
    vscode.commands.registerCommand("bazel.testTarget", bazelTestTarget),
    vscode.commands.registerCommand("bazel.testAll", bazelTestAll),
    vscode.commands.registerCommand(
      "bazel.testAllRecursive",
      bazelTestAllRecursive,
    ),
    vscode.commands.registerCommand("bazel.clean", bazelClean),
    vscode.commands.registerCommand("bazel.goToBuildFile", bazelGoToBuildFile),
    vscode.commands.registerCommand("bazel.goToLabel", bazelGoToLabel),
  ];
}
