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
import { TargetResolver, BazelTarget } from "./target_resolver";

/**
 * Represents a discovered test case
 */
export interface TestCase {
  /** Unique identifier for the test */
  id: string;
  /** Display name of the test */
  label: string;
  /** Bazel target containing this test */
  target: BazelTarget;
  /** Source file containing the test */
  file: vscode.Uri;
  /** Line number where test is defined */
  line?: number;
  /** Test framework (e.g., 'junit', 'pytest', 'go_test') */
  framework: string;
  /** Whether this is a test suite or individual test */
  isTestSuite: boolean;
  /** Parent test suite if this is an individual test */
  parentSuite?: string;
}

/**
 * Configuration for test discovery
 */
export interface TestDiscoveryConfig {
  /** Whether to discover individual test methods */
  discoverMethods: boolean;
  /** Maximum number of tests to discover */
  maxTests: number;
  /** Test frameworks to support */
  supportedFrameworks: string[];
  /** File extensions to scan for tests */
  testExtensions: string[];
  /** Patterns to identify test files */
  testFilePatterns: RegExp[];
}

/**
 * Result of test discovery operation
 */
export interface TestDiscoveryResult {
  /** Discovered test cases */
  tests: TestCase[];
  /** Test suites found */
  suites: TestCase[];
  /** Any errors during discovery */
  errors: string[];
  /** Whether discovery was truncated */
  truncated: boolean;
}

/**
 * Discovers and manages test cases based on project view configuration
 */
