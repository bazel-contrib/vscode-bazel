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
import {
  getLspServerArgs,
  getLspServerEnv,
  getWorkspacePath,
} from "../extension/configuration";
import { LocatedTool } from "../external-tools/tool_locator";

/** How to start the language server. */
export interface LanguageServerCommand {
  command: string;
  args: string[];
}

/**
 * Returns how to start the given language server, with the arguments from
 * `bazel.lsp.args`. starpls, when located by the extension rather than
 * configured explicitly, needs its `server` subcommand.
 */
export function getLanguageServerCommand(
  tool: LocatedTool,
): LanguageServerCommand {
  const args = getLspServerArgs();
  if (tool.source !== "setting" && args[0] !== "server") {
    return { command: tool.command, args: ["server", ...args] };
  }
  return { command: tool.command, args };
}

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
 * Starts a language server client, stopping the previous one first.
 *
 * @returns The new client; it is returned even if starting it failed, so
 * that it can be stopped later.
 */
export async function startLspClient(
  previousClient: lc.LanguageClient | undefined,
  server: LanguageServerCommand,
): Promise<lc.LanguageClient | undefined> {
  if (previousClient) {
    try {
      await previousClient.stop();
    } catch {
      // Ignore errors while stopping a previous client instance.
    }
  }

  let newClient: lc.LanguageClient | undefined;
  try {
    newClient = _createLspClient(server);
    await newClient.start();
  } catch (error: any) {
    logError("Failed to start Bazel language server", true, error);
  }
  return newClient;
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

function _createLspClient(server: LanguageServerCommand): lc.LanguageClient {
  const { command, args } = server;
  const env = getLspServerEnv();
  const workspacePath = getEffectiveLspWorkspacePath();

  const lspServer: lc.Executable = {
    args,
    command,
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
