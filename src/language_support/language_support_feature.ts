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
  LanguageServerCommand,
  getLanguageServerCommand,
  startLspClient,
} from "./language-server-client";
import { getLspServerExecutablePath } from "../extension/configuration";
import { affectsRenamedSetting } from "../extension/settings_migration";
import { AUTO_TOOL_SETTING, ToolKey } from "../external-tools/tool_config";
import { LocatedTool } from "../external-tools/tool_locator";
import { describeToolState } from "../external-tools/tool_registry";
import { getToolRegistry } from "../external-tools/tool_registry_instance";

/**
 * Language Support feature for Bazel.
 * Handles both external LSP and built-in language support implementations.
 * Uses the language server (starpls by default, see `bazel.lsp.command`)
 * when it is available, and falls back to the built-in support otherwise.
 */
export class LanguageSupportFeature extends BaseExtensionFeature {
  private lspClient: lc.LanguageClient | undefined;
  private completionItemProvider: BazelCompletionItemProvider | null = null;
  /** Incremented on disable, to stop clients that finish starting later. */
  private clientGeneration = 0;

  constructor(context: vscode.ExtensionContext) {
    super("LanguageSupport", context);
  }

  /**
   * Switches between the language server and the built-in support when the
   * language server becomes (un)available. Both use Bazel: starpls is given
   * its path, and the built-in completion of target labels queries it, so it
   * is only refreshed while Bazel is available.
   */
  protected optionalTools(): ToolKey[] {
    return ["Starlark Language Server", "Bazelisk"];
  }

  protected async enable(context: vscode.ExtensionContext): Promise<boolean> {
    const bazelAvailable = await this.isBazelAvailable();
    // Determine which implementation to use
    const languageServer = await this.resolveLanguageServer();
    if (languageServer) {
      return this.enableExternalLSP(languageServer);
    } else {
      return this.enableBuiltInSupport(context, bazelAvailable);
    }
  }

  /**
   * Whether Bazel can be run. Does not offer a download: the features that
   * require Bazel do that.
   */
  private async isBazelAvailable(): Promise<boolean> {
    const registry = getToolRegistry();
    if (!registry) {
      return true;
    }
    return (await registry.resolve("Bazelisk")).kind === "resolved";
  }

  /**
   * Resolves the language server, or returns undefined to use the built-in
   * support instead.
   */
  private async resolveLanguageServer(): Promise<LocatedTool | undefined> {
    const registry = getToolRegistry();
    if (!registry) {
      // No tool registry (outside of the activated extension): only use an
      // explicitly configured language server.
      const command = getLspServerExecutablePath();
      return command && command !== AUTO_TOOL_SETTING
        ? { command, location: command, source: "setting" }
        : undefined;
    }
    const state = await registry.ensure("Starlark Language Server");
    if (state.kind !== "resolved") {
      this.logInfo(
        `No language server (${describeToolState(state)}), using built-in language support`,
      );
      return undefined;
    }
    return state.tool;
  }

  protected disable(): boolean {
    // Clean up both implementations to be safe
    this.clientGeneration++;
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
  private enableExternalLSP(languageServer: LocatedTool): boolean {
    this.logInfo(
      `Enabling external language server support: ${languageServer.location}`,
    );

    const restart = async () => {
      this.logInfo("Restarting language server...");
      await this.startClient(this.getServerCommand(languageServer));
    };
    const restartCommand = vscode.commands.registerCommand(
      "bazel.lsp.restart",
      restart,
    );
    // The arguments and environment are read when the server starts.
    const settingsListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        affectsRenamedSetting(e, "bazel.lsp.args") ||
        affectsRenamedSetting(e, "bazel.lsp.env")
      ) {
        void restart();
      }
    });
    this.disposables.push(restartCommand, settingsListener);

    // Start the LSP client
    void this.startClient(this.getServerCommand(languageServer)).then(() => {
      this.logInfo("External language server started");
    });

    // Set context key for use in package.json
    vscode.commands.executeCommand("setContext", "bazel.lsp.enabled", true);

    return true;
  }

  private getServerCommand(languageServer: LocatedTool): LanguageServerCommand {
    return getLanguageServerCommand(
      languageServer,
      getToolRegistry()?.getResolvedTool("Bazelisk"),
    );
  }

  private async startClient(server: LanguageServerCommand) {
    const generation = this.clientGeneration;
    const previous = this.lspClient;
    this.lspClient = undefined;
    const client = await startLspClient(previous, server);
    if (generation !== this.clientGeneration) {
      // Disabled while starting.
      await client?.stop().catch((): void => undefined);
      return;
    }
    this.lspClient = client;
  }

  /**
   * Enables built-in language support implementation
   *
   * @param bazelAvailable Whether the completion targets can be queried.
   * Otherwise they are not, and the feature restarts once Bazel is available.
   */
  private enableBuiltInSupport(
    context: vscode.ExtensionContext,
    bazelAvailable: boolean,
  ): boolean {
    this.logInfo("Enabling built-in language support");

    // Create completion provider
    this.completionItemProvider = new BazelCompletionItemProvider();
    if (bazelAvailable) {
      this.completionItemProvider.scheduleRefresh();
    }

    // Set up file watcher for BUILD files
    const buildWatcher = vscode.workspace.createFileSystemWatcher(
      "**/{BUILD,BUILD.bazel}",
      false, // ignoreCreateEvents
      false, // ignoreChangeEvents
      false, // ignoreDeleteEvents
    );

    // Fire refresh when BUILD files change, are created, or deleted
    const refreshOnEvent = (uri: vscode.Uri) => {
      if (bazelAvailable) {
        this.completionItemProvider?.scheduleRefresh(uri);
      }
    };
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
