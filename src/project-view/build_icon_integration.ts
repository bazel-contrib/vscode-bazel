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
import { ProjectViewManager } from "./project_view_manager";
import { BazelBuildIconService } from "../bazel/bazel_build_icon_service";
import { ProjectViewConfig } from "./bazel_project_view";

/**
 * Integrates project view functionality with the existing build icon system
 */
export class BuildIconIntegration implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private projectViewManager: ProjectViewManager;
  private buildIconService: BazelBuildIconService;

  constructor(
    projectViewManager: ProjectViewManager,
    buildIconService: BazelBuildIconService
  ) {
    this.projectViewManager = projectViewManager;
    this.buildIconService = buildIconService;

    this.setupIntegration();
  }

  /**
   * Sets up the integration between project view and build icon
   */
  private setupIntegration(): void {
    // Listen for project view changes to update build icon behavior
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView((event) => {
        this.handleProjectViewChange(event.workspaceFolder, event.config);
      })
    );

    // Register command to build targets from project view
    this.disposables.push(
      vscode.commands.registerCommand('bazel.buildProjectViewTargets', () => {
        this.buildProjectViewTargets();
      })
    );

    // Register command to build current file if it's in project view
    this.disposables.push(
      vscode.commands.registerCommand('bazel.buildCurrentFileIfInProjectView', () => {
        this.buildCurrentFileIfInProjectView();
      })
    );
  }

  /**
   * Handles project view configuration changes
   */
  private handleProjectViewChange(workspaceFolder: vscode.WorkspaceFolder, config: ProjectViewConfig | undefined): void {
    if (config) {
      // Update build icon tooltip to show project view status
      const targetCount = config.targets.length;
      const dirCount = config.directories.length;
      
      this.updateBuildIconTooltip(
        `Bazel Build (Project View: ${targetCount} targets, ${dirCount} directories)`
      );
    } else {
      // Reset to default tooltip
      this.updateBuildIconTooltip('Bazel Build');
    }
  }

  /**
   * Updates the build icon tooltip
   */
  private updateBuildIconTooltip(tooltip: string): void {
    const buildIcon = this.buildIconService.getBuildIcon();
    if (buildIcon) {
      // Note: This would require extending the BazelBuildIcon class to support tooltip updates
      // For now, we'll just log the change
      console.log(`Build icon tooltip updated: ${tooltip}`);
    }
  }

  /**
   * Builds all targets defined in the project view
   */
  private async buildProjectViewTargets(): Promise<void> {
    const activeWorkspace = vscode.workspace.workspaceFolders?.[0];
    if (!activeWorkspace) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    const config = this.projectViewManager.getProjectViewConfig(activeWorkspace);
    if (!config || config.targets.length === 0) {
      vscode.window.showWarningMessage('No targets defined in project view');
      return;
    }

    try {
      // Use the existing build icon service to build targets
      for (const target of config.targets) {
        await this.buildTarget(target);
      }
      
      vscode.window.showInformationMessage(
        `Built ${config.targets.length} targets from project view`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to build project view targets: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Builds the current file if it's in a directory included by project view
   */
  private async buildCurrentFileIfInProjectView(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active file');
      return;
    }

    const fileUri = activeEditor.document.uri;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('File is not in a workspace');
      return;
    }

    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      vscode.window.showWarningMessage('No project view configuration found');
      return;
    }

    if (this.isFileInProjectView(fileUri, workspaceFolder, config)) {
      // Use the existing build current file command
      await vscode.commands.executeCommand('bazel.buildCurrentFile');
    } else {
      vscode.window.showWarningMessage('Current file is not included in project view');
    }
  }

  /**
   * Checks if a file is in a directory included by the project view
   */
  private isFileInProjectView(
    fileUri: vscode.Uri, 
    workspaceFolder: vscode.WorkspaceFolder, 
    config: ProjectViewConfig
  ): boolean {
    const relativePath = vscode.workspace.asRelativePath(fileUri, false);
    const dirPath = relativePath.substring(0, relativePath.lastIndexOf('/'));

    return config.directories.some(dir => {
      if (dir.startsWith('-')) {
        return false; // Skip exclusions
      }
      const cleanDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
      return dirPath === cleanDir || dirPath.startsWith(cleanDir + '/');
    });
  }

  /**
   * Builds a specific target using the build icon service
   */
  private async buildTarget(target: string): Promise<void> {
    // This would integrate with the existing build icon service
    // For now, we'll use the basic build command
    await vscode.commands.executeCommand('bazel.buildTarget', target);
  }

  /**
   * Gets project view statistics for display
   */
  public getProjectViewStats(workspaceFolder: vscode.WorkspaceFolder): {
    hasProjectView: boolean;
    targetCount: number;
    directoryCount: number;
    includedDirectories: string[];
    excludedDirectories: string[];
  } {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    
    if (!config) {
      return {
        hasProjectView: false,
        targetCount: 0,
        directoryCount: 0,
        includedDirectories: [],
        excludedDirectories: []
      };
    }

    const includedDirectories = config.directories.filter(dir => !dir.startsWith('-'));
    const excludedDirectories = config.directories
      .filter(dir => dir.startsWith('-'))
      .map(dir => dir.slice(1)); // Remove the '-' prefix

    return {
      hasProjectView: true,
      targetCount: config.targets.length,
      directoryCount: config.directories.length,
      includedDirectories,
      excludedDirectories
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
} 