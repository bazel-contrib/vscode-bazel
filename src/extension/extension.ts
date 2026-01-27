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
import * as lc from "vscode-languageclient/node";

import { activateTaskProvider } from "../bazel";
import {
  BuildifierDiagnosticsManager,
  BuildifierFormatProvider,
  checkBuildifierIsAvailable,
} from "../buildifier";
import { BazelBuildCodeLensProvider } from "../codelens";
import { BazelCompletionItemProvider } from "../completion-provider";
import {
  BazelGotoDefinitionProvider,
  targetToUri,
} from "../definition/bazel_goto_definition_provider";
import { BazelTargetSymbolProvider } from "../symbols";
import { BazelWorkspaceTreeProvider } from "../workspace-tree";
import { activateCommandVariables } from "./command_variables";
import { activateTesting } from "../test-explorer";
import { activateWrapperCommands } from "./bazel_wrapper_commands";
import { registerLogger, logInfo } from "./logger";

// Global reference to the workspace tree provider for testing
export let _workspaceTreeProvider: BazelWorkspaceTreeProvider;

/**
 * Called when the extension is activated; that is, when its first command is
 * executed.
 *
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
  // Setup logging
  const outputChannel = vscode.window.createOutputChannel("Bazel VSCode", {
    log: true,
  });
  context.subscriptions.push(outputChannel, registerLogger(outputChannel));
  logInfo("Extension activated successfully.");

  // Initialize the workspace tree provider
  _workspaceTreeProvider =
    BazelWorkspaceTreeProvider.fromExtensionContext(context);
  context.subscriptions.push(_workspaceTreeProvider);

  // Initialize other components
  const codeLensProvider = new BazelBuildCodeLensProvider(context);
  const buildifierDiagnostics = new BuildifierDiagnosticsManager();
  let completionItemProvider: BazelCompletionItemProvider | null = null;
  let lspClient: lc.LanguageClient | undefined;

  async function startLspFromCurrentConfig() {
    const currentConfig = vscode.workspace.getConfiguration("bazel");
    const lspCommand = !!currentConfig.get<string>("lsp.command");

    if (!lspCommand) {
      void vscode.window.showErrorMessage(
        "Bazel LSP command (bazel.lsp.command) is not configured.",
      );
      return;
    }

    if (lspClient) {
      try {
        await lspClient.stop();
      } catch {
        // Ignore errors while stopping a previous client instance.
      }
    }

    const newClient = createLsp(currentConfig);
    lspClient = newClient;
    context.subscriptions.push(newClient);

    try {
      await lspClient.start();
    } catch (error: any) {
      void vscode.window.showErrorMessage(
        `Failed to start Bazel language server. Error: ${error.message}`,
      );
    }
  }

  // Initialize other parts of the extension
  const config = vscode.workspace.getConfiguration("bazel");
  const lspEnabled = !!config.get<string>("lsp.command");

  // Set up LSP if enabled
  if (lspEnabled) {
    context.subscriptions.push(
      vscode.commands.registerCommand("bazel.lsp.restart", async () => {
        await startLspFromCurrentConfig();
      }),
    );
    await startLspFromCurrentConfig();
  } else {
    completionItemProvider = new BazelCompletionItemProvider();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    completionItemProvider.refresh();

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

  vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", lspEnabled);

  // Create and register the tree view
  const treeView = vscode.window.createTreeView("bazelWorkspace", {
    treeDataProvider: _workspaceTreeProvider,
    showCollapseAll: true,
  });
  _workspaceTreeProvider.setTreeView(treeView);

  context.subscriptions.push(
    treeView,
    // Commands
    ...activateWrapperCommands(),

    // Register command to manually refresh the tree view
    vscode.commands.registerCommand("bazel.workspaceTree.refresh", () => {
      _workspaceTreeProvider.refresh();
    }),
    vscode.commands.registerCommand("bazel.refreshBazelBuildTargets", () => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      completionItemProvider?.refresh();
      _workspaceTreeProvider.refresh();
    }),
    // URI handler
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        try {
          const workspace = vscode.workspace.workspaceFolders[0];
          const quotedUriPath = `"${uri.path}"`;
          const location = await targetToUri(quotedUriPath, workspace.uri);

          vscode.commands
            .executeCommand(
              "vscode.open",
              vscode.Uri.file(location.path).with({
                fragment: `${location.line}:${location.column}`,
              }),
            )
            .then(undefined, (err) => {
              void vscode.window.showErrorMessage(
                `Could not open file: ${location.path} Error: ${err}`,
              );
            });
        } catch (err: any) {
          void vscode.window.showErrorMessage(
            `While handling URI: ${JSON.stringify(uri)} Error: ${err}`,
          );
        }
      },
    }),
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
  const env = config.get<Record<string, string>>("lsp.env");

  const run: lc.Executable = {
    args,
    command,
    options: {
      env: { ...process.env, ...env },
    },
  };

  const serverOptions: lc.ServerOptions = {
    run,
    debug: run,
  };

  const clientOptions: lc.LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "starlark" }],
  };

  return new lc.LanguageClient(
    "bazel",
    "Bazel LSP Client",
    serverOptions,
    clientOptions,
  );
}
