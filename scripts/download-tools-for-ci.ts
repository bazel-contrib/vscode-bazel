#!/usr/bin/env node

/**
 * CI Tool Downloader Script
 *
 * This script downloads external tools for CI using the existing test infrastructure.
 * It leverages the working tool downloader without requiring VSCode dependencies.
 *
 * Usage: node scripts/download-tools-for-ci.ts <tools-dir> <platform>
 */

import * as fs from "fs/promises";
import { downloadExternalTool } from "../src/external-tools/tool_downloader";
import {
  loadToolsConfig,
  detectPlatform,
  Platform,
} from "../src/external-tools/tool_config";
import { ILogger } from "../src/extension/logger_interface";

// Mock VSCode logger for CI environment
const mockLogger: ILogger = {
  logDebug: (message: string, ...args: unknown[]) => {
    console.log(`[DEBUG] ${message}`, ...args);
  },
  logInfo: (message: string, ...args: unknown[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  logWarn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  logError: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error("Usage: node scripts/download-tools-for-ci.ts <tools-dir>");
    process.exit(1);
  }

  const toolsDir = args[0];
  const platform = detectPlatform(mockLogger);

  console.log(`Downloading tools to: ${toolsDir}`);
  console.log(`Target platform: ${platform}`);

  try {
    // Ensure tools directory exists
    await fs.mkdir(toolsDir, { recursive: true });

    // Load tool configuration
    const { config: toolsConfig } = loadToolsConfig(mockLogger);

    // Download each tool
    const downloadPromises = Object.entries(toolsConfig).map(
      async ([toolKey, toolConfig]) => {
        try {
          console.log(`Downloading ${toolKey}...`);

          // Check if platform is supported for this tool
          if (!toolConfig.assets[platform as Platform]) {
            console.log(
              `Skipping ${toolKey} - platform ${platform} not supported`,
            );
            return;
          }

          const downloadPath = await downloadExternalTool(
            toolConfig,
            toolsDir,
            mockLogger,
          );
          console.log(`Successfully downloaded ${toolKey} to ${downloadPath}`);
        } catch (error) {
          console.error(`Failed to download ${toolKey}:`, error);
          throw error;
        }
      },
    );

    await Promise.all(downloadPromises);
    console.log("All tools downloaded successfully!");
  } catch (error) {
    console.error("Tool download failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("Script execution failed:", error);
    process.exit(1);
  });
}
