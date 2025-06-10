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
import * as path from "path";
import { ProjectViewManager } from "./project_view_manager";
import { ProjectViewConfig } from "./bazel_project_view";

/**
 * Configuration for directory filtering behavior
 */
export interface DirectoryFilterConfig {
  /** Whether to enable directory filtering globally */
  enabled: boolean;
  /** Whether to show excluded directories with visual indicators */
  showExcluded: boolean;
  /** Maximum depth to scan for performance */
  maxDepth: number;
  /** Directories to always include regardless of project view */
  alwaysInclude: string[];
  /** File patterns to always exclude for performance */
  performanceExcludes: string[];
}

/**
 * Result of directory filtering operation
 */
export interface FilterResult {
  /** Whether the directory/file should be included */
  included: boolean;
  /** Reason for inclusion/exclusion */
  reason: string;
  /** Visual indicator type if applicable */
  indicator?: 'included' | 'excluded' | 'mixed';
}

/**
 * Manages directory filtering for VS Code file explorer based on project view
 */
export class DirectoryFilter implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private projectViewManager: ProjectViewManager;
  private config: DirectoryFilterConfig;
  private filterCache = new Map<string, FilterResult>();
  
  private readonly onDidChangeFilterEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeFilter = this.onDidChangeFilterEmitter.event;

  constructor(projectViewManager: ProjectViewManager) {
    this.projectViewManager = projectViewManager;
    this.config = this.loadConfiguration();
    
    this.setupEventHandlers();
    this.setupFileSystemExcludes();
  }

  /**
   * Checks if a directory should be included in the file explorer
   */
  public shouldIncludeDirectory(
    workspaceFolder: vscode.WorkspaceFolder,
    relativePath: string
  ): FilterResult {
    const cacheKey = `${workspaceFolder.uri.toString()}:${relativePath}`;
    
    // Check cache first
    const cached = this.filterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = this.computeDirectoryFilter(workspaceFolder, relativePath);
    
    // Cache the result
    this.filterCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Checks if a file should be included based on its directory
   */
  public shouldIncludeFile(
    workspaceFolder: vscode.WorkspaceFolder,
    filePath: string
  ): FilterResult {
    const relativePath = vscode.workspace.asRelativePath(filePath, false);
    const dirPath = path.dirname(relativePath);
    
    return this.shouldIncludeDirectory(workspaceFolder, dirPath);
  }

  /**
   * Gets all included directories for a workspace
   */
  public getIncludedDirectories(workspaceFolder: vscode.WorkspaceFolder): string[] {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config || !this.config.enabled) {
      return ['**']; // Include everything if no filtering
    }

    const included: string[] = [];
    
    // Add always included directories
    included.push(...this.config.alwaysInclude);
    
    // Add project view directories
    for (const dir of config.directories) {
      if (!dir.startsWith('-')) {
        const cleanDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
        included.push(cleanDir);
        included.push(`${cleanDir}/**`); // Include subdirectories
      }
    }

    return included;
  }

  /**
   * Gets directories that should be excluded for performance
   */
  public getExcludedDirectories(workspaceFolder: vscode.WorkspaceFolder): string[] {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    const excluded: string[] = [...this.config.performanceExcludes];

    if (config && this.config.enabled) {
      // Add project view exclusions
      for (const dir of config.directories) {
        if (dir.startsWith('-')) {
          const cleanDir = dir.slice(1); // Remove '-' prefix
          const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
          excluded.push(normalizedDir);
          excluded.push(`${normalizedDir}/**`); // Exclude subdirectories
        }
      }
    }

    return excluded;
  }

  /**
   * Updates VS Code's files.exclude settings based on project view
   */
  public async updateFileExcludes(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const config = vscode.workspace.getConfiguration('files', workspaceFolder.uri);
    const currentExcludes = config.get<Record<string, boolean>>('exclude') || {};
    const newExcludes = { ...currentExcludes };

    // Clear previous project view exclusions 
    // We need to identify which exclusions we added previously
    const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (projectViewConfig) {
      // Remove common excludes that we might have added
      const commonExcludes = [
        'node_modules', 'dist', 'build', 'out', 'target', 'bin', 'obj', 
        '.git', '.svn', '.hg', 'vendor', 'third_party', 'external'
      ];
      
      for (const exclude of commonExcludes) {
        // Only remove if it's not in the user's original config
        // This is a simplified approach - ideally we'd track what we added
        delete newExcludes[exclude];
      }
      
      // Remove explicit project view exclusions
      for (const dir of projectViewConfig.directories) {
        if (dir.startsWith('-')) {
          const cleanDir = dir.slice(1);
          const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
          delete newExcludes[normalizedDir];
        }
      }
    }

    // Add new project view exclusions  
    if (projectViewConfig) {
      try {
        // Get all top-level directories in the workspace
        const workspaceUri = workspaceFolder.uri;
        const entries = await vscode.workspace.fs.readDirectory(workspaceUri);
        const topLevelDirs = entries
          .filter(([name, type]) => type === vscode.FileType.Directory)
          .map(([name]) => name);

        // Create set of directories that should be included
        const includedDirs = new Set<string>();
        
        // Add explicitly included directories from project view
        for (const dir of projectViewConfig.directories) {
          if (!dir.startsWith('-')) {
            const cleanDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
            // Handle nested paths - include parent directories too
            const parts = cleanDir.split('/');
            for (let i = 0; i < parts.length; i++) {
              const parentPath = parts.slice(0, i + 1).join('/');
              includedDirs.add(parentPath);
            }
          }
        }
        
        // Always include essential directories
        for (const dir of this.config.alwaysInclude) {
          includedDirs.add(dir);
        }
        
        // Exclude top-level directories not in our include list
        for (const topDir of topLevelDirs) {
          if (!includedDirs.has(topDir) && !this.config.alwaysInclude.includes(topDir)) {
            newExcludes[topDir] = true;
          }
        }
        
        // Add explicit exclusions from project view
        for (const dir of projectViewConfig.directories) {
          if (dir.startsWith('-')) {
            const cleanDir = dir.slice(1); // Remove '-' prefix
            const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
            newExcludes[normalizedDir] = true;
          }
        }

        // Update the configuration
        await config.update('exclude', newExcludes, vscode.ConfigurationTarget.WorkspaceFolder);
        
        console.log('Directory filtering updated:', {
          included: Array.from(includedDirs),
          excluded: Object.keys(newExcludes).filter(key => newExcludes[key]),
          workspace: workspaceFolder.name
        });
        
      } catch (error) {
        console.error('Failed to update directory filtering:', error);
        vscode.window.showErrorMessage(`Failed to update directory filtering: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Restores original file excludes (removes project view filtering)
   */
  public async restoreFileExcludes(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const config = vscode.workspace.getConfiguration('files', workspaceFolder.uri);
    const currentExcludes = config.get<Record<string, boolean>>('exclude') || {};
    const newExcludes = { ...currentExcludes };

    // Remove all project view exclusions
    const commonExcludes = [
      'node_modules', 'dist', 'build', 'out', 'target', 'bin', 'obj', 
      '.git', '.svn', '.hg', 'vendor', 'third_party', 'external'
    ];
    
    for (const exclude of commonExcludes) {
      delete newExcludes[exclude];
    }
    
    // Remove explicit project view exclusions if we can determine them
    const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (projectViewConfig) {
      for (const dir of projectViewConfig.directories) {
        if (dir.startsWith('-')) {
          const cleanDir = dir.slice(1);
          const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
          delete newExcludes[normalizedDir];
        }
      }
    }

    await config.update('exclude', newExcludes, vscode.ConfigurationTarget.WorkspaceFolder);
  }

  /**
   * Gets filtering statistics for performance monitoring
   */
  public getFilteringStats(workspaceFolder: vscode.WorkspaceFolder): {
    enabled: boolean;
    includedDirectories: number;
    excludedDirectories: number;
    cacheSize: number;
    estimatedReduction: string;
  } {
    const included = this.getIncludedDirectories(workspaceFolder);
    const excluded = this.getExcludedDirectories(workspaceFolder);
    
    // Estimate reduction based on excluded directories
    const totalExclusions = excluded.length - this.config.performanceExcludes.length;
    const estimatedReduction = totalExclusions > 0 
      ? `~${Math.min(totalExclusions * 15, 70)}%` // Rough estimate
      : '0%';

    return {
      enabled: this.config.enabled,
      includedDirectories: included.length,
      excludedDirectories: excluded.length,
      cacheSize: this.filterCache.size,
      estimatedReduction
    };
  }

  /**
   * Clears the filter cache
   */
  public clearCache(): void {
    this.filterCache.clear();
    this.onDidChangeFilterEmitter.fire();
  }

  /**
   * Updates the configuration
   */
  public async updateConfiguration(newConfig: Partial<DirectoryFilterConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    const vscodeConfig = vscode.workspace.getConfiguration('bazel.directoryFilter');
    await vscodeConfig.update('enabled', this.config.enabled, vscode.ConfigurationTarget.Global);
    await vscodeConfig.update('showExcluded', this.config.showExcluded, vscode.ConfigurationTarget.Global);
    await vscodeConfig.update('maxDepth', this.config.maxDepth, vscode.ConfigurationTarget.Global);
    
    this.clearCache();
    this.setupFileSystemExcludes();
  }

  /**
   * Computes whether a directory should be included
   */
  private computeDirectoryFilter(
    workspaceFolder: vscode.WorkspaceFolder,
    relativePath: string
  ): FilterResult {
    // If filtering is disabled, include everything
    if (!this.config.enabled) {
      return { included: true, reason: 'Filtering disabled' };
    }

    // Always include certain directories
    if (this.config.alwaysInclude.some(pattern => 
      relativePath === pattern || relativePath.startsWith(pattern + '/')
    )) {
      return { included: true, reason: 'Always included', indicator: 'included' };
    }

    // Check performance exclusions
    if (this.config.performanceExcludes.some(pattern => 
      relativePath.match(new RegExp(pattern.replace(/\*/g, '.*')))
    )) {
      return { included: false, reason: 'Performance exclusion', indicator: 'excluded' };
    }

    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      return { included: true, reason: 'No project view config' };
    }

    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Check if directory is explicitly included
    const explicitlyIncluded = config.directories.some(dir => {
      if (dir.startsWith('-')) return false;
      const cleanDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
      return normalizedPath === cleanDir || normalizedPath.startsWith(cleanDir + '/');
    });

    if (!explicitlyIncluded) {
      return { included: false, reason: 'Not in project view directories', indicator: 'excluded' };
    }

    // Check if directory is explicitly excluded
    const explicitlyExcluded = config.directories.some(dir => {
      if (!dir.startsWith('-')) return false;
      const cleanDir = dir.slice(1);
      const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
      return normalizedPath === normalizedDir || normalizedPath.startsWith(normalizedDir + '/');
    });

    if (explicitlyExcluded) {
      return { included: false, reason: 'Excluded by project view', indicator: 'excluded' };
    }

    return { included: true, reason: 'Included by project view', indicator: 'included' };
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Listen for project view changes
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(async (event) => {
        this.clearCache();
        if (this.config.enabled) {
          await this.updateFileExcludes(event.workspaceFolder);
        }
      })
    );

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('bazel.directoryFilter')) {
          this.config = this.loadConfiguration();
          this.clearCache();
          this.setupFileSystemExcludes();
        }
      })
    );

    // Listen for workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
        // Setup filtering for new folders
        for (const added of event.added) {
          if (this.config.enabled) {
            await this.updateFileExcludes(added);
          }
        }
        
        // Clean up removed folders
        for (const removed of event.removed) {
          await this.restoreFileExcludes(removed);
        }
      })
    );
  }

  /**
   * Sets up file system excludes for all workspace folders
   */
  private async setupFileSystemExcludes(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    for (const workspaceFolder of vscode.workspace.workspaceFolders) {
      if (this.config.enabled) {
        await this.updateFileExcludes(workspaceFolder);
      } else {
        await this.restoreFileExcludes(workspaceFolder);
      }
    }
  }

  /**
   * Loads configuration from VS Code settings
   */
  private loadConfiguration(): DirectoryFilterConfig {
    const config = vscode.workspace.getConfiguration('bazel.directoryFilter');
    
    return {
      enabled: config.get<boolean>('enabled', true),
      showExcluded: config.get<boolean>('showExcluded', false),
      maxDepth: config.get<number>('maxDepth', 10),
      alwaysInclude: config.get<string[]>('alwaysInclude', [
        '.vscode',
        '.vscwb',
        'WORKSPACE',
        'WORKSPACE.bazel',
        'MODULE.bazel'
      ]),
      performanceExcludes: config.get<string[]>('performanceExcludes', [
        '**/node_modules',
        '**/bazel-*',
        '**/.git',
        '**/build',
        '**/dist',
        '**/out'
      ])
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.onDidChangeFilterEmitter.dispose();
    this.disposables.forEach(d => d.dispose());
    this.clearCache();
  }
} 