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
 * Decoration states for BUILD files
 */
export enum BuildFileState {
  Default = "default",
  Included = "included", 
  Excluded = "excluded"
}

/**
 * Provides file decorations for BUILD files based on project view configuration
 */
export class BuildFileDecorator implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private disposables: vscode.Disposable[] = [];
  private projectViewManager: ProjectViewManager;

  constructor(projectViewManager: ProjectViewManager) {
    this.projectViewManager = projectViewManager;

    // Listen for project view changes
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(() => {
        this._onDidChangeFileDecorations.fire(undefined);
      })
    );
  }

  /**
   * Provides decoration for a file
   */
  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    if (!this.isBuildFile(uri)) {
      return undefined;
    }

    const state = this.getBuildFileState(uri);
    return this.createDecoration(state);
  }

  /**
   * Checks if a file is a BUILD file
   */
  private isBuildFile(uri: vscode.Uri): boolean {
    const fileName = path.basename(uri.fsPath);
    return fileName === 'BUILD' || fileName === 'BUILD.bazel';
  }

  /**
   * Determines the state of a BUILD file based on project view configuration
   */
  private getBuildFileState(uri: vscode.Uri): BuildFileState {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return BuildFileState.Default;
    }

    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config) {
      return BuildFileState.Default;
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, path.dirname(uri.fsPath));
    const normalizedPath = relativePath.replace(/\\/g, '/'); // Normalize path separators

    return this.isDirectoryIncluded(normalizedPath, config) 
      ? BuildFileState.Included 
      : BuildFileState.Excluded;
  }

  /**
   * Checks if a directory is included in the project view
   */
  private isDirectoryIncluded(dirPath: string, config: ProjectViewConfig): boolean {
    // Check if any included directory matches
    const included = config.directories.some(dir => {
      if (dir.startsWith('-')) {
        return false; // Skip exclusions in this pass
      }
      const cleanDir = dir.endsWith('/') ? dir.slice(0, -1) : dir;
      return dirPath === cleanDir || dirPath.startsWith(cleanDir + '/');
    });

    if (!included) {
      return false;
    }

    // Check if any exclusion matches
    const excluded = config.directories.some(dir => {
      if (!dir.startsWith('-')) {
        return false; // Skip inclusions in this pass
      }
      const cleanDir = dir.slice(1); // Remove the '-' prefix
      const normalizedDir = cleanDir.endsWith('/') ? cleanDir.slice(0, -1) : cleanDir;
      return dirPath === normalizedDir || dirPath.startsWith(normalizedDir + '/');
    });

    return !excluded;
  }

  /**
   * Creates a file decoration for the given state
   */
  private createDecoration(state: BuildFileState): vscode.FileDecoration {
    switch (state) {
      case BuildFileState.Included:
        return {
          badge: '✓',
          color: new vscode.ThemeColor('charts.green'),
          tooltip: 'BUILD file included in project view'
        };
      case BuildFileState.Excluded:
        return {
          badge: '✗',
          color: new vscode.ThemeColor('charts.red'),
          tooltip: 'BUILD file excluded from project view'
        };
      case BuildFileState.Default:
      default:
        return {
          badge: '⚙',
          color: new vscode.ThemeColor('charts.blue'),
          tooltip: 'BUILD file (no project view active)'
        };
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
    this.disposables.forEach(d => d.dispose());
  }
} 