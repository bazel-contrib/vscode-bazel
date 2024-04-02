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
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";

import {
  BazelWorkspaceInfo,
  activateTaskProvider,
  createBazelTask,
  queryQuickPickPackage,
  queryQuickPickTargets,
} from "../bazel";
import { IBazelCommandAdapter } from "../bazel";
import {
  BuildifierDiagnosticsManager,
  BuildifierFormatProvider,
  checkBuildifierIsAvailable,
} from "../buildifier";
import { BazelBuildCodeLensProvider } from "../codelens";
import { BazelCompletionItemProvider } from "../completion-provider";
import { BazelGotoDefinitionProvider } from "../definition/bazel_goto_definition_provider";
import { BazelTargetSymbolProvider } from "../symbols";
import { BazelWorkspaceTreeProvider } from "../workspace-tree";
import { getDefaultBazelExecutablePath } from "./configuration";
import { activateCommandVariables } from "./command_variables";

/**
 * Called when the extension is activated; that is, when its first command is
 * executed.
 *
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
  const workspaceTreeProvider = new BazelWorkspaceTreeProvider(context);
  const codeLensProvider = new BazelBuildCodeLensProvider(context);
  const buildifierDiagnostics = new BuildifierDiagnosticsManager();
  const completionItemProvider = new BazelCompletionItemProvider();

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  completionItemProvider.refresh();

  const config = vscode.workspace.getConfiguration("bazel");
  const lspEnabled = config.get<boolean>("lsp.enabled");

  if (lspEnabled) {
    const lspClient = createLsp(config);

    context.subscriptions.push(
      lspClient,
      vscode.commands.registerCommand("bazel.lsp.restart", () =>
        lspClient.restart(),
      ),
    );

    await lspClient.start();
  } else {
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
        completionItemProvider,
        "/",
        ":",
      ),
      // Symbol provider for BUILD files
      vscode.languages.registerDocumentSymbolProvider(
        [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
        new BazelTargetSymbolProvider(),
      ),
      // Goto definition for BUILD files
      vscode.languages.registerDefinitionProvider(
        [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
        new BazelGotoDefinitionProvider(),
      ),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", lspEnabled);

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
    vscode.commands.registerCommand("bazel.runTarget", bazelRunTarget),
    vscode.commands.registerCommand("bazel.testTarget", bazelTestTarget),
    vscode.commands.registerCommand("bazel.testAll", bazelTestAll),
    vscode.commands.registerCommand(
      "bazel.testAllRecursive",
      bazelTestAllRecursive,
    ),
    vscode.commands.registerCommand("bazel.clean", bazelClean),
    vscode.commands.registerCommand("bazel.refreshBazelBuildTargets", () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      completionItemProvider.refresh();
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
        { language: "starlark" },
        { pattern: "**/BUILD" },
        { pattern: "**/*.bazel" },
        { pattern: "**/WORKSPACE" },
        { pattern: "**/*.BUILD" },
        { pattern: "**/*.bzl" },
        { pattern: "**/*.sky" },
      ],
      new BuildifierFormatProvider(),
    ),
    buildifierDiagnostics,
    // Task provider
    ...activateTaskProvider(),
    // Command variables
    ...activateCommandVariables(),
  );

  // Notify the user if buildifier is not available on their path (or where
  // their settings expect it).
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  await checkBuildifierIsAvailable();
}

/** Called when the extension is deactivated. */
export function deactivate() {
  // Nothing to do here.
}

function createLsp(config: vscode.WorkspaceConfiguration) {
  const command = config.get<string>("lsp.command");
  const args = config.get<string[]>("lsp.args");

  const serverOptions: ServerOptions = {
    args,
    command,
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "starlark" }],
  };

  return new LanguageClient("Bazel LSP Client", serverOptions, clientOptions);
}

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
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.* rule', ...)" }),
      {
        canPickMany: false,
      },
    );
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
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.* rule', ...)" }),
      {
        canPickMany: false,
      },
    );
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
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickPackage({}),
      {
        canPickMany: false,
      },
    );
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
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.* rule', ...)" }),
      {
        canPickMany: false,
      },
    );
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
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets({ query: "kind('.*_test rule', ...)" }),
      {
        canPickMany: false,
      },
    );
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
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickPackage({}),
      {
        canPickMany: false,
      },
    );
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
 * Copies a target to the clipboard.
 */
function bazelCopyTargetToClipboard(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // This command should not be enabled in the commands palette, so adapter
    // should always be present.
    return;
  }
  // This can only be called on single targets, so we can assume there is only
  // one of them.
  const target = adapter.getBazelCommandOptions().targets[0];
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  vscode.env.clipboard.writeText(target);
}
