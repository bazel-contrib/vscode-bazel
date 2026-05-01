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

import * as path from "path";
import { logDebug, logError } from "../extension/logger";

/**
 * Tool configuration schema.
 *
 * Defines the structure for external tool configurations including repository
 * information, version specifications, platform-specific assets, and checksums.
 *
 * Schema Details:
 * - repository: GitHub repository in "owner/repo" format
 * - version: Semantic version tag (e.g., "v8.5.1")
 * - configKey: VSCode configuration key for updating the setting
 * - assets: Platform-to-filename mapping for binary downloads
 * - executableName: Platform-independent executable identifier
 * - checksums: Platform-to-SHA256 checksum mapping for integrity verification
 */
export interface ToolConfig {
  repository: string;
  version: string;
  configKey: string;
  assets: { [key in Platform]: string };
  executableName: string;
  checksums: {
    [platform: string]: string;
  };
}

export interface ToolsConfig {
  [toolKey: string]: ToolConfig;
}

/**
 * Platform detection utilities for tool downloads.
 */
export type Platform =
  | "win32-amd64"
  | "win32-arm64"
  | "linux-amd64"
  | "linux-arm64"
  | "darwin-amd64"
  | "darwin-arm64";

/**
 * Attempts to load tool configuration from multiple possible paths to support
 * different execution contexts (development vs. production, extension vs. script).
 *
 * @returns Object containing loaded configuration and the successful path
 * @throws Error if no valid configuration file found in any location
 */
export function loadToolsConfig(): {
  config: ToolsConfig;
  path: string;
} {
  // Try relative require paths like the test pattern
  const requirePaths = [
    "./external-tools-config.json", // same directory
    "../external-tools-config.json", // parent directory (test pattern)
    "../../external-tools-config.json", // two levels up
  ];

  logDebug(
    `Attempting to load tool configuration from require paths: ${requirePaths.join(", ")}`,
  );

  for (const requirePath of requirePaths) {
    try {
      logDebug(`Trying to load config from: ${requirePath}`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const config = require(requirePath);
      const resolvedPath = path.resolve(__dirname, requirePath);
      logDebug(`Successfully loaded tool configuration from: ${resolvedPath}`);
      return { config, path: resolvedPath };
    } catch (error) {
      logDebug(
        `Failed to load config from ${requirePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Continue to next path
      continue;
    }
  }

  const errorMsg = `Failed to load tool configuration from any of these require paths: ${requirePaths.join(", ")}`;
  logError(errorMsg, true);
  throw new Error(errorMsg);
}

/**
 * Finds tool configuration by name or executable name.
 * @param toolNameOrKey The tool name or executable name to search for.
 * @returns Object containing the config and the config key, or null if not found.
 */
export function findToolConfig(
  toolNameOrKey: string,
  toolsConfig: ToolsConfig,
): { config: any; configKey: string } {
  for (const [key, value] of Object.entries(toolsConfig)) {
    if (value.executableName === toolNameOrKey || key === toolNameOrKey) {
      return { config: value, configKey: key };
    }
  }
  throw new Error(`Unknown tool: ${toolNameOrKey}`);
}

/**
 * Detects the current platform and architecture.
 * @returns The detected platform string value.
 * @throws Error if the platform is not supported.
 */
export function detectPlatform(): Platform {
  const platform = process.platform;
  const arch = process.arch;
  const detectedPlatform = `${platform}-${arch}`;
  logDebug(`Detected platform: ${detectedPlatform}`);

  // Runtime validation using regex based on Platform type
  const platformPattern = /^(win32|linux|darwin)-(amd64|arm64)$/;

  if (!platformPattern.test(detectedPlatform)) {
    const errorMsg = `Unsupported platform: ${detectedPlatform}`;
    logDebug(errorMsg);
    throw new Error(errorMsg);
  }

  logDebug(`Detected platform: ${detectedPlatform}`);
  return detectedPlatform as Platform;
}
