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
import { BazelBuildIcon, IconState } from "./bazel_build_icon";
import { FileTargetResolver, TargetResolutionOptions } from "./file_target_resolver";
import { BazelBuildIconAdapter } from "./bazel_build_icon_adapter";
import { BazelWorkspaceInfo } from "./bazel_workspace_info";
import { createBazelTask } from "./tasks";
import { BazelBuildIconConfigManager, TargetSelectionMode, CustomCommand } from "./bazel_build_icon_config";
import { ProjectViewManager } from "../project-view/project_view_manager";
import { ProjectViewConfig } from "../project-view/bazel_project_view";

/**
 * Service that coordinates the build icon functionality including
 * target resolution, command execution, and progress tracking.
 */
export class BazelBuildIconService implements vscode.Disposable {
  private buildIcon: BazelBuildIcon;
  private targetResolver: FileTargetResolver;
  private configManager: BazelBuildIconConfigManager;
  private projectViewManager: ProjectViewManager;
  private disposables: vscode.Disposable[] = [];
  private currentBuildTask: vscode.TaskExecution | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    buildIcon: BazelBuildIcon
  ) {
    this.buildIcon = buildIcon;
    this.targetResolver = new FileTargetResolver();
    this.configManager = new BazelBuildIconConfigManager(context);
    this.projectViewManager = ProjectViewManager.getInstance();
    
    this.setupCommandHandlers();
    this.setupTaskEventHandlers();
    this.setupConfigurationHandlers();
  }

  /**
   * Sets up command handlers for build icon functionality.
   */
  private setupCommandHandlers(): void {
    const buildCurrentFileCommand = vscode.commands.registerCommand(
      "bazel.buildCurrentFile",
      () => this.handleBuildCurrentFile()
    );

    const showTaskOutputCommand = vscode.commands.registerCommand(
      "bazel.showTaskOutput",
      () => this.showTaskOutput()
    );

    const buildFromHistoryCommand = vscode.commands.registerCommand(
      "bazel.buildFromHistory",
      () => this.handleBuildFromHistory()
    );

    const clearHistoryCommand = vscode.commands.registerCommand(
      "bazel.clearBuildHistory",
      () => this.handleClearHistory()
    );
    
    this.disposables.push(
      buildCurrentFileCommand, 
      showTaskOutputCommand, 
      buildFromHistoryCommand, 
      clearHistoryCommand
    );
  }

  /**
   * Sets up configuration change handlers.
   */
  private setupConfigurationHandlers(): void {
    const configChangeHandler = this.configManager.onConfigChanged(config => {
      // Update build icon visibility based on configuration
      if (!config.enabled) {
        this.buildIcon.setState(IconState.Disabled);
      } else {
        this.buildIcon.setState(IconState.Idle);
      }

      // Record telemetry for configuration changes
      this.configManager.recordTelemetry('configChanged', {
        enabled: config.enabled,
        targetSelectionMode: config.targetSelectionMode,
        enableTargetHistory: config.enableTargetHistory
      });
    });

    this.disposables.push(configChangeHandler);
  }

  /**
   * Sets up task event handlers to track build progress.
   */
  private setupTaskEventHandlers(): void {
    const taskStartHandler = vscode.tasks.onDidStartTask(e => {
      if (this.isBuildIconTask(e.execution)) {
        this.currentBuildTask = e.execution;
        this.buildIcon.setState(IconState.Building);
      }
    });

    const taskEndHandler = vscode.tasks.onDidEndTask(e => {
      if (this.isBuildIconTask(e.execution)) {
        this.currentBuildTask = null;
        
        // Set success or error state with 3 second timeout
        // Note: exitCode is not directly available on TaskEndEvent, we'll track success/failure differently
        this.buildIcon.setState(IconState.Success, 3000);
      }
    });

    const taskProcessEndHandler = vscode.tasks.onDidEndTaskProcess(e => {
      if (this.isBuildIconTask(e.execution)) {
        // Use process exit code for more accurate success/failure detection
        if (e.exitCode === 0) {
          this.buildIcon.setState(IconState.Success, 3000);
        } else {
          this.buildIcon.setState(IconState.Error, 5000);
        }
      }
    });

    this.disposables.push(taskStartHandler, taskEndHandler, taskProcessEndHandler);
  }

  /**
   * Checks if a task execution is from the build icon.
   */
  private isBuildIconTask(execution: vscode.TaskExecution): boolean {
    // Check if this task was created by our build icon service
    // We can identify it by checking the task definition or source
    return execution.task.source === "bazel" && 
           execution.task.definition.type === "bazel" &&
           execution.task.name.includes("Current File");
  }

  /**
   * Handles the build current file command with progress reporting.
   */
  private async handleBuildCurrentFile(): Promise<void> {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Building with Bazel",
      cancellable: true
    }, async (progress, token) => {
      return this.executeBuildWithProgress(progress, token);
    });
  }

  /**
   * Executes the build with progress reporting.
   */
  private async executeBuildWithProgress(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      // Check for cancellation
      if (token.isCancellationRequested) {
        return;
      }

      progress.report({ message: "Preparing build...", increment: 10 });

      // Get workspace information
      const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
      if (!workspaceInfo) {
        vscode.window.showErrorMessage("No Bazel workspace found");
        return;
      }

      progress.report({ message: "Resolving build targets...", increment: 20 });

      // Cancel any ongoing build
      if (this.currentBuildTask) {
        this.currentBuildTask.terminate();
        this.currentBuildTask = null;
      }

      // Set building state
      this.buildIcon.setState(IconState.Building);

      // Check for cancellation
      if (token.isCancellationRequested) {
        this.buildIcon.setState(IconState.Idle);
        return;
      }

      // Get targets to build - prioritize project view targets
      let targetsToUse: string[] = [];
      
      // First, check for project view configuration
      const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceInfo.workspaceFolder);
      if (projectViewConfig && projectViewConfig.targets.length > 0) {
        // Use targets from project view
        targetsToUse = projectViewConfig.targets;
        vscode.window.showInformationMessage(
          `Building ${targetsToUse.length} targets from project view: ${targetsToUse.join(', ')}`
        );
      } else {
        // Fallback to legacy file-based target resolution
        await this.executeLegacyFileBuild(progress, token, workspaceInfo);
        return;
      }

      if (targetsToUse.length === 0) {
        vscode.window.showWarningMessage("No targets found to build");
        this.buildIcon.setState(IconState.Idle);
        return;
      }

      progress.report({ message: "Starting build...", increment: 50 });

      // Add to history for the primary target (first one)
      if (targetsToUse.length > 0) {
        this.configManager.addToHistory(targetsToUse[0], workspaceInfo.bazelWorkspacePath);
      }

      // Execute the build with all targets
      await this.executeBuildMultipleTargets(workspaceInfo, targetsToUse);

      // Record telemetry
      this.configManager.recordTelemetry('buildExecuted', {
        targetSelectionMode: 'projectView',
        targetCount: targetsToUse.length,
        targets: targetsToUse
      });

    } catch (error) {
      this.buildIcon.setState(IconState.Error, 5000);
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Build failed: ${errorMessage}`);
    }
  }

  /**
   * Execute the legacy file-based build when no project view is available
   */
  private async executeLegacyFileBuild(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken,
    workspaceInfo: BazelWorkspaceInfo
  ): Promise<void> {
    // Get current editor and file
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage("No project view file found and no active file to build");
      this.buildIcon.setState(IconState.Idle);
      return;
    }

    const filePath = activeEditor.document.uri.fsPath;

    // Get configuration for target selection mode
    const config = this.configManager.getWorkspaceConfig(
      vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))
    );

    // Resolve target based on configuration
    let targetToUse: string | null = null;

    if (config.targetSelectionMode === TargetSelectionMode.Manual) {
      targetToUse = await this.targetResolver.manualTargetSelection(workspaceInfo);
    } else {
      // Auto or Prompt mode - try to resolve automatically first
      const resolutionOptions: TargetResolutionOptions = {
        showDisambiguationUI: config.targetSelectionMode === TargetSelectionMode.Prompt,
        maxCacheAge: 5 * 60 * 1000 // 5 minutes
      };

      const resolution = await this.targetResolver.resolveTargetForFile(
        filePath,
        workspaceInfo,
        resolutionOptions
      );

      if (resolution.primaryTarget) {
        targetToUse = resolution.primaryTarget;
        
        // Show information about disambiguation if it occurred
        if (resolution.wasDisambiguated && resolution.allTargets.length > 1) {
          vscode.window.showInformationMessage(
            `Building target: ${targetToUse} (selected from ${resolution.allTargets.length} options)`
          );
        }
      } else if (resolution.error) {
        vscode.window.showErrorMessage(`Cannot build file: ${resolution.error}`);
      } else {
        // Fallback to manual selection
        targetToUse = await this.targetResolver.manualTargetSelection(workspaceInfo);
      }
    }

    if (!targetToUse) {
      vscode.window.showWarningMessage("Build cancelled - no target selected");
      this.buildIcon.setState(IconState.Idle);
      return;
    }

    progress.report({ message: "Starting build...", increment: 50 });

    // Add to history
    this.configManager.addToHistory(targetToUse, workspaceInfo.bazelWorkspacePath);

    // Execute the build
    await this.executeBuild(workspaceInfo, targetToUse);

    // Record telemetry
    this.configManager.recordTelemetry('buildExecuted', {
      targetSelectionMode: config.targetSelectionMode,
      target: targetToUse
    });
  }

  /**
   * Handles building from target history.
   */
  private async handleBuildFromHistory(): Promise<void> {
    const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
    if (!workspaceInfo) {
      vscode.window.showErrorMessage("No Bazel workspace found");
      return;
    }

    const history = this.configManager.getHistory(workspaceInfo.bazelWorkspacePath);
    if (history.length === 0) {
      vscode.window.showInformationMessage("No build history available");
      return;
    }

    // Create quick pick items from history
    const items = history.map(entry => ({
      label: entry.target,
      description: `Used ${entry.useCount} times`,
      detail: `Last used: ${new Date(entry.lastUsed).toLocaleString()}`,
      target: entry.target
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a target from build history"
    });

    if (selected) {
      await this.executeBuild(workspaceInfo, selected.target);
      this.configManager.addToHistory(selected.target, workspaceInfo.bazelWorkspacePath);
    }
  }

  /**
   * Handles clearing the build history.
   */
  private async handleClearHistory(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      "Clear all build history?",
      { modal: true },
      "Clear"
    );

    if (confirm === "Clear") {
      this.configManager.clearHistory();
      vscode.window.showInformationMessage("Build history cleared");
    }
  }

  /**
   * Executes a Bazel build for multiple targets.
   */
  private async executeBuildMultipleTargets(workspaceInfo: BazelWorkspaceInfo, targets: string[]): Promise<void> {
    try {
      // Get configuration
      const config = this.configManager.getWorkspaceConfig(workspaceInfo.workspaceFolder);

      if (targets.length === 1) {
        // Single target - use existing method
        await this.executeBuild(workspaceInfo, targets[0]);
        return;
      }

      // Multiple targets - create a combined task
      const commandOptions = {
        workspaceInfo: workspaceInfo,
        targets: targets,
        options: [] as string[]
      };
      
      const task = createBazelTask("build", commandOptions);
      
      // Customize task name to indicate it's from project view
      task.name = `Build Project View Targets: ${targets.join(' ')}`;
      
      // Execute the task
      const execution = await vscode.tasks.executeTask(task);
      this.currentBuildTask = execution;

      // Show terminal if configured
      if (config.showTerminalOnBuild) {
        vscode.commands.executeCommand('workbench.action.terminal.focus');
      }

    } catch (error) {
      this.buildIcon.setState(IconState.Error, 5000);
      throw error;
    }
  }

  /**
   * Executes a Bazel build for the specified target.
   */
  private async executeBuild(workspaceInfo: BazelWorkspaceInfo, target: string): Promise<void> {
    try {
      // Get configuration
      const config = this.configManager.getWorkspaceConfig(workspaceInfo.workspaceFolder);

      // Create adapter for the build
      const adapter = new BazelBuildIconAdapter(workspaceInfo, target);
      
      // Create and execute the task
      const task = createBazelTask("build", adapter.getBazelCommandOptions());
      
      // Customize task name to indicate it's from the build icon
      task.name = `Build Target: ${target}`;
      
      // Execute the task
      const execution = await vscode.tasks.executeTask(task);
      this.currentBuildTask = execution;

      // Show terminal if configured
      if (config.showTerminalOnBuild) {
        vscode.commands.executeCommand('workbench.action.terminal.focus');
      }

    } catch (error) {
      this.buildIcon.setState(IconState.Error, 5000);
      throw error;
    }
  }

  /**
   * Shows the task output panel.
   */
  private showTaskOutput(): void {
    vscode.commands.executeCommand('workbench.action.tasks.showLog');
  }

  /**
   * Cancels the current build if one is running.
   */
  public cancelCurrentBuild(): void {
    if (this.currentBuildTask) {
      this.currentBuildTask.terminate();
      this.currentBuildTask = null;
      this.buildIcon.setState(IconState.Idle);
      vscode.window.showInformationMessage("Build cancelled");
    }
  }

  /**
   * Gets the build icon instance.
   */
  public getBuildIcon(): BazelBuildIcon {
    return this.buildIcon;
  }

  /**
   * Gets the target resolver instance.
   */
  public getTargetResolver(): FileTargetResolver {
    return this.targetResolver;
  }

  /**
   * Clears the target resolution cache.
   */
  public clearCache(): void {
    this.targetResolver.clearCache();
  }

  /**
   * Gets the configuration manager instance.
   */
  public getConfigManager(): BazelBuildIconConfigManager {
    return this.configManager;
  }

  /**
   * Disposes of the service and cleans up resources.
   */
  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    
    if (this.currentBuildTask) {
      this.currentBuildTask.terminate();
      this.currentBuildTask = null;
    }

    this.configManager.dispose();
    // Note: ProjectViewManager is a singleton, so we don't dispose it here
  }
} 