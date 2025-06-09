# Product Requirements Document: VS Code Bazel Project View

## Overview

The VS Code Bazel Project View feature brings IntelliJ's `.bazelproject` file functionality to VS Code, enabling developers to work with focused subsets of large Bazel monorepos. This feature addresses the challenge of working with massive codebases (~600,000 files) by providing intelligent project scoping, target management, and test discovery based on project view configurations.

The feature integrates seamlessly with the existing VS Code Bazel extension, extending the current build icon functionality to operate based on project view definitions rather than individual file context. This allows teams to maintain consistent development workflows across different IDEs while leveraging VS Code's performance and extensibility.

## Goals and Success Criteria

### Primary Goals
- **Performance**: Enable efficient development in large monorepos by reducing the active file set from 600,000+ to manageable subsets
- **Consistency**: Provide feature parity with IntelliJ's Bazel project view functionality for seamless IDE switching
- **Integration**: Extend existing VS Code Bazel extension without breaking current workflows
- **Usability**: Deliver intuitive project scoping with minimal configuration overhead

### Success Criteria
- **Performance KPIs**:
  - Project explorer loading time <3s for filtered views (vs >30s for full repo)
  - Build target resolution <500ms for project view targets
  - Memory usage reduction of 60%+ when using directory filtering
- **Adoption KPIs**:
  - 90% of teams using VS Code with Bazel adopt project views within 60 days
  - Zero regression in existing Bazel extension functionality
  - <5% increase in extension bundle size

## Target User Personas

### 1. Monorepo Developer
**Profile**: Full-stack engineers working on specific services/modules within large Bazel monorepos
**Pain Points**: 
- VS Code becomes slow/unresponsive with 600K+ files
- Difficulty finding relevant files in massive directory structures
- Accidental builds of unrelated targets causing long wait times
- Context switching between different services requires mental mapping
**Needs**: 
- Fast, focused development environment
- Clear visual separation of relevant vs irrelevant code
- Automatic target resolution for their specific domain
- Consistent experience with IntelliJ-using teammates

### 2. Platform/Infrastructure Engineer  
**Profile**: Engineers maintaining build systems, shared libraries, and tooling across multiple teams
**Pain Points**:
- Need to work across multiple project boundaries
- Existing project views from other teams don't fit their cross-cutting concerns
- Managing test execution across different service boundaries
- Ensuring build configurations work consistently across development environments
**Needs**:
- Flexible project view configuration for cross-cutting work
- Ability to quickly switch between different project contexts
- Integration with existing Bazel tooling and workflows
- Performance at scale for broad repository access

## User Experience Flow

### Initial Setup Flow
1. **Detection**: Extension automatically detects if `.vscwb/.bazelproject` exists in workspace root
2. **Initialization**: If not found, extension operates in legacy mode (current behavior)
3. **Activation**: When found, extension loads project view and applies filtering/targeting rules

### Daily Development Flow  
1. **Project Explorer**: Custom tree view shows only directories specified in `directories` attribute
2. **Build Action**: Clicking Bazel build icon builds targets from `targets` attribute (or derived targets)
3. **Test Discovery**: VS Code Test Explorer shows only tests from `test_sources` paths
4. **Status Indication**: Status bar shows active project view name and target count

### Configuration Management Flow
1. **Access**: Bazel menu → Project → Open Project View File opens `.vscwb/.bazelproject`
2. **Edit**: Standard text editing with syntax highlighting and validation
3. **Apply**: Changes take effect on next build action (no automatic rebuilding)
4. **Status**: Status bar updates to reflect configuration changes

## Core Features (MVP)

### 1. Project View File Management
- **Location**: Single `.vscwb/.bazelproject` file in workspace root
- **Format**: YAML-like syntax matching IntelliJ specification, the project view file uses a python-like format with 2 spaces indentation and # comments
- **Access**: Bazel menu → Project → Open Project View File
- **Validation**: Real-time syntax checking with error reporting

### 2. Directory Filtering (`directories` attribute)
- **Implementation**: Custom tree view panel if simple, otherwise VS Code file exclude patterns
- **Behavior**: Show only specified directories in project explorer
- **Performance**: Lazy loading for large directory structures
- **Exclusion**: Support `-` prefix for excluding subdirectories

### 3. Target Management (`targets` attribute)  
- **Integration**: Modify existing build icon to use project view targets
- **Resolution**: Build specified targets instead of current file context
- **Fallback**: If no project view, maintain current behavior
- **Validation**: Verify target existence during project view loading

