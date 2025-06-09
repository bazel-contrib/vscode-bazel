# Directory Filtering Specification

## Purpose & Scope

This specification covers the implementation of directory filtering functionality that shows only specified directories in the VS Code file explorer based on the `directories` attribute in project view configuration. This includes choosing between custom tree view implementation vs file exclude patterns, handling exclusion patterns, and optimizing performance for large repositories (600K+ files).

## Technical Requirements

- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** VS Code TreeDataProvider APIs or workspace configuration, BazelProjectView infrastructure
- **Performance Requirements:** Directory loading <3s, memory usage reduction 60%+ for filtered views
- **Security Considerations:** Validate directory paths to prevent access outside workspace boundaries

## Implementation Tasks

### Implementation Approach Assessment
- [ ] Assess complexity of custom TreeDataProvider implementation
- [ ] Evaluate VS Code file exclude patterns approach
- [ ] Compare performance implications of both approaches
- [ ] Choose optimal approach based on complexity analysis
- [ ] Document decision rationale and trade-offs

### Custom Tree View Implementation (if chosen)
- [ ] Create `BazelProjectViewTreeProvider` implementing `TreeDataProvider<IBazelTreeItem>`
- [ ] Implement tree item classes for filtered directory structure
- [ ] Add lazy loading for directory expansion
- [ ] Create custom icons and visual indicators for project view items
- [ ] Implement tree refresh logic when project view changes
- [ ] Add tree view registration and disposal

### File Exclude Patterns Implementation (if chosen)
- [ ] Generate file exclude patterns from project view directories
- [ ] Update VS Code workspace configuration dynamically
- [ ] Implement pattern inversion logic (exclude all except specified directories)
- [ ] Handle pattern conflict resolution with existing user settings
- [ ] Add setting restoration when project view is disabled

### Exclusion Pattern Support
- [ ] Parse directories with `-` prefix for exclusion
- [ ] Implement exclusion pattern precedence rules
- [ ] Support nested exclusion patterns within included directories
- [ ] Add validation for conflicting inclusion/exclusion patterns
- [ ] Create user-friendly error messages for pattern conflicts

### Performance Optimization
- [ ] Implement lazy loading for large directory structures
- [ ] Add directory size estimation and progressive loading
- [ ] Optimize memory usage with virtual tree rendering
- [ ] Implement intelligent caching with TTL
- [ ] Add background directory scanning with progress indication

### Integration with Workspace Management
- [ ] Integrate with existing `BazelWorkspaceTreeProvider` if using custom tree
- [ ] Ensure compatibility with multi-workspace folder scenarios
- [ ] Handle workspace folder changes and updates
- [ ] Preserve existing workspace functionality
- [ ] Add configuration to switch between filtered and full view

## Dependencies

**Requires completion of:**
- [ ] architecture/project-view-infrastructure.md

**Enables:**
- [ ] None (can run in parallel with other features)

## Acceptance Criteria

- [ ] Only directories specified in `directories` attribute are visible in explorer
- [ ] Exclusion patterns work correctly with `-` prefix
- [ ] Performance acceptable for large repositories (<3s load time)
- [ ] Memory usage optimized for filtered views (60%+ reduction)
- [ ] Directory filtering updates immediately when project view changes
- [ ] Existing workspace functionality remains unaffected
- [ ] Multi-workspace folder scenarios handled correctly
- [ ] User can easily switch between filtered and full repository view

## Testing Requirements

### Unit Tests
- [ ] Test directory path parsing and validation
- [ ] Test exclusion pattern logic with various configurations
- [ ] Test tree provider implementation (if custom tree chosen)
- [ ] Test file exclude pattern generation (if exclude approach chosen)
- [ ] Test lazy loading and memory management
- [ ] Test workspace configuration updates

### Integration Tests
- [ ] Test complete directory filtering workflow with real repositories
- [ ] Test performance with large directory structures (600K+ files)
- [ ] Test integration with existing workspace tree functionality
- [ ] Test multi-workspace folder scenarios
- [ ] Test directory filtering updates when project view changes
- [ ] Test user setting preservation and restoration

### Performance Tests
- [ ] Benchmark directory loading time with various repository sizes
- [ ] Test memory usage with filtered vs unfiltered views
- [ ] Validate lazy loading performance with deep directory structures
- [ ] Test UI responsiveness during directory scanning operations

## Integration Points

- **Inputs:**
  - Project view directories configuration
  - VS Code workspace folder structure
  - User interactions with tree view or explorer

- **Outputs:**
  - Filtered directory tree display
  - Explorer visibility updates
  - Memory usage optimization

- **APIs/Interfaces:**
  - `vscode.TreeDataProvider<IBazelTreeItem>` (if custom tree)
  - `vscode.workspace.getConfiguration()` (if exclude patterns)
  - `vscode.window.registerTreeDataProvider()` (if custom tree)

## Implementation Notes

### Custom Tree View Approach
Benefits:
- Complete control over display and behavior
- Can add custom icons and project view specific features
- Better performance isolation from main explorer
- Easier to implement project view specific context menus

Implementation pattern:
```typescript
export class BazelProjectViewTreeProvider implements vscode.TreeDataProvider<IBazelTreeItem> {
  private projectViewConfig?: ProjectViewConfig;
  
  constructor(private resources: Resources) {}
  
  refresh(config: ProjectViewConfig): void {
    this.projectViewConfig = config;
    this.onDidChangeTreeDataEmitter.fire();
  }
  
  getChildren(element?: IBazelTreeItem): Promise<IBazelTreeItem[]> {
    if (!element) {
      return this.getFilteredDirectories();
    }
    return element.getChildren();
  }
}
```

### File Exclude Patterns Approach
Benefits:
- Leverages existing VS Code infrastructure
- Automatically applies to all explorer functionality
- No additional UI development required
- Native VS Code performance optimizations

Implementation pattern:
```typescript
function updateFileExcludes(directories: string[]): void {
  const config = vscode.workspace.getConfiguration('files');
  const patterns = generateExcludePatterns(directories);
  config.update('exclude', patterns, vscode.ConfigurationTarget.Workspace);
}
```

### Performance Considerations
For large repositories:
- Use incremental loading with progress indication
- Implement virtual scrolling for tree views
- Cache directory structure with intelligent invalidation
- Use background workers for intensive scanning operations
- Optimize file system access patterns

### Memory Optimization Strategies
- Lazy load directory contents on expansion
- Use weak references for cached data
- Implement automatic cleanup of unused tree nodes
- Monitor memory usage and implement garbage collection triggers
- Use streaming approaches for large directory traversals

### User Experience Patterns
- Provide clear visual indicators when filtering is active
- Add easy toggle between filtered and full view
- Show directory count and filtering status
- Implement smooth transitions when changing project views
- Provide helpful error messages for configuration issues 