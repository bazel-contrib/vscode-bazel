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

/**
 * Represents a parsed project view configuration
 */
export interface ProjectViewConfig {
  /** Directories to include in the project view */
  directories: string[];
  /** Explicit targets to build */
  targets: string[];
  /** Whether to derive targets from specified directories */
  derive_targets_from_directories: boolean;
  /** Glob patterns for test source files */
  test_sources: string[];
  /** Additional language support */
  additional_languages: string[];
}

/**
 * Represents a validation error with location information
 */
export interface ValidationError {
  /** Line number where the error occurred (1-based) */
  line: number;
  /** Column number where the error occurred (0-based) */
  column: number;
  /** Error message */
  message: string;
  /** Severity of the error */
  severity: vscode.DiagnosticSeverity;
  /** Suggested fix for the error */
  suggestedFix?: string;
}

/**
 * Result of parsing and validation operations
 */
export interface ParseResult {
  /** Parsed configuration, or undefined if parsing failed */
  config?: ProjectViewConfig;
  /** Array of validation errors */
  errors: ValidationError[];
}

/**
 * Core class for handling Bazel project view files (.bazelproject)
 * Provides parsing, validation, and file watching capabilities
 */
export class BazelProjectView implements vscode.Disposable {
  private static readonly PROJECT_VIEW_FILE = ".bazelproject";
  private static readonly PROJECT_VIEW_DIR = ".vscwb";
  
  private fileWatcher?: vscode.FileSystemWatcher;
  private diagnosticCollection: vscode.DiagnosticCollection;
  private disposables: vscode.Disposable[] = [];
  private cachedConfig?: ProjectViewConfig;
  private lastModified?: number;
  private validationErrors: Array<{line: number, message: string}> = [];

  constructor(private workspaceFolder: vscode.WorkspaceFolder) {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("bazelproject");
    this.disposables.push(this.diagnosticCollection);
  }

  /**
   * Finds the project view file in the current workspace
   */
  public static getProjectViewPath(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(
      workspaceFolder.uri,
      BazelProjectView.PROJECT_VIEW_DIR,
      BazelProjectView.PROJECT_VIEW_FILE
    );
  }

