# Directory Filtering Guide

## Overview

The VS Code Bazel extension now provides high-performance directory filtering that integrates with your `.vscwb/.bazelproject` file to control which directories appear in the VS Code file explorer. This feature provides feature parity with IntelliJ's Bazel plugin.

## Key Features

### ✨ **IntelliJ Compatibility**
- **"." directory support**: Use `.` in your `directories` attribute to include all repository files and folders
- **Same syntax**: Supports the exact same directory patterns as IntelliJ's Bazel plugin
- **Mixed configurations**: Combine `.` with exclusions for fine-grained control

### ⚡ **High Performance**
- **Instant filtering**: Enable/disable filtering with immediate visual feedback
- **Smart caching**: Workspace statistics cached for 5 minutes to avoid redundant scans
- **Non-blocking**: Updates happen in the background without freezing VS Code
- **Memory efficient**: Only scans top-level directories, not recursive

### 📊 **Accurate Statistics**
- **Real percentage**: Shows actual filtering impact based on workspace analysis
- **Live updates**: Statistics update automatically when project view changes
- **Detailed metrics**: See included/excluded directory counts and cache performance

## Configuration

### Basic Project View Setup

Create or edit your `.vscwb/.bazelproject` file:

```bazel
# Include specific directories
directories:
  src/
  test/
  docs/

# Exclude specific directories  
directories:
  src/
  test/
  -node_modules/
  -bazel-*

targets:
  //src/...
  //test/...
```

### IntelliJ Compatible Configurations

#### 1. Include Everything (like "Disable Filtering")
```bazel
directories:
  .

targets:
  //...
```

#### 2. Include Everything with Exclusions
```bazel
directories:
  .
  -node_modules/
  -bazel-*/
  -third_party/large_dataset/

targets:
  //...
```

#### 3. Specific Directories Only
```bazel
directories:
  src/main/
  src/test/
  config/

targets:
  //src/...
```

#### 4. Complex Nested Structure
```bazel
directories:
  src/main/java/com/company/
  src/main/resources/
  src/test/java/com/company/
  -src/main/java/com/company/legacy/

targets:
  //src/main/java/com/company/...
  //src/test/java/com/company/...
```

## VS Code Settings

Configure the directory filter behavior in your VS Code settings:

```json
{
  "bazel.directoryFilter.enabled": true,
  "bazel.directoryFilter.showExcluded": false,
  "bazel.directoryFilter.maxDepth": 10,
  "bazel.directoryFilter.alwaysInclude": [
    ".vscode",
    ".vscwb",
    "WORKSPACE",
    "WORKSPACE.bazel",
    "MODULE.bazel"
  ],
  "bazel.directoryFilter.performanceExcludes": [
    "node_modules/**",
    ".git/**",
    "bazel-*/**"
  ]
}
```

### Setting Descriptions

| Setting | Description | Default |
|---------|-------------|---------|
| `enabled` | Enable/disable directory filtering globally | `true` |
| `showExcluded` | Show excluded directories with visual indicators | `false` |
| `maxDepth` | Maximum directory depth to scan | `10` |
| `alwaysInclude` | Directories always included regardless of project view | `[".vscode", ".vscwb", "WORKSPACE", "WORKSPACE.bazel", "MODULE.bazel"]` |
| `performanceExcludes` | Patterns always excluded for performance | `["node_modules/**", ".git/**", "bazel-*/**"]` |

## Usage Examples

### Example 1: Large Monorepo with Specific Services

```bazel
# Only show specific microservices
directories:
  services/user-service/
  services/auth-service/
  services/payment-service/
  shared/
  -services/legacy/

targets:
  //services/user-service/...
  //services/auth-service/...
  //services/payment-service/...
  //shared/...
```

**Result**: File explorer shows only the specified services and shared code, hiding legacy services and other unrelated directories.

### Example 2: Frontend Development Focus

```bazel
# Focus on frontend code
directories:
  frontend/src/
  frontend/public/
  shared/ui/
  -frontend/node_modules/
  -frontend/build/

targets:
  //frontend/...
  //shared/ui/...
```

**Result**: Shows only frontend source code and shared UI components, hiding build artifacts and dependencies.

### Example 3: Show Everything (Development Mode)

```bazel
# Show all directories for full development access
directories:
  .

targets:
  //...
```

**Result**: Equivalent to disabling filtering - all directories visible in file explorer.

### Example 4: Production Codebase Only

```bazel
# Hide all development/tooling directories
directories:
  .
  -tools/
  -scripts/
  -docs/internal/
  -experiments/
  -.github/

targets:
  //src/...
  //config/...
```

**Result**: Shows entire codebase except development tooling and internal documentation.

## Performance Optimizations

### Caching Strategy
- **Workspace stats**: Cached for 5 minutes to avoid repeated filesystem scans
- **Filter results**: Individual directory decisions cached until project view changes
- **Original excludes**: VS Code's original `files.exclude` settings preserved and restored

### Debouncing
- **Project view changes**: 100ms debounce prevents excessive updates during rapid changes
- **Configuration updates**: Applied to all workspaces in parallel for instant feedback

### Memory Efficiency
- **Top-level only**: Scans only top-level directories, not entire filesystem tree
- **Smart exclusions**: Uses VS Code's native `files.exclude` for optimal performance
- **Cache cleanup**: Automatic cleanup when workspaces are removed

