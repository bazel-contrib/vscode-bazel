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

import * as lc from "vscode-languageclient/node";
import * as vscode from "vscode";
import { logError } from "../extension/logger";
import {
  getLspServerArgs,
  getLspServerEnv,
  getLspServerExecutablePath,
} from "../extension/configuration";

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

async function _createLspClient(): Promise<lc.LanguageClient> {
  const lspServerExecutable = getLspServerExecutablePath();
  if (!lspServerExecutable) {
    throw new Error("LSP server executable not configured");
  }

  const args = getLspServerArgs();
  const env = getLspServerEnv();

  const lspServer: lc.Executable = {
    args,
    command: lspServerExecutable,
    options: {
      env: { ...process.env, ...env },
    },
  };

  const serverOptions: lc.ServerOptions = {
    run: lspServer,
    debug: lspServer,
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
