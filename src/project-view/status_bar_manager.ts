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
import { DirectoryFilterService } from "./directory_filter_service";
import { ProjectViewService } from "./project_view_service";
import { ProjectViewDashboard } from "./project_view_dashboard";

/**
 * Status bar item priority levels
 */
enum StatusBarPriority {
  ProjectView = 100,
  DirectoryFilter = 99,
  Performance = 98,
  Errors = 101
}

/**
 * Project view status types
 */
type ProjectViewStatus = 'active' | 'inactive' | 'error' | 'loading';

/**
 * Directory filter status types  
 */
type DirectoryFilterStatus = 'enabled' | 'disabled' | 'recommended';

/**
 * Manages status bar items for project view system
 */
export class StatusBarManager implements vscode.Disposable {
  private static instance?: StatusBarManager;
  
  private disposables: vscode.Disposable[] = [];
  private projectViewManager: ProjectViewManager;
  private directoryFilterService: DirectoryFilterService;
  private projectViewService: ProjectViewService;
  private dashboard: ProjectViewDashboard;

  // Status bar items
  private projectViewStatusItem: vscode.StatusBarItem;
  private directoryFilterStatusItem: vscode.StatusBarItem;
  private performanceStatusItem: vscode.StatusBarItem;
  private errorStatusItem: vscode.StatusBarItem;

  // State tracking
  private currentWorkspaceFolder?: vscode.WorkspaceFolder;
  private updateTimeout?: NodeJS.Timeout;

  // Configuration
  private config: {
    enabled: boolean;
    showPerformanceMetrics: boolean;
    showFilterRecommendations: boolean;
  };

  private constructor() {
    this.projectViewManager = ProjectViewManager.getInstance();
    this.directoryFilterService = DirectoryFilterService.getInstance();
    this.projectViewService = ProjectViewService.getInstance();
    this.dashboard = ProjectViewDashboard.getInstance();

    this.config = this.loadConfiguration();
    this.createStatusBarItems();
    this.setupEventHandlers();
    this.registerCommands();
    this.updateAllStatusItems();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
  }

  /**
   * Updates all status bar items
   */
  public updateAllStatusItems(): void {
    // Debounce updates to avoid excessive refreshing
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    
    this.updateTimeout = setTimeout(() => {
      this.updateCurrentWorkspace();
      this.updateProjectViewStatus();
      this.updateDirectoryFilterStatus();
      this.updatePerformanceStatus();
      this.updateErrorStatus();
    }, 100);
  }

  /**
   * Shows a temporary status message
   */
  public showTemporaryStatus(message: string, duration: number = 3000): void {
    const tempItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, StatusBarPriority.Errors + 1);
    tempItem.text = `$(info) ${message}`;
    tempItem.show();

