// Copyright 2025 The Bazel Authors. All rights reserved.
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

import { BaseExtensionFeature } from "../extension/extension_feature";
import { BazelCompletionItemProvider } from "../completion-provider";
import { BazelGotoDefinitionProvider } from "../definition/bazel_goto_definition_provider";
import { BazelTargetSymbolProvider } from "../symbols";
import { startLspClientFromCurrentConfig } from "./language-server-client";
import { getLspServerExecutablePath } from "../extension/configuration";

/**
 * Language Support feature for Bazel.
 * Handles both external LSP and built-in language support implementations.
 * Automatically chooses implementation based on LSP configuration.
 */
export class LanguageSupportFeature extends BaseExtensionFeature {
  private lspClient: lc.LanguageClient | undefined;
  private completionItemProvider: BazelCompletionItemProvider | null = null;
  private isUsingExternalLSP: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    super("LanguageSupport", context);
  }

  enable(context: vscode.ExtensionContext): boolean {
    // Determine which implementation to use
    const lspCommand = getLspServerExecutablePath();
    this.isUsingExternalLSP = !!lspCommand;

    if (this.isUsingExternalLSP) {
      return this.enableExternalLSP(context);
    } else {
      return this.enableBuiltInSupport(context);
    }
  }

  protected disable(): boolean {
    // Clean up both implementations to be safe
    if (this.lspClient) {
      this.lspClient.stop().catch((error) => {
        this.logError("Error stopping language server", true, error);
      });
      this.lspClient = undefined;
    }

    this.completionItemProvider = null;

    // Clear context key for use in package.json
    vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", false);

    return super.disable();
  }

  /**
   * Enables external LSP implementation
   */
  private enableExternalLSP(context: vscode.ExtensionContext): boolean {
    this.logInfo("Enabling external language server support");

    // Register restart command
    const restartCommand = vscode.commands.registerCommand(
      "bazel.lsp.restart",
      async () => {
        this.logInfo("Restarting language server...");
        await startLspClientFromCurrentConfig(this.lspClient, context);
      },
    );
    this.disposables.push(restartCommand);

    // Start the LSP client
    startLspClientFromCurrentConfig(this.lspClient, context)
      .then(() => {
        this.logInfo("External language server started successfully");
      })
      .catch((error: any) => {
        this.logError("Failed to start external language server", true, error);
        return false;
      });

    // Set context key for use in package.json
    vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", true);

    return true;
  }

  /**
   * Enables built-in language support implementation
   */
  private enableBuiltInSupport(context: vscode.ExtensionContext): boolean {
    this.logInfo("Enabling built-in language support");

    // Create completion provider
    this.completionItemProvider = new BazelCompletionItemProvider();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.completionItemProvider.refresh();

    // Set up file watcher for BUILD files
    const buildWatcher = vscode.workspace.createFileSystemWatcher(
      "**/{BUILD,BUILD.bazel}",
      false, // ignoreCreateEvents
      false, // ignoreChangeEvents
      false, // ignoreDeleteEvents
    );

    // Fire refresh when BUILD files change
    const buildWatcherDisposable = buildWatcher.onDidChange(() =>
      this.completionItemProvider?.refresh(),
    );

    // Register language providers
    const completionRegistration =
      vscode.languages.registerCompletionItemProvider(
        [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
        this.completionItemProvider,
        "/",
        ":",
      );

    const symbolRegistration = vscode.languages.registerDocumentSymbolProvider(
      [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
      new BazelTargetSymbolProvider(),
    );

    const definitionRegistration = vscode.languages.registerDefinitionProvider(
      [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
      new BazelGotoDefinitionProvider(),
    );

    // Add all disposables
    this.disposables.push(
      buildWatcher,
      buildWatcherDisposable,
      completionRegistration,
      symbolRegistration,
      definitionRegistration,
    );

    this.logInfo("Built-in language support enabled successfully");
    return true;
  }
}
