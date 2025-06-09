# Project View Infrastructure Specification

## Purpose & Scope

This specification covers the foundational infrastructure for project view file detection, parsing, and validation. It establishes the core `BazelProjectView` class and supporting components that enable the entire project view feature set, including Python-like syntax parsing, file system watching, and validation schema for all supported attributes.

## Technical Requirements

- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** VS Code Workspace APIs, Node.js fs module, path utilities
- **Performance Requirements:** File parsing <50ms, validation <100ms for typical project files
- **Security Considerations:** Validate file paths to prevent directory traversal attacks

## Implementation Tasks

### Core Parser Implementation
- [ ] Create `BazelProjectView` class with file parsing interface
- [ ] Implement Python-like syntax parser supporting 2-space indentation
- [ ] Add support for `#` comment parsing and preservation
- [ ] Create attribute value parsers for different data types (strings, arrays, booleans)
- [ ] Implement line-by-line parsing with proper error reporting

### File System Integration
- [ ] Add `.vscwb/.bazelproject` file detection logic
- [ ] Implement file system watcher using `vscode.workspace.createFileSystemWatcher`
- [ ] Add workspace detection logic for project view file existence
- [ ] Create file change event handlers with debouncing
- [ ] Implement graceful handling of file deletion/creation

### Validation Schema
- [ ] Create validation schema for `directories` attribute (array of strings)
- [ ] Add validation for `targets` attribute (array of Bazel target labels)
- [ ] Implement `derive_targets_from_directories` boolean validation
- [ ] Add `test_sources` glob pattern validation
- [ ] Create `additional_languages` enum validation
- [ ] Implement unknown attribute detection and warnings

### Error Reporting System
- [ ] Create structured error classes for different validation failures
- [ ] Implement line number tracking for precise error location
- [ ] Add descriptive error messages with suggested fixes
- [ ] Create error aggregation and prioritization
- [ ] Implement VS Code diagnostic integration for real-time feedback

## Dependencies

**Requires completion of:**
- [ ] None (Foundation component)

**Enables:**
- [ ] features/build-icon-integration.md
- [ ] features/directory-filtering.md
- [ ] features/test-integration.md
- [ ] features/status-bar-integration.md

## Acceptance Criteria

- [ ] Successfully parses valid `.bazelproject` files with Python-like syntax
- [ ] Detects and reports syntax errors with accurate line numbers
- [ ] File watcher correctly triggers on project view file changes
- [ ] All supported attributes validate according to their expected types
- [ ] Gracefully handles missing or malformed project view files
- [ ] Performance targets met: parsing <50ms, validation <100ms
- [ ] Integration with VS Code diagnostics shows real-time validation

## Testing Requirements

### Unit Tests
- [ ] Test Python-like syntax parser with various indentation scenarios
- [ ] Test comment parsing and preservation functionality
- [ ] Test each attribute validator with valid and invalid inputs
- [ ] Test error reporting with edge cases (empty files, malformed syntax)
- [ ] Test file system watcher with file creation/deletion/modification

### Integration Tests
- [ ] Test complete parsing workflow with real project view files
- [ ] Test VS Code diagnostic integration
- [ ] Test workspace detection across different project structures
- [ ] Test file watching integration with VS Code workspace events

### Performance Tests
- [ ] Benchmark parsing performance with large project view files
- [ ] Test memory usage during file watching operations
- [ ] Validate error reporting performance with files containing many errors

## Integration Points

- **Inputs:** 
  - `.vscwb/.bazelproject` file content
  - VS Code workspace folder configuration
  - File system change events

- **Outputs:** 
  - Parsed project view configuration object
  - Validation error reports with line numbers
  - File change notifications for dependent components

- **APIs/Interfaces:**
  - `BazelProjectView.parse(content: string): ProjectViewConfig`
  - `BazelProjectView.validate(config: ProjectViewConfig): ValidationResult[]`
  - `BazelProjectView.watchFile(callback: (config: ProjectViewConfig) => void): vscode.Disposable`

## Implementation Notes

### Parser Architecture
Use a line-by-line parsing approach with state machines for handling:
- Indentation levels (2-space requirement)
- Multi-line array values
- Comment preservation for round-trip editing
- Attribute name recognition and value type inference

### Performance Optimization
- Implement lazy parsing for large files
- Cache parsed results with file modification time checking
- Use incremental validation for real-time feedback
- Minimize file system operations through efficient watching

### Error Recovery
- Continue parsing after encountering errors to show multiple issues
- Provide suggestions for common syntax mistakes
- Implement partial parsing for incomplete files during editing

### VS Code Integration Patterns
Follow existing extension patterns from the codebase:
- Use `vscode.Disposable` for cleanup
- Implement proper error handling with user-friendly messages
- Integration with VS Code's problem reporting system 