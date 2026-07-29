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

import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { ILogger } from "../extension/logger_interface";
import { ToolConfig, detectPlatform } from "./tool_config";
import {
  GitHubAsset,
  getGitHubRelease,
  findMatchingGithubAsset,
} from "./github_api";

/**
 * Cryptographic binary integrity verifier.
 *
 * @param asset GitHub asset with digest for verification
 * @param filePath Local path to the downloaded file
 * @param logger Logger instance for dependency injection.
 * @throws Security violation error with detailed context
 */
export async function _verifyBinaryIntegrity(
  asset: GitHubAsset,
  filePath: string,
  logger: ILogger,
): Promise<void> {
  const fileBuffer = await fs.readFile(filePath);
  const actualChecksum = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");
  const githubHash = asset.digest.replace("sha256:", "").toLowerCase();

  // Checksum verification for debugging
  logger.logDebug(
    `Checksum verification for ${asset.name}: expected=${githubHash}, actual=${actualChecksum}`,
  );

  if (actualChecksum !== githubHash) {
    // If verification fails, clean up the downloaded file
    try {
      await fs.unlink(filePath);
      logger.logDebug(`Cleaned up corrupted file: ${filePath}`);
    } catch {
      // Ignore cleanup errors
    }
    const errorMsg =
      `Security violation: ${asset.name} failed checksum verification.\n` +
      `Expected: ${githubHash}\n` +
      `Actual: ${actualChecksum}\n` +
      `The downloaded binary may be corrupted or tampered with. File removed.`;
    logger.logError(errorMsg);
    throw new Error(errorMsg);
  }

  logger.logDebug(`Successfully verified binary integrity for ${asset.name}`);
}

/**
 * Secure binary downloader with integrated integrity verification.
 *
 * Downloads GitHub release assets and immediately verifies their cryptographic
 * integrity. It also verifies the checksum provided by GitHub against the
 * expected checksum to detect if the checksum file was tampered with.
 * This function combines download and verification into a single atomic operation
 * to prevent unsafe downloads.
 *
 * @param asset GitHub asset to download with metadata
 * @param expectedChecksum Expected SHA256 checksum for verification
 * @param destination Local file path for the downloaded binary
 * @param logger Logger instance for dependency injection.
 * @throws Error with detailed context for any failure
 */
export async function downloadAndVerify(
  asset: GitHubAsset,
  expectedChecksum: string,
  destination: string,
  logger: ILogger,
): Promise<void> {
  logger.logInfo(
    `Starting download of ${asset.name} from ${asset.browser_download_url}`,
  );
  const githubChecksum = asset.digest.replace("sha256:", "");
  if (githubChecksum !== expectedChecksum) {
    throw new Error(
      `Checksum validation failed for ${asset.name}: expected ${expectedChecksum}, GitHub has ${githubChecksum}`,
    );
  }
  try {
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} for ${asset.browser_download_url}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(destination, Buffer.from(arrayBuffer));
    logger.logDebug(
      `Downloaded ${asset.name} to ${destination}, starting verification`,
    );
    await _verifyBinaryIntegrity(asset, destination, logger);
    logger.logInfo(`Successfully downloaded and verified ${asset.name}`);
  } catch (error) {
    // Clean up partial file on download error
    try {
      await fs.unlink(destination);
      logger.logDebug(`Cleaned up partial download: ${destination}`);
    } catch {
      // Ignore cleanup errors, might have been removed by _verifyBinaryIntegrity already.
    }
    logger.logError(
      `Failed to download ${asset.name}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/**
 * Downloads a tool from GitHub releases.
 * @param toolConfig The tool configuration to download.
 * @param logger Logger instance for dependency injection.
 */
export async function downloadExternalTool(
  toolConfig: ToolConfig,
  toolsDir: string,
  logger: ILogger,
): Promise<string> {
  logger.logDebug(
    `Starting download process for tool: ${toolConfig.repository}`,
  );

  const platform = detectPlatform(logger);
  const assetFilename = toolConfig.assets[platform];
  const expectedChecksum = toolConfig.checksums[platform];

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
    logger,
  );
  const asset = findMatchingGithubAsset(releaseInfo.assets, assetFilename);

  if (!asset) {
    throw new Error(
      `No matching asset found for ${toolConfig.executableName} on ${platform} (${assetFilename})`,
    );
  }

  const downloadPath = path.join(toolsDir, toolConfig.executableName);
  await downloadAndVerify(asset, expectedChecksum, downloadPath, logger);

  // Make executable on Unix systems
  if (process.platform !== "win32") {
    await fs.chmod(downloadPath, 0o755);
    logger.logDebug(`Made ${downloadPath} executable`);
  }

  logger.logDebug(
    `Successfully downloaded ${toolConfig.repository} to ${downloadPath}`,
  );
  return downloadPath;
}
