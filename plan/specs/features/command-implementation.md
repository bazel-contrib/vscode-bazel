# Command Implementation Specification

## Purpose & Scope

This specification covers the implementation of project view file management commands and UI integration features. It includes command handlers for opening project view files, file creation logic, syntax highlighting, language server features, and user experience enhancements for project view file editing.

## Technical Requirements

- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** VS Code Command APIs, extension metadata infrastructure, file system APIs
- **Performance Requirements:** Command execution <200ms, syntax highlighting <100ms
- **Security Considerations:** Validate file paths and prevent unauthorized file system access

## Implementation Tasks

### Command Handler Implementation
- [ ] Implement `bazel.openProjectViewFile` command handler
- [ ] Add command registration in extension activation
- [ ] Create file opening logic with proper error handling
- [ ] Implement workspace-relative path resolution
- [ ] Add command parameter validation and sanitization

### File Creation Logic
- [ ] Add file creation logic if `.vscwb/.bazelproject` doesn't exist
- [ ] Create directory structure (`/.vscwb/`) if missing
- [ ] Implement template-based file creation with default content
- [ ] Add user confirmation for file creation
- [ ] Handle file creation errors and permissions issues

### Syntax Highlighting Implementation
- [ ] Create TextMate grammar for `.bazelproject` files
- [ ] Define syntax patterns for project view attributes
- [ ] Add syntax highlighting for comments (`#` prefix)
- [ ] Implement indentation pattern recognition (2-space)
- [ ] Add syntax highlighting for attribute values and arrays

### Language Server Features
- [ ] Implement language server provider for `.bazelproject` files
- [ ] Add auto-completion for valid attribute names
- [ ] Create value completion for attribute types (boolean, enum)
- [ ] Implement hover information for attributes
- [ ] Add signature help for attribute syntax

### Validation Integration
- [ ] Create diagnostic provider for real-time validation
- [ ] Implement error squiggles for syntax and validation issues
- [ ] Add quick fixes for common project view configuration errors
- [ ] Create code actions for attribute correction
- [ ] Implement validation on save with immediate feedback

### Template and Snippet Support
- [ ] Create project view configuration templates
- [ ] Add snippet support for common attribute patterns
- [ ] Implement intelligent defaults based on workspace structure
- [ ] Create scaffolding for different project types
- [ ] Add snippet completion in Command Palette

## Dependencies

**Requires completion of:**
- [ ] infrastructure/extension-metadata.md

**Enables:**
- [ ] None (can run in parallel with other features)

## Acceptance Criteria

- [ ] Command opens project view file correctly from all entry points
- [ ] File creation works with proper directory structure and templates
- [ ] Syntax highlighting displays correctly for project view syntax
- [ ] Auto-completion suggests valid attribute names and values
- [ ] Error reporting provides actionable feedback with quick fixes
- [ ] Command execution meets performance requirements
- [ ] File creation handles edge cases (permissions, existing files)
- [ ] Language features work consistently across VS Code versions

## Testing Requirements

### Unit Tests
- [ ] Test command handler registration and execution
- [ ] Test file creation logic with various scenarios
- [ ] Test syntax highlighting patterns with different file content
- [ ] Test auto-completion provider with various cursor positions
- [ ] Test validation integration and error reporting
- [ ] Test snippet expansion and template creation

### Integration Tests
- [ ] Test complete command workflow from menu to file opening
- [ ] Test file creation from non-existent to fully functional
- [ ] Test language server features with real project view files
- [ ] Test quick fixes and code actions
- [ ] Test syntax highlighting across different VS Code themes
- [ ] Test command execution from different contexts (palette, menu, shortcut)

### User Experience Tests
- [ ] Test command discoverability and naming
- [ ] Validate syntax highlighting readability
- [ ] Test auto-completion usefulness and accuracy
- [ ] Verify error messages are helpful and actionable
- [ ] Test template quality and defaults

## Integration Points

- **Inputs:**
  - User command invocations
  - File editing events
  - Workspace configuration changes
  - Language server requests

- **Outputs:**
  - File system operations (open, create)
  - Language server responses
  - Diagnostic messages
  - Syntax highlighting updates

- **APIs/Interfaces:**
  - `vscode.commands.registerCommand()` for command handlers
  - `vscode.languages.registerCompletionItemProvider()` for auto-completion
  - `vscode.languages.registerDiagnosticCollection()` for validation

## Implementation Notes

### Command Handler Architecture
```typescript
export function registerProjectViewCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('bazel.openProjectViewFile', async () => {
      const projectViewPath = await findOrCreateProjectViewFile();
      const document = await vscode.workspace.openTextDocument(projectViewPath);
      await vscode.window.showTextDocument(document);
    })
  );
}

async function findOrCreateProjectViewFile(): Promise<vscode.Uri> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error('No workspace folder found');
  }
  
  const projectViewPath = vscode.Uri.joinPath(workspaceFolder.uri, '.vscwb', '.bazelproject');
  
  try {
    await vscode.workspace.fs.stat(projectViewPath);
    return projectViewPath; // File exists
  } catch {
    return await createProjectViewFile(projectViewPath); // Create new file
  }
}
```

### Syntax Highlighting Grammar
Create TextMate grammar in `package.json`:
```json
{
  "contributes": {
    "languages": [{
      "id": "bazelproject",
      "aliases": ["Bazel Project", "bazelproject"],
      "extensions": [".bazelproject"],
      "configuration": "./language-configuration.json"
    }],
    "grammars": [{
      "language": "bazelproject",
      "scopeName": "source.bazelproject",
      "path": "./syntaxes/bazelproject.tmGrammar.json"
    }]
  }
}
```

### Auto-completion Provider
```typescript
export class BazelProjectViewCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const line = document.lineAt(position).text;
    const linePrefix = line.substring(0, position.character);
    
    if (this.isAttributePosition(linePrefix)) {
      return this.getAttributeCompletions();
    }
    
    if (this.isValuePosition(linePrefix)) {
      return this.getValueCompletions(this.getAttributeFromLine(line));
    }
    
    return [];
  }
  
  private getAttributeCompletions(): vscode.CompletionItem[] {
    return [
      new vscode.CompletionItem('directories', vscode.CompletionItemKind.Property),
      new vscode.CompletionItem('targets', vscode.CompletionItemKind.Property),
      new vscode.CompletionItem('derive_targets_from_directories', vscode.CompletionItemKind.Property),
      new vscode.CompletionItem('test_sources', vscode.CompletionItemKind.Property),
      new vscode.CompletionItem('additional_languages', vscode.CompletionItemKind.Property)
    ];
  }
}
```

### File Template System
Default project view template:
```typescript
const DEFAULT_PROJECT_VIEW_TEMPLATE = `# Bazel Project View Configuration
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
```

### Quick Fix Implementation
```typescript
export class BazelProjectViewCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source === 'bazelproject') {
        const action = this.createQuickFix(document, diagnostic);
        if (action) {
          actions.push(action);
        }
      }
    }
    
    return actions;
  }
  
  private createQuickFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction | null {
    if (diagnostic.message.includes('Unknown attribute')) {
      return this.createAttributeNameFix(document, diagnostic);
    }
    
    if (diagnostic.message.includes('Invalid indentation')) {
      return this.createIndentationFix(document, diagnostic);
    }
    
    return null;
  }
}
```

### Performance Optimization
- Cache completion items for frequently used attributes
- Implement incremental parsing for large project view files
- Use debounced validation to avoid excessive processing
- Optimize syntax highlighting patterns for performance
- Lazy load language features only when needed 