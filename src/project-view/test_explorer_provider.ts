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
import { TestDiscovery, TestCase, TestDiscoveryResult } from "./test_discovery";
import { ProjectViewManager } from "./project_view_manager";

/**
 * VS Code Test Explorer provider for Bazel tests
 */
export class TestExplorerProvider implements vscode.Disposable {
  private static instance?: TestExplorerProvider;
  
  private disposables: vscode.Disposable[] = [];
  private testDiscovery: TestDiscovery;
  private projectViewManager: ProjectViewManager;
  private testController: vscode.TestController;
  private testItemMap = new Map<string, vscode.TestItem>();

  private constructor() {
    this.testDiscovery = new TestDiscovery();
    this.projectViewManager = ProjectViewManager.getInstance();
    
    // Create the test controller
    this.testController = vscode.tests.createTestController(
      'bazel-project-view-tests',
      'Bazel Project View Tests'
    );
    
    this.setupTestController();
    this.setupEventHandlers();
  }

  /**
   * Gets the singleton instance
   */
  public static getInstance(): TestExplorerProvider {
    if (!TestExplorerProvider.instance) {
      TestExplorerProvider.instance = new TestExplorerProvider();
    }
    return TestExplorerProvider.instance;
  }

  /**
   * Gets the VS Code test controller
   */
  public getTestController(): vscode.TestController {
    return this.testController;
  }

