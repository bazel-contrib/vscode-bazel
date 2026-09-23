#!/usr/bin/env node

/**
 * CI Tool Downloader Script
 *
 * This script downloads external tools for CI using the existing test infrastructure.
 * It leverages the working tool downloader without requiring VSCode dependencies.
 *
 * Usage: node scripts/download-tools-for-ci.ts <tools-dir>
 */

import * as fs from "fs/promises";
import { downloadExternalTool } from "../src/external-tools/tool_downloader";
import {
  loadToolsConfig,
  detectPlatform,
  Platform,
} from "../src/external-tools/tool_config";
import { ILogger } from "../src/extension/logger_interface";

// Console-based logger for the CI environment
const consoleLogger: ILogger = {
  logDebug: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.log(`[DEBUG] ${message}`, ...args);
  },
  logInfo: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  logWarn: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  logError: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    consoleLogger.logError(
      "Usage: node scripts/download-tools-for-ci.ts <tools-dir>",
    );
    process.exit(1);
  }

  const toolsDir = args[0];
  const platform = detectPlatform(consoleLogger);

  consoleLogger.logInfo(`Downloading tools to: ${toolsDir}`);
  consoleLogger.logInfo(`Target platform: ${platform}`);

  try {
    // Ensure tools directory exists
    await fs.mkdir(toolsDir, { recursive: true });

    // Load tool configuration
    const { config: toolsConfig } = loadToolsConfig(consoleLogger);

    // Download each tool
    const downloadPromises = Object.entries(toolsConfig).map(
      async ([toolKey, toolConfig]) => {
        try {
          consoleLogger.logInfo(`Downloading ${toolKey}...`);

          // Check if platform is supported for this tool
          if (!toolConfig.assets[platform as Platform]) {
            consoleLogger.logInfo(
              `Skipping ${toolKey} - platform ${platform} not supported`,
            );
            return;
          }

          const downloadPath = await downloadExternalTool(
            toolConfig,
            toolsDir,
            consoleLogger,
          );
          consoleLogger.logInfo(
            `Successfully downloaded ${toolKey} to ${downloadPath}`,
          );
        } catch (error) {
          consoleLogger.logError(`Failed to download ${toolKey}: ${error}`);
          throw error;
        }
      },
    );

    await Promise.all(downloadPromises);
    consoleLogger.logInfo("All tools downloaded successfully!");
  } catch (error) {
    consoleLogger.logError(`Tool download failed: ${error}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    consoleLogger.logError(`Script execution failed: ${error}`);
    process.exit(1);
  });
}
