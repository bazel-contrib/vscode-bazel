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
import { TargetResolver, BazelTarget, TargetResolutionResult, TargetResolutionConfig } from "./target_resolver";
import { ProjectViewConfig } from "./bazel_project_view";

/**
 * Event fired when targets are resolved
 */
export interface TargetResolutionEvent {
  /** The workspace folder where resolution occurred */
  workspaceFolder: vscode.WorkspaceFolder;
  /** The resolved targets */
  result: TargetResolutionResult;
  /** The project view configuration used */
  config: ProjectViewConfig;
}

/**
 * Comprehensive service for project view functionality including target resolution
 */
export class ProjectViewService implements vscode.Disposable {
  private static instance?: ProjectViewService;
  
  private disposables: vscode.Disposable[] = [];
  private projectViewManager: ProjectViewManager;
  private targetResolver: TargetResolver;
  
  private readonly onDidResolveTargetsEmitter = new vscode.EventEmitter<TargetResolutionEvent>();
  public readonly onDidResolveTargets = this.onDidResolveTargetsEmitter.event;

  private constructor() {
    this.projectViewManager = ProjectViewManager.getInstance();
    this.targetResolver = new TargetResolver();
    
    this.setupEventHandlers();
    this.registerCommands();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): ProjectViewService {
    if (!ProjectViewService.instance) {
      ProjectViewService.instance = new ProjectViewService();
    }
    return ProjectViewService.instance;
  }

  /**
   * Gets the project view manager
   */
  public getProjectViewManager(): ProjectViewManager {
    return this.projectViewManager;
  }

  /**
   * Gets the target resolver
   */
  public getTargetResolver(): TargetResolver {
    return this.targetResolver;
  }

  /**
   * Resolves all targets for a workspace folder based on its project view
   */
  public async resolveTargetsForWorkspace(
    workspaceFolder: vscode.WorkspaceFolder,
    options: Partial<TargetResolutionConfig> = {}
  ): Promise<TargetResolutionResult | undefined> {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      return undefined;
    }

    const result = await this.targetResolver.resolveTargets(workspaceFolder, config, options);
    
    // Fire event
    this.onDidResolveTargetsEmitter.fire({
      workspaceFolder,
      result,
      config
    });

