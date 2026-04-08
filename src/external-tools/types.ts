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
 * GitHub release asset metadata.
 *
 * Represents a downloadable asset from a GitHub release with integrity
 * verification capabilities via the GitHub-provided SHA256 digest.
 *
 * Important Notes:
 * - digest: GitHub-provided SHA256 hash (prefixed with "sha256:")
 * - browser_download_url: Direct download URL for the asset
 * - name: Original filename as shown in the GitHub release
 *
 * Security:
 * The digest field is cryptographically signed by GitHub and provides
 * assurance that the asset has not been tampered with since release.
 */
export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  digest: string;
}

/**
 * GitHub release information.
 *
 * Contains metadata about a GitHub release including all associated assets.
 * Used for tool version management and binary distribution.
 */
export interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

/**
 * Platform detection utilities for tool downloads.
 */
export enum Platform {
  WINDOWS_X64 = "windows-amd64",
  WINDOWS_ARM64 = "windows-arm64",
  LINUX_X64 = "linux-amd64",
  LINUX_ARM64 = "linux-arm64",
  DARWIN_X64 = "darwin-amd64",
  DARWIN_ARM64 = "darwin-arm64",
}
