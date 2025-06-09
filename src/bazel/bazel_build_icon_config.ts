// Copyright 2024 The Bazel Authors. All rights reserved.
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

import * as vscode from "vscode";

/**
 * Target selection mode options
 */
export enum TargetSelectionMode {
  Auto = "auto",
  Manual = "manual", 
  Prompt = "prompt"
}

/**
 * Custom command configuration
 */
export interface CustomCommand {
  name: string;
  command: "build" | "test" | "run";
  args?: string[];
}

/**
 * Target history entry
 */
export interface TargetHistoryEntry {
  target: string;
  workspacePath: string;
  lastUsed: number;
  useCount: number;
}

/**
 * Configuration interface for build icon settings
 */
export interface BuildIconConfig {
  enabled: boolean;
  showSuccessNotifications: boolean;
  showErrorNotifications: boolean;
  targetSelectionMode: TargetSelectionMode;
  showTerminalOnBuild: boolean;
  enableTargetHistory: boolean;
  maxHistoryItems: number;
  enableCacheStatus: boolean;
  customCommands: CustomCommand[];
  enableTelemetry: boolean;
}

/**
 * Manages configuration and advanced features for the Bazel build icon
 */
export class BazelBuildIconConfigManager implements vscode.Disposable {
  private static readonly CONFIG_SECTION = "bazel.buildIcon";
  private static readonly HISTORY_KEY = "bazel.buildIcon.targetHistory";
  private static readonly CONFIG_VERSION_KEY = "bazel.buildIcon.configVersion";
  private static readonly CURRENT_CONFIG_VERSION = 1;

  private disposables: vscode.Disposable[] = [];
  private configChangeEmitter = new vscode.EventEmitter<BuildIconConfig>();
  private targetHistory: TargetHistoryEntry[] = [];

