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
import * as util from "util";
import * as child_process from "child_process";
import which from "which";

import { downloadExternalTool } from "./tool_downloader";
import {
  findToolConfig,
  loadToolsConfig,
  ToolConfig,
  ToolsConfig,
} from "./config";
import { logInfo, logDebug, logWarn, logError } from "../extension/logger";
import { validateBuildifierExecutable } from "../buildifier";
import { getConfigurationWithDefault } from "../extension/configuration";

const execFile = util.promisify(child_process.execFile);

/**
 * Manages external tools availability checking, caching, and execution.
 *
 * This class provides a unified interface for managing external tools like
 * buildifier, bazel/bazelisk, and the Starlark language server. It handles
 * tool discovery, validation, downloading, and caching of tool locations.
 */
export class ExternalToolsManager {
  private readonly toolsConfig: ToolsConfig;
  private readonly downloadDir: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.toolsConfig = loadToolsConfig().config;
    this.downloadDir = path.join(
      context.globalStorageUri.fsPath,
      "external-tools",
    );
  }

  /**
   * Checks if a file exists and is executable.
   */
  private async fileExistsAndIsExecutable(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return false;
      }
      await fs.access(filePath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates that a tool is working correctly by running it with basic arguments.
   */
  private async validateTool(
    toolKey: string,
    executablePath: string,
  ): Promise<boolean> {
    logDebug(`Validating tool: ${toolKey} at ${executablePath}`);

    try {
      switch (toolKey) {
        case "Buildifier":
          return validateBuildifierExecutable(executablePath);

        case "Bazelisk":
          logDebug(`Testing bazelisk with version command`);
          // Test bazel with version command
          await execFile(executablePath, ["version"]);
          logDebug(`Bazelisk validation successful`);
          return true;

        case "Starlark Language Server":
          logDebug(`Testing Starlark Language Server with help command`);
          // Test LSP with help command
          await execFile(executablePath, ["--help"]);
          logDebug(`Starlark Language Server validation successful`);
          return true;

        default:
          logDebug(`No validation method available for tool: ${toolKey}`);
          return false;
      }
    } catch (error) {
      logError(
        `Tool validation failed for ${toolKey} at ${executablePath}: ${error instanceof Error ? error.message : String(error)}`,
        false,
        error,
      );
      return false;
    }
  }

  /**
   * Finds a tool using various strategies.
   */
  public async getToolPathByName(toolName: string): Promise<string | null> {
    logDebug(`Finding tool: ${toolName}`);

    // Find the configuration entry for this tool name
    const { config, configKey } = findToolConfig(toolName, this.toolsConfig);
    logDebug(`Found configuration for ${toolName} using key: ${configKey}`);

    // STAGE 1: Get Tool Name
    const configuredPath = getConfigurationWithDefault<string[]>(
      "bazel",
      config.configKey,
    );
    const executableNameOrPath = configuredPath || config.executableName;
    logDebug(
      `Using executable path/name: ${executableNameOrPath}${configuredPath ? " (from settings)" : " (from config)"}`,
    );

    // STAGE 2: Find or Download Executable
    let executablePath: string | null = null;
    executablePath = await this.findExecutable(executableNameOrPath);
    if (!executablePath) {
      logDebug(`Prompting to download or configure tool: ${toolName}`);
      executablePath = await this.promptDownloadOrConfigureTool(
        config,
        `${toolName} was not found`,
      );
    }
    if (!executablePath) {
      logDebug(`Could not find executable for tool: ${toolName}`);
      return null;
    }
    logDebug(`Found executable for ${toolName}: ${executablePath}`);

    // STAGE 3: Validate Executable
    if (await this.validateTool(configKey, executablePath)) {
      logDebug(`Tool validation successful for: ${toolName}`);
      return executablePath;
    } else {
      // Tool exists but validation failed - prompt for manual configuration
      logDebug(
        `Tool validation failed for: ${toolName}, prompting for manual configuration`,
      );
      await this.promptManualConfiguration(
        toolName,
        config,
        "Tool validation failed",
      );
      return null;
    }
  }

  /**
   * Finds executable path using various strategies.
   */
  private async findExecutable(
    executableNameOrPath: string,
  ): Promise<string | null> {
    logDebug(`Finding executable: ${executableNameOrPath}`);

    // 1. Handle Bazel targets (starting with @)
    if (executableNameOrPath.startsWith("@")) {
      logDebug(`Found Bazel target: ${executableNameOrPath}`);
      return executableNameOrPath;
    }

    // 2. Test whether this is a path to a executable
    let pathCandidate: string;
    if (path.isAbsolute(executableNameOrPath)) {
      pathCandidate = executableNameOrPath;
      logDebug(`Testing absolute path: ${pathCandidate}`);
    } else {
      const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
      if (workspacePath) {
        // Check as relative path from workspace
        pathCandidate = path.join(workspacePath, executableNameOrPath);
        logDebug(`Testing relative path from workspace: ${pathCandidate}`);
      }
    }
    if (
      pathCandidate &&
      (await this.fileExistsAndIsExecutable(pathCandidate))
    ) {
      logDebug(`Found executable at path: ${pathCandidate}`);
      return pathCandidate;
    }

    // 3. Check system PATH for executable name
    logDebug(`Checking system PATH for: ${executableNameOrPath}`);
    try {
      const systemPath = await which(executableNameOrPath);
      logDebug(`Found executable in system PATH: ${systemPath}`);
      return systemPath;
    } catch {
      logDebug(`Executable not found in system PATH: ${executableNameOrPath}`);
    }

    return null;
  }

  /**
   * Shows a dialog for a missing tool and handles the user's choice.
   * @param toolName The name of the tool that is missing.
   * @param reason The reason why the tool is missing.
   * @returns The path to the tool if successfully resolved, null otherwise.
   */
  private async promptDownloadOrConfigureTool(
    toolConfig: ToolConfig,
    reason: string,
  ): Promise<string | null> {
    const message = `${reason}. Would you like to download ${toolConfig.repository} automatically?`;

    const options: { title: string; action: string }[] = [
      { title: "Download", action: "download" },
      { title: "Configure Path", action: "configure" },
      { title: "Cancel", action: "cancel" },
    ];

    const choice = await vscode.window.showWarningMessage(
      message,
      ...options.map((opt) => opt.title),
    );

    if (!choice) {
      return null;
    }

    const selectedOption = options.find((opt) => opt.title === choice);
    if (!selectedOption) {
      return null;
    }

    switch (selectedOption.action) {
      case "download":
        return await this.downloadAndConfigureTool(toolConfig);
      case "configure":
        await this.openSettingsForTool(toolConfig);
        return null;
      case "cancel":
        return null;
      default:
        return null;
    }
  }

  /**
   * Downloads and configures a tool.
   * @param toolConfig The tool configuration to configure.
   * @returns The path to the downloaded tool or null if failed.
   */
  private async downloadAndConfigureTool(
    toolConfig: ToolConfig,
  ): Promise<string | null> {
    try {
      const toolPath = await downloadExternalTool(toolConfig, this.downloadDir);

      // Update configuration to use downloaded path
      await this.updateConfigurationForTool(toolConfig, toolPath);

      return toolPath;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to download ${toolConfig.repository}: ${error}`,
      );
      await this.promptManualConfiguration(
        toolConfig.executableName,
        toolConfig,
        "Tool download or validation failed",
      );
      return null;
    }
  }

  /**
   * Opens VSCode settings for specific tool configuration.
   * @param toolConfig The tool configuration to configure.
   */
  private async openSettingsForTool(toolConfig: ToolConfig): Promise<void> {
    const settingKey = `bazel.${toolConfig.configKey}`;
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      settingKey,
    );
  }

  /**
   * Updates VSCode configuration to use the downloaded tool path.
   * @param toolConfig The tool configuration to update.
   * @param toolPath The path to the downloaded tool.
   */
  private async updateConfigurationForTool(
    toolConfig: ToolConfig,
    toolPath: string,
  ): Promise<void> {
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        toolConfig.configKey,
        toolPath,
        vscode.ConfigurationTarget.Global,
      );
  }

  /**
   * Prompts the user to manually configure a tool.
   */
  private async promptManualConfiguration(
    toolName: string,
    toolConfig: ToolConfig,
    reason: string,
  ): Promise<void> {
    const message = `${reason}. Please manually configure the path to ${toolName} executable in settings.`;
    const choice = await vscode.window.showWarningMessage(
      message,
      "Open Settings",
    );
    if (choice === "Open Settings") {
      await this.openSettingsForTool(toolConfig);
    }
  }

  /**
   * Checks availability of all external tools.
   */
  public async checkAvailabilityOfExternalTools(): Promise<void> {
    logInfo(`Checking availability of all external tools`);
    const toolKeys = Object.keys(this.toolsConfig) as string[];

    await Promise.all(
      toolKeys.map(async (toolKey) => {
        const toolName = this.toolsConfig[toolKey].executableName;
        logInfo(`Checking availability of: ${toolKey}`);
        try {
          const toolPath = await this.getToolPathByName(toolName);
          logInfo(`Tool ${toolName} is available at: ${toolPath}`);
        } catch (error) {
          logWarn(
            `Failed to check availability of ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
            false,
          );
        }
      }),
    );

    logDebug(`Completed availability check for all external tools`);
  }
}
