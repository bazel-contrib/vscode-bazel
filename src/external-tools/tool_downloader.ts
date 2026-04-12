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

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { logInfo, logDebug, logError } from "../extension/logger";
import { detectPlatform } from "./platform";
import { findToolConfig, ToolConfig, ToolsConfig } from "./config";
import {
  GitHubAsset,
  getGitHubRelease,
  findMatchingGithubAsset,
} from "./github";

/**
 * Cryptographic binary integrity verifier.
 *
 * @param asset GitHub asset with digest for verification
 * @param filePath Local path to the downloaded file
 * @throws Security violation error with detailed context
 */
export async function _verifyBinaryIntegrity(
  asset: GitHubAsset,
  filePath: string,
): Promise<void> {
  const fileBuffer = await fs.readFile(filePath);
  const actualChecksum = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");
  const githubHash = asset.digest.replace("sha256:", "").toLowerCase();

  logDebug(
    `Checksum verification for ${asset.name}: expected=${githubHash}, actual=${actualChecksum}`,
  );

  if (actualChecksum !== githubHash) {
    // If verification fails, clean up the downloaded file
    try {
      await fs.unlink(filePath);
      logDebug(`Cleaned up corrupted file: ${filePath}`);
    } catch {
      // Ignore cleanup errors
    }
    const errorMsg =
      `Security violation: ${asset.name} failed checksum verification.\n` +
      `Expected: ${githubHash}\n` +
      `Actual: ${actualChecksum}\n` +
      `The downloaded binary may be corrupted or tampered with. File removed.`;
    logError(errorMsg, true);
    throw new Error(errorMsg);
  }

  logDebug(`Successfully verified binary integrity for ${asset.name}`);
}

/**
 * Secure binary downloader with integrated integrity verification.
 *
 * Downloads GitHub release assets and immediately verifies their cryptographic
 * integrity. This function combines download and verification into a single
 * atomic operation to prevent unsafe downloads.
 *
 * @param asset GitHub asset to download with metadata
 * @param destination Local file path for the downloaded binary
 * @throws Error with detailed context for any failure
 */
export async function downloadAndVerify(
  asset: GitHubAsset,
  destination: string,
): Promise<void> {
  logInfo(
    `Starting download of ${asset.name} from ${asset.browser_download_url}`,
  );

  try {
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} for ${asset.browser_download_url}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(destination, Buffer.from(arrayBuffer));
    logDebug(
      `Downloaded ${asset.name} to ${destination}, starting verification`,
    );
    await _verifyBinaryIntegrity(asset, destination);
    logInfo(`Successfully downloaded and verified ${asset.name}`);
  } catch (error) {
    // Clean up partial file on download error
    try {
      await fs.unlink(destination);
      logDebug(`Cleaned up partial download: ${destination}`);
    } catch {
      // Ignore cleanup errors
    }
    logError(
      `Failed to download ${asset.name}: ${error instanceof Error ? error.message : String(error)}`,
      false,
      error,
    );
    throw error;
  }
}

/**
 * Downloads a tool from GitHub releases.
 * @param toolConfig The tool configuration to download.
 */
export async function downloadExternalTool(
  toolConfig: ToolConfig,
  toolsDir: string,
): Promise<string> {
  logDebug(`Starting download process for tool: ${toolConfig.repository}`);

  const platform = detectPlatform();
  const assetFilename = toolConfig.assets[platform];

  if (!assetFilename) {
    throw new Error(
      `Unsupported platform ${platform} for tool ${toolConfig.executableName}`,
    );
  }

  // Ensure tools directory exists
  await fs.mkdir(toolsDir, { recursive: true });

  // Get release information from GitHub
  const releaseInfo = await getGitHubRelease(
    toolConfig.repository,
    toolConfig.version,
  );
  const asset = findMatchingGithubAsset(releaseInfo.assets, assetFilename);

  if (!asset) {
    throw new Error(
      `No matching asset found for ${toolConfig.executableName} on ${platform} (${assetFilename})`,
    );
  }

  const downloadPath = path.join(toolsDir, toolConfig.executableName);
  await downloadAndVerify(asset, downloadPath);

  // Make executable on Unix systems
  if (process.platform !== "win32") {
    await fs.chmod(downloadPath, 0o755);
    logDebug(`Made ${downloadPath} executable`);
  }

  logDebug(
    `Successfully downloaded ${toolConfig.repository} to ${downloadPath}`,
  );
  return downloadPath;
}
