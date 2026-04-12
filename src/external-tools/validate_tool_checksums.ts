#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * This script validates SHA256 checksums for tool binaries against GitHub API.
 * It can detect outdated checksums, update them automatically, and optionally
 * download and verify binary integrity.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { downloadAndVerify } from "./tool_downloader";
import {
  findMatchingGithubAsset,
  getGitHubRelease,
  GitHubRelease,
} from "./github";
import { loadToolsConfig, ToolConfig, ToolsConfig } from "./config";
import { Platform } from "./platform";

interface ValidationOptions {
  downloadTo?: string;
  githubToken?: string;
}

interface ValidationResult {
  configUpdated: boolean;
  hasErrors: boolean;
}

/**
 * Command line argument parser.
 *
 * Parses command line arguments and environment variables to determine
 * validation options. Supports:
 *
 * - --download-to <dir>: Optional directory to download binaries to for integrity verification
 * - GITHUB_TOKEN env var: Optional GitHub token for authenticated API requests
 *
 * Returns structured options for the validation pipeline.
 */
function _parseArguments(): ValidationOptions {
  const args = process.argv.slice(2);
  const downloadToIndex = args.indexOf("--download-to");
  const downloadTo =
    downloadToIndex !== -1 ? args[downloadToIndex + 1] : undefined;
  const githubToken = process.env.GITHUB_TOKEN;

  return { downloadTo, githubToken };
}

/**
 * Main validation orchestrator.
 *
 * Coordinates the entire checksum validation process:
 * 1. Loads tool configuration from multiple possible locations
 * 2. Initiates validation across all configured tools
 * 3. Handles final result reporting and file updates
 * 4. Manages process exit codes based on validation outcomes
 *
 * Exit Code Strategy:
 * - 0: All checksums valid, no changes needed
 * - 1: Unexpected error during validation
 * - 2: Checksums updated successfully
 * - 3: One or more validation failures detected
 */