    setTimeout(() => {
      tempItem.dispose();
    }, duration);
  }

  /**
   * Shows an error status with action
   */
  public showErrorStatus(message: string, command?: string): void {
    this.errorStatusItem.text = `$(error) ${message}`;
    this.errorStatusItem.command = command;
    this.errorStatusItem.show();

    // Auto-hide error after 10 seconds
    setTimeout(() => {
      this.errorStatusItem.hide();
    }, 10000);
  }

  /**
   * Clears error status
   */
  public clearErrorStatus(): void {
    this.errorStatusItem.hide();
  }

  /**
   * Creates all status bar items
   */
  private createStatusBarItems(): void {
    // Project view status
    this.projectViewStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 
      StatusBarPriority.ProjectView
    );
    this.projectViewStatusItem.command = 'bazel.openProjectViewFile';

    // Directory filter status
    this.directoryFilterStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      StatusBarPriority.DirectoryFilter
    );
    this.directoryFilterStatusItem.command = 'bazel.configureDirectoryFiltering';

    // Performance status
    this.performanceStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      StatusBarPriority.Performance
    );
    this.performanceStatusItem.command = 'bazel.showDirectoryFilterStats';

    // Error status
    this.errorStatusItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      StatusBarPriority.Errors
    );
  }

  /**
   * Updates current workspace folder
   */
  private updateCurrentWorkspace(): void {
    if (vscode.window.activeTextEditor) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(
        vscode.window.activeTextEditor.document.uri
      );
      this.currentWorkspaceFolder = workspaceFolder || vscode.workspace.workspaceFolders?.[0];
    } else {
      this.currentWorkspaceFolder = vscode.workspace.workspaceFolders?.[0];
    }
  }

  /**
   * Updates project view status item
   */
  private updateProjectViewStatus(): void {
    if (!this.config.enabled || !this.currentWorkspaceFolder) {
      this.projectViewStatusItem.hide();
      return;
    }

    const config = this.projectViewManager.getProjectViewConfig(this.currentWorkspaceFolder);
    const hasErrors = this.projectViewManager.hasValidationErrors(this.currentWorkspaceFolder);

    let status: ProjectViewStatus;
    let icon: string;
    let text: string;
    let tooltip: string;

    if (hasErrors) {
      status = 'error';
      icon = '$(error)';
      text = 'Project View (Errors)';
      tooltip = 'Project view has validation errors. Click to open and fix.';
    } else if (config) {
      status = 'active';
      icon = '$(check)';
      text = 'Project View';
      tooltip = `Project view active: ${config.directories.length} directories configured. Click to edit.`;
    } else {
      status = 'inactive';
      icon = '$(circle-outline)';
      text = 'No Project View';
      tooltip = 'No project view configured. Click to create one.';
    }

    this.projectViewStatusItem.text = `${icon} ${text}`;
    this.projectViewStatusItem.tooltip = tooltip;
    this.projectViewStatusItem.backgroundColor = hasErrors 
      ? new vscode.ThemeColor('statusBarItem.errorBackground')
      : undefined;
    
    this.projectViewStatusItem.show();
  }

  /**
   * Updates directory filter status item
   */
  private updateDirectoryFilterStatus(): void {
    if (!this.config.enabled || !this.config.showFilterRecommendations || !this.currentWorkspaceFolder) {
      this.directoryFilterStatusItem.hide();
      return;
    }

    const directoryFilter = this.directoryFilterService.getDirectoryFilter();
    const stats = directoryFilter.getFilteringStats(this.currentWorkspaceFolder);
    const recommendation = this.directoryFilterService.shouldRecommendFiltering(this.currentWorkspaceFolder);

    let status: DirectoryFilterStatus;
    let icon: string;
    let text: string;
    let tooltip: string;

    if (stats.enabled) {
      status = 'enabled';
      icon = '$(filter)';
      text = `Filter (${stats.estimatedReduction})`;
      tooltip = `Directory filtering enabled. Performance improvement: ${stats.estimatedReduction}. Click to configure.`;
    } else if (recommendation.recommended) {
      status = 'recommended';
      icon = '$(lightbulb)';
      text = 'Filter Recommended';
      tooltip = `Directory filtering could improve performance by ${recommendation.potentialBenefit}. Click to enable.`;
      // Highlight recommended items
      this.directoryFilterStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      status = 'disabled';
      icon = '$(filter-filled)';
      text = 'No Filter';
      tooltip = 'Directory filtering disabled. Click to configure.';
    }

    this.directoryFilterStatusItem.text = `${icon} ${text}`;
    this.directoryFilterStatusItem.tooltip = tooltip;
    
    // Only show if there's something actionable
    if (status === 'enabled' || status === 'recommended') {
      this.directoryFilterStatusItem.show();
    } else {
      this.directoryFilterStatusItem.hide();
    }
  }

  /**
   * Updates performance status item
   */
  private updatePerformanceStatus(): void {
    if (!this.config.enabled || !this.config.showPerformanceMetrics || !this.currentWorkspaceFolder) {
      this.performanceStatusItem.hide();
      return;
    }

    const directoryFilter = this.directoryFilterService.getDirectoryFilter();
    const stats = directoryFilter.getFilteringStats(this.currentWorkspaceFolder);
    const impact = this.directoryFilterService.getPerformanceImpact(this.currentWorkspaceFolder);
    const config = this.projectViewManager.getProjectViewConfig(this.currentWorkspaceFolder);

    // Only show performance status if filtering is enabled and has impact
    if (!stats.enabled || !config || stats.estimatedReduction === '0%') {
      this.performanceStatusItem.hide();
      return;
    }

    const targets = this.projectViewService.getTargetStats(this.currentWorkspaceFolder);
    
    this.performanceStatusItem.text = `$(pulse) ${targets.total} targets`;
    this.performanceStatusItem.tooltip = [
      'Project View Performance:',
      `• Targets: ${targets.total} (${targets.production} prod, ${targets.test} test)`,
      `• Memory reduction: ${impact.memoryReduction}`,
      `• Load time improvement: ${impact.loadTimeImprovement}`,
      `• File watch reduction: ${impact.fileWatchReduction}`,
      '',
      'Click for detailed statistics'
    ].join('\n');

    this.performanceStatusItem.show();
  }

  /**
   * Updates error status item
   */
  private updateErrorStatus(): void {
    if (!this.config.enabled || !this.currentWorkspaceFolder) {
      this.errorStatusItem.hide();
      return;
    }

    const hasErrors = this.projectViewManager.hasValidationErrors(this.currentWorkspaceFolder);
    
    if (!hasErrors) {
      this.errorStatusItem.hide();
      return;
    }

    const errors = this.projectViewManager.getValidationErrors(this.currentWorkspaceFolder);
    const errorCount = errors.length;

    this.errorStatusItem.text = `$(warning) ${errorCount} issue${errorCount > 1 ? 's' : ''}`;
    this.errorStatusItem.tooltip = [
      'Project View Issues:',
      ...errors.map(error => `• Line ${error.line}: ${error.message}`),
      '',
      'Click to open and fix'
    ].join('\n');
    this.errorStatusItem.command = 'bazel.openProjectViewFile';
    this.errorStatusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');

    this.errorStatusItem.show();
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Update on active editor change
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.updateAllStatusItems();
      })
    );

    // Update on workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.updateAllStatusItems();
      })
    );

    // Update on project view changes
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(() => {
        this.updateAllStatusItems();
      })
    );

    // Update on directory filter changes
    this.disposables.push(
      this.directoryFilterService.getDirectoryFilter().onDidChangeFilter(() => {
        this.updateAllStatusItems();
      })
    );

    // Update on configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('bazel')) {
          this.updateAllStatusItems();
        }
      })
    );

    // Update periodically for performance metrics
    const updateInterval = setInterval(() => {
      this.updatePerformanceStatus();
    }, 30000); // Every 30 seconds

    this.disposables.push({
      dispose: () => clearInterval(updateInterval)
    });
  }

  /**
   * Registers status bar commands
   */
  private registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand('bazel.toggleStatusBar', async () => {
        this.config.enabled = !this.config.enabled;
        await this.updateConfiguration();
        vscode.window.showInformationMessage(
          `Status bar indicators ${this.config.enabled ? 'enabled' : 'disabled'}`
        );
      }),

      vscode.commands.registerCommand('bazel.showProjectViewDashboard', async () => {
        await this.dashboard.show(this.currentWorkspaceFolder);
      })
    );
  }

  /**
   * Updates configuration
   */
  private async updateConfiguration(): Promise<void> {
    const vscodeConfig = vscode.workspace.getConfiguration('bazel.statusBar');
    await vscodeConfig.update('enabled', this.config.enabled, vscode.ConfigurationTarget.Global);
    
    if (this.config.enabled) {
      this.updateAllStatusItems();
    } else {
      this.hideAllStatusItems();
    }
  }

  /**
   * Hides all status bar items
   */
  private hideAllStatusItems(): void {
    this.projectViewStatusItem.hide();
    this.directoryFilterStatusItem.hide();
    this.performanceStatusItem.hide();
    this.errorStatusItem.hide();
  }

  /**
   * Loads configuration from VS Code settings
   */
  private loadConfiguration(): {
    enabled: boolean;
    showPerformanceMetrics: boolean;
    showFilterRecommendations: boolean;
  } {
    const config = vscode.workspace.getConfiguration('bazel.statusBar');
    
    return {
      enabled: config.get<boolean>('enabled', true),
      showPerformanceMetrics: config.get<boolean>('showPerformanceMetrics', true),
      showFilterRecommendations: config.get<boolean>('showFilterRecommendations', true)
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.disposables.forEach(d => d.dispose());
    
    this.projectViewStatusItem.dispose();
    this.directoryFilterStatusItem.dispose();
    this.performanceStatusItem.dispose();
    this.errorStatusItem.dispose();
  }
} 