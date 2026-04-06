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
import { logDebug, logError } from "../extension/logger";
import { ToolConfig } from "./types";

/**
 * Attempts to load tool configuration from multiple possible paths to support
 * different execution contexts (development vs. production, extension vs. script).
 *
 * @returns Object containing loaded configuration and the successful path
 * @throws Error if no valid configuration file found in any location
 */
export function loadToolConfig(): {
  config: ToolConfig;
  path: string;
} {
  // List of paths to try in order
  const configPaths = [
    path.join(__dirname.replace("/dist", ""), "external-tools-config.json"), // src location for extension
  ];

  logDebug(`Attempting to load tool configuration from paths: ${configPaths.join(", ")}`);

  for (const configPath of configPaths) {
    try {
      logDebug(`Trying to load config from: ${configPath}`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const config = require(configPath);
      logDebug(`Successfully loaded tool configuration from: ${configPath}`);
      return { config, path: configPath };
    } catch (error) {
      logDebug(`Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
      // Continue to next path
      continue;
    }
  }

  const errorMsg = `Failed to load tool configuration from any of these paths: ${configPaths.join(", ")}`;
  logError(errorMsg, true);
  throw new Error(errorMsg);
}