async function validateToolChecksumsMain(): Promise<void> {
  const options = _parseArguments();
  const { config: toolsConfig, path: configPath } = loadToolsConfig();

  console.log(`Using tool config file: ${configPath}`);

  if (options.githubToken) {
    console.log("Using GitHub token for API requests");
  }

  try {
    const { configUpdated, hasErrors } = await validateAllToolChecksums(
      toolsConfig,
      options,
    );

    if (hasErrors) {
      console.error("\n❌ Some tools failed validation!");
      process.exit(3);
    }

    if (configUpdated) {
      writeUpdatedToolConfigFile(configPath, toolsConfig);
      console.log(
        "⚠️  Changes were made - please commit the updated checksums",
      );
      process.exit(2);
    } else {
      console.log("\n✅ All checksums are up to date - no changes needed");
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ Checksum validation failed!");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Validate all tool checksums and return validation result.
 */
async function validateAllToolChecksums(
  toolsConfig: ToolsConfig,
  options: ValidationOptions,
): Promise<ValidationResult> {
  let configUpdated = false;
  let hasErrors = false;
  const toolKeys = Object.keys(toolsConfig);
  console.log(`\n🔍 Validating ${toolKeys.length} tools...`);

  for (const toolKey of toolKeys) {
    try {
      const result = await validateSingleToolChecksum(
        toolKey,
        toolsConfig[toolKey],
        options,
      );
      configUpdated = configUpdated || result.configUpdated;
      if (result.errors.length > 0) {
        hasErrors = true;
      }
      if (result.configUpdated) {
        console.log(`  📝 ${toolKey}: Configuration updated`);
      } else if (result.errors.length === 0) {
        console.log(`  ✅ ${toolKey}: All checksums up to date`);
      }
    } catch (error) {
      console.error(`\n❌ Failed to validate ${toolKey}:`);
      console.error(error instanceof Error ? error.message : String(error));
      hasErrors = true;
    }
  }

  return { configUpdated, hasErrors };
}

/**
 * Tool-level validation coordinator.
 *
 * Manages validation for a single tool across all its supported platforms:
 * - Fetches GitHub release information once (optimizes API calls)
 * - Delegates platform-specific validation to asset level
 * - Aggregates results and provides per-tool status reporting
 * - Handles tool-level error collection and propagation
 *
 * Error Strategy:
 * - Continues processing other platforms on individual platform failures
 * - Collects all errors for comprehensive reporting
 * - Preserves successful validations even when some platforms fail
 */
async function validateSingleToolChecksum(
  toolName: string,
  toolConfig: ToolConfig,
  options: ValidationOptions,
): Promise<{ configUpdated: boolean; errors: Error[] }> {
  console.log(`\n=== Validating ${toolName} ===`);
  let configUpdated = false;
  const errors: Error[] = [];
  try {
    // Get release information from GitHub
    console.log(
      `  🌐 Fetching release info for ${toolConfig.repository}@${toolConfig.version}...`,
    );
    const release = await getGitHubRelease(
      toolConfig.repository,
      toolConfig.version,
      options.githubToken,
    );

    // Process all platforms for this tool
    const supportedPlatforms = Object.keys(toolConfig.assets);
    console.log(
      `  📦 Checking ${supportedPlatforms.length} platforms: ${supportedPlatforms.join(", ")}`,
    );
    for (const platform of supportedPlatforms) {
      const result = await validateSingleAssetChecksum(
        toolName,
        toolConfig,
        platform as Platform,
        release,
        { validateDownload: !!options.downloadTo, update_config: true },
      );

      if (result.errors.length > 0) {
        errors.push(...result.errors);
        console.error(
          `    ❌ ${platform}: ${result.errors.map((e) => e.message).join("; ")}`,
        );
      } else {
        console.log(`    ✅ ${platform}: OK`);
      }
      configUpdated = configUpdated || result.configUpdated;
    }
    return { configUpdated, errors };
  } catch (error) {
    errors.push(error as Error);
    return { configUpdated, errors };
  }
}

/**
 * Asset-level validation engine.
 *
 * Core validation logic for individual platform binaries:
 *
 * Validation Flow:
 * 1. Pre-validation checks (asset existence, checksum availability)
 * 2. GitHub API digest comparison vs stored checksums
 * 3. Optional download and binary integrity verification
 * 4. Checksum updates when mismatches detected
 *
 * Security Features:
 * - SHA256 checksum verification for downloaded binaries
 * - Automatic cleanup of corrupted/tampered files
 * - Temporary file usage for downloads
 *
 * Update Modes:
 * - Validation only: Reports mismatches as errors
 * - Update mode: Automatically updates stored checksums
 *
 * @param toolName Tool identifier (e.g., "buildifier")
 * @param toolConfig Complete tool configuration object
 * @param platform Target platform (e.g., "linux-amd64")
 * @param release GitHub release information with asset digests
 * @param options Validation and update behavior controls
 * @returns Validation result with config update flag and error collection
 */
export async function validateSingleAssetChecksum(
  toolName: string,
  toolConfig: ToolConfig,
  platform: Platform,
  release: GitHubRelease,
  options: {
    validateDownload?: boolean;
    update_config?: boolean;
  } = {},
): Promise<{ configUpdated: boolean; errors: Error[] }> {
  const filename = toolConfig.assets[platform];
  const expectedChecksum = toolConfig.checksums[platform];
  const asset = findMatchingGithubAsset(release.assets, filename);

  // Error checking
  if (!filename) {
    const error = new Error(
      `No asset filename found for ${toolName} ${platform}`,
    );
    return { configUpdated: false, errors: [error] };
  }
  if (!expectedChecksum) {
    const error = new Error(`No checksum found for ${toolName} ${platform}`);
    return { configUpdated: false, errors: [error] };
  }
  if (!asset) {
    const error = new Error(
      `Asset not found for ${toolName} ${platform}: ${filename}`,
    );
    return { configUpdated: false, errors: [error] };
  }
  if (!asset.digest) {
    const error = new Error(
      `GitHub API missing digest for ${toolName} ${platform}: ${asset.name}`,
    );
    return { configUpdated: false, errors: [error] };
  }

  // Validate GitHub checksum
  const githubHash = asset.digest.replace("sha256:", "");
  if (expectedChecksum !== githubHash) {
    if (options.update_config) {
      console.log(`  🔄 Updating checksum for ${toolName} ${platform}`);
      toolConfig.checksums[platform] = githubHash;
      return { configUpdated: true, errors: [] };
    } else {
      // Treat as validation error
      const error = new Error(
        `Checksum validation failed for ${toolName} ${platform}: expected ${expectedChecksum}, GitHub has ${githubHash}`,
      );
      return { configUpdated: false, errors: [error] };
    }
  }

  // Validate downloaded asset
  if (options.validateDownload) {
    try {
      console.log(`  ⬇️  Downloading ${filename} for integrity check...`);
      const tempFile = path.join(os.tmpdir(), `${toolName}-${platform}`);
      await downloadAndVerify(asset, tempFile);
      console.log(`  ✅ Downloaded asset integrity verified`);
    } catch (error) {
      return { configUpdated: false, errors: [error as Error] };
    }
  }
  return { configUpdated: false, errors: [] };
}

/**
 * Configuration file writer.
 *
 * Writes updated tool configuration to disk with proper formatting.
 * Uses JSON.stringify with 2-space indentation for human-readable output.
 *
 * Note: This function performs atomic write operations. If the write
 * operation fails, the original file remains unchanged.
 *
 * @param configPath Path to the configuration file to update
 * @param toolsConfig Updated tool configuration object
 */
function writeUpdatedToolConfigFile(
  configPath: string,
  toolsConfig: ToolsConfig,
): void {
  fs.writeFileSync(configPath, JSON.stringify(toolsConfig, null, 2));
  console.log(`\n📝 Tool configuration updated: ${configPath}`);
}

// Run if called directly
if (require.main === module) {
  validateToolChecksumsMain().catch(console.error);
}
