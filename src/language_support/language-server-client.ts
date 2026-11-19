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

import * as path from "path";
import * as lc from "vscode-languageclient/node";
import * as vscode from "vscode";
import { logError } from "../extension/logger";
import { BazelWorkspaceInfo } from "../bazel/bazel_workspace_info";
import { createWasmLspClient } from "./wasm_language_server";
import {
  getLspServerArgs,
  getLspServerEnv,
  getLspServerExecutablePath,
  getWorkspacePath,
} from "../extension/configuration";

// Singleton output channel for LSP to prevent duplication
let lspOutputChannel: vscode.LogOutputChannel | undefined;

function getLspOutputChannel(): vscode.LogOutputChannel {
  if (!lspOutputChannel) {
    lspOutputChannel = vscode.window.createOutputChannel("Bazel LSP Client", {
      log: true,
    });
  }
  return lspOutputChannel;
}

/**
 * Starts (or restarts) the bundled WebAssembly server: one client per
 * workspace folder that is a Bazel workspace, each scoped to its folder.
 * Returns the clients that started; an empty list means none could.
 */
export async function startWasmLspClients(
  running: lc.LanguageClient[],
  context: vscode.ExtensionContext,
  wasmUri: vscode.Uri,
): Promise<lc.LanguageClient[]> {
  for (const client of running) {
    try {
      await client.stop();
    } catch {
      // Ignore errors while stopping a previous client instance.
    }
  }
  const started: lc.LanguageClient[] = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (!BazelWorkspaceInfo.fromWorkspaceFolder(folder)) {
      continue;
    }
    try {
      const client = await createWasmLspClient(
        context,
        wasmUri,
        getLspOutputChannel(),
        folder,
      );
      context.subscriptions.push(client);
      await client.start();
      started.push(client);
    } catch (error: any) {
      logError(
        `Failed to start the bundled Starlark language server for ${folder.name}`,
        true,
        error,
      );
    }
  }
  return started;
}

export async function startLspClientFromCurrentConfig(
  lspClient: lc.LanguageClient | undefined,
  context: vscode.ExtensionContext,
) {
  if (lspClient) {
    try {
      await lspClient.stop();
    } catch {
      // Ignore errors while stopping a previous client instance.
    }
  }

  try {
    const newClient = await _createLspClient();
    lspClient = newClient;
    context.subscriptions.push(newClient);
    await lspClient.start();
  } catch (error: any) {
    logError("Failed to start Bazel language server", true, error);
  }
}

/**
 * Resolves the Bazel workspace path to use for LSP initialization.
 *
 * Returns the absolute path when `bazel.workspace.path` is configured,
 * resolving relative paths against the first VS Code workspace folder.
 * Returns undefined when the setting is not configured (default behavior).
 */
export function getEffectiveLspWorkspacePath(): string | undefined {
  const configuredPath = getWorkspacePath();
  if (!configuredPath) {
    return undefined;
  }
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return path.join(folders[0].uri.fsPath, configuredPath);
  }
  return undefined;
}

async function _createLspClient(): Promise<lc.LanguageClient> {
  const lspServerExecutable = getLspServerExecutablePath();
  if (!lspServerExecutable) {
    throw new Error("LSP server executable not configured");
  }

  const args = getLspServerArgs();
  const env = getLspServerEnv();
  const workspacePath = getEffectiveLspWorkspacePath();

  const lspServer: lc.Executable = {
    args,
    command: lspServerExecutable,
    options: {
      cwd: workspacePath,
      env: { ...process.env, ...env },
    },
  };

  const serverOptions: lc.ServerOptions = {
    run: lspServer,
    debug: lspServer,
  };

  const clientOptions: lc.LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "starlark" }],
    workspaceFolder: workspacePath
      ? {
          uri: vscode.Uri.file(workspacePath),
          name: path.basename(workspacePath),
          index: 0,
        }
      : undefined,
    outputChannel: getLspOutputChannel(),
  };

  const client = new lc.LanguageClient(
    "bazel",
    "Bazel LSP Client",
    serverOptions,
    clientOptions,
  );

  return client;
}
