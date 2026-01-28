// Copyright 2018 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Logging module inspired heavily by the vscode-black-formatter extension
// https://github.com/microsoft/vscode-black-formatter/blob/main/src/common/logging.ts
import * as util from "util";
import * as vscode from "vscode";
import { Disposable, ExtensionContext, LogOutputChannel } from "vscode";

type Arguments = unknown[];

const DETAILS_ACTION = "Details";
let channel: LogOutputChannel | undefined;
let outputChannelName: string | undefined;

/**
 * Registers the logger by creating an output channel and registering it with
 * the extension context. Returns a Disposable that can be used to clean up
 * the logger.
 *
 * Setup (usually in the extension `activate()`):
 * import { logInfo, logError } from './logging';
 * registerLogger('<Output Channel Name>', context);
 *
 * Usage (anywhere in the extension):
 * import { logInfo, logError } from './logging';
 * logInfo('Hello, world!');
 * logError('Operation failed', true, 'Error details:', error);
 *
 * @param name The name of the output channel.
 * @param context The ExtensionContext to register the logger with.
 * @returns A Disposable for cleanup.
 */
export function registerLogger(
  name: string,
  context: ExtensionContext,
): Disposable {
  const outputChannel: LogOutputChannel = vscode.window.createOutputChannel(
    name,
    {
      log: true,
    },
  );
  context.subscriptions.push(outputChannel);

  outputChannelName = name;
  channel = outputChannel;
  channel.info("Logger initialized.");

  const loggerDisposable: Disposable = {
    dispose: () => {
      channel = undefined;
      outputChannelName = undefined;
    },
  };
  context.subscriptions.push(loggerDisposable);

  return loggerDisposable;
}

/**
 * Logs a message to the output channel.
 *
 * @param message A short summary message that will be logged first.
 * @param showMessage Whether to show the message to the user in a message window (default: false).
 * @param args Additional information to include in the detailed log output (will be passed to util.format).
 */
export function log(
  message: string,
  showMessage: boolean = false,
  ...args: Arguments
): void {
  if (!channel) {
    return;
  }
  // Log the short summary message first
  channel.appendLine(message);
  // Show user message if requested
  if (showMessage) {
    void showUserMessage(message, vscode.LogLevel.Info);
  }
  // Log detailed output if provided
  if (args.length > 0) {
    channel.appendLine(util.format(...args));
  }
}

/**
 * Logs an error message to the output channel.
 *
 * @param message A short summary message that will be logged first.
 * @param showMessage Whether to show the message to the user in a message window (default: false).
 * @param args Additional information to include in the detailed log output (will be passed to util.format).
 */
export function logError(
  message: string,
  showMessage: boolean = false,
  ...args: Arguments
): void {
  if (!channel) {
    return;
  }
  // Log the short summary message first
  channel.error(message);
  // Show user message if requested
  if (showMessage) {
    void showUserMessage(message, vscode.LogLevel.Error);
  }
  // Log detailed output if provided
  if (args.length > 0) {
    channel.error(util.format(...args));
  }
}

/**
 * Logs a warning message to the output channel.
 *
 * @param message A short summary message that will be logged first.
 * @param showMessage Whether to show the message to the user in a message window (default: false).
 * @param args Additional information to include in the detailed log output (will be passed to util.format).
 */
export function logWarn(
  message: string,
  showMessage: boolean = false,
  ...args: Arguments
): void {
  if (!channel) {
    return;
  }
  // Log the short summary message first
  channel.warn(message);
  // Show user message if requested
  if (showMessage) {
    void showUserMessage(message, vscode.LogLevel.Warning);
  }
  // Log detailed output if provided
  if (args.length > 0) {
    channel.warn(util.format(...args));
  }
}

/**
 * Logs an info message to the output channel.
 *
 * @param message A short summary message that will be logged first.
 * @param showMessage Whether to show the message to the user in a message window (default: false).
 * @param args Additional information to include in the detailed log output (will be passed to util.format).
 */
export function logInfo(
  message: string,
  showMessage: boolean = false,
  ...args: Arguments
): void {
  if (!channel) {
    return;
  }
  // Log the short summary message first
  channel.info(message);
  // Show user message if requested
  if (showMessage) {
    void showUserMessage(message, vscode.LogLevel.Info);
  }
  // Log detailed output if provided
  if (args.length > 0) {
    channel.info(util.format(...args));
  }
}

/**
 * Logs a debug message to the output channel.
 *
 * @param message A short summary message that will be logged first.
 * @param showMessage Whether to show the message to the user in a message window (default: false).
 * @param args Additional information to include in the detailed log output (will be passed to util.format).
 */
export function logDebug(
  message: string,
  showMessage: boolean = false,
  ...args: Arguments
): void {
  if (!channel) {
    return;
  }
  // Log the short summary message first
  channel.debug(message);
  // Show user message if requested
  if (showMessage) {
    void showUserMessage(message, vscode.LogLevel.Debug);
  }
  // Log detailed output if provided
  if (args.length > 0) {
    channel.debug(util.format(...args));
  }
}

/**
 * Shows the output channel in the VS Code Output panel.
 * This is useful for displaying error messages with a link to open the output.
 */
export function showOutputChannel(): void {
  if (channel) {
    channel.show(true);
  } else if (outputChannelName) {
    // Fallback: if channel is not initialized but we know the name,
    // create a temporary reference to show it
    const tempChannel = vscode.window.createOutputChannel(outputChannelName, {
      log: true,
    });
    tempChannel.show(true);
  }
}

/**
 * Map of log levels to their corresponding VS Code window message functions.
 */
const LOG_LEVEL_TO_MESSAGE_FUNC: Map<
  vscode.LogLevel,
  (message: string, ...items: string[]) => Thenable<string | undefined>
> = new Map([
  [vscode.LogLevel.Error, vscode.window.showErrorMessage],
  [vscode.LogLevel.Warning, vscode.window.showWarningMessage],
  [vscode.LogLevel.Info, vscode.window.showInformationMessage],
]);

/**
 * Shows an user message with an "Details" button that opens the output channel.
 * Returns a promise that resolves to the action selected by the user, or undefined if dismissed.
 *
 * @param message The user message to display.
 * @param level The level of the message.
 * @returns A promise that resolves to the selected action or undefined.
 */
function showUserMessage(
  message: string,
  level: vscode.LogLevel,
): Thenable<string | undefined> {
  // Use the map to get the message function for the log level
  const messageFunc = LOG_LEVEL_TO_MESSAGE_FUNC.get(level);
  if (!messageFunc) {
    return Promise.resolve(undefined);
  }

  return messageFunc(message, DETAILS_ACTION).then((action) => {
    if (action === DETAILS_ACTION) {
      showOutputChannel();
    }
    return action;
  });
}
