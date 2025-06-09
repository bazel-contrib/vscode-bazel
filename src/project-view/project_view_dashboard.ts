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
import { ProjectViewService } from "./project_view_service";
import { DirectoryFilterService } from "./directory_filter_service";

/**
 * Creates and manages the Project View Dashboard webview
 */
export class ProjectViewDashboard implements vscode.Disposable {
  private static instance?: ProjectViewDashboard;
  private panel?: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private projectViewManager: ProjectViewManager;
  private projectViewService: ProjectViewService;
  private directoryFilterService: DirectoryFilterService;

  private constructor() {
    this.projectViewManager = ProjectViewManager.getInstance();
    this.projectViewService = ProjectViewService.getInstance();
    this.directoryFilterService = DirectoryFilterService.getInstance();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): ProjectViewDashboard {
    if (!ProjectViewDashboard.instance) {
      ProjectViewDashboard.instance = new ProjectViewDashboard();
    }
    return ProjectViewDashboard.instance;
  }

  /**
   * Shows the dashboard
   */
  public async show(workspaceFolder?: vscode.WorkspaceFolder): Promise<void> {
    const targetWorkspace = workspaceFolder || vscode.workspace.workspaceFolders?.[0];
    
    if (!targetWorkspace) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    if (this.panel) {
      this.panel.reveal();
      this.updateContent(targetWorkspace);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'bazelProjectViewDashboard',
      'Bazel Project View Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.setupWebviewMessageHandling();
    this.updateContent(targetWorkspace);

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.disposables);
  }

  /**
   * Updates the dashboard content
   */
  private async updateContent(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    if (!this.panel) return;

    const data = await this.gatherDashboardData(workspaceFolder);
    this.panel.webview.html = this.generateHtml(data);
  }

  /**
   * Gathers all data needed for the dashboard
   */
  private async gatherDashboardData(workspaceFolder: vscode.WorkspaceFolder): Promise<DashboardData> {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    const hasErrors = this.projectViewManager.hasValidationErrors(workspaceFolder);
    const errors = this.projectViewManager.getValidationErrors(workspaceFolder);
    
    const directoryFilter = this.directoryFilterService.getDirectoryFilter();
    const filterStats = directoryFilter.getFilteringStats(workspaceFolder);
    const filterRecommendation = this.directoryFilterService.shouldRecommendFiltering(workspaceFolder);
    const performanceImpact = this.directoryFilterService.getPerformanceImpact(workspaceFolder);
    
    const targetStats = config ? this.projectViewService.getTargetStats(workspaceFolder) : null;
    const hasProjectView = !!config;

    return {
      workspaceName: workspaceFolder.name,
      hasProjectView,
      config,
      hasErrors,
      errors,
      filterStats,
      filterRecommendation,
      performanceImpact,
      targetStats
    };
  }