## Troubleshooting

### Common Issues

#### 1. Filtering Not Applied
**Problem**: Directory filtering seems to have no effect
**Solution**: 
- Check that `bazel.directoryFilter.enabled` is `true`
- Verify your `.vscwb/.bazelproject` file has a `directories` attribute
- Try reloading VS Code window

#### 2. Performance Issues
**Problem**: VS Code becomes slow when enabling filtering
**Solution**:
- Reduce `maxDepth` setting to limit filesystem scanning
- Add large directories to `performanceExcludes`
- Use `.` with exclusions instead of listing many individual directories

#### 3. Directories Not Excluded
**Problem**: Some directories still appear despite being excluded
**Solution**:
- Check that excluded directories start with `-` in your project view
- Verify the directory path matches exactly (case-sensitive)
- Try using pattern matching (e.g., `-bazel-*` instead of `-bazel-bin`)

#### 4. Filter Percentage Shows 0%
**Problem**: Statistics show 0% filtering even when directories are hidden
**Solution**:
- This is fixed in the new version - percentage now shows actual workspace impact
- Try refreshing the workspace statistics by toggling filtering off/on

### Debug Information

Enable debug logging by adding to your VS Code settings:
```json
{
  "bazel.directoryFilter.debug": true
}
```

This will log filtering decisions and performance metrics to the VS Code Developer Console.

## Migration from Previous Versions

### Breaking Changes
- **More accurate percentage**: The filtering percentage now reflects actual workspace impact rather than a rough estimate
- **Instant updates**: Filtering changes apply immediately instead of requiring workspace reload
- **Preserved settings**: Your original VS Code `files.exclude` settings are now preserved and restored

### Recommended Updates
1. **Add "." support**: If you want to show everything, replace long lists of directories with just `.`
2. **Use exclusions**: Instead of listing what to include, use `.` with exclusions for better performance
3. **Update settings**: Review your `performanceExcludes` patterns for optimal performance

## Advanced Usage

### Custom Filter Patterns

You can combine multiple filtering strategies:

```bazel
# Hybrid approach: show everything but exclude large/unnecessary directories
directories:
  .
  -node_modules/
  -bazel-*/
  -third_party/
  -build/
  -dist/
  -.git/
  -coverage/
  -logs/

targets:
  //...
```

### Dynamic Filtering

Use VS Code tasks to switch between different project view configurations:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Focus on Backend",
      "type": "shell",
      "command": "cp",
      "args": [".vscwb/.bazelproject.backend", ".vscwb/.bazelproject"]
    },
    {
      "label": "Focus on Frontend", 
      "type": "shell",
      "command": "cp",
      "args": [".vscwb/.bazelproject.frontend", ".vscwb/.bazelproject"]
    },
    {
      "label": "Show Everything",
      "type": "shell",
      "command": "cp", 
      "args": [".vscwb/.bazelproject.full", ".vscwb/.bazelproject"]
    }
  ]
}
```

## API Reference

### DirectoryFilter Class

The `DirectoryFilter` class provides programmatic access to filtering functionality:

```typescript
// Check if directory should be included
const result = directoryFilter.shouldIncludeDirectory(workspaceFolder, 'src/main');
console.log(result.included); // true/false
console.log(result.reason);   // Reason for inclusion/exclusion

// Get filtering statistics
const stats = directoryFilter.getFilteringStats(workspaceFolder);
console.log(stats.estimatedReduction); // "45%"
console.log(stats.includedDirectories); // 5
console.log(stats.excludedDirectories); // 8

// Update filtering configuration
await directoryFilter.updateConfiguration({
  enabled: true,
  maxDepth: 15
});
```

## Best Practices

### 1. Start Simple
Begin with basic inclusion/exclusion patterns and add complexity as needed:
```bazel
directories:
  src/
  test/
  -bazel-*
```

### 2. Use "." for Large Codebases
For large monorepos, use `.` with exclusions for better performance:
```bazel
directories:
  .
  -third_party/
  -bazel-*
  -node_modules/
```

### 3. Group Related Directories
Keep related directories together in your project view:
```bazel
directories:
  # Core application code
  src/main/
  src/test/
  
  # Configuration and build files
  config/
  build/
  
  # Documentation
  docs/user/
  docs/api/
```

### 4. Regular Maintenance
Periodically review and update your directory filters:
- Remove directories that no longer exist
- Add new important directories
- Optimize patterns for better performance

## FAQ

**Q: Does this affect Bazel builds?**
A: No, directory filtering only affects the VS Code file explorer. Bazel builds use the `targets` attribute from your project view.

**Q: Can I have different filtering per workspace folder?**
A: Yes, each workspace folder can have its own `.vscwb/.bazelproject` file with different directory configurations.

**Q: What happens if I don't have a project view file?**
A: Without a project view file, all directories are shown (no filtering applied).

**Q: Is this compatible with other VS Code extensions?**
A: Yes, directory filtering uses VS Code's standard `files.exclude` mechanism, which is respected by all extensions.

**Q: Can I disable filtering for specific file types?**
A: Filtering is directory-based. However, you can use the `alwaysInclude` setting to ensure certain directories are always visible.

**Q: How do I restore original VS Code exclude settings?**
A: Disable directory filtering in settings - the extension automatically restores your original `files.exclude` configuration. 