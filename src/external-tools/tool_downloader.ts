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
import * as vscode from "vscode";
import * as crypto from "crypto";
import { logInfo, logDebug, logError } from "../extension/logger";
import { ToolConfig, GitHubAsset } from "./types";
import { detectPlatform } from "./platform";
import { loadToolConfig } from "./config";
import { getGitHubRelease, findMatchingGithubAsset } from "./github";

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
 * Downloads and manages external tools for the extension.
 */
export class ToolDownloader {
  private readonly toolsDir: string;
  private readonly toolConfig: ToolConfig;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.toolsDir = path.join(
      context.globalStorageUri.fsPath,
      "external-tools",
    );
    logDebug(
      `Tool downloader initialized with tools directory: ${this.toolsDir}`,
    );
    const { config } = loadToolConfig();
    this.toolConfig = config;
  }

  /**
   * Downloads a tool from GitHub releases.
   * @param toolName The name of the tool to download.
   */
  async downloadExternalTools(toolName: string): Promise<string> {
    logDebug(`Starting download process for tool: ${toolName}`);

    const config = this.toolConfig[toolName];
    if (!config) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const platform = detectPlatform();
    const assetFilename = config.assets[platform];

    if (!assetFilename) {
      throw new Error(`Unsupported platform ${platform} for tool ${toolName}`);
    }

    // Ensure tools directory exists
    await fs.mkdir(this.toolsDir, { recursive: true });

    // Get release information from GitHub
    const releaseInfo = await getGitHubRelease(
      config.repository,
      config.version,
    );
    const asset = findMatchingGithubAsset(releaseInfo.assets, assetFilename);

    if (!asset) {
      throw new Error(
        `No matching asset found for ${toolName} on ${platform} (${assetFilename})`,
      );
    }

    const downloadPath = path.join(this.toolsDir, config.executableName);
    await downloadAndVerify(asset, downloadPath);

    // Make executable on Unix systems
    if (process.platform !== "win32") {
      await fs.chmod(downloadPath, 0o755);
      logDebug(`Made ${downloadPath} executable`);
    }

    logDebug(`Successfully downloaded ${toolName} to ${downloadPath}`);
    return downloadPath;
  }

  /**
   * Gets the path to a tool if it exists, returns null otherwise.
   * @param toolName The name of the tool.
   * @returns The absolute path to the tool or null if not found.
   */
  async getToolPath(toolName: string): Promise<string | null> {
    logDebug(`Checking if tool exists locally: ${toolName}`);

    const config = this.toolConfig[toolName];
    if (!config) {
      logDebug(`No configuration found for tool: ${toolName}`);
      return null;
    }

    const executablePath = path.join(this.toolsDir, config.executableName);
    try {
      await fs.access(executablePath, fs.constants.X_OK);
      logDebug(`Found existing executable at: ${executablePath}`);
      return executablePath;
    } catch {
      logDebug(`Tool not found or not executable: ${executablePath}`);
      return null;
    }
  }
}
