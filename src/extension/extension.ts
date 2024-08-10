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

import { activateTaskProvider } from "../bazel";
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
import { activateCommandVariables } from "./command_variables";
import { activateTesting } from "../test-explorer";
import { activateWrapperCommands } from "./bazel_wrapper_commands";

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
  const lspEnabled = !!config.get<string>("lsp.command");

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
    ...activateWrapperCommands(),
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
    // Test provider
    ...activateTesting(),
  );

  // Notify the user if buildifier is not available on their path (or where
  // their settings expect it).
  // We intentionally do no `await` the completion because doing so would mean
  // that VS Code considers the extension activation to be "in-flight" until the
  // users closes the "Buildifier not found" notification. VS Code hence
  // dislayed  never-finishing "Loading" indicator on top of the "Bazel Build
  // Targets" tree view.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  checkBuildifierIsAvailable();
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