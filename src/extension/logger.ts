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

// Logging module inspired heavily by the vscode-black-formatter extension.
// https://github.com/microsoft/vscode-black-formatter/blob/main/src/common/logging.ts
import * as util from "util";
import { Disposable, LogOutputChannel } from "vscode";

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
 * Registers the logger with the given LogOutputChannel.
 * Returns a Disposable that can be used to clean up the logger.
 *
 * @param logChannel The LogOutputChannel to use for logging.
 * @returns A Disposable for cleanup.
 */
export function registerLogger(logChannel: LogOutputChannel): Disposable {
  channel = new OutputChannelLogger(logChannel);
  return {
    dispose: () => {
      channel = undefined;
    },
  };
}

/**
 * Logs a message (appends to output channel).
 */
export function log(...args: Arguments): void {
  channel?.log(...args);
}

/**
 * Logs an error message.
 */
export function logError(...args: Arguments): void {
  channel?.logError(...args);
}

/**
 * Logs a warning message.
 */
export function logWarn(...args: Arguments): void {
  channel?.logWarn(...args);
}

/**
 * Logs an info message.
 */
export function logInfo(...args: Arguments): void {
  channel?.logInfo(...args);
}

/**
 * Logs a verbose/debug message.
 */
export function logVerbose(...args: Arguments): void {
  channel?.logVerbose(...args);
}