  public readonly onConfigChanged = this.configChangeEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.loadTargetHistory();
    this.migrateConfigIfNeeded();
    this.setupConfigurationWatcher();
  }

  /**
   * Gets the current configuration with validation
   */
  public getConfig(): BuildIconConfig {
    const config = vscode.workspace.getConfiguration(BazelBuildIconConfigManager.CONFIG_SECTION);
    
    return {
      enabled: this.validateBoolean(config.get("enabled"), true),
      showSuccessNotifications: this.validateBoolean(config.get("showSuccessNotifications"), true),
      showErrorNotifications: this.validateBoolean(config.get("showErrorNotifications"), true),
      targetSelectionMode: this.validateTargetSelectionMode(config.get("targetSelectionMode"), TargetSelectionMode.Auto),
      showTerminalOnBuild: this.validateBoolean(config.get("showTerminalOnBuild"), false),
      enableTargetHistory: this.validateBoolean(config.get("enableTargetHistory"), true),
      maxHistoryItems: this.validateNumber(config.get("maxHistoryItems"), 10, 1, 50),
      enableCacheStatus: this.validateBoolean(config.get("enableCacheStatus"), false),
      customCommands: this.validateCustomCommands(config.get("customCommands"), []),
      enableTelemetry: this.validateBoolean(config.get("enableTelemetry"), false)
    };
  }

  /**
   * Gets workspace-specific configuration overrides
   */
  public getWorkspaceConfig(workspaceFolder?: vscode.WorkspaceFolder): BuildIconConfig {
    const globalConfig = this.getConfig();
    
    if (!workspaceFolder) {
      return globalConfig;
    }

    // Get workspace-specific configuration
    const workspaceConfig = vscode.workspace.getConfiguration(
      BazelBuildIconConfigManager.CONFIG_SECTION, 
      workspaceFolder.uri
    );

    // Merge with global config, workspace overrides global
    return {
      enabled: workspaceConfig.get("enabled") ?? globalConfig.enabled,
      showSuccessNotifications: workspaceConfig.get("showSuccessNotifications") ?? globalConfig.showSuccessNotifications,
      showErrorNotifications: workspaceConfig.get("showErrorNotifications") ?? globalConfig.showErrorNotifications,
      targetSelectionMode: this.validateTargetSelectionMode(
        workspaceConfig.get("targetSelectionMode"), 
        globalConfig.targetSelectionMode
      ),
      showTerminalOnBuild: workspaceConfig.get("showTerminalOnBuild") ?? globalConfig.showTerminalOnBuild,
      enableTargetHistory: workspaceConfig.get("enableTargetHistory") ?? globalConfig.enableTargetHistory,
      maxHistoryItems: this.validateNumber(
        workspaceConfig.get("maxHistoryItems"), 
        globalConfig.maxHistoryItems, 1, 50
      ),
      enableCacheStatus: workspaceConfig.get("enableCacheStatus") ?? globalConfig.enableCacheStatus,
      customCommands: this.validateCustomCommands(
        workspaceConfig.get("customCommands"), 
        globalConfig.customCommands
      ),
      enableTelemetry: workspaceConfig.get("enableTelemetry") ?? globalConfig.enableTelemetry
    };
  }

  /**
   * Adds a target to the build history
   */
  public addToHistory(target: string, workspacePath: string): void {
    const config = this.getConfig();
    if (!config.enableTargetHistory) {
      return;
    }

    // Find existing entry or create new one
    let entry = this.targetHistory.find(h => h.target === target && h.workspacePath === workspacePath);
    
    if (entry) {
      entry.lastUsed = Date.now();
      entry.useCount++;
    } else {
      entry = {
        target,
        workspacePath,
        lastUsed: Date.now(),
        useCount: 1
      };
      this.targetHistory.push(entry);
    }

    // Sort by last used (most recent first)
    this.targetHistory.sort((a, b) => b.lastUsed - a.lastUsed);

    // Trim to max items
    if (this.targetHistory.length > config.maxHistoryItems) {
      this.targetHistory = this.targetHistory.slice(0, config.maxHistoryItems);
    }

    this.saveTargetHistory();
  }

  /**
   * Gets the target history for a workspace
   */
  public getHistory(workspacePath?: string): TargetHistoryEntry[] {
    const config = this.getConfig();
    if (!config.enableTargetHistory) {
      return [];
    }

    if (workspacePath) {
      return this.targetHistory.filter(h => h.workspacePath === workspacePath);
    }

    return [...this.targetHistory];
  }

  /**
   * Clears the target history
   */
  public clearHistory(): void {
    this.targetHistory = [];
    this.saveTargetHistory();
  }

  /**
   * Gets custom commands for the current configuration
   */
  public getCustomCommands(): CustomCommand[] {
    const config = this.getConfig();
    return config.customCommands;
  }

  /**
   * Records telemetry data if enabled
   */
  public recordTelemetry(event: string, properties?: Record<string, any>): void {
    const config = this.getConfig();
    if (!config.enableTelemetry) {
      return;
    }

    // In a real implementation, this would send to a telemetry service
    console.log(`Telemetry: ${event}`, properties);
  }

  /**
   * Validates configuration and shows warnings for invalid values
   */
  public validateConfiguration(): string[] {
    const warnings: string[] = [];
    const config = vscode.workspace.getConfiguration(BazelBuildIconConfigManager.CONFIG_SECTION);

    // Validate target selection mode
    const targetMode = config.get("targetSelectionMode");
    if (targetMode && !Object.values(TargetSelectionMode).includes(targetMode as TargetSelectionMode)) {
      warnings.push(`Invalid targetSelectionMode: ${targetMode}. Using default 'auto'.`);
    }

    // Validate max history items
    const maxItems = config.get("maxHistoryItems");
    if (typeof maxItems === "number" && (maxItems < 1 || maxItems > 50)) {
      warnings.push(`Invalid maxHistoryItems: ${maxItems}. Must be between 1 and 50.`);
    }

    // Validate custom commands
    const customCommands = config.get("customCommands");
    if (Array.isArray(customCommands)) {
      customCommands.forEach((cmd, index) => {
        if (!cmd.name || typeof cmd.name !== "string") {
          warnings.push(`Custom command ${index}: missing or invalid name.`);
        }
        if (!cmd.command || !["build", "test", "run"].includes(cmd.command)) {
          warnings.push(`Custom command ${index}: invalid command type.`);
        }
      });
    }

    return warnings;
  }

  /**
   * Sets up configuration change watching
   */
  private setupConfigurationWatcher(): void {
    const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(BazelBuildIconConfigManager.CONFIG_SECTION)) {
        const warnings = this.validateConfiguration();
        if (warnings.length > 0) {
          vscode.window.showWarningMessage(
            `Bazel Build Icon configuration warnings:\n${warnings.join('\n')}`
          );
        }
        
        this.configChangeEmitter.fire(this.getConfig());
      }
    });

    this.disposables.push(configWatcher);
  }

  /**
   * Loads target history from extension storage
   */
  private loadTargetHistory(): void {
    const stored = this.context.globalState.get<TargetHistoryEntry[]>(
      BazelBuildIconConfigManager.HISTORY_KEY, 
      []
    );
    this.targetHistory = stored;
  }

  /**
   * Saves target history to extension storage
   */
  private saveTargetHistory(): void {
    this.context.globalState.update(
      BazelBuildIconConfigManager.HISTORY_KEY, 
      this.targetHistory
    );
  }

  /**
   * Migrates configuration from older versions if needed
   */
  private migrateConfigIfNeeded(): void {
    const currentVersion = this.context.globalState.get<number>(
      BazelBuildIconConfigManager.CONFIG_VERSION_KEY, 
      0
    );

    if (currentVersion < BazelBuildIconConfigManager.CURRENT_CONFIG_VERSION) {
      this.performConfigMigration(currentVersion);
      this.context.globalState.update(
        BazelBuildIconConfigManager.CONFIG_VERSION_KEY,
        BazelBuildIconConfigManager.CURRENT_CONFIG_VERSION
      );
    }
  }

  /**
   * Performs configuration migration from older versions
   */
  private performConfigMigration(fromVersion: number): void {
    // Future migration logic would go here
    console.log(`Migrating Bazel Build Icon configuration from version ${fromVersion}`);
  }

  /**
   * Validation helper methods
   */
  private validateBoolean(value: any, defaultValue: boolean): boolean {
    return typeof value === "boolean" ? value : defaultValue;
  }

  private validateNumber(value: any, defaultValue: number, min?: number, max?: number): number {
    if (typeof value !== "number") {
      return defaultValue;
    }
    if (min !== undefined && value < min) {
      return defaultValue;
    }
    if (max !== undefined && value > max) {
      return defaultValue;
    }
    return value;
  }

  private validateTargetSelectionMode(value: any, defaultValue: TargetSelectionMode): TargetSelectionMode {
    if (Object.values(TargetSelectionMode).includes(value)) {
      return value;
    }
    return defaultValue;
  }

  private validateCustomCommands(value: any, defaultValue: CustomCommand[]): CustomCommand[] {
    if (!Array.isArray(value)) {
      return defaultValue;
    }

    return value.filter(cmd => 
      cmd && 
      typeof cmd.name === "string" && 
      ["build", "test", "run"].includes(cmd.command)
    );
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    this.configChangeEmitter.dispose();
  }
} 