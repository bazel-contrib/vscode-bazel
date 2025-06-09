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
import { ProjectViewConfig } from "./bazel_project_view";

/**
 * Represents a discovered Bazel target
 */
export interface BazelTarget {
  /** Full target label (e.g., "//app/main:binary") */
  label: string;
  /** Package path (e.g., "app/main") */
  package: string;
  /** Target name (e.g., "binary") */
  name: string;
  /** Target type (e.g., "cc_binary", "java_library") */
  type: string;
  /** Source location in BUILD file */
  location: {
    file: vscode.Uri;
    line: number;
    column: number;
  };
}

/**
 * Configuration for target resolution
 */
export interface TargetResolutionConfig {
  /** Maximum number of targets to discover */
  maxTargets: number;
  /** Timeout for target discovery operations (ms) */
  timeoutMs: number;
  /** Whether to include test targets */
  includeTests: boolean;
  /** Whether to include private targets (starting with _) */
  includePrivate: boolean;
}

/**
 * Result of target resolution operation
 */
export interface TargetResolutionResult {
  /** Discovered targets */
  targets: BazelTarget[];
  /** Directories that were scanned */
  scannedDirectories: string[];
  /** Any errors encountered during resolution */
  errors: string[];
  /** Whether the operation was truncated due to limits */
  truncated: boolean;
}

/**
 * Resolves and filters Bazel targets based on project view configuration
 */