  /**
   * Generates the HTML for the dashboard
   */
  private generateHtml(data: DashboardData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bazel Project View Dashboard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            line-height: 1.6;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
        }
        .header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .header h1 {
            margin: 0;
            color: var(--vscode-textLink-foreground);
        }
        .status-badge {
            margin-left: 15px;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .status-active {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-badge-foreground);
        }
        .status-error {
            background-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-badge-foreground);
        }
        .status-inactive {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
        }
        .card h3 {
            margin-top: 0;
            margin-bottom: 15px;
            color: var(--vscode-textLink-foreground);
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .stat-label {
            color: var(--vscode-descriptionForeground);
        }
        .stat-value {
            font-weight: bold;
        }
        .error-list {
            margin-top: 15px;
        }
        .error-item {
            background-color: var(--vscode-inputValidation-errorBackground);
            border-left: 3px solid var(--vscode-inputValidation-errorBorder);
            padding: 8px 12px;
            margin-bottom: 8px;
            border-radius: 0 4px 4px 0;
        }
        .actions {
            margin-top: 20px;
        }
        .action-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            margin-right: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .action-button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .action-button.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        .performance-chart {
            margin-top: 15px;
            padding: 15px;
            background-color: var(--vscode-textBlockQuote-background);
            border-radius: 4px;
        }
        .metric-bar {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .metric-label {
            width: 140px;
            font-size: 12px;
        }
        .metric-progress {
            flex: 1;
            height: 8px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 4px;
            margin: 0 10px;
            overflow: hidden;
        }
        .metric-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-foreground);
            border-radius: 4px;
        }
        .metric-value {
            font-size: 12px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .recommendation {
            background-color: var(--vscode-editorInfo-background);
            border-left: 3px solid var(--vscode-editorInfo-border);
            padding: 15px;
            margin: 15px 0;
            border-radius: 0 4px 4px 0;
        }
        .full-width {
            grid-column: 1 / -1;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Project View Dashboard</h1>
        <div class="status-badge ${data.hasProjectView ? (data.hasErrors ? 'status-error' : 'status-active') : 'status-inactive'}">
            ${data.hasProjectView ? (data.hasErrors ? 'ERRORS' : 'ACTIVE') : 'INACTIVE'}
        </div>
    </div>

    <div class="dashboard-grid">
        <!-- Project View Status -->
        <div class="card">
            <h3>📋 Project View Status</h3>
            ${data.hasProjectView ? `
                <div class="stat-item">
                    <span class="stat-label">Directories:</span>
                    <span class="stat-value">${data.config!.directories.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Explicit Targets:</span>
                    <span class="stat-value">${data.config!.targets.length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Derive Targets:</span>
                    <span class="stat-value">${data.config!.derive_targets_from_directories ? 'Yes' : 'No'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Test Sources:</span>
                    <span class="stat-value">${data.config!.test_sources.length} patterns</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Languages:</span>
                    <span class="stat-value">${data.config!.additional_languages.length}</span>
                </div>
            ` : `
                <p>No project view configured for <strong>${data.workspaceName}</strong></p>
                <p>Create a <code>.bazelproject</code> file to define your project scope.</p>
            `}
            
            ${data.hasErrors ? `
                <div class="error-list">
                    <h4>⚠️ Validation Errors:</h4>
                    ${data.errors.map(error => `
                        <div class="error-item">
                            Line ${error.line}: ${error.message}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="actions">
                ${data.hasProjectView ? `
                    <button class="action-button" onclick="openProjectView()">Edit Project View</button>
                    <button class="action-button secondary" onclick="refreshProjectView()">Refresh</button>
                ` : `
                    <button class="action-button" onclick="createProjectView()">Create Project View</button>
                `}
            </div>
        </div>

        <!-- Directory Filtering -->
        <div class="card">
            <h3>🔍 Directory Filtering</h3>
            <div class="stat-item">
                <span class="stat-label">Status:</span>
                <span class="stat-value">${data.filterStats.enabled ? '✅ Enabled' : '❌ Disabled'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Included Dirs:</span>
                <span class="stat-value">${data.filterStats.includedDirectories}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Excluded Dirs:</span>
                <span class="stat-value">${data.filterStats.excludedDirectories}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Performance Gain:</span>
                <span class="stat-value">${data.filterStats.estimatedReduction}</span>
            </div>
            
            ${data.filterRecommendation.recommended && !data.filterStats.enabled ? `
                <div class="recommendation">
                    <strong>💡 Recommendation:</strong> Enable directory filtering to improve performance by ${data.filterRecommendation.potentialBenefit}. ${data.filterRecommendation.reason}.
                </div>
            ` : ''}
            
            <div class="actions">
                ${data.filterStats.enabled ? `
                    <button class="action-button secondary" onclick="disableFiltering()">Disable Filtering</button>
                    <button class="action-button secondary" onclick="configureFiltering()">Configure</button>
                ` : `
                    <button class="action-button" onclick="enableFiltering()">Enable Filtering</button>
                `}
                <button class="action-button secondary" onclick="showFilterStats()">View Stats</button>
            </div>
        </div>

        <!-- Performance Metrics -->
        ${data.filterStats.enabled && data.targetStats ? `
        <div class="card full-width">
            <h3>📊 Performance Metrics</h3>
            <div class="performance-chart">
                <div class="metric-bar">
                    <span class="metric-label">Memory Reduction:</span>
                    <div class="metric-progress">
                        <div class="metric-fill" style="width: ${parseInt(data.performanceImpact.memoryReduction)}%"></div>
                    </div>
                    <span class="metric-value">${data.performanceImpact.memoryReduction}</span>
                </div>
                <div class="metric-bar">
                    <span class="metric-label">Load Time Improvement:</span>
                    <div class="metric-progress">
                        <div class="metric-fill" style="width: ${parseInt(data.performanceImpact.loadTimeImprovement)}%"></div>
                    </div>
                    <span class="metric-value">${data.performanceImpact.loadTimeImprovement}</span>
                </div>
                <div class="metric-bar">
                    <span class="metric-label">File Watch Reduction:</span>
                    <div class="metric-progress">
                        <div class="metric-fill" style="width: ${parseInt(data.performanceImpact.fileWatchReduction)}%"></div>
                    </div>
                    <span class="metric-value">${data.performanceImpact.fileWatchReduction}</span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px;">
                <div>
                    <div class="stat-item">
                        <span class="stat-label">Total Targets:</span>
                        <span class="stat-value">${data.targetStats.total}</span>
                    </div>
                </div>
                <div>
                    <div class="stat-item">
                        <span class="stat-label">Production:</span>
                        <span class="stat-value">${data.targetStats.production}</span>
                    </div>
                </div>
                <div>
                    <div class="stat-item">
                        <span class="stat-label">Test Targets:</span>
                        <span class="stat-value">${data.targetStats.test}</span>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function openProjectView() {
            vscode.postMessage({ command: 'openProjectView' });
        }
        
        function createProjectView() {
            vscode.postMessage({ command: 'createProjectView' });
        }
        
        function refreshProjectView() {
            vscode.postMessage({ command: 'refreshProjectView' });
        }
        
        function enableFiltering() {
            vscode.postMessage({ command: 'enableFiltering' });
        }
        
        function disableFiltering() {
            vscode.postMessage({ command: 'disableFiltering' });
        }
        
        function configureFiltering() {
            vscode.postMessage({ command: 'configureFiltering' });
        }
        
        function showFilterStats() {
            vscode.postMessage({ command: 'showFilterStats' });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Sets up webview message handling
   */
  private setupWebviewMessageHandling(): void {
    if (!this.panel) return;

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'openProjectView':
            await vscode.commands.executeCommand('bazel.openProjectViewFile');
            break;
          case 'createProjectView':
            await vscode.commands.executeCommand('bazel.createProjectViewFile');
            break;
          case 'refreshProjectView':
            await vscode.commands.executeCommand('bazel.refreshProjectView');
            break;
          case 'enableFiltering':
            await vscode.commands.executeCommand('bazel.enableDirectoryFiltering');
            break;
          case 'disableFiltering':
            await vscode.commands.executeCommand('bazel.disableDirectoryFiltering');
            break;
          case 'configureFiltering':
            await vscode.commands.executeCommand('bazel.configureDirectoryFiltering');
            break;
          case 'showFilterStats':
            await vscode.commands.executeCommand('bazel.showDirectoryFilterStats');
            break;
        }
      },
      undefined,
      this.disposables
    );
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.panel?.dispose();
  }
}

/**
 * Data structure for dashboard content
 */
interface DashboardData {
  workspaceName: string;
  hasProjectView: boolean;
  config?: any;
  hasErrors: boolean;
  errors: Array<{line: number, message: string}>;
  filterStats: any;
  filterRecommendation: any;
  performanceImpact: any;
  targetStats?: any;
} 