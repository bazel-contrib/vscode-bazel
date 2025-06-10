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
 * Cached workspace statistics for performance
 */
interface WorkspaceStats {
  totalDirectories: number;
  totalFiles: number;
  scannedAt: number;
  topLevelDirs: string[];
}

/**
 * High-performance directory filtering for VS Code file explorer based on project view
 */
export class DirectoryFilter implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private projectViewManager: ProjectViewManager;
  private config: DirectoryFilterConfig;
  private filterCache = new Map<string, FilterResult>();
  private workspaceStatsCache = new Map<string, WorkspaceStats>();
  private originalExcludes = new Map<string, Record<string, boolean>>();
  
  private readonly onDidChangeFilterEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeFilter = this.onDidChangeFilterEmitter.event;

  constructor(projectViewManager: ProjectViewManager) {
    this.projectViewManager = projectViewManager;
    this.config = this.loadConfiguration();
    
    this.setupEventHandlers();
  }

  /**
   * Checks if a directory should be included based on project view
   */
  public shouldIncludeDirectory(
    workspaceFolder: vscode.WorkspaceFolder,
    relativePath: string
  ): FilterResult {
    const cacheKey = `${workspaceFolder.uri.toString()}:${relativePath}`;
    
    if (this.filterCache.has(cacheKey)) {
      return this.filterCache.get(cacheKey)!;
    }

    const result = this.computeDirectoryFilter(workspaceFolder, relativePath);
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
   * Gets all included directories for a workspace (optimized for project view)
   */
  public getIncludedDirectories(workspaceFolder: vscode.WorkspaceFolder): string[] {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config || !this.config.enabled) {
      return ['**']; // Include everything if no filtering
    }

    // Handle "." special case - include everything (IntelliJ compatibility)
    if (config.directories.includes('.')) {
      return ['**'];
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
   * Gets directories that should be excluded for performance (cached)
   */
  public getExcludedDirectories(workspaceFolder: vscode.WorkspaceFolder): string[] {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    const excluded: string[] = [...this.config.performanceExcludes];

    if (config && this.config.enabled) {
      // Handle "." special case - no exclusions (include everything)
      if (config.directories.includes('.')) {
        return excluded; // Only performance exclusions
      }

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
   * High-performance file excludes update with instant feedback
   */
  public async updateFileExcludes(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    if (!this.config.enabled) {
      await this.restoreFileExcludes(workspaceFolder);
      return;
    }

    const startTime = Date.now();
    const config = vscode.workspace.getConfiguration('files', workspaceFolder.uri);
    const workspaceKey = workspaceFolder.uri.toString();

    // Store original excludes if not already stored
    if (!this.originalExcludes.has(workspaceKey)) {
      this.originalExcludes.set(workspaceKey, config.get<Record<string, boolean>>('exclude') || {});
    }

    const originalExcludes = this.originalExcludes.get(workspaceKey)!;
    const newExcludes = { ...originalExcludes };

    const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!projectViewConfig) {
      return;
    }

    try {
      // Handle "." special case - include everything (no additional exclusions)
      if (projectViewConfig.directories.includes('.')) {
        console.log('Project view includes "." - showing all directories');
        await config.update('exclude', originalExcludes, vscode.ConfigurationTarget.WorkspaceFolder);
        return;
      }

      // Get workspace stats (cached for performance)
      const stats = await this.getWorkspaceStats(workspaceFolder);
      
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
      
      // High-performance exclusion: only check top-level directories
      let excludedCount = 0;
      for (const topDir of stats.topLevelDirs) {
        if (!includedDirs.has(topDir) && !this.config.alwaysInclude.includes(topDir)) {
          newExcludes[topDir] = true;
          excludedCount++;
        }
      }
      
      // Add explicit exclusions from project view
      for (const dir of projectViewConfig.directories) {
        if (dir.startsWith('-')) {
          const cleanDir = dir.slice(1); // Remove '-' prefix
          const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
          newExcludes[normalizedDir] = true;
          excludedCount++;
        }
      }

      // Apply changes instantly (non-blocking)
      await config.update('exclude', newExcludes, vscode.ConfigurationTarget.WorkspaceFolder);
      
      const duration = Date.now() - startTime;
      console.log(`Directory filtering updated in ${duration}ms:`, {
        included: Array.from(includedDirs).length,
        excluded: excludedCount,
        total: stats.topLevelDirs.length,
        workspace: workspaceFolder.name
      });
      
    } catch (error) {
      console.error('Failed to update directory filtering:', error);
      vscode.window.showErrorMessage(`Failed to update directory filtering: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restores original file excludes (removes project view filtering)
   */
  public async restoreFileExcludes(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const workspaceKey = workspaceFolder.uri.toString();
    const originalExcludes = this.originalExcludes.get(workspaceKey);
    
    if (originalExcludes) {
      const config = vscode.workspace.getConfiguration('files', workspaceFolder.uri);
      await config.update('exclude', originalExcludes, vscode.ConfigurationTarget.WorkspaceFolder);
      console.log('Directory filtering disabled - restored original excludes');
    }
  }

  /**
   * Gets accurate filtering statistics with real workspace analysis
   */
  public getFilteringStats(workspaceFolder: vscode.WorkspaceFolder): {
    enabled: boolean;
    includedDirectories: number;
    excludedDirectories: number;
    cacheSize: number;
    estimatedReduction: string;
  } {
    const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    
    if (!this.config.enabled || !projectViewConfig) {
      return {
        enabled: false,
        includedDirectories: 0,
        excludedDirectories: 0,
        cacheSize: this.filterCache.size,
        estimatedReduction: '0%'
      };
    }

    // Handle "." special case
    if (projectViewConfig.directories.includes('.')) {
      return {
        enabled: true,
        includedDirectories: 0, // All directories
        excludedDirectories: 0,
        cacheSize: this.filterCache.size,
        estimatedReduction: '0%' // No filtering when "." is used
      };
    }

    // Get workspace stats for accurate calculation
    const stats = this.workspaceStatsCache.get(workspaceFolder.uri.toString());
    if (!stats) {
      return {
        enabled: true,
        includedDirectories: 0,
        excludedDirectories: 0,
        cacheSize: this.filterCache.size,
        estimatedReduction: 'Calculating...'
      };
    }

    // Calculate included directories
    const includedDirs = new Set<string>();
    for (const dir of projectViewConfig.directories) {
      if (!dir.startsWith('-')) {
        const cleanDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
        includedDirs.add(cleanDir);
      }
    }

    // Calculate excluded directories  
    let excludedCount = 0;
    for (const topDir of stats.topLevelDirs) {
      if (!includedDirs.has(topDir) && !this.config.alwaysInclude.includes(topDir)) {
        excludedCount++;
      }
    }

    // Add explicit exclusions
    const explicitExclusions = projectViewConfig.directories.filter(d => d.startsWith('-')).length;
    excludedCount += explicitExclusions;

    // Calculate accurate reduction percentage
    const totalTopLevel = stats.topLevelDirs.length;
    const reductionPercent = totalTopLevel > 0 ? Math.round((excludedCount / totalTopLevel) * 100) : 0;

    return {
      enabled: true,
      includedDirectories: includedDirs.size + this.config.alwaysInclude.length,
      excludedDirectories: excludedCount,
      cacheSize: this.filterCache.size,
      estimatedReduction: `${reductionPercent}%`
    };
  }

  /**
   * Gets cached workspace statistics for performance
   */
  private async getWorkspaceStats(workspaceFolder: vscode.WorkspaceFolder): Promise<WorkspaceStats> {
    const workspaceKey = workspaceFolder.uri.toString();
    const cached = this.workspaceStatsCache.get(workspaceKey);
    
    // Use cache if recent (within 5 minutes)
    if (cached && (Date.now() - cached.scannedAt) < 5 * 60 * 1000) {
      return cached;
    }

    // Quick scan of top-level directories only (for performance)
    const workspaceUri = workspaceFolder.uri;
    const entries = await vscode.workspace.fs.readDirectory(workspaceUri);
    const topLevelDirs = entries
      .filter(([name, type]) => type === vscode.FileType.Directory)
      .map(([name]) => name);

    const stats: WorkspaceStats = {
      totalDirectories: topLevelDirs.length, // Simplified - only top-level
      totalFiles: entries.filter(([, type]) => type === vscode.FileType.File).length,
      scannedAt: Date.now(),
      topLevelDirs
    };

    this.workspaceStatsCache.set(workspaceKey, stats);
    return stats;
  }

  /**
   * Clears all caches for fresh scanning
   */
  public clearCache(): void {
    this.filterCache.clear();
    this.workspaceStatsCache.clear();
    this.onDidChangeFilterEmitter.fire();
  }

  /**
   * Updates the configuration with performance optimizations
   */
  public async updateConfiguration(newConfig: Partial<DirectoryFilterConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    const vscodeConfig = vscode.workspace.getConfiguration('bazel.directoryFilter');
    await vscodeConfig.update('enabled', this.config.enabled, vscode.ConfigurationTarget.Global);
    await vscodeConfig.update('showExcluded', this.config.showExcluded, vscode.ConfigurationTarget.Global);
    await vscodeConfig.update('maxDepth', this.config.maxDepth, vscode.ConfigurationTarget.Global);
    
    this.clearCache();
    
    // Apply to all workspaces instantly
    if (vscode.workspace.workspaceFolders) {
      const promises = vscode.workspace.workspaceFolders.map(folder => 
        this.config.enabled ? this.updateFileExcludes(folder) : this.restoreFileExcludes(folder)
      );
      await Promise.all(promises);
    }
  }

  /**
   * Computes whether a directory should be included (with "." support)
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

    // Handle "." special case - include everything (IntelliJ compatibility)
    if (config.directories.includes('.')) {
      return { included: true, reason: 'Project view includes all (.)' };
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
   * Sets up event handlers with performance optimizations
   */
  private setupEventHandlers(): void {
    // Listen for project view changes (debounced for performance)
    let debounceTimer: NodeJS.Timeout | undefined;
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(async (event) => {
        // Clear existing timer
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        
        // Debounce updates for better performance
        debounceTimer = setTimeout(async () => {
          this.clearCache();
          if (this.config.enabled) {
            await this.updateFileExcludes(event.workspaceFolder);
          }
        }, 100); // 100ms debounce
      })
    );

    // Listen for configuration changes
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(async (event) => {
        if (event.affectsConfiguration('bazel.directoryFilter')) {
          this.config = this.loadConfiguration();
          this.clearCache();
          
          // Apply to all workspaces
          if (vscode.workspace.workspaceFolders) {
            const promises = vscode.workspace.workspaceFolders.map(folder => 
              this.config.enabled ? this.updateFileExcludes(folder) : this.restoreFileExcludes(folder)
            );
            await Promise.all(promises);
          }
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
          const workspaceKey = removed.uri.toString();
          this.originalExcludes.delete(workspaceKey);
          this.workspaceStatsCache.delete(workspaceKey);
        }
      })
    );
  }

  /**
   * Loads configuration from VS Code settings
   */
  private loadConfiguration(): DirectoryFilterConfig {
    const config = vscode.workspace.getConfiguration('bazel.directoryFilter');
    
    return {
      enabled: config.get('enabled', true),
      showExcluded: config.get('showExcluded', false),
      maxDepth: config.get('maxDepth', 10),
      alwaysInclude: config.get('alwaysInclude', [
        '.vscode',
        '.vscwb', 
        'WORKSPACE',
        'WORKSPACE.bazel',
        'MODULE.bazel'
      ]),
      performanceExcludes: config.get('performanceExcludes', [
        'node_modules/**',
        '.git/**',
        'bazel-*/**'
      ])
    };
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.filterCache.clear();
    this.workspaceStatsCache.clear();
    this.originalExcludes.clear();
  }
} 