export class TargetResolver implements vscode.Disposable {
  private cache = new Map<string, TargetResolutionResult>();
  private fileWatcher?: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.setupFileWatcher();
  }

  /**
   * Resolves targets for a project view configuration
   */
  public async resolveTargets(
    workspaceFolder: vscode.WorkspaceFolder,
    config: ProjectViewConfig,
    options: Partial<TargetResolutionConfig> = {}
  ): Promise<TargetResolutionResult> {
    const cacheKey = this.getCacheKey(workspaceFolder, config, options);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const resolvedConfig = this.getResolvedConfig(options);
    const result = await this.performTargetResolution(workspaceFolder, config, resolvedConfig);
    
    // Cache the result
    this.cache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Gets explicit targets from project view configuration
   */
  public getExplicitTargets(config: ProjectViewConfig): BazelTarget[] {
    return config.targets.map(label => this.parseTargetLabel(label));
  }

  /**
   * Discovers targets from directories when derive_targets_from_directories is enabled
   */
  public async discoverTargetsFromDirectories(
    workspaceFolder: vscode.WorkspaceFolder,
    config: ProjectViewConfig,
    options: TargetResolutionConfig
  ): Promise<TargetResolutionResult> {
    const result: TargetResolutionResult = {
      targets: [],
      scannedDirectories: [],
      errors: [],
      truncated: false
    };

    if (!config.derive_targets_from_directories) {
      return result;
    }

    const includedDirs = config.directories.filter(dir => !dir.startsWith('-'));
    const excludedDirs = config.directories
      .filter(dir => dir.startsWith('-'))
      .map(dir => dir.slice(1));

    for (const dirPattern of includedDirs) {
      if (result.targets.length >= options.maxTargets) {
        result.truncated = true;
        break;
      }

      try {
        const dirTargets = await this.scanDirectoryForTargets(
          workspaceFolder,
          dirPattern,
          excludedDirs,
          options
        );
        
        result.targets.push(...dirTargets.targets);
        result.scannedDirectories.push(...dirTargets.scannedDirectories);
        result.errors.push(...dirTargets.errors);
      } catch (error) {
        result.errors.push(`Failed to scan directory ${dirPattern}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Filters targets based on project view test_sources configuration
   */
  public filterTestTargets(targets: BazelTarget[], config: ProjectViewConfig): {
    production: BazelTarget[];
    test: BazelTarget[];
  } {
    const testPatterns = config.test_sources.map(pattern => 
      new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))
    );

    const production: BazelTarget[] = [];
    const test: BazelTarget[] = [];

    for (const target of targets) {
      const isTest = target.type.includes('test') || 
                    testPatterns.some(pattern => pattern.test(target.location.file.fsPath));
      
      if (isTest) {
        test.push(target);
      } else {
        production.push(target);
      }
    }

    return { production, test };
  }

  /**
   * Clears the resolution cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Sets up file system watcher to invalidate cache on BUILD file changes
   */
  private setupFileWatcher(): void {
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      '**/BUILD{,.bazel}',
      false, // don't ignore creates
      false, // don't ignore changes
      false  // don't ignore deletes
    );

    this.disposables.push(
      this.fileWatcher,
      this.fileWatcher.onDidCreate(() => this.clearCache()),
      this.fileWatcher.onDidChange(() => this.clearCache()),
      this.fileWatcher.onDidDelete(() => this.clearCache())
    );
  }

  /**
   * Performs the actual target resolution
   */
  private async performTargetResolution(
    workspaceFolder: vscode.WorkspaceFolder,
    config: ProjectViewConfig,
    options: TargetResolutionConfig
  ): Promise<TargetResolutionResult> {
    const result: TargetResolutionResult = {
      targets: [],
      scannedDirectories: [],
      errors: [],
      truncated: false
    };

    // Add explicit targets
    try {
      const explicitTargets = this.getExplicitTargets(config);
      result.targets.push(...explicitTargets);
    } catch (error) {
      result.errors.push(`Failed to parse explicit targets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Discover targets from directories if enabled
    if (config.derive_targets_from_directories) {
      const discoveredResult = await this.discoverTargetsFromDirectories(workspaceFolder, config, options);
      result.targets.push(...discoveredResult.targets);
      result.scannedDirectories.push(...discoveredResult.scannedDirectories);
      result.errors.push(...discoveredResult.errors);
      
      if (discoveredResult.truncated) {
        result.truncated = true;
      }
    }

    // Apply filtering
    if (!options.includeTests) {
      const filtered = this.filterTestTargets(result.targets, config);
      result.targets = filtered.production;
    }

    if (!options.includePrivate) {
      result.targets = result.targets.filter(target => !target.name.startsWith('_'));
    }

    // Deduplicate targets
    const uniqueTargets = new Map<string, BazelTarget>();
    for (const target of result.targets) {
      uniqueTargets.set(target.label, target);
    }
    result.targets = Array.from(uniqueTargets.values());

    return result;
  }

  /**
   * Scans a directory pattern for BUILD files and extracts targets
   */
  private async scanDirectoryForTargets(
    workspaceFolder: vscode.WorkspaceFolder,
    dirPattern: string,
    excludedDirs: string[],
    options: TargetResolutionConfig
  ): Promise<TargetResolutionResult> {
    const result: TargetResolutionResult = {
      targets: [],
      scannedDirectories: [],
      errors: [],
      truncated: false
    };

    // Find BUILD files in the directory pattern
    const cleanPattern = dirPattern.endsWith('/') ? dirPattern.slice(0, -1) : dirPattern;
    const buildFiles = await vscode.workspace.findFiles(
      `${cleanPattern}/**/BUILD{,.bazel}`,
      undefined,
      options.maxTargets * 2 // Allow some headroom
    );

    for (const buildFile of buildFiles) {
      const relativePath = vscode.workspace.asRelativePath(buildFile, false);
      const dirPath = path.dirname(relativePath);
      
      // Check if directory is excluded
      if (excludedDirs.some(excludedDir => 
        dirPath === excludedDir || dirPath.startsWith(excludedDir + '/')
      )) {
        continue;
      }

      result.scannedDirectories.push(dirPath);

      try {
        const fileTargets = await this.parseBuildFile(buildFile, workspaceFolder);
        result.targets.push(...fileTargets);
        
        if (result.targets.length >= options.maxTargets) {
          result.truncated = true;
          break;
        }
      } catch (error) {
        result.errors.push(`Failed to parse ${buildFile.fsPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Parses a BUILD file to extract target definitions
   */
  private async parseBuildFile(buildFile: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder): Promise<BazelTarget[]> {
    const content = await vscode.workspace.fs.readFile(buildFile);
    const text = Buffer.from(content).toString('utf8');
    const lines = text.split('\n');
    
    const targets: BazelTarget[] = [];
    const packagePath = this.getPackagePath(buildFile, workspaceFolder);
    
    // Simple regex-based parsing for common target patterns
    const targetRegex = /^(\w+)\s*\(\s*name\s*=\s*["']([^"']+)["']/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(targetRegex);
      
      if (match) {
        const [, type, name] = match;
        const label = `//${packagePath}:${name}`;
        
        targets.push({
          label,
          package: packagePath,
          name,
          type,
          location: {
            file: buildFile,
            line: i + 1,
            column: 0
          }
        });
      }
    }
    
    return targets;
  }

  /**
   * Parses a target label into its components
   */
  private parseTargetLabel(label: string): BazelTarget {
    const match = label.match(/^\/\/([^:]*):([^:]+)$/);
    if (!match) {
      throw new Error(`Invalid target label: ${label}`);
    }
    
    const [, packagePath, name] = match;
    
    return {
      label,
      package: packagePath,
      name,
      type: 'unknown', // Will be resolved later if needed
      location: {
        file: vscode.Uri.file(''), // Unknown location for explicit targets
        line: 0,
        column: 0
      }
    };
  }

  /**
   * Gets the package path for a BUILD file
   */
  private getPackagePath(buildFile: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder): string {
    const relativePath = vscode.workspace.asRelativePath(buildFile, false);
    const dirPath = path.dirname(relativePath);
    return dirPath === '.' ? '' : dirPath.replace(/\\/g, '/');
  }

  /**
   * Gets resolved configuration with defaults
   */
  private getResolvedConfig(options: Partial<TargetResolutionConfig>): TargetResolutionConfig {
    return {
      maxTargets: options.maxTargets ?? 1000,
      timeoutMs: options.timeoutMs ?? 30000,
      includeTests: options.includeTests ?? true,
      includePrivate: options.includePrivate ?? false
    };
  }

  /**
   * Generates a cache key for the given parameters
   */
  private getCacheKey(
    workspaceFolder: vscode.WorkspaceFolder,
    config: ProjectViewConfig,
    options: Partial<TargetResolutionConfig>
  ): string {
    return JSON.stringify({
      workspace: workspaceFolder.uri.toString(),
      config: {
        directories: config.directories.sort(),
        targets: config.targets.sort(),
        derive_targets_from_directories: config.derive_targets_from_directories,
        test_sources: config.test_sources.sort()
      },
      options
    });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.fileWatcher?.dispose();
    this.disposables.forEach(d => d.dispose());
    this.clearCache();
  }
} 