export class TestDiscovery implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private projectViewManager: ProjectViewManager;
  private targetResolver: TargetResolver;
  private discoveryCache = new Map<string, TestDiscoveryResult>();
  
  private readonly onDidChangeTestsEmitter = new vscode.EventEmitter<vscode.WorkspaceFolder>();
  public readonly onDidChangeTests = this.onDidChangeTestsEmitter.event;

  constructor() {
    this.projectViewManager = ProjectViewManager.getInstance();
    this.targetResolver = new TargetResolver();
    
    this.setupEventHandlers();
  }

  /**
   * Discovers all tests for a workspace based on project view configuration
   */
  public async discoverTests(
    workspaceFolder: vscode.WorkspaceFolder,
    config?: Partial<TestDiscoveryConfig>
  ): Promise<TestDiscoveryResult> {
    const cacheKey = this.getCacheKey(workspaceFolder, config);
    
    // Check cache first
    const cached = this.discoveryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const discoveryConfig = this.getResolvedConfig(config);
    const result = await this.performTestDiscovery(workspaceFolder, discoveryConfig);
    
    // Cache the result
    this.discoveryCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Discovers tests in a specific directory
   */
  public async discoverTestsInDirectory(
    workspaceFolder: vscode.WorkspaceFolder,
    directory: string,
    config?: Partial<TestDiscoveryConfig>
  ): Promise<TestDiscoveryResult> {
    const discoveryConfig = this.getResolvedConfig(config);
    
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    try {
      const directoryUri = vscode.Uri.joinPath(workspaceFolder.uri, directory);
      const files = await this.findTestFilesInDirectory(directoryUri, discoveryConfig);
      
      for (const file of files) {
        if (result.tests.length >= discoveryConfig.maxTests) {
          result.truncated = true;
          break;
        }

        try {
          const fileTests = await this.discoverTestsInFile(file, workspaceFolder, discoveryConfig);
          result.tests.push(...fileTests.tests);
          result.suites.push(...fileTests.suites);
          result.errors.push(...fileTests.errors);
        } catch (error) {
          result.errors.push(`Failed to discover tests in ${file.fsPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to scan directory ${directory}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Discovers tests in a specific file
   */
  public async discoverTestsInFile(
    file: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder,
    config?: Partial<TestDiscoveryConfig>
  ): Promise<TestDiscoveryResult> {
    const discoveryConfig = this.getResolvedConfig(config);
    
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    try {
      const document = await vscode.workspace.openTextDocument(file);
      const framework = this.detectTestFramework(file, document.getText());
      
      if (!framework) {
        return result;
      }

      const tests = await this.parseTestsFromDocument(document, framework, workspaceFolder, discoveryConfig);
      result.tests.push(...tests.tests);
      result.suites.push(...tests.suites);
    } catch (error) {
      result.errors.push(`Failed to parse tests from ${file.fsPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Gets all test targets from project view configuration
   */
  public async getTestTargets(workspaceFolder: vscode.WorkspaceFolder): Promise<BazelTarget[]> {
    const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!projectViewConfig) {
      return [];
    }

    try {
      const targetResult = await this.targetResolver.resolveTargets(workspaceFolder, projectViewConfig, {
        includeTests: true,
        includePrivate: false
      });

      return targetResult.targets.filter(target => 
        target.type.includes('test') || 
        target.label.includes('_test') ||
        target.label.includes('test_')
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Filters tests based on project view test_sources patterns
   */
  public filterTestsByProjectView(
    tests: TestCase[],
    workspaceFolder: vscode.WorkspaceFolder
  ): TestCase[] {
    const config = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!config || config.test_sources.length === 0) {
      return tests;
    }

    const testPatterns = config.test_sources.map(pattern => 
      new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))
    );

    return tests.filter(test => {
      const relativePath = vscode.workspace.asRelativePath(test.file, false);
      return testPatterns.some(pattern => pattern.test(relativePath));
    });
  }

  /**
   * Clears the discovery cache
   */
  public clearCache(): void {
    this.discoveryCache.clear();
    this.onDidChangeTestsEmitter.fire(vscode.workspace.workspaceFolders?.[0]!);
  }

  /**
   * Performs the actual test discovery
   */
  private async performTestDiscovery(
    workspaceFolder: vscode.WorkspaceFolder,
    config: TestDiscoveryConfig
  ): Promise<TestDiscoveryResult> {
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    const projectViewConfig = this.projectViewManager.getProjectViewConfig(workspaceFolder);
    if (!projectViewConfig) {
      result.errors.push('No project view configuration found');
      return result;
    }

    // Get directories to scan from project view
    const includedDirs = projectViewConfig.directories.filter(dir => !dir.startsWith('-'));
    
    for (const dir of includedDirs) {
      if (result.tests.length >= config.maxTests) {
        result.truncated = true;
        break;
      }

      const dirResult = await this.discoverTestsInDirectory(workspaceFolder, dir, config);
      result.tests.push(...dirResult.tests);
      result.suites.push(...dirResult.suites);
      result.errors.push(...dirResult.errors);
    }

    // Filter by test_sources patterns
    const filteredTests = this.filterTestsByProjectView(result.tests, workspaceFolder);
    const filteredSuites = this.filterTestsByProjectView(result.suites, workspaceFolder);

    return {
      tests: filteredTests,
      suites: filteredSuites,
      errors: result.errors,
      truncated: result.truncated
    };
  }

  /**
   * Finds test files in a directory
   */
  private async findTestFilesInDirectory(
    directory: vscode.Uri,
    config: TestDiscoveryConfig
  ): Promise<vscode.Uri[]> {
    const files: vscode.Uri[] = [];
    
    try {
      const entries = await vscode.workspace.fs.readDirectory(directory);
      
      for (const [name, type] of entries) {
        const entryUri = vscode.Uri.joinPath(directory, name);
        
        if (type === vscode.FileType.File) {
          const ext = path.extname(name);
          if (config.testExtensions.includes(ext)) {
            // Check if filename matches test patterns
            const isTestFile = config.testFilePatterns.some(pattern => pattern.test(name));
            if (isTestFile) {
              files.push(entryUri);
            }
          }
        } else if (type === vscode.FileType.Directory && !name.startsWith('.')) {
          // Recursively scan subdirectories
          const subFiles = await this.findTestFilesInDirectory(entryUri, config);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return files;
  }

  /**
   * Detects the test framework used in a file
   */
  private detectTestFramework(file: vscode.Uri, content: string): string | null {
    const ext = path.extname(file.fsPath);
    const fileName = path.basename(file.fsPath);
    
    // Java/Kotlin test detection
    if (['.java', '.kt'].includes(ext)) {
      if (content.includes('@Test') || content.includes('import org.junit')) {
        return 'junit';
      }
      if (content.includes('import org.testng')) {
        return 'testng';
      }
    }
    
    // Python test detection
    if (ext === '.py') {
      if (content.includes('import unittest') || content.includes('from unittest')) {
        return 'unittest';
      }
      if (content.includes('import pytest') || content.includes('def test_')) {
        return 'pytest';
      }
    }
    
    // Go test detection
    if (ext === '.go' && fileName.endsWith('_test.go')) {
      if (content.includes('import "testing"') || content.includes('func Test')) {
        return 'go_test';
      }
    }
    
    // TypeScript/JavaScript test detection
    if (['.ts', '.js'].includes(ext)) {
      if (content.includes('describe(') || content.includes('it(')) {
        return 'jest';
      }
    }
    
    // C++ test detection
    if (['.cc', '.cpp', '.cxx'].includes(ext)) {
      if (content.includes('#include "gtest/gtest.h"') || content.includes('TEST(')) {
        return 'gtest';
      }
    }
    
    return null;
  }

  /**
   * Parses tests from a document based on the detected framework
   */
  private async parseTestsFromDocument(
    document: vscode.TextDocument,
    framework: string,
    workspaceFolder: vscode.WorkspaceFolder,
    config: TestDiscoveryConfig
  ): Promise<TestDiscoveryResult> {
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    const content = document.getText();
    const lines = content.split('\n');
    
    // Find associated Bazel target
    const target = await this.findBazelTargetForFile(document.uri, workspaceFolder);
    if (!target) {
      result.errors.push(`No Bazel target found for ${document.uri.fsPath}`);
      return result;
    }

    switch (framework) {
      case 'junit':
        return this.parseJUnitTests(document, target, lines, config);
      case 'pytest':
        return this.parsePytestTests(document, target, lines, config);
      case 'go_test':
        return this.parseGoTests(document, target, lines, config);
      case 'jest':
        return this.parseJestTests(document, target, lines, config);
      case 'gtest':
        return this.parseGTestTests(document, target, lines, config);
      default:
        result.errors.push(`Unsupported test framework: ${framework}`);
        return result;
    }
  }

  /**
   * Finds the Bazel target associated with a file
   */
  private async findBazelTargetForFile(
    file: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<BazelTarget | null> {
    // This is a simplified implementation
    // In practice, you'd want to find the BUILD file in the same directory
    // and parse it to find the target that includes this file
    
    const relativePath = vscode.workspace.asRelativePath(file, false);
    const packagePath = path.dirname(relativePath);
    const fileName = path.basename(file.fsPath, path.extname(file.fsPath));
    
    // Create a mock target for now
    return {
      label: `//${packagePath}:${fileName}`,
      package: packagePath,
      name: fileName,
      type: 'test',
      location: {
        file: file,
        line: 1,
        column: 1
      }
    };
  }

  /**
   * Parses JUnit tests
   */
  private parseJUnitTests(
    document: vscode.TextDocument,
    target: BazelTarget,
    lines: string[],
    config: TestDiscoveryConfig
  ): TestDiscoveryResult {
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    let currentClass: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find class declaration
      const classMatch = line.match(/(?:public\s+)?class\s+(\w+)/);
      if (classMatch) {
        currentClass = classMatch[1];
        
        // Add as test suite
        result.suites.push({
          id: `${target.label}::${currentClass}`,
          label: currentClass,
          target: target,
          file: document.uri,
          line: i + 1,
          framework: 'junit',
          isTestSuite: true
        });
      }
      
      // Find test methods
      if (currentClass && line.includes('@Test')) {
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
        const methodMatch = nextLine.match(/(?:public\s+)?(?:void\s+)?(\w+)\s*\(/);
        
        if (methodMatch) {
          const methodName = methodMatch[1];
          result.tests.push({
            id: `${target.label}::${currentClass}::${methodName}`,
            label: methodName,
            target: target,
            file: document.uri,
            line: i + 2,
            framework: 'junit',
            isTestSuite: false,
            parentSuite: `${target.label}::${currentClass}`
          });
        }
      }
    }

    return result;
  }

  /**
   * Parses pytest tests
   */
  private parsePytestTests(
    document: vscode.TextDocument,
    target: BazelTarget,
    lines: string[],
    config: TestDiscoveryConfig
  ): TestDiscoveryResult {
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find test functions
      const testMatch = line.match(/def\s+(test_\w+)\s*\(/);
      if (testMatch) {
        const testName = testMatch[1];
        result.tests.push({
          id: `${target.label}::${testName}`,
          label: testName,
          target: target,
          file: document.uri,
          line: i + 1,
          framework: 'pytest',
          isTestSuite: false
        });
      }
    }

    return result;
  }

  /**
   * Parses Go tests
   */
  private parseGoTests(
    document: vscode.TextDocument,
    target: BazelTarget,
    lines: string[],
    config: TestDiscoveryConfig
  ): TestDiscoveryResult {
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find test functions
      const testMatch = line.match(/func\s+(Test\w+)\s*\(/);
      if (testMatch) {
        const testName = testMatch[1];
        result.tests.push({
          id: `${target.label}::${testName}`,
          label: testName,
          target: target,
          file: document.uri,
          line: i + 1,
          framework: 'go_test',
          isTestSuite: false
        });
      }
    }

    return result;
  }

  /**
   * Parses Jest tests
   */
  private parseJestTests(
    document: vscode.TextDocument,
    target: BazelTarget,
    lines: string[],
    config: TestDiscoveryConfig
  ): TestDiscoveryResult {
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    const suiteStack: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find describe blocks (test suites)
      const describeMatch = line.match(/describe\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (describeMatch) {
        const suiteName = describeMatch[1];
        const suiteId = `${target.label}::${suiteStack.join('::')}::${suiteName}`;
        
        result.suites.push({
          id: suiteId,
          label: suiteName,
          target: target,
          file: document.uri,
          line: i + 1,
          framework: 'jest',
          isTestSuite: true
        });
        
        suiteStack.push(suiteName);
      }
      
      // Find it blocks (individual tests)
      const itMatch = line.match(/it\s*\(\s*['"`]([^'"`]+)['"`]/);
      if (itMatch) {
        const testName = itMatch[1];
        result.tests.push({
          id: `${target.label}::${suiteStack.join('::')}::${testName}`,
          label: testName,
          target: target,
          file: document.uri,
          line: i + 1,
          framework: 'jest',
          isTestSuite: false,
          parentSuite: suiteStack.length > 0 ? `${target.label}::${suiteStack.join('::')}}` : undefined
        });
      }
    }

    return result;
  }

  /**
   * Parses Google Test (gtest) tests
   */
  private parseGTestTests(
    document: vscode.TextDocument,
    target: BazelTarget,
    lines: string[],
    config: TestDiscoveryConfig
  ): TestDiscoveryResult {
    const result: TestDiscoveryResult = {
      tests: [],
      suites: [],
      errors: [],
      truncated: false
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find TEST macros
      const testMatch = line.match(/TEST\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/);
      if (testMatch) {
        const suiteName = testMatch[1];
        const testName = testMatch[2];
        
        // Add suite if not already added
        const suiteId = `${target.label}::${suiteName}`;
        if (!result.suites.find(s => s.id === suiteId)) {
          result.suites.push({
            id: suiteId,
            label: suiteName,
            target: target,
            file: document.uri,
            line: i + 1,
            framework: 'gtest',
            isTestSuite: true
          });
        }
        
        // Add test
        result.tests.push({
          id: `${target.label}::${suiteName}::${testName}`,
          label: testName,
          target: target,
          file: document.uri,
          line: i + 1,
          framework: 'gtest',
          isTestSuite: false,
          parentSuite: suiteId
        });
      }
    }

    return result;
  }

  /**
   * Gets resolved configuration with defaults
   */
  private getResolvedConfig(config?: Partial<TestDiscoveryConfig>): TestDiscoveryConfig {
    return {
      discoverMethods: config?.discoverMethods ?? true,
      maxTests: config?.maxTests ?? 1000,
      supportedFrameworks: config?.supportedFrameworks ?? ['junit', 'pytest', 'go_test', 'jest', 'gtest'],
      testExtensions: config?.testExtensions ?? ['.java', '.py', '.go', '.ts', '.js', '.cc', '.cpp'],
      testFilePatterns: config?.testFilePatterns ?? [
        /.*[Tt]est.*\.(java|py|go|ts|js|cc|cpp)$/,
        /.*_test\.(java|py|go|ts|js|cc|cpp)$/,
        /test_.*\.py$/,
        /.*\.test\.(ts|js)$/,
        /.*\.spec\.(ts|js)$/
      ]
    };
  }

  /**
   * Generates cache key for discovery results
   */
  private getCacheKey(workspaceFolder: vscode.WorkspaceFolder, config?: Partial<TestDiscoveryConfig>): string {
    const configJson = JSON.stringify(config || {});
    return `${workspaceFolder.uri.toString()}:${configJson}`;
  }

  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Clear cache when project view changes
    this.disposables.push(
      this.projectViewManager.onDidChangeProjectView(() => {
        this.clearCache();
      })
    );

    // Clear cache when files change
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        const ext = path.extname(document.fileName);
        if (['.java', '.py', '.go', '.ts', '.js', '.cc', '.cpp'].includes(ext)) {
          this.clearCache();
        }
      })
    );
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.onDidChangeTestsEmitter.dispose();
    this.targetResolver.dispose();
    this.clearCache();
  }
} 