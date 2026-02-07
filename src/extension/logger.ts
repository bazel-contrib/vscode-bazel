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

const OUTPUT_CHANNEL_NAME = "Bazel";
const DETAILS_ACTION = "Details";
let channel: LogOutputChannel | undefined;

/**
 * Registers the logger by creating an output channel and registering it with
 * the extension context. Returns a Disposable that can be used to clean up
 * the logger.
 *
 * Setup (usually in the extension `activate()`):
 * import { logInfo, logError } from './logging';
 * registerLogger(context);
 *
 * Usage (anywhere in the extension):
 * import { logInfo, logError } from './logging';
 * logInfo('Hello, world!');
 * logError('Operation failed', true, 'Error details:', error);
 *
 * @param context The ExtensionContext to register the logger with.
 * @returns The logger output channel.
 */
export function registerLogger(context: ExtensionContext): Disposable {
  const outputChannel: LogOutputChannel = vscode.window.createOutputChannel(
    OUTPUT_CHANNEL_NAME,
    {
      log: true,
    },
  );
  context.subscriptions.push(outputChannel);

  channel = outputChannel;
  channel.info("Logger initialized.");

  const loggerDisposable: Disposable = {
    dispose: () => {
      channel = undefined;
    },
  };
  context.subscriptions.push(loggerDisposable);

  return loggerDisposable;
}

/**
 * Internal helper function to log messages with a specific log level.
 *
 * @param logMethod The channel method to use for logging (e.g., channel.error, channel.warn).
 * @param level The VS Code log level for user messages.
 * @param message A short summary message that will be logged first.
 * @param showMessage Whether to show the message to the user in a message window (default: false).
 * @param args Additional information to include in the detailed log output (will be passed to util.format).
 */
function logWithLevel(
  logMethod: (message: string) => void,
  level: vscode.LogLevel,
  message: string,
  showMessage: boolean = false,
  ...args: Arguments
): void {
  if (!channel) {
    return;
  }

  // Log the detailed message to the output channel
  let detailedMessage = message;
  if (args.length > 0) {
    detailedMessage += " Details:\n" + util.format(...args);
  }
  logMethod(detailedMessage);

  // Show user message if requested
  if (showMessage) {
    void showUserMessage(message, level);
  }
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
  logWithLevel(
    (msg) => channel!.appendLine(msg),
    vscode.LogLevel.Info,
    message,
    showMessage,
    ...args,
  );
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
  logWithLevel(
    (msg) => channel!.error(msg),
    vscode.LogLevel.Error,
    message,
    showMessage,
    ...args,
  );
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
  logWithLevel(
    (msg) => channel!.warn(msg),
    vscode.LogLevel.Warning,
    message,
    showMessage,
    ...args,
  );
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
  logWithLevel(
    (msg) => channel!.info(msg),
    vscode.LogLevel.Info,
    message,
    showMessage,
    ...args,
  );
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
  logWithLevel(
    (msg) => channel!.debug(msg),
    vscode.LogLevel.Debug,
    message,
    showMessage,
    ...args,
  );
}

/**
 * Shows the output channel in the VS Code Output panel.
 * This is useful for displaying error messages with a link to open the output.
 */
export function showOutputChannel(): void {
  channel!.show(true);
}

/**
 * Gets the VS Code window message function for a given log level.
 * This is done dynamically to support testing with mocked functions.
 *
 * @param level The log level.
 * @returns The corresponding message function, or undefined if not supported.
 */
function getMessageFunctionForLevel(
  level: vscode.LogLevel,
):
  | ((message: string, ...items: string[]) => Thenable<string | undefined>)
  | undefined {
  switch (level) {
    case vscode.LogLevel.Error:
      return vscode.window.showErrorMessage;
    case vscode.LogLevel.Warning:
      return vscode.window.showWarningMessage;
    case vscode.LogLevel.Info:
      return vscode.window.showInformationMessage;
    default:
      return undefined;
  }
}

/**
 * Shows an user message with an "Details" button that opens the output channel.
 * Returns a promise that resolves to the action selected by the user, or undefined if dismissed.
 *
 * @param message The user message to display.
 * @param level The level of the message.
 * @param showDetailsButton Whether to show the "Details" button.
 * @returns A promise that resolves to the selected action or undefined.
 */
export function showUserMessage(
  message: string,
  level: vscode.LogLevel,
  showDetailsButton: boolean = true,
): Thenable<string | undefined> {
  // Get the message function dynamically for the log level
  const messageFunc = getMessageFunctionForLevel(level);
  if (!messageFunc) {
    return Promise.resolve(undefined);
  }

  // Add the Details button if requested
  const buttons = showDetailsButton ? [DETAILS_ACTION] : [];

  // Show the message with optional buttons
  return messageFunc(message, ...buttons).then((action) => {
    if (action === DETAILS_ACTION) {
      showOutputChannel();
    }
    return action;
  });
}

/**
 * Simple function to show an info message with no details button.
 *
 * We only provide this function at the info level because warnings and errors
 * should generally provide details in the logs.
 *
 * @param message
 * @returns
 */
export function showInfoMessage(message: string): Thenable<string | undefined> {
  return showUserMessage(message, vscode.LogLevel.Info, false);
}
