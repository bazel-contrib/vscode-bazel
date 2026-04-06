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

import { ToolDownloader } from "./tool_downloader";
import { loadToolConfig } from "./config";
import { ToolConfig } from "./types";
import { logInfo, logDebug, logWarn, logError } from "../extension/logger";

const execFile = util.promisify(child_process.execFile);

/**
 * Manages external tools availability checking, caching, and execution.
 *
 * This class provides a unified interface for managing external tools like
 * buildifier, bazel/bazelisk, and the Starlark language server. It handles
 * tool discovery, validation, downloading, and caching of tool locations.
 */
export class ExternalToolsManager {
  private readonly toolLocations = new Map<string, string>();
  private readonly toolDownloader: ToolDownloader;
  private readonly toolConfig: ToolConfig;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.toolConfig = loadToolConfig().config;
    this.toolDownloader = new ToolDownloader(context);

    // Ensure tools directory is in PATH
    this.ensureToolsDirectoryInPath();
  }

  /**
   * Ensures the tools directory is added to the process PATH.
   */
  private ensureToolsDirectoryInPath(): void {
    const toolsDir = path.join(
      this.context.globalStorageUri.fsPath,
      "external-tools",
    );
    if (!process.env.PATH?.includes(toolsDir)) {
      process.env.PATH = `${toolsDir}${path.delimiter}${process.env.PATH}`;
    }
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
    toolName: string,
    executablePath: string,
  ): Promise<boolean> {
    logDebug(`Validating tool: ${toolName} at ${executablePath}`);

    try {
      switch (toolName) {
        case "Buildifier":
          logDebug(`Testing buildifier with JSON output format`);
          // Test buildifier with empty input and check for JSON output
          const { stdout } = await execFile(
            executablePath,
            ["--format=json", "--mode=check", "--lint=off"],
            { input: "" } as any,
          );
          const stdoutStr =
            typeof stdout === "string" ? stdout : stdout.toString();

          try {
            JSON.parse(stdoutStr); // Will throw if not valid JSON
            logDebug(
              `Buildifier validation successful - JSON output supported`,
            );
            return true;
          } catch (jsonError) {
            logWarn(
              `Buildifier JSON validation failed. The buildifier version may be too old and doesn't support JSON output format. Consider updating to a newer version. Error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
              false,
            );
            return false;
          }

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
          logDebug(`No validation method available for tool: ${toolName}`);
          return false;
      }
    } catch (error) {
      logError(
        `Tool validation failed for ${toolName} at ${executablePath}: ${error instanceof Error ? error.message : String(error)}`,
        false,
        error,
      );
      return false;
    }
  }

  /**
   * Gets the configured path for a tool from VSCode settings.
   */
  private getConfiguredPath(toolName: string): string | null {
    const config = this.toolConfig[toolName];
    if (!config) {
      return null;
    }

    const vscodeConfig = vscode.workspace.getConfiguration("bazel");
    return vscodeConfig.get<string>(config.configKey) || null;
  }

  /**
   * Finds a tool using various strategies.
   */
  private async findTool(toolName: string): Promise<string | null> {
    logDebug(`Finding tool: ${toolName}`);

    const config = this.toolConfig[toolName];
    if (!config) {
      logDebug(`No configuration found for tool: ${toolName}`);
      return null;
    }

    // STAGE 1: Get Tool Name
    const configuredPath = this.getConfiguredPath(toolName);
    const executableNameOrPath = configuredPath || config.executableName;
    logDebug(
      `Using executable path/name: ${executableNameOrPath}${configuredPath ? " (from settings)" : " (from config)"}`,
    );

    // STAGE 2: Find Executable
    const executablePath = await this.findExecutable(
      toolName,
      executableNameOrPath,
    );
    if (!executablePath) {
      logDebug(`Could not find executable for tool: ${toolName}`);
      return null;
    }

    logDebug(`Found executable for ${toolName}: ${executablePath}`);

    // STAGE 3: Validate Executable
    if (await this.validateTool(toolName, executablePath)) {
      logDebug(`Tool validation successful for: ${toolName}`);
      return executablePath;
    } else {
      // Tool exists but validation failed - prompt for manual configuration
      logDebug(
        `Tool validation failed for: ${toolName}, prompting for manual configuration`,
      );
      await this.promptManualConfiguration(toolName, "Tool validation failed");
      return null;
    }
  }

  /**
   * Finds executable path using various strategies.
   */
  private async findExecutable(
    toolName: string,
    executableNameOrPath: string,
  ): Promise<string | null> {
    logDebug(`Finding executable for ${toolName}: ${executableNameOrPath}`);

    // 1. Handle Bazel targets (starting with @)
    if (executableNameOrPath.startsWith("@")) {
      logDebug(`Found Bazel target for ${toolName}: ${executableNameOrPath}`);
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

    // 4. Offer to download the tool
    logDebug(`Prompting to download or configure tool: ${toolName}`);
    const downloadedToolPath = await this.promptDownloadOrConfigureTool(
      toolName,
      `${toolName} was not found`,
    );

    return downloadedToolPath;
  }

  /**
   * Shows a dialog for a missing tool and handles the user's choice.
   * @param toolName The name of the tool that is missing.
   * @param reason The reason why the tool is missing.
   * @returns The path to the tool if successfully resolved, null otherwise.
   */
  private async promptDownloadOrConfigureTool(
    toolName: string,
    reason: string,
  ): Promise<string | null> {
    const toolConfig = this.toolConfig[toolName];
    if (!toolConfig) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const toolDisplayName = toolName;
    const message = `${reason}. Would you like to download ${toolDisplayName} automatically?`;

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
        return await this.downloadAndConfigureTool(toolName);
      case "configure":
        await this.openSettingsForTool(toolName);
        return null;
      case "cancel":
        return null;
      default:
        return null;
    }
  }

  /**
   * Downloads and configures a tool.
   * @param toolName The name of the tool to download.
   * @returns The path to the downloaded tool or null if failed.
   */
  private async downloadAndConfigureTool(
    toolName: string,
  ): Promise<string | null> {
    try {
      // Show progress notification
      const toolConfig = this.toolConfig[toolName];
      if (!toolConfig) {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      const toolDisplayName = toolName;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Downloading ${toolDisplayName}`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            increment: 0,
            message: "Initializing download...",
          });

          const toolPath =
            await this.toolDownloader.downloadExternalTools(toolName);

          progress.report({ increment: 100, message: "Download complete!" });

          // Update configuration to use downloaded path
          await this.updateConfigurationForTool(toolName, toolPath);

          return toolPath;
        },
      );

      // Show success message
      const downloadedToolPath =
        await this.toolDownloader.getToolPath(toolName);
      await vscode.window.showInformationMessage(
        `${toolDisplayName} downloaded successfully and configured.`,
      );

      return downloadedToolPath;
    } catch (error) {
      const toolConfig = this.toolConfig[toolName];
      const toolDisplayName = toolName;
      await vscode.window.showErrorMessage(
        `Failed to download ${toolDisplayName}: ${error}`,
      );
      return null;
    }
  }

  /**
   * Opens VSCode settings for specific tool configuration.
   * @param toolName The name of the tool to configure.
   */
  private async openSettingsForTool(toolName: string): Promise<void> {
    const toolConfig = this.toolConfig[toolName];
    if (!toolConfig) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const settingKey = `bazel.${toolConfig.configKey}`;
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      settingKey,
    );
  }

  /**
   * Updates VSCode configuration to use the downloaded tool path.
   * @param toolName The name of the tool that was downloaded.
   * @param toolPath The path to the downloaded tool.
   */
  private async updateConfigurationForTool(
    toolName: string,
    toolPath: string,
  ): Promise<void> {
    const toolConfig = this.toolConfig[toolName];
    if (!toolConfig) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const configKey = toolConfig.configKey;
    const config = vscode.workspace.getConfiguration("bazel");

    await config.update(configKey, toolPath, vscode.ConfigurationTarget.Global);
  }

  /**
   * Prompts the user to manually configure a tool.
   */
  private async promptManualConfiguration(
    toolName: string,
    reason: string,
  ): Promise<void> {
    const config = this.toolConfig[toolName];
    if (!config) {
      return;
    }
    const message = `${reason}. Please manually configure path to ${toolName} in settings.`;
    const choice = await vscode.window.showWarningMessage(
      message,
      "Open Settings",
    );
    if (choice === "Open Settings") {
      await this.openSettingsForTool(toolName);
    }
  }

  /**
   * Gets the path to a tool, using cached location if available.
   */
  public async getToolPath(toolName: string): Promise<string | null> {
    logDebug(`Getting tool path for: ${toolName}`);

    // Check cache first
    if (this.toolLocations.has(toolName)) {
      const cachedPath = this.toolLocations.get(toolName)!;
      logDebug(`Found cached path for ${toolName}: ${cachedPath}`);
      return cachedPath;
    }

    logDebug(`No cached path found for ${toolName}, searching...`);
    // Find the tool
    const toolPath = await this.findTool(toolName);
    if (toolPath) {
      this.toolLocations.set(toolName, toolPath);
      logDebug(`Caching path for ${toolName}: ${toolPath}`);
    } else {
      logDebug(`Could not find path for ${toolName}`);
    }

    return toolPath;
  }

  /**
   * Executes a tool with the given arguments.
   */
  public async executeTool(
    toolName: string,
    args: string[] = [],
    options: child_process.ExecFileOptions = {},
  ): Promise<{ stdout: string; stderr: string }> {
    logDebug(`Executing tool: ${toolName} with args: [${args.join(", ")}]`);

    const toolPath = await this.getToolPath(toolName);
    if (!toolPath) {
      const errorMsg = `${toolName} is not available`;
      logError(errorMsg, true);
      throw new Error(errorMsg);
    }

    // Handle Bazel targets
    let executable = toolPath;
    let execArgs = [...args];

    if (toolPath.startsWith("@")) {
      const targetName = toolPath;
      executable = (await this.getToolPath("Bazelisk")) || "bazel";
      execArgs = ["run", targetName, "--", ...args];
      logDebug(
        `Executing Bazel target: ${targetName} using bazelisk: ${executable}`,
      );
    }

    const execOptions = {
      maxBuffer: Number.MAX_SAFE_INTEGER,
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
      ...options,
    };

    logDebug(`Executing: ${executable} ${execArgs.join(" ")}`);
    const result = await execFile(executable, execArgs, execOptions);
    const stdout =
      typeof result.stdout === "string"
        ? result.stdout
        : result.stdout.toString();
    const stderr =
      typeof result.stderr === "string"
        ? result.stderr
        : result.stderr.toString();

    logDebug(`Tool execution completed for ${toolName}`);
    return { stdout, stderr };
  }

  /**
   * Checks availability of all external tools.
   */
  public async checkAvailabilityOfExternalTools(): Promise<void> {
    logDebug(`Checking availability of all external tools`);
    const toolKeys = Object.keys(this.toolConfig) as string[];

    for (const toolKey of toolKeys) {
      const toolName = this.toolConfig[toolKey].executableName;
      logDebug(`Checking availability of: ${toolName}`);
      try {
        await this.getToolPath(toolName);
        logDebug(`Tool ${toolName} is available`);
      } catch (error) {
        logWarn(
          `Failed to check availability of ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
          false,
        );
      }
    }

    logDebug(`Completed availability check for all external tools`);
  }
}

/**
 * Global instance of the external tools manager.
 */
let externalToolsManager: ExternalToolsManager | null = null;

/**
 * Gets or creates the global external tools manager instance.
 */
export function getExternalToolsManager(
  context: vscode.ExtensionContext,
): ExternalToolsManager {
  if (!externalToolsManager) {
    externalToolsManager = new ExternalToolsManager(context);
  }
  return externalToolsManager;
}

/**
 * Checks availability of external tools using the global manager.
 */
export async function checkAvailabilityOfExternalTools(
  context: vscode.ExtensionContext,
): Promise<void> {
  const manager = getExternalToolsManager(context);
  await manager.checkAvailabilityOfExternalTools();
}
