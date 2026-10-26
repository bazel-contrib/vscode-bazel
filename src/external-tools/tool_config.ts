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

import { ILogger } from "../extension/logger_interface";
import toolsConfig from "./external-tools-config.json";

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
 * - assets: Platform-to-filename mapping for binary downloads (unsupported
 *   platforms are omitted)
 * - executableName: Platform-independent executable identifier
 * - checksums: Platform-to-SHA256 checksum mapping for integrity verification
 */
export interface ToolConfig {
  repository: string;
  version: string;
  configKey: string;
  assets: { [key in Platform]?: string };
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
 * Returns the external tool configuration.
 *
 * The configuration is imported statically, so esbuild inlines it into the
 * extension bundle and tsc copies it next to the compiled sources.
 */
export function loadToolsConfig(): ToolsConfig {
  return toolsConfig as ToolsConfig;
}

/**
 * Detects the current platform and architecture.
 * @param logger Logger instance for dependency injection.
 * @returns The detected platform string value.
 * @throws Error if the platform is not supported.
 */
export function detectPlatform(logger: ILogger): Platform {
  const platform = process.platform;
  let arch: string = process.arch;

  // Normalize architecture: treat 'x64' as 'amd64'
  if (arch === "x64") {
    arch = "amd64";
  }

  const detectedPlatform = `${platform}-${arch}` as Platform;
  logger.logDebug(
    `Detected platform: ${detectedPlatform} (original arch: ${process.arch})`,
  );

  // Runtime validation using regex based on Platform type
  const platformPattern = /^(win32|linux|darwin)-(amd64|arm64)$/;

  if (!platformPattern.test(detectedPlatform)) {
    const errorMsg = `Unsupported platform: ${detectedPlatform}`;
    logger.logError(errorMsg);
    throw new Error(errorMsg);
  }

  logger.logDebug(`Detected platform: ${detectedPlatform}`);
  return detectedPlatform as Platform;
}