    return result;
  }

  /**
   * Gets all production targets for a workspace
   */
  public async getProductionTargets(
    workspaceFolder: vscode.WorkspaceFolder,
    options: Partial<TargetResolutionConfig> = {}
  ): Promise<BazelTarget[]> {
    const result = await this.resolveTargetsForWorkspace(workspaceFolder, {
      ...options,
      includeTests: false
    });
    return result?.targets || [];
  }

  /**
   * Gets all test targets for a workspace
   */
  public async getTestTargets(
    workspaceFolder: vscode.WorkspaceFolder,
    options: Partial<TargetResolutionConfig> = {}
  ): Promise<BazelTarget[]> {
    const fullResult = await this.resolveTargetsForWorkspace(workspaceFolder, {
      ...options,
      includeTests: true
    });
    
    if (!fullResult) {
      return [];
    }

    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      return [];
    }

    const filtered = this.targetResolver.filterTestTargets(fullResult.targets, config);
    return filtered.test;
  }

  /**
   * Finds targets that match a pattern
   */
  public async findTargets(
    workspaceFolder: vscode.WorkspaceFolder,
    pattern: string,
    options: Partial<TargetResolutionConfig> = {}
  ): Promise<BazelTarget[]> {
    const result = await this.resolveTargetsForWorkspace(workspaceFolder, options);
    if (!result) {
      return [];
    }

    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return result.targets.filter(target => 
      regex.test(target.label) || 
      regex.test(target.name) || 
      regex.test(target.package)
    );
  }

  /**
   * Gets targets for a specific directory
   */
  public async getTargetsForDirectory(
    workspaceFolder: vscode.WorkspaceFolder,
    directoryPath: string,
    options: Partial<TargetResolutionConfig> = {}
  ): Promise<BazelTarget[]> {
    const result = await this.resolveTargetsForWorkspace(workspaceFolder, options);
    if (!result) {
      return [];
    }

    const normalizedPath = directoryPath.replace(/\\/g, '/');
    return result.targets.filter(target => 
      target.package === normalizedPath || 
      target.package.startsWith(normalizedPath + '/')
    );
  }

  /**
   * Checks if a file is covered by the project view
   */
  public isFileCovered(workspaceFolder: vscode.WorkspaceFolder, filePath: string): boolean {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      return false;
    }

    const relativePath = vscode.workspace.asRelativePath(filePath, false);
    const dirPath = relativePath.substring(0, relativePath.lastIndexOf('/'));

    // Check if directory is included
    const included = config.directories.some(dir => {
      if (dir.startsWith('-')) {
        return false;
      }
      const cleanDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
      return dirPath === cleanDir || dirPath.startsWith(cleanDir + '/');
    });

    if (!included) {
      return false;
    }

    // Check if directory is excluded
    const excluded = config.directories.some(dir => {
      if (!dir.startsWith('-')) {
        return false;
      }
      const cleanDir = dir.slice(1);
      const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
      return dirPath === normalizedDir || dirPath.startsWith(normalizedDir + '/');
    });

    return !excluded;
  }

  /**
   * Gets project view statistics
   */
  public async getProjectViewStats(workspaceFolder: vscode.WorkspaceFolder): Promise<{
    hasProjectView: boolean;
    explicitTargets: number;
    discoveredTargets: number;
    productionTargets: number;
    testTargets: number;
    scannedDirectories: number;
    errors: string[];
  }> {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      return {
        hasProjectView: false,
        explicitTargets: 0,
        discoveredTargets: 0,
        productionTargets: 0,
        testTargets: 0,
        scannedDirectories: 0,
        errors: []
      };
    }

    const result = await this.resolveTargetsForWorkspace(workspaceFolder);
    if (!result) {
      return {
        hasProjectView: true,
        explicitTargets: config.targets.length,
        discoveredTargets: 0,
        productionTargets: 0,
        testTargets: 0,
        scannedDirectories: 0,
        errors: []
      };
    }

    const filtered = this.targetResolver.filterTestTargets(result.targets, config);
    
    return {
      hasProjectView: true,
      explicitTargets: config.targets.length,
      discoveredTargets: result.targets.length - config.targets.length,
      productionTargets: filtered.production.length,
      testTargets: filtered.test.length,
      scannedDirectories: result.scannedDirectories.length,
      errors: result.errors
    };
  }

  /**
   * Refreshes target resolution for all workspaces
   */
  public async refreshTargetResolution(): Promise<void> {
    this.targetResolver.clearCache();
    
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    await Promise.all(
      vscode.workspace.workspaceFolders.map(folder => 
        this.resolveTargetsForWorkspace(folder)
      )
    );
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Listen for project view changes to trigger target resolution
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(async (event) => {
        if (event.config) {
          // Resolve targets for the changed workspace
          await this.resolveTargetsForWorkspace(event.workspaceFolder);
        }
      })
    );
  }

  /**
   * Registers VS Code commands
   */
  private registerCommands(): void {
    this.disposables.push(
      vscode.commands.registerCommand('bazel.resolveProjectViewTargets', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        try {
          const result = await this.resolveTargetsForWorkspace(workspaceFolder);
          if (result) {
            const stats = await this.getProjectViewStats(workspaceFolder);
            vscode.window.showInformationMessage(
              `Resolved ${result.targets.length} targets (${stats.productionTargets} production, ${stats.testTargets} test) from ${result.scannedDirectories.length} directories`
            );
          } else {
            vscode.window.showWarningMessage('No project view configuration found');
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to resolve targets: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }),

      vscode.commands.registerCommand('bazel.showProjectViewStats', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const stats = await this.getProjectViewStats(workspaceFolder);
        
        if (!stats.hasProjectView) {
          vscode.window.showInformationMessage('No project view configuration found');
          return;
        }

        const message = [
          `Project View Statistics:`,
          `• Explicit targets: ${stats.explicitTargets}`,
          `• Discovered targets: ${stats.discoveredTargets}`,
          `• Production targets: ${stats.productionTargets}`,
          `• Test targets: ${stats.testTargets}`,
          `• Scanned directories: ${stats.scannedDirectories}`,
          stats.errors.length > 0 ? `• Errors: ${stats.errors.length}` : null
        ].filter(Boolean).join('\n');

        vscode.window.showInformationMessage(message, { modal: false });
      }),

      vscode.commands.registerCommand('bazel.findProjectViewTargets', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const pattern = await vscode.window.showInputBox({
          prompt: 'Enter target search pattern (supports wildcards)',
          placeHolder: 'e.g., *_test, //app/*, main'
        });

        if (!pattern) {
          return;
        }

        try {
          const targets = await this.findTargets(workspaceFolder, pattern);
          
          if (targets.length === 0) {
            vscode.window.showInformationMessage(`No targets found matching pattern: ${pattern}`);
            return;
          }

          const items = targets.map(target => ({
            label: target.label,
            description: target.type,
            detail: target.package
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Select from ${targets.length} matching targets`
          });

          if (selected) {
            // Could integrate with build/run commands here
            vscode.window.showInformationMessage(`Selected target: ${selected.label}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to find targets: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      })
    );
  }

  /**
   * Gets target statistics for a workspace
   */
  public getTargetStats(workspaceFolder: vscode.WorkspaceFolder): {
    total: number;
    production: number;
    test: number;
  } {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      return { total: 0, production: 0, test: 0 };
    }

    // Get explicit targets
    const explicitTargets = this.targetResolver.getExplicitTargets(config);
    
    // For derived targets, we'll need to use cached resolution results
    // This is a simplified implementation - in practice you'd want to cache the resolution
    const filtered = this.targetResolver.filterTestTargets(explicitTargets, config);
    
    return {
      total: explicitTargets.length,
      production: filtered.production.length,
      test: filtered.test.length
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.onDidResolveTargetsEmitter.dispose();
    this.disposables.forEach(d => d.dispose());
    this.targetResolver.dispose();
  }
} 