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
import { DirectoryFilter, DirectoryFilterConfig } from "./directory_filter";
import { ProjectViewManager } from "./project_view_manager";

/**
 * Service that manages directory filtering and provides VS Code integration
 */
export class DirectoryFilterService implements vscode.Disposable {
  private static instance?: DirectoryFilterService;
  
  private disposables: vscode.Disposable[] = [];
  private directoryFilter: DirectoryFilter;
  private projectViewManager: ProjectViewManager;

  private constructor() {
    this.projectViewManager = ProjectViewManager.getInstance();
    this.directoryFilter = new DirectoryFilter(this.projectViewManager);
    
    this.registerCommands();
    this.setupEventHandlers();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): DirectoryFilterService {
    if (!DirectoryFilterService.instance) {
      DirectoryFilterService.instance = new DirectoryFilterService();
    }
    return DirectoryFilterService.instance;
  }

  /**
   * Gets the directory filter instance
   */
  public getDirectoryFilter(): DirectoryFilter {
    return this.directoryFilter;
  }

  /**
   * Enables directory filtering for all workspaces
   */
  public async enableDirectoryFiltering(): Promise<void> {
    await this.directoryFilter.updateConfiguration({ enabled: true });
    
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        await this.directoryFilter.updateFileExcludes(folder);
      }
    }
    
    vscode.window.showInformationMessage(
      'Directory filtering enabled. File explorer will now show only project view directories.'
    );
  }

  /**
   * Disables directory filtering for all workspaces
   */
  public async disableDirectoryFiltering(): Promise<void> {
    await this.directoryFilter.updateConfiguration({ enabled: false });
    
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        await this.directoryFilter.restoreFileExcludes(folder);
      }
    }
    
    vscode.window.showInformationMessage(
      'Directory filtering disabled. File explorer will show all directories.'
    );
  }

  /**
   * Shows directory filtering statistics
   */
  public async showDirectoryFilterStats(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    const stats = this.directoryFilter.getFilteringStats(workspaceFolder);
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);

    const message = [
      `Directory Filter Statistics:`,
      `• Status: ${stats.enabled ? 'Enabled' : 'Disabled'}`,
      `• Project View: ${config ? 'Active' : 'Not configured'}`,
      `• Included directories: ${stats.includedDirectories}`,
      `• Excluded directories: ${stats.excludedDirectories}`,
      `• Cache size: ${stats.cacheSize} entries`,
      `• Estimated performance improvement: ${stats.estimatedReduction}`,
      '',
      stats.enabled ? '💡 Tip: Directory filtering improves performance in large repositories' : '💡 Tip: Enable filtering to improve performance with project view'
    ].join('\n');

    await vscode.window.showInformationMessage(message, { modal: false });
  }

  /**
   * Refreshes directory filtering
   */
  public async refreshDirectoryFilter(): Promise<void> {
    this.directoryFilter.clearCache();
    
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        await this.directoryFilter.updateFileExcludes(folder);
      }
    }
    
    vscode.window.showInformationMessage('Directory filter refreshed');
  }

  /**
   * Configures directory filtering settings
   */
  public async configureDirectoryFiltering(): Promise<void> {
    const options = [
      { label: 'Enable filtering', description: 'Filter directories based on project view', action: 'enable' },
      { label: 'Disable filtering', description: 'Show all directories', action: 'disable' },
      { label: 'Toggle excluded visibility', description: 'Show/hide excluded directories with indicators', action: 'toggleExcluded' },
      { label: 'View statistics', description: 'Show current filtering statistics', action: 'stats' },
      { label: 'Refresh filter', description: 'Clear cache and refresh filtering', action: 'refresh' }
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select directory filtering action'
    });

    if (!selected) {
      return;
    }

    switch (selected.action) {
      case 'enable':
        await this.enableDirectoryFiltering();
        break;
      case 'disable':
        await this.disableDirectoryFiltering();
        break;
      case 'toggleExcluded':
        await this.toggleExcludedVisibility();
        break;
      case 'stats':
        await this.showDirectoryFilterStats();
        break;
      case 'refresh':
        await this.refreshDirectoryFilter();
        break;
    }
  }

  /**
   * Toggles visibility of excluded directories
   */
  private async toggleExcludedVisibility(): Promise<void> {
    const currentConfig = vscode.workspace.getConfiguration('bazel.directoryFilter');
    const currentValue = currentConfig.get<boolean>('showExcluded', false);
    
    await this.directoryFilter.updateConfiguration({ showExcluded: !currentValue });
    
    vscode.window.showInformationMessage(
      `Excluded directories will now be ${!currentValue ? 'shown with indicators' : 'hidden'}`
    );
  }

  /**
   * Gets performance impact estimation
   */
  public getPerformanceImpact(workspaceFolder: vscode.WorkspaceFolder): {
    memoryReduction: string;
    loadTimeImprovement: string;
    fileWatchReduction: string;
  } {
    const stats = this.directoryFilter.getFilteringStats(workspaceFolder);
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);

    if (!stats.enabled || !config) {
      return {
        memoryReduction: '0%',
        loadTimeImprovement: '0%',
        fileWatchReduction: '0%'
      };
    }

    // Estimate based on number of excluded directories
    const excludedCount = stats.excludedDirectories - 6; // Subtract default excludes
    const reductionPercent = Math.min(excludedCount * 10, 70); // Cap at 70%

    return {
      memoryReduction: `~${reductionPercent}%`,
      loadTimeImprovement: `~${Math.min(reductionPercent * 0.8, 50)}%`,
      fileWatchReduction: `~${reductionPercent}%`
    };
  }

  /**
   * Checks if directory filtering would benefit the workspace
   */
  public shouldRecommendFiltering(workspaceFolder: vscode.WorkspaceFolder): {
    recommended: boolean;
    reason: string;
    potentialBenefit: string;
  } {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    
    if (!config) {
      return {
        recommended: false,
        reason: 'No project view configuration found',
        potentialBenefit: '0%'
      };
    }

    const totalDirectories = config.directories.length;
    const excludedDirectories = config.directories.filter(d => d.startsWith('-')).length;
    
    if (excludedDirectories >= 3 || totalDirectories >= 10) {
      return {
        recommended: true,
        reason: `Project view has ${excludedDirectories} exclusions and ${totalDirectories} total directories`,
        potentialBenefit: `${Math.min(excludedDirectories * 15 + totalDirectories * 5, 70)}%`
      };
    }

    return {
      recommended: false,
      reason: 'Project view is relatively simple',
      potentialBenefit: '<10%'
    };
  }

  /**
   * Registers VS Code commands
   */
  private registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand('bazel.enableDirectoryFiltering', () => {
        return this.enableDirectoryFiltering();
      }),

      vscode.commands.registerCommand('bazel.disableDirectoryFiltering', () => {
        return this.disableDirectoryFiltering();
      }),

      vscode.commands.registerCommand('bazel.showDirectoryFilterStats', () => {
        return this.showDirectoryFilterStats();
      }),

      vscode.commands.registerCommand('bazel.refreshDirectoryFilter', () => {
        return this.refreshDirectoryFilter();
      }),

      vscode.commands.registerCommand('bazel.configureDirectoryFiltering', () => {
        return this.configureDirectoryFiltering();
      })
    );
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Listen for project view changes to show filtering recommendations
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(async (event) => {
        if (event.config) {
          const recommendation = this.shouldRecommendFiltering(event.workspaceFolder);
          
          if (recommendation.recommended && !this.directoryFilter.getFilteringStats(event.workspaceFolder).enabled) {
            const action = await vscode.window.showInformationMessage(
              `Directory filtering could improve performance by ${recommendation.potentialBenefit}. ${recommendation.reason}.`,
              'Enable Filtering',
              'Not Now'
            );
            
            if (action === 'Enable Filtering') {
              await this.enableDirectoryFiltering();
            }
          }
        }
      })
    );

    // Listen for directory filter changes
    this.disposables.push(
      this.directoryFilter.onDidChangeFilter(() => {
        // Could trigger UI updates here if needed
      })
    );
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.directoryFilter.dispose();
  }
} 