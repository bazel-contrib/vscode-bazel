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
import { BazelProjectView, ProjectViewConfig, ParseResult } from "./bazel_project_view";

/**
 * Event fired when project view configuration changes
 */
export interface ProjectViewChangeEvent {
  /** The workspace folder where the change occurred */
  workspaceFolder: vscode.WorkspaceFolder;
  /** The new project view configuration, or undefined if disabled/invalid */
  config?: ProjectViewConfig;
  /** Whether project view is currently active */
  isActive: boolean;
  /** Any errors in the current configuration */
  errors: readonly any[];
}

/**
 * Manages project view functionality across the extension
 * Coordinates between parsing, validation, and dependent features
 */
export class ProjectViewManager implements vscode.Disposable {
  private static instance?: ProjectViewManager;
  
  private readonly projectViews = new Map<string, BazelProjectView>();
  private readonly activeConfigs = new Map<string, ProjectViewConfig>();
  private readonly disposables: vscode.Disposable[] = [];
  
  private readonly onDidChangeProjectViewEmitter = new vscode.EventEmitter<ProjectViewChangeEvent>();
  public readonly onDidChangeProjectView = this.onDidChangeProjectViewEmitter.event;

  private constructor() {
    // Watch for workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(this.handleWorkspaceFoldersChange.bind(this))
    );
    