### 4. Derived Target Discovery (`derive_targets_from_directories`)
- **Behavior**: When `true`, ignore explicit `targets` and auto-discover from directories
- **Implementation**: Scan directories for BUILD/BUILD.bazel files and extract target labels
- **Performance**: Incremental scanning with caching for large repositories
- **Priority**: Explicit targets override derived targets when both present

### 5. Test Source Management (`test_sources` attribute)
- **Integration**: Extend VS Code Test Explorer with Bazel test discovery
- **Filtering**: Limit test discovery to specified glob patterns
- **Execution**: Restrict `bazel test` commands to project view test sources
- **Discovery**: Automatic scanning (not Bazel query) for performance

### 6. Status Indicators
- **Status Bar**: Show active project view status (file name, target count, directory count)
- **Project State**: Indicate when project view is active vs legacy mode
- **Errors**: Display configuration errors and validation issues

## Advanced or Stretch Features

### 1. Multiple Project View Support
- **Switcher**: Quick-pick menu to switch between different `.bazelproject` configurations
- **Templates**: Pre-defined project view templates for common patterns
- **Inheritance**: Support for importing shared project view configurations

### 2. Performance Optimizations
- **Incremental Updates**: Smart refresh of only changed directories/targets
- **Background Processing**: Asynchronous target discovery and validation
- **Memory Management**: Efficient caching with configurable retention policies

### 3. Enhanced UI/UX
- **Project View Editor**: Form-based editor with validation and auto-completion
- **Visual Indicators**: Icons and badges to show project view status in explorer
- **Configuration Wizard**: Guided setup for new project views

### 4. Advanced Test Integration
- **Test Filtering**: Additional test execution filters beyond source paths
- **Coverage Integration**: Project view-aware code coverage reporting
- **Test Templates**: Common test configuration patterns

## Technical Architecture and Stack

### Frontend Components
- **VS Code Extension**: TypeScript extension hosted in VS Code extension host
- **UI Framework**: VS Code native APIs (TreeDataProvider, StatusBarItem, Commands)
- **File System**: VS Code workspace APIs with efficient file watching

### Backend Integration  
- **Bazel CLI**: Direct integration with existing Bazel command execution
- **Target Resolution**: Bazel query integration with caching layer
- **File Processing**: Node.js fs APIs with streaming for large directories

### Data Management
- **Configuration**: YAML parsing with validation schema
- **Caching**: In-memory LRU cache for target resolution and directory scanning
- **State Management**: VS Code workspace state for persistence

### Performance Architecture
- **Lazy Loading**: On-demand directory tree population
- **Incremental Processing**: Change-based updates rather than full rescans
- **Memory Optimization**: WeakMap-based caching and cleanup strategies

## Out-of-Scope / Future Features

### Not Included in MVP
- **Build Flags**: `build_flags`, `sync_flags`, `test_flags` attributes
- **Language Configuration**: `additional_languages`, `workspace_type` attributes  
- **Advanced Attributes**: `import`, `java_language_level`, `android_*` attributes
- **Run Configurations**: Import/export of run configurations
- **Multi-workspace**: Support for multiple workspace folders with different project views

### Future Considerations
- **Bazel Query Integration**: Optional Bazel query-based target discovery
- **Workspace Synchronization**: Real-time sync with Bazel workspace changes
- **Team Collaboration**: Shared project view configurations and templates
- **Advanced Filtering**: More sophisticated directory and target filtering rules

## Metrics and KPIs

### Performance Metrics (30-day measurement)
- **Load Time**: Project explorer population time <3s (baseline: >30s)
- **Memory Usage**: 60%+ reduction in VS Code memory consumption
- **Build Performance**: Target resolution time <500ms consistently
- **File Operations**: Search/navigation performance improvement 5x+

### Adoption Metrics (90-day measurement) 
- **Feature Usage**: 90% of Bazel extension users create project views
- **Configuration**: Average 2.3 project view files per team
- **Error Rate**: <1% project view parsing errors
- **Retention**: 95% continued usage after initial adoption

### Quality Metrics (Ongoing)
- **Compatibility**: Zero regressions in existing Bazel extension functionality
- **Reliability**: 99.9% successful project view loading
- **User Satisfaction**: >4.5/5 rating in extension reviews
- **Support Requests**: <5% increase in support tickets despite new complexity

### Business Impact (60-day measurement)
- **Developer Productivity**: 25% improvement in development velocity metrics
- **Tool Consistency**: 100% feature parity with IntelliJ project views for MVP scope
- **Monorepo Efficiency**: 40% reduction in irrelevant build executions
- **Extension Growth**: 20% increase in VS Code Bazel extension adoption 