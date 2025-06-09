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
import * as fs from "fs";
import { BazelWorkspaceInfo } from "./bazel_workspace_info";
import { BazelQuery } from "./bazel_query";
import { getDefaultBazelExecutablePath } from "../extension/configuration";

/**
 * Cache entry for target resolution results.
 */
interface TargetCacheEntry {
  targets: string[];
  timestamp: number;
  buildFilePath: string;
}

/**
 * Options for target resolution.
 */
export interface TargetResolutionOptions {
  /** Whether to show disambiguation UI for multiple targets */
  showDisambiguationUI?: boolean;
  /** Maximum cache age in milliseconds */
  maxCacheAge?: number;
}

/**
 * Result of target resolution.
 */
export interface TargetResolutionResult {
  /** The primary target to build */
  primaryTarget: string | null;
  /** All possible targets for the file */
  allTargets: string[];
  /** Whether user disambiguation was required */
  wasDisambiguated: boolean;
  /** Error message if resolution failed */
  error?: string;
}

/**
 * Manages target resolution result caching.
 */
export class TargetCache {
  private cache: Map<string, TargetCacheEntry> = new Map();
  private readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Gets cached targets for a file.
   */
  public get(filePath: string, maxAge: number = this.DEFAULT_TTL_MS): TargetCacheEntry | null {
    const entry = this.cache.get(filePath);
    if (!entry) {
      return null;
    }

    // Check if cache entry is too old
    if (Date.now() - entry.timestamp > maxAge) {
      this.cache.delete(filePath);
      return null;
    }

    // Check if BUILD file has been modified since cache entry
    try {
      const buildFileStat = fs.statSync(entry.buildFilePath);
      if (buildFileStat.mtimeMs > entry.timestamp) {
        this.cache.delete(filePath);
        return null;
      }
    } catch (error) {
      // BUILD file might have been deleted
      this.cache.delete(filePath);
      return null;
    }

    return entry;
  }

  /**
   * Caches targets for a file.
   */
  public set(filePath: string, targets: string[], buildFilePath: string): void {
    this.cache.set(filePath, {
      targets,
      timestamp: Date.now(),
      buildFilePath
    });
  }

  /**
   * Clears the cache.
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Removes expired entries from the cache.
   */
  public cleanup(maxAge: number = this.DEFAULT_TTL_MS): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Resolves files to their corresponding Bazel targets.
 */
export class FileTargetResolver {
  private targetCache: TargetCache = new TargetCache();
  private readonly SUPPORTED_EXTENSIONS = new Set([
    '.java', '.kt', '.scala',
    '.ts', '.js', '.tsx', '.jsx',
    '.py', '.pyi',
    '.go',
    '.cc', '.cpp', '.cxx', '.c++', '.c', '.h', '.hpp', '.hxx', '.h++',
    '.rs',
    '.sh',
    '.proto',
    '.bzl'
  ]);

  /**
   * Resolves the primary target for the given file.
   */
  public async resolveTargetForFile(
    filePath: string, 
    workspaceInfo: BazelWorkspaceInfo,
    options: TargetResolutionOptions = {}
  ): Promise<TargetResolutionResult> {
    try {
      // Check if file is supported
      if (!this.isSupportedFile(filePath)) {
        return {
          primaryTarget: null,
          allTargets: [],
          wasDisambiguated: false,
          error: `Unsupported file type: ${path.extname(filePath)}`
        };
      }

      // Try cache first
      const cached = this.targetCache.get(filePath, options.maxCacheAge);
      if (cached) {
        return this.selectPrimaryTarget(cached.targets, options.showDisambiguationUI);
      }

      // Find containing BUILD file
      const buildFilePath = this.findContainingBuildFile(filePath, workspaceInfo.bazelWorkspacePath);
      if (!buildFilePath) {
        return {
          primaryTarget: null,
          allTargets: [],
          wasDisambiguated: false,
          error: "No BUILD file found for this file"
        };
      }

      // Query targets containing this file
      const targets = await this.queryTargetsForFile(filePath, workspaceInfo);
      
      // Cache the results
      this.targetCache.set(filePath, targets, buildFilePath);

      return this.selectPrimaryTarget(targets, options.showDisambiguationUI);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        primaryTarget: null,
        allTargets: [],
        wasDisambiguated: false,
        error: `Failed to resolve target: ${errorMessage}`
      };
    }
  }

