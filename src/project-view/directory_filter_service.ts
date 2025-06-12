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
    
    // Refresh explorer to show changes immediately
    await this.forceExplorerRefresh();
    
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
    
    // Refresh explorer to show changes immediately
    await this.forceExplorerRefresh();
    
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
    
    // Refresh explorer to show changes
    await this.forceExplorerRefresh();
    
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
      }),

      // Hook into VS Code's standard explorer refresh
      vscode.commands.registerCommand('bazel.refreshExplorerAndFiltering', async () => {
        // First refresh our directory filtering
        await this.refreshDirectoryFilter();
        
        // Then trigger standard explorer refresh
        await this.forceExplorerRefresh();
        
        vscode.window.showInformationMessage('Explorer and directory filtering refreshed');
      }),

      // Debug command to test directory filtering
      vscode.commands.registerCommand('bazel.debugDirectoryFiltering', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
        const stats = this.directoryFilter.getFilteringStats(workspaceFolder);
        
        const debugInfo = {
          hasProjectView: !!config,
          directories: config?.directories || [],
          filterEnabled: stats.enabled,
          includedDirCount: stats.includedDirectories,
          excludedDirCount: stats.excludedDirectories,
          currentFileExcludes: vscode.workspace.getConfiguration('files', workspaceFolder.uri).get('exclude')
        };

        console.log('Directory Filtering Debug Info:', debugInfo);
        
        const message = [
          'Directory Filtering Debug:',
          `• Project View: ${debugInfo.hasProjectView ? 'Active' : 'None'}`,
          `• Directories: [${debugInfo.directories.join(', ')}]`,
          `• Filter Enabled: ${debugInfo.filterEnabled}`,
          `• Included: ${debugInfo.includedDirCount}, Excluded: ${debugInfo.excludedDirCount}`,
          '',
          'Check console for full details.'
        ].join('\n');

        await vscode.window.showInformationMessage(message);
        
        // Force a refresh after debugging
        await this.forceExplorerRefresh();
      })
    );
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Listen for project view changes and sync directory filtering
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(async (event) => {
        if (event.config) {
          console.log('🔔 PROJECT VIEW CHANGE EVENT TRIGGERED');
          console.log('🔍 New directories config:', event.config.directories);
          console.log('🔍 Workspace:', event.workspaceFolder.name);
          
          // Clear cache to ensure fresh data
          this.directoryFilter.clearCache();
          
          // Only update filtering if it's currently enabled (don't auto-enable)
          const isCurrentlyEnabled = this.directoryFilter.getFilteringStats(event.workspaceFolder).enabled;
          console.log('🔍 Directory filtering currently enabled:', isCurrentlyEnabled);
          
          if (isCurrentlyEnabled) {
            console.log('🔄 Updating directory filtering...');
            // Update directory filtering to sync with new .bazelproject content
            await this.directoryFilter.updateFileExcludes(event.workspaceFolder);
            console.log('✅ Directory filtering synced with updated project view');
          } else {
            console.log('⚠️ Directory filtering not enabled, skipping sync');
          }
        } else {
          console.log('🔍 No project view config found in change event');
        }
      })
    );

    // Listen for directory filter changes
    this.disposables.push(
      this.directoryFilter.onDidChangeFilter(async () => {
        // Refresh explorer when filter changes
        await this.forceExplorerRefresh();
      })
    );

    // Listen for configuration changes to directory filter settings
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('bazel.directoryFilter') || 
            event.affectsConfiguration('files.exclude')) {
          console.log('Configuration changed, refreshing directory filter');
          await this.forceExplorerRefresh();
        }
      })
    );
  }

  /**
   * Forces VS Code file explorer to refresh using multiple methods
   */
  private async forceExplorerRefresh(): Promise<void> {
    try {
      console.log('Forcing VS Code explorer refresh...');
      
      // Method 1: Direct explorer refresh command
      await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
      
      // Method 2: Brief delay to let changes propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Method 3: Force tree view refresh
      await vscode.commands.executeCommand('workbench.view.explorer');
      
    } catch (error) {
      console.log('Standard refresh failed, trying alternative methods:', error);
      
      try {
        // Method 4: Force workspace folder refresh by toggling focus
        await vscode.commands.executeCommand('workbench.view.explorer');
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        
        // Method 5: Programmatically update workspace state
        await this.triggerWorkspaceRefresh();
        
      } catch (fallbackError) {
        console.log('All refresh methods failed:', fallbackError);
        
        // Last resort: Show user manual refresh instruction
        const action = await vscode.window.showWarningMessage(
          'Directory filtering updated but explorer may need manual refresh. Try reloading the window if needed.',
          'Reload Window',
          'Dismiss'
        );
        
        if (action === 'Reload Window') {
          await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      }
    }
  }

  /**
   * Triggers a programmatic workspace refresh
   */
  private async triggerWorkspaceRefresh(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    // Create a small delay to allow VS Code to process file exclude changes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    for (const workspaceFolder of vscode.workspace.workspaceFolders) {
      try {
        // Force VS Code to re-scan the workspace folder
        const dummyFile = vscode.Uri.joinPath(workspaceFolder.uri, '.vscode-refresh-temp');
        
        // Create and immediately delete a temp file to trigger workspace refresh
        await vscode.workspace.fs.writeFile(dummyFile, new Uint8Array());
        await vscode.workspace.fs.delete(dummyFile);
        
      } catch (error) {
        // Ignore errors from this fallback method
        console.log('Workspace refresh method failed for:', workspaceFolder.name, error);
      }
    }
  }

  /**
   * Refreshes VS Code file explorer to show directory changes
   * @deprecated Use forceExplorerRefresh instead
   */
  private async refreshExplorer(): Promise<void> {
    await this.forceExplorerRefresh();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.directoryFilter.dispose();
  }
} 