  /**
   * Checks if a project view file exists in the workspace
   */
  public static async hasProjectViewFile(workspaceFolder: vscode.WorkspaceFolder): Promise<boolean> {
    try {
      const projectViewPath = BazelProjectView.getProjectViewPath(workspaceFolder);
      await vscode.workspace.fs.stat(projectViewPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parses project view file content with Python-like syntax
   */
  public parse(content: string): ParseResult {
    const errors: ValidationError[] = [];
    const config: Partial<ProjectViewConfig> = {
      directories: [],
      targets: [],
      derive_targets_from_directories: false,
      test_sources: [],
      additional_languages: []
    };

    const lines = content.split('\n');
    let currentAttribute: string | null = null;
    let currentValue: any = null;
    let skipCurrentAttribute = false; // Flag to skip processing values for invalid attributes

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      
      try {
        const parseResult = this.parseLine(line, lineNumber, currentAttribute);
        
        if (parseResult.attribute) {
          // Save previous attribute if exists and valid
          if (currentAttribute && currentValue !== null && !skipCurrentAttribute) {
            this.setConfigValue(config, currentAttribute, currentValue);
          }
          
          // Set new current attribute
          currentAttribute = parseResult.attribute;
          currentValue = parseResult.value;
          skipCurrentAttribute = !!parseResult.error; // Skip if there's an error (unknown attribute)
          
          if (parseResult.error) {
            errors.push(parseResult.error);
          }
        } else if (parseResult.value !== null && parseResult.value !== undefined && currentAttribute && !skipCurrentAttribute) {
          // Continue building current attribute value (only if attribute is valid)
          if (Array.isArray(currentValue)) {
            currentValue.push(parseResult.value);
          } else if (Array.isArray(parseResult.value)) {
            currentValue = parseResult.value;
          } else {
            // Convert single value to array if needed
            currentValue = [parseResult.value];
          }
        } else if (parseResult.error && !skipCurrentAttribute) {
          // Only add syntax errors if we're not already skipping due to unknown attribute
          errors.push(parseResult.error);
        }
        // If skipCurrentAttribute is true, we silently ignore values under unknown attributes
      } catch (error) {
        errors.push({
          line: lineNumber,
          column: 0,
          message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: vscode.DiagnosticSeverity.Error
        });
      }
    }

    // Save final attribute if valid
    if (currentAttribute && currentValue !== null && !skipCurrentAttribute) {
      this.setConfigValue(config, currentAttribute, currentValue);
    }

    // Validate the final configuration
    const validationErrors = this.validateConfig(config as ProjectViewConfig);
    errors.push(...validationErrors);

    // Update the validation to also track errors
    this.validationErrors = validationErrors.map(error => ({
      line: error.line,
      message: error.message
    }));
    
    if (validationErrors.length > 0) {
      this.showValidationErrors(validationErrors);
      return {
        config: errors.some(e => e.severity === vscode.DiagnosticSeverity.Error) 
          ? undefined 
          : config as ProjectViewConfig,
        errors
      };
    }

    return {
      config: errors.some(e => e.severity === vscode.DiagnosticSeverity.Error) 
        ? undefined 
        : config as ProjectViewConfig,
      errors
    };
  }

  /**
   * Parses a single line of project view syntax
   */
  private parseLine(line: string, lineNumber: number, currentAttribute: string | null): {
    attribute?: string;
    value?: any;
    error?: ValidationError;
  } {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      return {};
    }

    // Check for indented value first (part of array)
    if (trimmed.startsWith('  ') || (trimmed.startsWith('-') && currentAttribute)) {
      let value = trimmed.replace(/^[\s]+/, '').trim(); // Remove leading spaces but preserve -
      if (value) {
        return { value };
      }
      return {}; // Empty indented line, skip
    }

    // Check for attribute definition (key:) - only if not indented and colon is not part of a target label
    if (trimmed.includes(':') && !trimmed.startsWith(' ')) {
      const colonIndex = trimmed.indexOf(':');
      const beforeColon = trimmed.substring(0, colonIndex).trim();
      
      // If it starts with // it's likely a Bazel target, not an attribute definition
      if (beforeColon.startsWith('//')) {
        // This is actually a value (target label), not an attribute definition
        return { value: trimmed };
      }
      
      const attribute = beforeColon;
      const valueStr = trimmed.substring(colonIndex + 1).trim();
      
      if (!this.isValidAttribute(attribute)) {
        return {
          attribute: attribute, // Still return attribute so parser knows we're starting a new section
          error: {
            line: lineNumber,
            column: 0,
            message: `Unknown attribute: ${attribute}`,
            severity: vscode.DiagnosticSeverity.Warning,
            suggestedFix: this.suggestAttributeName(attribute)
          }
        };
      }

      // Handle single-line value
      if (valueStr) {
        const value = this.parseValue(valueStr, attribute);
        return { attribute, value };
      } else {
        // Multi-line value starts next line
        return { attribute, value: [] };
      }
    }

    // If we get here, it might be a non-indented value (target label, directory, etc.)
    if (currentAttribute) {
      // Only allow non-indented values for certain attributes and if they look valid
      if (this.isValidNonIndentedValue(trimmed, currentAttribute)) {
        return { value: trimmed };
      } else {
        // This looks like invalid syntax - not properly indented and not a valid standalone value
        return {
          error: {
            line: lineNumber,
            column: 0,
            message: 'Invalid syntax. Expected attribute definition or indented value.',
            severity: vscode.DiagnosticSeverity.Error,
            suggestedFix: 'Use "attribute:" for definitions or "  value" for array items'
          }
        };
      }
    }

    // Invalid syntax
    return {
      error: {
        line: lineNumber,
        column: 0,
        message: 'Invalid syntax. Expected attribute definition or indented value.',
        severity: vscode.DiagnosticSeverity.Error,
        suggestedFix: 'Use "attribute:" for definitions or "  value" for array items'
      }
    };
  }

  /**
   * Parses attribute values based on their expected type
   */
  private parseValue(valueStr: string, attribute: string): any {
    switch (attribute) {
      case 'derive_targets_from_directories':
        return valueStr.toLowerCase() === 'true';
      case 'directories':
      case 'targets':
      case 'test_sources':
      case 'additional_languages':
        // Single value that will become array, or array notation
        if (valueStr.startsWith('[') && valueStr.endsWith(']')) {
          return valueStr.slice(1, -1).split(',').map(v => v.trim());
        }
        return [valueStr];
      default:
        return valueStr;
    }
  }

  /**
   * Sets a configuration value with proper type handling
   */
  private setConfigValue(config: Partial<ProjectViewConfig>, attribute: string, value: any): void {
    switch (attribute) {
      case 'directories':
        if (Array.isArray(value)) {
          config.directories = value.filter(v => v && typeof v === 'string');
        } else if (value && typeof value === 'string') {
          config.directories = [value];
        } else {
          config.directories = [];
        }
        break;
      case 'targets':
        if (Array.isArray(value)) {
          config.targets = value.filter(v => v && typeof v === 'string');
        } else if (value && typeof value === 'string') {
          config.targets = [value];
        } else {
          config.targets = [];
        }
        break;
      case 'derive_targets_from_directories':
        config.derive_targets_from_directories = Boolean(value);
        break;
      case 'test_sources':
        if (Array.isArray(value)) {
          config.test_sources = value.filter(v => v && typeof v === 'string');
        } else if (value && typeof value === 'string') {
          config.test_sources = [value];
        } else {
          config.test_sources = [];
        }
        break;
      case 'additional_languages':
        if (Array.isArray(value)) {
          config.additional_languages = value.filter(v => v && typeof v === 'string');
        } else if (value && typeof value === 'string') {
          config.additional_languages = [value];
        } else {
          config.additional_languages = [];
        }
        break;
    }
  }

  /**
   * Validates attribute names
   */
  private isValidAttribute(attribute: string): boolean {
    const validAttributes = [
      'directories',
      'targets', 
      'derive_targets_from_directories',
      'test_sources',
      'additional_languages'
    ];
    return validAttributes.includes(attribute);
  }

  /**
   * Suggests correct attribute name for typos
   */
  private suggestAttributeName(attribute: string): string {
    const validAttributes = [
      'directories',
      'targets', 
      'derive_targets_from_directories',
      'test_sources',
      'additional_languages'
    ];
    
    // Simple suggestion based on first few characters
    const suggestion = validAttributes.find(valid => 
      valid.startsWith(attribute.substring(0, 3)) ||
      attribute.startsWith(valid.substring(0, 3))
    );
    
    return suggestion ? `Did you mean "${suggestion}"?` : `Valid attributes: ${validAttributes.join(', ')}`;
  }

  /**
   * Validates the complete configuration
   */
  private validateConfig(config: ProjectViewConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate directory paths
    if (config.directories && config.directories.length > 0) {
      config.directories.forEach((dir, index) => {
        if (dir && dir.includes('..')) {
          errors.push({
            line: -1,
            column: 0,
            message: `Directory path cannot contain '..': ${dir}`,
            severity: vscode.DiagnosticSeverity.Error,
            suggestedFix: 'Use absolute paths relative to workspace root'
          });
        }
      });
    }

    // Validate target labels
    if (config.targets && config.targets.length > 0) {
      config.targets.forEach((target, index) => {
        if (target && !target.startsWith('//')) {
          errors.push({
            line: -1,
            column: 0,
            message: `Target must start with '//': ${target}`,
            severity: vscode.DiagnosticSeverity.Error,
            suggestedFix: `Did you mean "//${target}"?`
          });
        }
      });
    }

    // Validate additional languages
    if (config.additional_languages && config.additional_languages.length > 0) {
      const validLanguages = ['typescript', 'python', 'java', 'kotlin', 'scala', 'go', 'rust'];
      config.additional_languages.forEach((lang, index) => {
        if (lang && !validLanguages.includes(lang.toLowerCase())) {
          errors.push({
            line: -1,
            column: 0,
            message: `Unsupported language: ${lang}`,
            severity: vscode.DiagnosticSeverity.Warning,
            suggestedFix: `Supported languages: ${validLanguages.join(', ')}`
          });
        }
      });
    }

    return errors;
  }

  /**
   * Loads and parses the project view file from workspace
   */
  public async loadFromWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<ParseResult> {
    try {
      const projectViewPath = BazelProjectView.getProjectViewPath(workspaceFolder);
      const stat = await vscode.workspace.fs.stat(projectViewPath);
      
      // Check cache validity
      if (this.cachedConfig && this.lastModified === stat.mtime) {
        return { config: this.cachedConfig, errors: [] };
      }

      const content = await vscode.workspace.fs.readFile(projectViewPath);
      const contentStr = Buffer.from(content).toString('utf8');
      const result = this.parse(contentStr);
      
      // Cache successful parse results
      if (result.config) {
        this.cachedConfig = result.config;
        this.lastModified = stat.mtime;
      }

      // Update diagnostics
      this.updateDiagnostics(projectViewPath, result.errors);
      
      return result;
    } catch (error) {
      return {
        errors: [{
          line: 1,
          column: 0,
          message: `Failed to load project view file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: vscode.DiagnosticSeverity.Error
        }]
      };
    }
  }

  /**
   * Starts watching the project view file for changes
   */
  public watchFile(
    workspaceFolder: vscode.WorkspaceFolder,
    callback: (result: ParseResult) => void
  ): vscode.Disposable {
    const projectViewPath = BazelProjectView.getProjectViewPath(workspaceFolder);
    const pattern = new vscode.RelativePattern(workspaceFolder, `${BazelProjectView.PROJECT_VIEW_DIR}/${BazelProjectView.PROJECT_VIEW_FILE}`);
    
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);
    
    // Debounce file changes to avoid excessive parsing
    let debounceTimer: NodeJS.Timeout | undefined;
    const debouncedCallback = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(async () => {
        const result = await this.loadFromWorkspace(workspaceFolder);
        callback(result);
      }, 300);
    };

    this.fileWatcher.onDidChange(debouncedCallback);
    this.fileWatcher.onDidCreate(debouncedCallback);
    this.fileWatcher.onDidDelete(() => {
      this.cachedConfig = undefined;
      this.lastModified = undefined;
      this.diagnosticCollection.delete(projectViewPath);
      callback({ errors: [] });
    });

    this.disposables.push(this.fileWatcher);
    return this.fileWatcher;
  }

  /**
   * Updates VS Code diagnostics for the project view file
   */
  private updateDiagnostics(uri: vscode.Uri, errors: ValidationError[]): void {
    const diagnostics = errors.map(error => {
      const range = new vscode.Range(
        Math.max(0, error.line - 1),
        error.column,
        Math.max(0, error.line - 1),
        error.column + 10 // Approximate error range
      );
      
      const diagnostic = new vscode.Diagnostic(range, error.message, error.severity);
      diagnostic.source = "bazelproject";
      if (error.suggestedFix) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(uri, range),
            error.suggestedFix
          )
        ];
      }
      return diagnostic;
    });

    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Clears cached configuration and forces re-parsing
   */
  public clearCache(): void {
    this.cachedConfig = undefined;
    this.lastModified = undefined;
  }

  /**
   * Disposes of resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.fileWatcher?.dispose();
  }

  /**
   * Checks if a non-indented value is valid for the given attribute
   */
  private isValidNonIndentedValue(value: string, attribute: string): boolean {
    switch (attribute) {
      case 'targets':
        // Always allow target-like values - let the validation phase handle target format errors
        return true;
      case 'directories':
        // Directories should look like paths (contain / or be simple names), or special case "."
        return value === '.' || value.includes('/') || /^[a-zA-Z0-9_-]+\/?$/.test(value) || value.startsWith('-');
      case 'test_sources':
        // Test sources are typically glob patterns
        return value.includes('*') || value.includes('/') || /\.(py|java|ts|js|cpp|h)$/.test(value);
      case 'additional_languages':
        // Languages should be simple identifiers
        return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(value);
      case 'derive_targets_from_directories':
        // Boolean values
        return value === 'true' || value === 'false';
      default:
        return false;
    }
  }

  /**
   * Checks if there are validation errors
   */
  public hasValidationErrors(): boolean {
    return this.validationErrors.length > 0;
  }

  /**
   * Gets all validation errors
   */
  public getValidationErrors(): Array<{line: number, message: string}> {
    return [...this.validationErrors];
  }

  /**
   * Shows validation errors in a VS Code notification
   */
  private showValidationErrors(errors: ValidationError[]): void {
    const errorMessages = errors.map(error => error.message).join('\n');
    vscode.window.showErrorMessage(`Validation errors:\n${errorMessages}`);
  }
} 