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

class OutputChannelLogger {
  constructor(private readonly logChannel: LogOutputChannel) {}

  public log(...data: Arguments): void {
    this.logChannel.appendLine(util.format(...data));
  }

  public logError(...data: Arguments): void {
    this.logChannel.error(util.format(...data));
  }

  public logWarn(...data: Arguments): void {
    this.logChannel.warn(util.format(...data));
  }

  public logInfo(...data: Arguments): void {
    this.logChannel.info(util.format(...data));
  }

  public logVerbose(...data: Arguments): void {
    this.logChannel.debug(util.format(...data));
  }
}

let channel: OutputChannelLogger | undefined;

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
 * logError(new Error('Something went wrong'));
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

  channel = new OutputChannelLogger(outputChannel);
  channel.logInfo("Logger initialized.");

  const loggerDisposable: Disposable = {
    dispose: () => {
      channel = undefined;
    },
  };
  context.subscriptions.push(loggerDisposable);

  return loggerDisposable;
}

export function log(...args: Arguments): void {
  channel?.log(...args);
}

export function logError(...args: Arguments): void {
  channel?.logError(...args);
}

export function logWarn(...args: Arguments): void {
  channel?.logWarn(...args);
}

export function logInfo(...args: Arguments): void {
  channel?.logInfo(...args);
}

export function logVerbose(...args: Arguments): void {
  channel?.logVerbose(...args);
}