  /**
   * Finds the BUILD file containing the given file.
   */
  public findContainingBuildFile(filePath: string, workspaceRoot: string): string | null {
    let currentDir = path.dirname(filePath);
    
    while (currentDir.startsWith(workspaceRoot)) {
      // Check for BUILD or BUILD.bazel
      const buildFile = path.join(currentDir, "BUILD");
      const buildBazelFile = path.join(currentDir, "BUILD.bazel");
      
      if (fs.existsSync(buildFile)) {
        return buildFile;
      }
      if (fs.existsSync(buildBazelFile)) {
        return buildBazelFile;
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break; // Reached filesystem root
      }
      currentDir = parentDir;
    }

    return null;
  }

  /**
   * Queries Bazel for targets containing the specified file.
   */
  private async queryTargetsForFile(filePath: string, workspaceInfo: BazelWorkspaceInfo): Promise<string[]> {
    // Make file path relative to workspace root
    const relativePath = path.relative(workspaceInfo.bazelWorkspacePath, filePath);
    
    // Use Bazel query to find targets containing this file
    const query = `attr(srcs, ${relativePath}, //...)`;
    
    const bazelQuery = new BazelQuery(
      getDefaultBazelExecutablePath(),
      workspaceInfo.bazelWorkspacePath
    );

    try {
      const queryResult = await bazelQuery.queryTargets(query);
      return queryResult.target.map(target => target.rule?.name || "").filter(name => name);
    } catch (error) {
      // If query fails, try to infer targets from BUILD file
      return this.inferTargetsFromBuildFile(filePath, workspaceInfo);
    }
  }

  /**
   * Infers possible targets from the BUILD file when query fails.
   */
  private inferTargetsFromBuildFile(filePath: string, workspaceInfo: BazelWorkspaceInfo): string[] {
    const buildFilePath = this.findContainingBuildFile(filePath, workspaceInfo.bazelWorkspacePath);
    if (!buildFilePath) {
      return [];
    }

    // Get package path relative to workspace
    const packagePath = path.relative(workspaceInfo.bazelWorkspacePath, path.dirname(buildFilePath));
    const packageLabel = packagePath ? `//${packagePath}` : "//";

    // For simple cases, assume common target patterns
    const fileName = path.basename(filePath, path.extname(filePath));
    const commonTargets = [
      `${packageLabel}:${fileName}`,
      `${packageLabel}:all`,
      `${packageLabel}:*`
    ];

    return commonTargets;
  }

  /**
   * Selects the primary target from a list of targets.
   */
  private async selectPrimaryTarget(
    targets: string[], 
    showUI: boolean = true
  ): Promise<TargetResolutionResult> {
    if (targets.length === 0) {
      return {
        primaryTarget: null,
        allTargets: [],
        wasDisambiguated: false,
        error: "No targets found for this file"
      };
    }

    if (targets.length === 1) {
      return {
        primaryTarget: targets[0],
        allTargets: targets,
        wasDisambiguated: false
      };
    }

    // Multiple targets found - disambiguate
    if (showUI) {
      const selectedTarget = await this.disambiguateTargets(targets);
      return {
        primaryTarget: selectedTarget,
        allTargets: targets,
        wasDisambiguated: true
      };
    } else {
      // Use the first target as default
      return {
        primaryTarget: targets[0],
        allTargets: targets,
        wasDisambiguated: false
      };
    }
  }

  /**
   * Shows UI for target disambiguation when multiple targets are found.
   */
  private async disambiguateTargets(targets: string[]): Promise<string | null> {
    const items = targets.map(target => ({
      label: target,
      description: "Bazel target"
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Multiple targets found. Select one to build:",
      canPickMany: false
    });

    return selected ? selected.label : null;
  }

  /**
   * Checks if the file type is supported for target resolution.
   */
  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.SUPPORTED_EXTENSIONS.has(ext);
  }

  /**
   * Provides a fallback mechanism for manual target selection.
   */
  public async manualTargetSelection(workspaceInfo: BazelWorkspaceInfo): Promise<string | null> {
    const input = await vscode.window.showInputBox({
      prompt: "Enter the Bazel target to build (e.g., //package:target)",
      placeHolder: "//package:target",
      validateInput: (value) => {
        if (!value.trim()) {
          return "Target cannot be empty";
        }
        if (!value.startsWith("//")) {
          return "Target must start with '//'";
        }
        return null;
      }
    });

    return input ? input.trim() : null;
  }

  /**
   * Clears the target resolution cache.
   */
  public clearCache(): void {
    this.targetCache.clear();
  }

  /**
   * Cleans up expired cache entries.
   */
  public cleanupCache(): void {
    this.targetCache.cleanup();
  }
} 