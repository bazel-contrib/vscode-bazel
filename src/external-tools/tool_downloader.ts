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
import { createWriteStream } from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { ReadableStream } from "stream/web";
import { ILogger } from "../extension/logger_interface";
import { Platform, ToolConfig } from "./tool_config";

/**
 * Streams the given URL to a local file while computing its SHA256 checksum.
 *
 * @param url URL to download
 * @param destination Local file path to write the downloaded content to
 * @returns Hex-encoded SHA256 checksum of the downloaded content
 */
async function downloadToFile(
  url: string,
  destination: string,
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const hash = crypto.createHash("sha256");
  const hashingPassThrough = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    hashingPassThrough,
    createWriteStream(destination),
  );
  return hash.digest("hex");
}

/**
 * Secure binary downloader with integrated integrity verification.
 *
 * Downloads the given URL into a temporary file next to `destination`,
 * verifies its SHA256 checksum against the pinned one, makes it executable
 * and only then renames it to `destination`. The rename is atomic, so no
 * other process (e.g. a second VS Code window) can ever execute a partial or
 * unverified file.
 *
 * @param url URL of the binary to download
 * @param expectedChecksum Pinned SHA256 checksum the download must match
 * @param destination Local file path for the downloaded binary
 * @param logger Logger instance for dependency injection.
 * @throws Error with detailed context for any failure
 */
export async function downloadAndVerify(
  url: string,
  expectedChecksum: string,
  destination: string,
  logger: ILogger,
): Promise<void> {
  logger.logInfo(`Starting download of ${url}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const tempFile = `${destination}.${process.pid}.${crypto.randomUUID()}.download`;
  try {
    const actualChecksum = await downloadToFile(url, tempFile);
    logger.logDebug(
      `Checksum verification for ${url}: expected=${expectedChecksum}, actual=${actualChecksum}`,
    );
    if (actualChecksum !== expectedChecksum.toLowerCase()) {
      throw new Error(
        `Security violation: ${url} failed checksum verification.\n` +
          `Expected: ${expectedChecksum}\n` +
          `Actual: ${actualChecksum}\n` +
          `The downloaded binary may be corrupted or tampered with.`,
      );
    }
    if (process.platform !== "win32") {
      await fs.chmod(tempFile, 0o755);
    }
    await fs.rename(tempFile, destination);
    logger.logInfo(`Successfully downloaded and verified ${url}`);
  } catch (error) {
    // Clean up partial or corrupted file
    await fs.rm(tempFile, { force: true }).catch((): void => undefined);
    logger.logError(
      `Failed to download ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/**
 * Returns the URL a tool's release asset is downloaded from.
 *
 * The checksum is pinned in the tool configuration, so there is no need to
 * ask the GitHub API for the asset's metadata (which is rate limited and
 * often blocked in corporate networks).
 */
export function getToolDownloadUrl(
  toolConfig: ToolConfig,
  platform: Platform,
): string | undefined {
  const asset = toolConfig.assets[platform];
  if (!asset) {
    return undefined;
  }
  return `https://github.com/${toolConfig.repository}/releases/download/${toolConfig.version}/${asset}`;
}

/**
 * Returns the path a managed copy of the tool's pinned version lives at:
 * `<toolsDir>/<toolKey>/<version>/<asset>`. Each version gets its own
 * directory, so an update never overwrites a binary that may be running.
 * Keeping the asset's file name preserves the `.exe` suffix on Windows.
 */
export function getManagedToolPath(
  toolsDir: string,
  toolKey: string,
  toolConfig: ToolConfig,
  platform: Platform,
): string | undefined {
  const asset = toolConfig.assets[platform];
  if (!asset) {
    return undefined;
  }
  return path.join(toolsDir, toolKey, toolConfig.version, asset);
}

/**
 * Downloads a tool's pinned version from GitHub releases into its managed
 * location (see `getManagedToolPath`) and removes all other versions of the
 * tool afterwards.
 *
 * @param toolKey The tool's key in the tool configuration.
 * @param toolConfig The tool configuration to download.
 * @param toolsDir The root directory of all managed tools.
 * @param platform The platform to download the tool for.
 * @param logger Logger instance for dependency injection.
 * @returns The path of the downloaded executable.
 */
export async function downloadExternalTool(
  toolKey: string,
  toolConfig: ToolConfig,
  toolsDir: string,
  platform: Platform,
  logger: ILogger,
): Promise<string> {
  const url = getToolDownloadUrl(toolConfig, platform);
  const destination = getManagedToolPath(
    toolsDir,
    toolKey,
    toolConfig,
    platform,
  );
  const expectedChecksum = toolConfig.checksums[platform];
  if (!url || !destination || !expectedChecksum) {
    throw new Error(`Unsupported platform ${platform} for tool ${toolKey}`);
  }

  await downloadAndVerify(url, expectedChecksum, destination, logger);
  await removeOtherVersions(toolsDir, toolKey, toolConfig.version, logger);
  return destination;
}

/**
 * Removes all managed versions of a tool except `keepVersion`.
 */
async function removeOtherVersions(
  toolsDir: string,
  toolKey: string,
  keepVersion: string,
  logger: ILogger,
): Promise<void> {
  const toolDir = path.join(toolsDir, toolKey);
  const versions = await fs.readdir(toolDir).catch(() => [] as string[]);
  for (const version of versions) {
    if (version === keepVersion) {
      continue;
    }
    try {
      await fs.rm(path.join(toolDir, version), {
        recursive: true,
        force: true,
      });
      logger.logInfo(`Removed outdated ${toolKey} ${version}`);
    } catch (error) {
      // On Windows a running binary can't be deleted; retry next time.
      logger.logDebug(`Could not remove ${toolKey} ${version}: ${error}`);
    }
  }
}

/**
 * Finds the newest managed copy of a tool that is not the pinned version,
 * e.g. one downloaded by a previous extension release. It stays usable while
 * the pinned version is being downloaded.
 */
export async function findOutdatedManagedTool(
  toolsDir: string,
  toolKey: string,
  toolConfig: ToolConfig,
  platform: Platform,
): Promise<{ path: string; version: string } | undefined> {
  const asset = toolConfig.assets[platform];
  if (!asset) {
    return undefined;
  }
  const toolDir = path.join(toolsDir, toolKey);
  const versions = await fs.readdir(toolDir).catch(() => [] as string[]);
  const candidates = versions
    .filter((v) => v !== toolConfig.version)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const version of candidates) {
    // The asset name may differ between versions, so take any file.
    const files = await fs
      .readdir(path.join(toolDir, version))
      .catch(() => [] as string[]);
    const binary = files.find((f) => !f.endsWith(".download"));
    if (binary) {
      return { path: path.join(toolDir, version, binary), version };
    }
  }
  return undefined;
}
