# Test Integration Specification

## Purpose & Scope

This specification covers the integration of project view test source filtering with VS Code Test Explorer. It implements test discovery restrictions based on the `test_sources` attribute, creates test provider functionality, and ensures test execution is limited to project view defined test directories while maintaining performance for large repositories.

## Technical Requirements

- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** VS Code Test Explorer APIs, BazelProjectView infrastructure, existing test discovery components
- **Performance Requirements:** Test discovery <2s, glob pattern matching <500ms
- **Security Considerations:** Validate test source paths to prevent execution outside workspace

## Implementation Tasks

### Test Provider Implementation
- [ ] Create `BazelProjectViewTestProvider` class extending existing test provider
- [ ] Implement `TestProvider` interface for VS Code Test Explorer integration
- [ ] Add test discovery filtering based on project view configuration
- [ ] Create test tree structure for filtered test sources
- [ ] Implement test provider registration and lifecycle management

### Test Source Filtering
- [ ] Implement glob pattern matching for `test_sources` attribute
- [ ] Create path filtering logic to restrict test discovery
- [ ] Add support for multiple glob patterns in test_sources
- [ ] Implement exclusion pattern support within test sources
- [ ] Add validation for test source path existence

### Test Discovery Integration
- [ ] Filter VS Code Test Explorer to show only project view test sources
- [ ] Implement automatic test scanning (non-Bazel query based)
- [ ] Create incremental test discovery for large repositories
- [ ] Add test file change detection and refresh logic
- [ ] Implement test discovery caching with invalidation

### Test Execution Restriction
- [ ] Restrict `bazel test` commands to project view test directories
- [ ] Update test runner configuration for filtered execution
- [ ] Implement test target resolution within project view scope
- [ ] Add error handling for tests outside project view scope
- [ ] Create test execution progress reporting for filtered tests

### Performance Optimization
- [ ] Implement lazy loading for test discovery
- [ ] Add background test scanning with progress indication
- [ ] Optimize glob pattern matching for large directory structures
- [ ] Cache test discovery results with file system watching
- [ ] Implement test tree virtualization for large test suites

### Error Handling and Validation
- [ ] Add test source validation and error reporting
- [ ] Create user-friendly messages for invalid glob patterns
- [ ] Implement fallback behavior when test sources are invalid
- [ ] Add diagnostic reporting for test discovery issues
- [ ] Handle test execution errors gracefully

## Dependencies

**Requires completion of:**
- [ ] architecture/project-view-infrastructure.md

**Enables:**
- [ ] None (can run in parallel with other features)

## Acceptance Criteria

- [ ] Test Explorer shows only tests from `test_sources` paths
- [ ] Test execution is restricted to project view test sources
- [ ] Glob patterns work correctly for test source matching
- [ ] Test discovery performance is acceptable for large repositories
- [ ] Test tree updates correctly when project view changes
- [ ] Test execution progress reporting works with filtered tests
- [ ] Error messages are clear for invalid test source configurations
- [ ] Existing test functionality remains unaffected when no project view is active

## Testing Requirements

### Unit Tests
- [ ] Test glob pattern matching with various test source configurations
- [ ] Test path filtering logic with different directory structures
- [ ] Test provider implementation with mock VS Code Test Explorer
- [ ] Test discovery filtering with valid and invalid paths
- [ ] Test execution restriction logic
- [ ] Test error handling and validation

### Integration Tests
- [ ] Test complete test discovery workflow with real repositories
- [ ] Test VS Code Test Explorer integration with filtered tests
- [ ] Test performance with large test suites (1000+ test files)
- [ ] Test test execution restriction across different test types
- [ ] Test test discovery updates when project view changes
- [ ] Test integration with existing Bazel test infrastructure

### Performance Tests
- [ ] Benchmark test discovery time with various repository sizes
- [ ] Test glob pattern matching performance with complex patterns
- [ ] Validate memory usage during test discovery operations
- [ ] Test test tree rendering performance with large filtered test sets

## Integration Points

- **Inputs:**
  - Project view test_sources configuration
  - VS Code Test Explorer requests
  - Test file system events
  - User test execution commands

- **Outputs:**
  - Filtered test tree for Test Explorer
  - Test discovery results
  - Test execution commands
  - Error and validation messages

- **APIs/Interfaces:**
  - `vscode.TestProvider` implementation
  - `BazelProjectViewTestProvider.discoverTests(testSources: string[]): Promise<TestItem[]>`
  - Integration with existing `BazelTestProvider` patterns

## Implementation Notes

### Test Provider Architecture
Extend existing test provider patterns:
```typescript
export class BazelProjectViewTestProvider implements vscode.TestProvider {
  private projectViewConfig?: ProjectViewConfig;
  
  constructor(private bazelTestProvider: BazelTestProvider) {}
  
  async discoverTests(token: vscode.CancellationToken): Promise<void> {
    if (!this.projectViewConfig?.test_sources) {
      return this.bazelTestProvider.discoverTests(token);
    }
    
    return this.discoverFilteredTests(this.projectViewConfig.test_sources, token);
  }
  
  private async discoverFilteredTests(patterns: string[], token: vscode.CancellationToken): Promise<void> {
    const filteredPaths = await this.applyGlobPatterns(patterns);
    return this.scanTestsInPaths(filteredPaths, token);
  }
}
```

### Glob Pattern Implementation
Use efficient glob matching:
- Leverage `minimatch` or similar library for pattern matching
- Implement path normalization for cross-platform compatibility
- Cache compiled glob patterns for performance
- Support standard glob syntax: `*`, `**`, `?`, `[...]`

### Test Discovery Optimization
For large repositories:
```typescript
async function discoverTestsIncremental(patterns: string[]): Promise<TestItem[]> {
  const batches = chunkTestPaths(patterns, 100); // Process in batches
  const results: TestItem[] = [];
  
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(path => discoverTestsInPath(path))
    );
    results.push(...batchResults.flat());
    
    // Yield control to prevent blocking UI
    await new Promise(resolve => setImmediate(resolve));
  }
  
  return results;
}
```

### VS Code Test Explorer Integration
Follow Test Explorer API patterns:
- Implement proper test item hierarchy
- Use appropriate test item icons and labels
- Handle test state updates correctly
- Implement test debugging support
- Support test filtering and searching

### Error Handling Patterns
Graceful degradation strategies:
- Show warning when test sources are invalid
- Fall back to full test discovery if filtering fails
- Provide clear error messages for glob pattern issues
- Allow manual test source validation
- Maintain existing functionality when project view is disabled

### Performance Monitoring
Implement performance tracking:
- Monitor test discovery time
- Track memory usage during test scanning
- Log performance metrics for optimization
- Implement automatic performance degradation detection
- Provide user feedback for slow operations 