    // Initialize for existing workspace folders
    this.initializeWorkspaceFolders();
  }

  /**
   * Gets the singleton instance of ProjectViewManager
   */
  public static getInstance(): ProjectViewManager {
    if (!ProjectViewManager.instance) {
      ProjectViewManager.instance = new ProjectViewManager();
    }
    return ProjectViewManager.instance;
  }

  /**
   * Gets the active project view configuration for a workspace folder
   */
  public getProjectViewConfig(workspaceFolder: vscode.WorkspaceFolder): ProjectViewConfig | undefined {
    return this.activeConfigs.get(workspaceFolder.uri.toString());
  }

  /**
   * Checks if project view is active for a workspace folder
   */
  public isProjectViewActive(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.activeConfigs.has(workspaceFolder.uri.toString());
  }

  /**
   * Gets all workspace folders with active project views
   */
  public getActiveWorkspaceFolders(): vscode.WorkspaceFolder[] {
    return vscode.workspace.workspaceFolders?.filter(folder => 
      this.isProjectViewActive(folder)
    ) ?? [];
  }

  /**
   * Checks if any workspace has project view active
   */
  public hasAnyActiveProjectView(): boolean {
    return this.activeConfigs.size > 0;
  }

  /**
   * Refreshes project view configuration for a specific workspace folder
   */
  public async refreshProjectView(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const projectView = this.getOrCreateProjectView(workspaceFolder);
    const result = await projectView.loadFromWorkspace(workspaceFolder);
    this.handleProjectViewChange(workspaceFolder, result);
  }

  /**
   * Refreshes all project view configurations
   */
  public async refreshAllProjectViews(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    await Promise.all(
      vscode.workspace.workspaceFolders.map(folder => 
        this.refreshProjectView(folder)
      )
    );
  }

  /**
   * Clears cached data and forces refresh
   */
  public async clearCache(): Promise<void> {
    for (const projectView of Array.from(this.projectViews.values())) {
      projectView.clearCache();
    }
    await this.refreshAllProjectViews();
  }

  /**
   * Creates a project view file for a workspace folder
   */
  public async createProjectViewFile(
    workspaceFolder: vscode.WorkspaceFolder,
    template?: string
  ): Promise<vscode.Uri> {
    const projectViewPath = BazelProjectView.getProjectViewPath(workspaceFolder);
    
    // Create directory if it doesn't exist
    const dirPath = vscode.Uri.joinPath(workspaceFolder.uri, ".vscwb");
    try {
      await vscode.workspace.fs.createDirectory(dirPath);
    } catch {
      // Directory might already exist
    }

    // Create file with template content
    const defaultTemplate = this.getDefaultProjectViewTemplate();
    const content = template || defaultTemplate;
    const contentBytes = Buffer.from(content, 'utf8');
    
    await vscode.workspace.fs.writeFile(projectViewPath, contentBytes);
    
    // Refresh configuration after creation
    await this.refreshProjectView(workspaceFolder);
    
    return projectViewPath;
  }

  /**
   * Opens the project view file for editing
   */
  public async openProjectViewFile(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    let projectViewPath = BazelProjectView.getProjectViewPath(workspaceFolder);
    
    // Create file if it doesn't exist
    try {
      await vscode.workspace.fs.stat(projectViewPath);
    } catch {
      const action = await vscode.window.showInformationMessage(
        'Project view file does not exist. Would you like to create it?',
        'Create',
        'Cancel'
      );
      
      if (action === 'Create') {
        projectViewPath = await this.createProjectViewFile(workspaceFolder);
      } else {
        return;
      }
    }

    // Open the file
    const document = await vscode.workspace.openTextDocument(projectViewPath);
    await vscode.window.showTextDocument(document);
  }

  /**
   * Handles workspace folder changes
   */
  private handleWorkspaceFoldersChange(event: vscode.WorkspaceFoldersChangeEvent): void {
    // Clean up removed folders
    for (const removed of event.removed) {
      const key = removed.uri.toString();
      const projectView = this.projectViews.get(key);
      if (projectView) {
        projectView.dispose();
        this.projectViews.delete(key);
      }
      this.activeConfigs.delete(key);
    }

    // Initialize new folders
    for (const added of event.added) {
      this.initializeWorkspaceFolder(added);
    }
  }

  /**
   * Initializes all existing workspace folders
   */
  private initializeWorkspaceFolders(): void {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    for (const folder of vscode.workspace.workspaceFolders) {
      this.initializeWorkspaceFolder(folder);
    }
  }

  /**
   * Initializes project view for a single workspace folder
   */
  private async initializeWorkspaceFolder(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const projectView = this.getOrCreateProjectView(workspaceFolder);
    
    // Set up file watching
    projectView.watchFile(workspaceFolder, (result) => {
      this.handleProjectViewChange(workspaceFolder, result);
    });

    // Load initial configuration
    const result = await projectView.loadFromWorkspace(workspaceFolder);
    this.handleProjectViewChange(workspaceFolder, result);

    // Update context for activation
    await this.updateContext();
  }

  /**
   * Gets or creates a project view instance for a workspace folder
   */
  private getOrCreateProjectView(workspaceFolder: vscode.WorkspaceFolder): BazelProjectView {
    const key = workspaceFolder.uri.toString();
    let projectView = this.projectViews.get(key);
    
    if (!projectView) {
      projectView = new BazelProjectView(workspaceFolder);
      this.projectViews.set(key, projectView);
    }
    
    return projectView;
  }

  /**
   * Handles project view configuration changes
   */
  private handleProjectViewChange(workspaceFolder: vscode.WorkspaceFolder, result: ParseResult): void {
    const key = workspaceFolder.uri.toString();
    
    if (result.config) {
      this.activeConfigs.set(key, result.config);
    } else {
      this.activeConfigs.delete(key);
    }

    // Update VS Code context
    this.updateContext();

    // Fire change event
    this.onDidChangeProjectViewEmitter.fire({
      workspaceFolder,
      config: result.config,
      isActive: !!result.config,
      errors: result.errors
    });
  }

  /**
   * Updates VS Code context variables
   */
  private async updateContext(): Promise<void> {
    const hasProjectView = this.hasAnyActiveProjectView();
    await vscode.commands.executeCommand('setContext', 'bazel.hasProjectView', hasProjectView);
  }

  /**
   * Gets the default project view template
   */
  private getDefaultProjectViewTemplate(): string {
    return `# Bazel Project View Configuration
# See: https://ij.bazel.build/docs/project-views.html

directories:
  # Add directories to include in the project view
  # Use - prefix to exclude: -unwanted/directory
  
targets:
  # Explicit targets to build
  # //app/main:binary
  # //tests:all
  
derive_targets_from_directories: false

test_sources:
  # Glob patterns for test source files
  # tests/**/*_test.py
  # **/*_test.java
  
additional_languages:
  # Additional language support
  # typescript
  # python
`;
  }

  /**
   * Checks if a workspace has validation errors
   */
  public hasValidationErrors(workspaceFolder: vscode.WorkspaceFolder): boolean {
    const projectView = this.projectViews.get(workspaceFolder.uri.toString());
    return projectView ? projectView.hasValidationErrors() : false;
  }

  /**
   * Gets validation errors for a workspace
   */
  public getValidationErrors(workspaceFolder: vscode.WorkspaceFolder): Array<{line: number, message: string}> {
    const projectView = this.projectViews.get(workspaceFolder.uri.toString());
    return projectView ? projectView.getValidationErrors() : [];
  }

  /**
   * Disposes of all resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.projectViews.forEach(pv => pv.dispose());
    this.projectViews.clear();
    this.activeConfigs.clear();
    this.onDidChangeProjectViewEmitter.dispose();
    
    if (ProjectViewManager.instance === this) {
      ProjectViewManager.instance = undefined;
    }
  }
} 