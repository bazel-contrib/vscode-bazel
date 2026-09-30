// Copyright 2026 The Bazel Authors. All rights reserved.
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

/**
 * Interface for logger implementations that provide feature-specific logging.
 * This allows dependency injection of logging capabilities while maintaining
 * feature-specific prefixes in log messages.
 */
export interface ILogger {
  logDebug(message: string, showMessage?: boolean, ...args: unknown[]): void;
  logInfo(message: string, showMessage?: boolean, ...args: unknown[]): void;
  logWarn(message: string, showMessage?: boolean, ...args: unknown[]): void;
  logError(message: string, showMessage?: boolean, ...args: unknown[]): void;
}
