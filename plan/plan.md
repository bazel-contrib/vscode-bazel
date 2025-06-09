# Implementation Plan: VS Code Bazel Project View

## Technical Context
- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Architecture:** Extension module integration with existing Bazel infrastructure
- **Key Dependencies:** VS Code Extension APIs, existing BazelBuildIcon components, TreeDataProvider patterns

## Stage 1: Project View File Infrastructure
Depends on: None

**Objective:** Establish core project view file detection, parsing, and validation foundation

**Tasks:**
- [ ] Create `BazelProjectView` class for `.vscwb/.bazelproject` file parsing
- [ ] Implement Python-like syntax parser (2-space indentation, # comments)
- [ ] Add file system watcher for `.vscwb/.bazelproject` changes
- [ ] Create validation schema for supported attributes (`directories`, `targets`, `derive_targets_from_directories`, `test_sources`, `additional_languages`)
- [ ] Implement error reporting and syntax validation
- [ ] Add workspace detection logic for `.vscwb/.bazelproject` existence

**Verification Criteria:**
- [ ] Parser correctly handles Python-like syntax with proper indentation
- [ ] File watcher detects changes to project view files
- [ ] Validation catches syntax errors and reports line numbers
- [ ] All supported attributes parse correctly with appropriate data types

**Parallel Opportunities:** Can run simultaneously with UI infrastructure development

## Stage 2: Extension Metadata Updates  
Depends on: None

**Objective:** Update extension branding, commands, and menu structure to support project view features

**Tasks:**
- [ ] Update package.json displayName to "Bazel (Wix)"
- [ ] Update package.json description to "Bazel BUILD integration at Wix"
- [ ] Add activation event for `.vscwb/.bazelproject` files
- [ ] Create command `bazel.openProjectViewFile` 
- [ ] Implement nested menu structure: Bazel → Project → Open Project View File
- [ ] Add context menu contributions for project view management
- [ ] Update extension icon and branding assets if needed

**Verification Criteria:**
- [ ] Extension displays correct name "Bazel (Wix)" in marketplace
- [ ] Menu structure matches IntelliJ pattern (Bazel → Project → Open Project View File)
- [ ] Commands properly registered and accessible via Command Palette
- [ ] Activation events trigger extension on project view file presence

**Parallel Opportunities:** Can run simultaneously with project view parsing and UI development

## Stage 3: Build Icon Integration
Depends on: Stage 1

**Objective:** Modify existing BazelBuildIcon to use project view targets instead of file-based targeting

**Tasks:**
- [ ] Extend `BazelBuildIconService` to integrate with project view
- [ ] Modify target resolution logic to check for project view configuration
- [ ] Implement `derive_targets_from_directories` scanning functionality
- [ ] Update `FileTargetResolver` to use project view targets when available
- [ ] Add fallback behavior to maintain legacy functionality when no project view exists
- [ ] Implement target validation for project view configurations

**Verification Criteria:**
- [ ] Build icon uses project view targets when `.vscwb/.bazelproject` exists
- [ ] Derived targets correctly discovered from specified directories
- [ ] Legacy behavior preserved when no project view file present
- [ ] Build commands execute correct targets based on project view configuration

**Parallel Opportunities:** None - requires project view infrastructure

## Stage 4: Directory Filtering Implementation
Depends on: Stage 1

**Objective:** Implement directory filtering using either custom tree view or file exclude patterns based on complexity assessment

**Tasks:**
- [ ] Assess complexity of custom TreeDataProvider vs VS Code file exclude patterns
- [ ] Implement chosen approach (custom tree view OR file exclude pattern modification)
- [ ] Create `BazelProjectViewTreeProvider` if custom tree view selected
- [ ] Implement lazy loading for large directory structures (600K+ files)
- [ ] Add support for exclusion patterns (`-` prefix) in directories
- [ ] Integrate with existing workspace folder management

**Verification Criteria:**
- [ ] Only directories specified in `directories` attribute visible in explorer
- [ ] Exclusion patterns work correctly with `-` prefix
- [ ] Performance acceptable for large repositories (<3s load time)
- [ ] Memory usage optimized for filtered views

**Parallel Opportunities:** Can run simultaneously with test integration after Stage 1 completion

## Stage 5: Status Bar Integration
Depends on: Stage 1, Stage 3

**Objective:** Enhance existing status bar to show project view status and information

**Tasks:**
- [ ] Extend `BazelBuildIcon` status bar to include project view information
- [ ] Display active project view status (file name, target count, directory count)
- [ ] Show project view vs legacy mode indicators
- [ ] Add error states for invalid project view configurations
- [ ] Implement tooltips with detailed project view information
- [ ] Add click handlers for project view status interaction

**Verification Criteria:**
- [ ] Status bar clearly indicates when project view is active
- [ ] Target and directory counts display accurately
- [ ] Error states visible when project view has issues
- [ ] Status updates reflect project view file changes

**Parallel Opportunities:** None - requires build integration completion

## Stage 6: Test Integration
Depends on: Stage 1

**Objective:** Integrate project view test source filtering with VS Code Test Explorer

**Tasks:**
- [ ] Create `BazelProjectViewTestProvider` for test discovery integration
- [ ] Implement glob pattern matching for `test_sources` attribute
- [ ] Filter VS Code Test Explorer to show only project view test sources
- [ ] Restrict `bazel test` commands to project view test directories
- [ ] Implement automatic test scanning (non-Bazel query based)
- [ ] Add test source validation and error reporting

**Verification Criteria:**
- [ ] Test Explorer shows only tests from `test_sources` paths
- [ ] Test execution restricted to project view test sources
- [ ] Glob patterns work correctly for test source matching
- [ ] Test discovery performance acceptable for large repositories

**Parallel Opportunities:** Can run simultaneously with directory filtering after Stage 1 completion

## Stage 7: Command Implementation
Depends on: Stage 2

**Objective:** Implement project view file management commands and UI integration

**Tasks:**
- [ ] Implement `bazel.openProjectViewFile` command handler
- [ ] Add file creation logic if `.vscwb/.bazelproject` doesn't exist
- [ ] Create syntax highlighting for `.bazelproject` files
- [ ] Implement language server features (auto-completion, validation)
- [ ] Add quick fixes for common project view configuration errors
- [ ] Create template/snippet support for project view configuration

**Verification Criteria:**
- [ ] Command opens project view file correctly
- [ ] Syntax highlighting works for project view syntax
- [ ] Auto-completion suggests valid attribute names and values
- [ ] Error reporting provides actionable feedback

**Parallel Opportunities:** Can run simultaneously with other stages after Stage 2 completion

## Stage 8: Integration Testing & Performance Optimization
Depends on: Stage 3, Stage 4, Stage 5, Stage 6, Stage 7

**Objective:** Ensure all components work together correctly and meet performance requirements

**Tasks:**
- [ ] Create integration tests for complete project view workflow
- [ ] Performance testing with large repositories (600K+ files)
- [ ] Memory usage optimization and leak detection
- [ ] Regression testing for existing Bazel extension functionality
- [ ] Load testing for project view switching and updates
- [ ] Documentation updates and user guide creation

**Verification Criteria:**
- [ ] All performance KPIs met (<3s load time, <500ms target resolution, 60% memory reduction)
- [ ] Zero regressions in existing functionality
- [ ] Integration tests pass consistently
- [ ] Memory usage stable under load

**Parallel Opportunities:** None - requires all core functionality complete

*Tick each box with `[x]` when finished to track progress.* 