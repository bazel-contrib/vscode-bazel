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
import {
  startLspClientFromCurrentConfig,
  startWasmLspClients,
} from "./language-server-client";
import { bundledStarplsWasm } from "./wasm_language_server";
import {
  getLspServerExecutablePath,
  getLspWasmPath,
} from "../extension/configuration";

/**
 * Language Support feature for Bazel.
 * Handles both external LSP and built-in language support implementations.
 * Automatically chooses implementation based on LSP configuration.
 */
export class LanguageSupportFeature extends BaseExtensionFeature {
  private lspClient: lc.LanguageClient | undefined;
  /** The bundled server's clients, one per Bazel workspace folder. */
  private wasmClients: lc.LanguageClient[] = [];
  /** The last start of the bundled server; a restart waits for it. */
  private wasmStart: Promise<void> = Promise.resolve();
  /** Bumped by `disable`, so a start that finishes afterwards is dropped. */
  private enableGeneration = 0;
  /** Built-in providers registered because no bundled server started. */
  private fallbackProviders: vscode.Disposable[] = [];
  private completionItemProvider: BazelCompletionItemProvider | null = null;
  private isUsingExternalLSP: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    super("LanguageSupport", context);
  }

  protected async enable(context: vscode.ExtensionContext): Promise<boolean> {
    // Determine which implementation to use: an external server if one is
    // configured, else the bundled WebAssembly one, else the built-in
    // providers.
    const lspCommand = getLspServerExecutablePath();
    const wasm = lspCommand ? undefined : await this.starplsWasm(context);
    this.isUsingExternalLSP = !!lspCommand || !!wasm;

    if (lspCommand) {
      return this.enableExternalLSP(context);
    }
    if (wasm) {
      return this.enableWasmLSP(context, wasm);
    }
    return this.enableBuiltInSupport(context);
  }

  /**
   * The starpls wasm to run in-process: `bazel.lsp.wasm` if set, else the
   * one bundled with the extension, else none.
   */
  private async starplsWasm(
    context: vscode.ExtensionContext,
  ): Promise<vscode.Uri | undefined> {
    const configured = getLspWasmPath();
    if (configured) {
      return vscode.Uri.file(configured);
    }
    return bundledStarplsWasm(context);
  }

  /**
   * Enables the bundled WebAssembly language server. Starts are chained so
   * a restart never overlaps a start still in progress; if no client could
   * start (no output base, no Bazel workspace), the built-in providers
   * take over until a later start succeeds. A start that completes after
   * the feature was disabled stops what it started.
   */
  private enableWasmLSP(
    context: vscode.ExtensionContext,
    wasmUri: vscode.Uri,
  ): boolean {
    this.logInfo(
      `Enabling the bundled Starlark language server (${wasmUri.fsPath})`,
    );
    const start = (): Promise<void> => {
      const generation = this.enableGeneration;
      this.wasmStart = this.wasmStart.then(async () => {
        if (generation !== this.enableGeneration) {
          return;
        }
        const clients = await startWasmLspClients(
          this.wasmClients,
          context,
          wasmUri,
        );
        if (generation !== this.enableGeneration) {
          for (const client of clients) {
            client.stop().catch((): undefined => undefined);
          }
          return;
        }
        this.wasmClients = clients;
        if (clients.length > 0) {
          this.leaveFallback();
        } else {
          this.enterFallback(context);
        }
      });
      return this.wasmStart;
    };
    this.disposables.push(
      vscode.commands.registerCommand("bazel.lsp.restart", async () => {
        this.logInfo("Restarting language server...");
        await start();
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.logInfo("Workspace folders changed; restarting language server");
        void start();
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        // The server and its clients were set up for one Bazel executable
        // and output base; a change to either means a new server.
        if (
          event.affectsConfiguration("bazel.executable") ||
          event.affectsConfiguration("bazel.commandLine.startupOptions")
        ) {
          this.logInfo("Bazel settings changed; restarting language server");
          void start();
        }
      }),
    );
    start().catch((error: any) => {
      this.logError("Failed to start the bundled language server", true, error);
    });
    vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", true);
    return true;
  }

  /** Registers the built-in providers in place of the bundled server. */
  private enterFallback(context: vscode.ExtensionContext): void {
    if (this.fallbackProviders.length > 0) {
      return;
    }
    this.logError(
      "The bundled language server did not start; " +
        "using the built-in providers",
      true,
    );
    vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", false);
    this.isUsingExternalLSP = false;
    const before = this.disposables.length;
    this.enableBuiltInSupport(context);
    this.fallbackProviders = this.disposables.splice(before);
  }

  /** Removes the built-in providers again once the bundled server runs. */
  private leaveFallback(): void {
    for (const disposable of this.fallbackProviders) {
      disposable.dispose();
    }
    this.fallbackProviders = [];
    this.completionItemProvider = null;
    this.isUsingExternalLSP = true;
    vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", true);
  }

  protected disable(): boolean {
    this.enableGeneration++;
    for (const disposable of this.fallbackProviders) {
      disposable.dispose();
    }
    this.fallbackProviders = [];
    // Clean up both implementations to be safe
    if (this.lspClient) {
      this.lspClient.stop().catch((error) => {
        this.logError("Error stopping language server", true, error);
      });
      this.lspClient = undefined;
    }
    for (const client of this.wasmClients) {
      client.stop().catch((error) => {
        this.logError("Error stopping language server", true, error);
      });
    }
    this.wasmClients = [];

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
    this.completionItemProvider.scheduleRefresh();

    // Set up file watcher for BUILD files
    const buildWatcher = vscode.workspace.createFileSystemWatcher(
      "**/{BUILD,BUILD.bazel}",
      false, // ignoreCreateEvents
      false, // ignoreChangeEvents
      false, // ignoreDeleteEvents
    );

    // Fire refresh when BUILD files change, are created, or deleted
    const refreshOnEvent = (uri: vscode.Uri) =>
      this.completionItemProvider?.scheduleRefresh(uri);
    const onDidChangeDisposable = buildWatcher.onDidChange(refreshOnEvent);
    const onDidCreateDisposable = buildWatcher.onDidCreate(refreshOnEvent);
    const onDidDeleteDisposable = buildWatcher.onDidDelete(refreshOnEvent);

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
      this.completionItemProvider,
      buildWatcher,
      onDidChangeDisposable,
      onDidCreateDisposable,
      onDidDeleteDisposable,
      completionRegistration,
      symbolRegistration,
      definitionRegistration,
    );

    this.logInfo("Built-in language support enabled successfully");
    return true;
  }
}
