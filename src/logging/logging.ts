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

/**
 * Allows logging to the custom output channel "VSCode-Bazel".
 */
let logOutputChannel: vscode.OutputChannel | undefined;

/**
 * Sets up the VSCode-Bazel logging output channel and the showExtensionLog
 * command.
 * @param context The extension context.
 */
export function setupLoggingOutputChannel(context: vscode.ExtensionContext) {
  // Setup the output channel for logging.
  logOutputChannel = vscode.window.createOutputChannel("VSCode-Bazel");
  context.subscriptions.push(logOutputChannel);
  context.subscriptions.push(
    vscode.commands.registerCommand("bazel.showExtensionLog", () =>
      logOutputChannel.show(),
    ),
  );
  const bazelConfig = vscode.workspace.getConfiguration("bazel");
  const showExtensionLog = bazelConfig.get<boolean>("showExtensionLog");
  if (showExtensionLog) {
    logOutputChannel.show();
  }
}

/**
 * Logs a string to the output channel.
 * @param message The string to be logged.
 */
export function bazelLog(message: string, newline: boolean = true) {
  if (newline) {
    logOutputChannel.appendLine(message);
  } else {
    logOutputChannel.append(message);
  }
}
