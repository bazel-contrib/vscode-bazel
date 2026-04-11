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
import { registerLogger, logInfo, logError, showOutputChannel } from "./logger";
import { startLspClientFromCurrentConfig } from "../lsp/language-server-client";
import { ExternalToolsManager } from "../external-tools/tool_manager";

// Global reference to the workspace tree provider for testing
declare global {
  var bazelWorkspaceTreeProvider: BazelWorkspaceTreeProvider | undefined;
  var externalToolsManager: ExternalToolsManager | undefined;
}

// Clean way to access the provider for testing
export function getWorkspaceTreeProviderForTesting():
  | BazelWorkspaceTreeProvider
  | undefined {
  return globalThis.bazelWorkspaceTreeProvider;
}

// Also set a global variable that can be accessed from tests
export function storeWorkspaceTreeProviderForTesting(
  provider: BazelWorkspaceTreeProvider,
) {
  globalThis.bazelWorkspaceTreeProvider = provider;
}

/**
 * Called when the extension is activated; that is, when its first command is
 * executed.
 *
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
  // Setup logging
  const logger = registerLogger(context);
  logInfo("Extension activated successfully.");
  context.subscriptions.push(
    vscode.commands.registerCommand("bazel.showOutputChannel", () => {
      showOutputChannel();
    }),
  );

  // Initialize the workspace tree provider
  const _workspaceTreeProvider =
    BazelWorkspaceTreeProvider.fromExtensionContext(context);

  // Set the global reference for testing
  storeWorkspaceTreeProviderForTesting(_workspaceTreeProvider);

  context.subscriptions.push(_workspaceTreeProvider);

  // Initialize other components
  const codeLensProvider = new BazelBuildCodeLensProvider(context);
  const buildifierDiagnostics = new BuildifierDiagnosticsManager();
  let completionItemProvider: BazelCompletionItemProvider | null = null;
  let lspClient: lc.LanguageClient | undefined;

  // Set up LSP if enabled
  const config = vscode.workspace.getConfiguration("bazel");

  // Check availability of external tools (don't wait for it as it involves user prompts)
  const toolsManager = new ExternalToolsManager(context);
  void toolsManager.checkAvailabilityOfExternalTools();

  // Set up LSP if enabled
  const lspEnabled = !!config.get<string>("lsp.command");
  if (lspEnabled) {
    context.subscriptions.push(
      vscode.commands.registerCommand("bazel.lsp.restart", async () => {
        await startLspClientFromCurrentConfig(lspClient, context);
      }),
    );
    await startLspClientFromCurrentConfig(lspClient, context);
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
              logError("Could not open file", true, location.path, err);
            });
        } catch (err: any) {
          logError("While handling URI", true, JSON.stringify(uri), err);
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
}

/** Called when the extension is deactivated. */
export function deactivate() {
  // Nothing to do here.
  logInfo("Extension deactivated.");
}