  /**
   * Refreshes tests for all workspace folders
   */
  public async refreshTests(): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
      return;
    }

    // Clear existing tests
    this.testController.items.replace([]);
    this.testItemMap.clear();

    // Discover tests for each workspace folder
    for (const workspaceFolder of vscode.workspace.workspaceFolders) {
      await this.refreshTestsForWorkspace(workspaceFolder);
    }
  }

  /**
   * Refreshes tests for a specific workspace folder
   */
  public async refreshTestsForWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
    const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!projectViewConfig) {
      return;
    }

    try {
      const result = await this.testDiscovery.discoverTests(workspaceFolder);
      await this.updateTestItems(workspaceFolder, result);
    } catch (error) {
      console.error(`Failed to discover tests for ${workspaceFolder.name}:`, error);
    }
  }

  /**
   * Runs tests
   */
  public async runTests(
    request: vscode.TestRunRequest,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const run = this.testController.createTestRun(request);
    
    try {
      const testsToRun = this.getTestsToRun(request);
      
      for (const test of testsToRun) {
        if (cancellation.isCancellationRequested) {
          break;
        }
        
        await this.runSingleTest(test, run, cancellation);
      }
    } finally {
      run.end();
    }
  }

  /**
   * Sets up the test controller
   */
  private setupTestController(): void {
    this.testController.refreshHandler = async () => {
      await this.refreshTests();
    };

    this.testController.createRunProfile(
      'Run',
      vscode.TestRunProfileKind.Run,
      async (request, cancellation) => {
        await this.runTests(request, cancellation);
      },
      true
    );

    this.testController.createRunProfile(
      'Debug',
      vscode.TestRunProfileKind.Debug,
      async (request, cancellation) => {
        await this.debugTests(request, cancellation);
      },
      true
    );

    this.disposables.push(this.testController);
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Refresh tests when project view changes
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(async (event) => {
        await this.refreshTestsForWorkspace(event.workspaceFolder);
      })
    );

    // Refresh tests when test files change
    this.disposables.push(
      this.testDiscovery.onDidChangeTests(async (workspaceFolder) => {
        await this.refreshTestsForWorkspace(workspaceFolder);
      })
    );

    // Auto-refresh on file changes
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (workspaceFolder && this.isTestFile(document.uri)) {
          await this.refreshTestsForWorkspace(workspaceFolder);
        }
      })
    );
  }

  /**
   * Updates test items based on discovery results
   */
  private async updateTestItems(
    workspaceFolder: vscode.WorkspaceFolder,
    result: TestDiscoveryResult
  ): Promise<void> {
    // Create workspace folder item if it doesn't exist
    const workspaceId = `workspace:${workspaceFolder.name}`;
    let workspaceItem = this.testItemMap.get(workspaceId);
    
    if (!workspaceItem) {
      const existingItem = this.testController.items.get(workspaceId);
      if (existingItem) {
        workspaceItem = existingItem;
      } else {
        workspaceItem = this.testController.createTestItem(
          workspaceId,
          workspaceFolder.name,
          workspaceFolder.uri
        );
        this.testController.items.add(workspaceItem);
      }
      this.testItemMap.set(workspaceId, workspaceItem);
    }

    // Clear existing children
    workspaceItem.children.replace([]);

    // Add test suites first
    for (const suite of result.suites) {
      const suiteItem = this.createBazelTestItem(suite, workspaceItem);
      workspaceItem.children.add(suiteItem);
    }

    // Add individual tests
    for (const test of result.tests) {
      if (test.parentSuite) {
        // Find parent suite and add as child
        const parentItem = this.testItemMap.get(test.parentSuite);
        if (parentItem) {
          const testItem = this.createBazelTestItem(test, parentItem);
          parentItem.children.add(testItem);
        }
      } else {
        // Add directly to workspace
        const testItem = this.createBazelTestItem(test, workspaceItem);
        workspaceItem.children.add(testItem);
      }
    }

    // Show errors if any
    if (result.errors.length > 0) {
      const errorMessage = result.errors.join('\n');
      vscode.window.showWarningMessage(`Test discovery completed with errors:\n${errorMessage}`);
    }
  }

  /**
   * Creates a VS Code test item from a test case
   */
  private createBazelTestItem(testCase: TestCase, parent?: vscode.TestItem): vscode.TestItem {
    const item = this.testController.createTestItem(
      testCase.id,
      testCase.label,
      testCase.file
    );

    // Set range if line number is available
    if (testCase.line) {
      item.range = new vscode.Range(
        testCase.line - 1, 0,
        testCase.line - 1, 0
      );
    }

    // Set description
    item.description = `${testCase.framework} • ${testCase.target.label}`;

    // Store test case data
    this.testItemMap.set(testCase.id, item);

    return item;
  }

  /**
   * Gets tests to run from a request
   */
  private getTestsToRun(request: vscode.TestRunRequest): TestCase[] {
    const testsToRun: TestCase[] = [];

    if (request.include) {
      for (const testItem of request.include) {
        testsToRun.push(...this.getTestCasesFromItem(testItem));
      }
    } else {
      // Run all tests
      this.testController.items.forEach(item => {
        testsToRun.push(...this.getTestCasesFromItem(item));
      });
    }

    // Exclude specified tests
    if (request.exclude) {
      const excludeIds = new Set<string>();
      for (const testItem of request.exclude) {
        this.getTestCasesFromItem(testItem).forEach(tc => excludeIds.add(tc.id));
      }
      return testsToRun.filter(tc => !excludeIds.has(tc.id));
    }

    return testsToRun;
  }

  /**
   * Gets test cases from a test item (including children)
   */
  private getTestCasesFromItem(testItem: vscode.TestItem): TestCase[] {
    const testCases: TestCase[] = [];

    // Check if this item corresponds to a test case
    const testCaseId = testItem.id;
    // For simplicity, we'll need to store test cases separately or reconstruct them
    // This is a simplified approach - in practice you'd want better data management

    // Recursively get children
    testItem.children.forEach(child => {
      testCases.push(...this.getTestCasesFromItem(child));
    });

    return testCases;
  }

  /**
   * Runs a single test
   */
  private async runSingleTest(
    testCase: TestCase,
    run: vscode.TestRun,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const testItem = this.testItemMap.get(testCase.id);
    if (!testItem) {
      return;
    }

    run.started(testItem);

    try {
      // Build the Bazel command
      const bazelCmd = this.buildBazelTestCommand(testCase);
      
      // Execute the test
      const result = await this.executeBazelTest(bazelCmd, cancellation);
      
      if (result.success) {
        run.passed(testItem, result.duration);
      } else {
        const message = new vscode.TestMessage(result.output);
        if (result.location) {
          message.location = result.location;
        }
        run.failed(testItem, message, result.duration);
      }
    } catch (error) {
      const message = new vscode.TestMessage(
        `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      run.failed(testItem, message);
    }
  }

  /**
   * Debugs tests
   */
  private async debugTests(
    request: vscode.TestRunRequest,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const testsToDebug = this.getTestsToRun(request);
    
    if (testsToDebug.length === 0) {
      vscode.window.showInformationMessage('No tests selected for debugging');
      return;
    }

    // For debugging, we'll run one test at a time
    const testCase = testsToDebug[0];
    
    if (testsToDebug.length > 1) {
      vscode.window.showInformationMessage(
        `Debugging first test: ${testCase.label}. Other tests will be ignored.`
      );
    }

    try {
      const debugConfig = this.createDebugConfiguration(testCase);
      await vscode.debug.startDebugging(undefined, debugConfig);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to start debugging: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Builds a Bazel test command for a test case
   */
  private buildBazelTestCommand(testCase: TestCase): string[] {
    const cmd = ['bazel', 'test'];
    
    // Add target
    cmd.push(testCase.target.label);
    
    // Add test filter if not running entire target
    if (!testCase.isTestSuite) {
      switch (testCase.framework) {
        case 'junit':
          cmd.push(`--test_filter=${testCase.label}`);
          break;
        case 'pytest':
          cmd.push(`--test_filter=${testCase.label}`);
          break;
        case 'go_test':
          cmd.push(`--test_filter=^${testCase.label}$`);
          break;
        case 'jest':
          cmd.push(`--test_filter=${testCase.label}`);
          break;
        case 'gtest':
          const parts = testCase.id.split('::');
          if (parts.length >= 3) {
            const suiteName = parts[parts.length - 2];
            const testName = parts[parts.length - 1];
            cmd.push(`--test_filter=${suiteName}.${testName}`);
          }
          break;
      }
    }
    
    return cmd;
  }

  /**
   * Executes a Bazel test command
   */
  private async executeBazelTest(
    cmd: string[],
    cancellation: vscode.CancellationToken
  ): Promise<{
    success: boolean;
    output: string;
    duration?: number;
    location?: vscode.Location;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let output = '';
      
      // This is a simplified implementation
      // In practice, you'd want to use the existing Bazel infrastructure
      const process = require('child_process').spawn(cmd[0], cmd.slice(1), {
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      });

      process.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      process.stderr.on('data', (data: Buffer) => {
        output += data.toString();
      });

      process.on('close', (code: number) => {
        const duration = Date.now() - startTime;
        resolve({
          success: code === 0,
          output,
          duration
        });
      });

      process.on('error', (error: Error) => {
        resolve({
          success: false,
          output: `Process error: ${error.message}`
        });
      });

      // Handle cancellation
      cancellation.onCancellationRequested(() => {
        process.kill();
        resolve({
          success: false,
          output: 'Test execution cancelled'
        });
      });
    });
  }

  /**
   * Creates a debug configuration for a test case
   */
  private createDebugConfiguration(testCase: TestCase): vscode.DebugConfiguration {
    const bazelCmd = this.buildBazelTestCommand(testCase);
    
    // This would need to be customized based on the language and framework
    return {
      name: `Debug ${testCase.label}`,
      type: 'bazel-test',
      request: 'launch',
      target: testCase.target.label,
      testFilter: testCase.label,
      program: testCase.file.fsPath
    };
  }

  /**
   * Checks if a file is a test file
   */
  private isTestFile(uri: vscode.Uri): boolean {
    const fileName = uri.fsPath;
    return /[Tt]est|_test\.|\.test\.|\.spec\./.test(fileName);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.testDiscovery.dispose();
    this.testItemMap.clear();
  }
} 