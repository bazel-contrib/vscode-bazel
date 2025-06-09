# Build Icon Integration Specification

## Purpose & Scope

This specification covers the integration of project view functionality with the existing BazelBuildIcon system. It modifies the current file-based targeting approach to use project view targets when available, implements derived target discovery, and maintains backward compatibility with the existing build workflow.

## Technical Requirements

- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** Existing BazelBuildIconService, FileTargetResolver, BazelProjectView infrastructure
- **Performance Requirements:** Target resolution <500ms, derived target discovery <2s for large repos
- **Security Considerations:** Validate target labels to prevent command injection

## Implementation Tasks

### BazelBuildIconService Integration
- [ ] Extend `BazelBuildIconService` to check for active project view configuration
- [ ] Modify service initialization to detect `.vscwb/.bazelproject` files
- [ ] Add project view configuration change handlers
- [ ] Implement project view vs legacy mode switching logic
- [ ] Update service disposal to clean up project view resources

### Target Resolution Logic Updates
- [ ] Update `FileTargetResolver` to prioritize project view targets over file-based resolution
- [ ] Implement project view target validation during resolution
- [ ] Add fallback logic to file-based targeting when project view is unavailable
- [ ] Create target existence validation using Bazel query
- [ ] Implement error handling for invalid or missing targets

### Derived Target Discovery
- [ ] Implement `derive_targets_from_directories` scanning functionality
- [ ] Create directory traversal logic to find BUILD/BUILD.bazel files
- [ ] Extract target labels from discovered BUILD files
- [ ] Implement target filtering and deduplication
- [ ] Add caching for derived target results with TTL
- [ ] Handle large repository performance with incremental scanning

### Build Execution Integration
- [ ] Modify build command generation to use project view targets
- [ ] Update build task creation to handle multiple targets efficiently
- [ ] Implement build progress reporting for multiple targets
- [ ] Add build result aggregation and status reporting
- [ ] Ensure build history integration works with project view targets

### Legacy Compatibility
- [ ] Maintain existing behavior when no project view file is present
- [ ] Ensure all existing build commands continue to function
- [ ] Preserve existing keyboard shortcuts and menu behaviors
- [ ] Add configuration option to disable project view integration if needed
- [ ] Test backward compatibility with various workspace configurations

## Dependencies

**Requires completion of:**
- [ ] architecture/project-view-infrastructure.md

**Enables:**
- [ ] features/status-bar-integration.md

## Acceptance Criteria

- [ ] Build icon uses project view targets when `.vscwb/.bazelproject` exists
- [ ] Derived targets are correctly discovered from specified directories
- [ ] Target resolution meets <500ms performance requirement
- [ ] Build commands execute correct targets based on project view configuration
- [ ] Legacy behavior preserved when no project view file is present
- [ ] Multiple targets build correctly with proper progress reporting
- [ ] Build history functionality works with project view targets
- [ ] Zero regressions in existing build functionality

## Testing Requirements

### Unit Tests
- [ ] Test project view detection and configuration loading
- [ ] Test target resolution logic with various project view configurations
- [ ] Test derived target discovery with different directory structures
- [ ] Test fallback logic when project view is missing or invalid
- [ ] Test target validation and error handling
- [ ] Test build command generation with project view targets

### Integration Tests
- [ ] Test complete build workflow with project view active
- [ ] Test build workflow fallback to legacy behavior
- [ ] Test derived target discovery performance with large repositories
- [ ] Test multiple target building and progress reporting
- [ ] Test build history integration with project view targets
- [ ] Test error handling with invalid project view configurations

### Performance Tests
- [ ] Benchmark target resolution with project view vs legacy mode
- [ ] Test derived target discovery performance with 600K+ file repositories
- [ ] Validate memory usage during target caching operations
- [ ] Test build execution performance with multiple targets

## Integration Points

- **Inputs:**
  - Project view configuration from BazelProjectView
  - Current active file context (for legacy fallback)
  - User build command invocations

- **Outputs:**
  - Target labels for build execution
  - Build progress and status updates
  - Error messages for invalid configurations

- **APIs/Interfaces:**
  - `BazelBuildIconService.setProjectView(config: ProjectViewConfig): void`
  - `FileTargetResolver.resolveProjectViewTargets(config: ProjectViewConfig): Promise<string[]>`
  - `BazelBuildIconService.buildProjectViewTargets(): Promise<void>`

## Implementation Notes

### Service Architecture Integration
Extend existing `BazelBuildIconService` class:
```typescript
class BazelBuildIconService {
  private projectViewConfig?: ProjectViewConfig;
  
  public setProjectView(config: ProjectViewConfig) {
    this.projectViewConfig = config;
    this.updateTargetResolution();
  }
  
  private async resolveTargets(): Promise<string[]> {
    if (this.projectViewConfig) {
      return this.resolveProjectViewTargets();
    }
    return this.resolveFileBasedTargets(); // Legacy fallback
  }
}
```

### Derived Target Discovery Algorithm
1. Scan directories specified in project view configuration
2. Recursively find BUILD and BUILD.bazel files
3. Parse files to extract target definitions
4. Apply exclusion patterns (directories with `-` prefix)
5. Cache results with file modification time tracking
6. Return deduplicated target labels

### Performance Optimization Strategies
- Implement incremental scanning for large repositories
- Use parallel directory traversal for performance
- Cache derived targets with intelligent invalidation
- Optimize Bazel query operations with batching
- Implement background target validation

### Error Handling Patterns
- Graceful degradation when project view parsing fails
- User-friendly error messages for common configuration mistakes
- Fallback to legacy behavior on critical errors
- Progress indication during long-running target discovery operations

### Build Progress Integration
Leverage existing build progress infrastructure:
- Extend status bar updates for multiple target builds
- Aggregate build results across targets
- Provide detailed progress for derived target discovery
- Maintain build history with project view context 