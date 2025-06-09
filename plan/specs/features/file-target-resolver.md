# File-to-Target Resolution Engine Specification

## Purpose & Scope
This specification covers the intelligent file-to-target mapping system that determines which Bazel targets to build based on the currently active file in VS Code, including BUILD file traversal, Bazel query integration, and target disambiguation logic.

## Technical Requirements
- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** Bazel CLI, existing bazel_utils module, getBazelWorkspaceFolder pattern
- **Performance Requirements:** Target resolution <200ms (cached), <2s (uncached), caching system for repeated queries
- **Security Considerations:** Validate Bazel query results, sanitize file paths to prevent injection

## Implementation Tasks
- [ ] Create `FileTargetResolver` class with public resolution interface
- [ ] Implement `findContainingBuildFile()` method using path traversal from current file
- [ ] Create `queryTargetsForFile()` method using Bazel query to find targets containing specific files
- [ ] Implement `resolvePrimaryTarget()` logic for single target scenarios
- [ ] Create `disambiguateTargets()` method with QuickPick UI for multiple targets
- [ ] Implement `TargetCache` class for resolution result caching with TTL
- [ ] Add error handling for files without associated BUILD files or targets
- [ ] Create fallback mechanism for manual target selection via input box
- [ ] Implement file extension filtering (ignore non-source files)
- [ ] Add support for common Bazel project structures (mono-repo, multi-package)
- [ ] Create unit tests for all resolution scenarios

## Dependencies
**Requires completion of:**
- [ ] None (Foundation component)

**Enables:**
- [ ] features/command-integration.md
- [ ] testing/testing-framework.md

## Acceptance Criteria
- [ ] Target resolution accuracy >95% for standard project structures
- [ ] Resolution time <200ms for cached results, <2s for fresh queries
- [ ] Graceful fallback to manual selection when multiple targets found
- [ ] Proper error messages for files without associated targets
- [ ] Cache invalidation works correctly when BUILD files change
- [ ] Supports common file types (*.java, *.ts, *.py, *.go, *.cc, etc.)
- [ ] Handles edge cases like symbolic links and generated files
- [ ] Memory efficient caching with automatic cleanup

## Testing Requirements
- [ ] Unit tests for `FileTargetResolver` core methods
- [ ] Unit tests for BUILD file traversal logic
- [ ] Unit tests for Bazel query integration
- [ ] Unit tests for target disambiguation scenarios
- [ ] Unit tests for caching behavior and TTL
- [ ] Integration tests with real Bazel workspace structures
- [ ] Performance tests for large codebases
- [ ] Edge case tests for malformed BUILD files and missing targets

## Integration Points
- **Inputs:** 
  - Currently active file path from VS Code TextEditor
  - Bazel workspace root directory
  - User target selection from QuickPick/InputBox
- **Outputs:** 
  - Primary target label (e.g., "//package:target_name")
  - List of possible targets for disambiguation
  - Error messages for unresolvable files
- **APIs/Interfaces:** 
  - `vscode.window.activeTextEditor` for current file
  - `vscode.window.showQuickPick` for target selection
  - Bazel CLI for query operations
  - File system APIs for BUILD file traversal

## Implementation Notes
- Use Bazel query language: `bazel query 'attr(srcs, ${relativePath}, //...)'`
- Implement intelligent caching based on BUILD file modification times
- Consider workspace-relative vs absolute paths for portability
- Handle Bazel query timeouts gracefully with fallback options
- Support both BUILD and BUILD.bazel file conventions
- Optimize for common scenarios (single target per file) while supporting complex cases 