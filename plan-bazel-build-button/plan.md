# Implementation Plan: VS Code Bazel Build Icon

## Technical Context
- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Architecture:** Extension-based integration using existing IBazelCommandAdapter pattern and task execution system
- **Key Dependencies:** VS Code Extension APIs (StatusBar, Commands, Tasks), existing Bazel infrastructure (BazelWorkspaceInfo, bazel_utils, tasks.ts)

## Stage 1: Foundation & Icon Infrastructure
Depends on: None

**Objective:** Establish basic icon display and state management infrastructure

**Tasks:**
- [ ] Create action bar icon component using VS Code StatusBarItem API
- [ ] Design and implement green Bazel SVG icon assets for different states (idle, building, success, error)
- [ ] Implement icon state management system with TypeScript enums and state transitions
- [ ] Add icon configuration section to package.json contributes section
- [ ] Integrate icon display with Bazel workspace detection using BazelWorkspaceInfo
- [ ] Create icon tooltip system with contextual help text
- [ ] Add icon enable/disable configuration setting to package.json configuration section

**Verification Criteria:**
- [ ] Icon appears in action bar when Bazel workspace is detected
- [ ] Icon state changes are visually smooth and responsive (<100ms)
- [ ] Icon disappears when no Bazel workspace is present
- [ ] Tooltip provides clear status information

**Parallel Opportunities:** Can run simultaneously with Stage 2 (File Resolution Engine) development

## Stage 2: File-to-Target Resolution Engine  
Depends on: None

**Objective:** Build intelligent target detection for the currently active file

**Tasks:**
- [ ] Implement FileTargetResolver class to map files to Bazel targets
- [ ] Create logic to find containing BUILD file using path traversal (leverage getBazelWorkspaceFolder pattern)
- [ ] Implement Bazel query integration to find targets containing specific files
- [ ] Add target disambiguation logic for files belonging to multiple targets
- [ ] Create fallback mechanism to manual target selection via QuickPick
- [ ] Implement caching system for target resolution to improve performance
- [ ] Add error handling for files without associated targets

**Verification Criteria:**
- [ ] Target resolution accuracy >95% for common project structures
- [ ] Resolution time <200ms for cached results
- [ ] Graceful fallback to manual selection when ambiguous
- [ ] Proper error messages for unsupported file types

**Parallel Opportunities:** Can run simultaneously with Stage 1 (Icon Infrastructure) development

## Stage 3: Command Integration & Build Execution
Depends on: Stage 1, Stage 2

**Objective:** Integrate icon with existing build command infrastructure

**Tasks:**
- [ ] Create new command handler "bazel.buildCurrentFile" following existing command patterns
- [ ] Implement BazelBuildIconAdapter class extending IBazelCommandAdapter interface
- [ ] Integrate with existing createBazelTask() function for background build execution
- [ ] Add command registration to package.json contributes.commands section
- [ ] Connect icon click event to command execution via vscode.commands.executeCommand
- [ ] Implement build progress tracking and icon state updates during execution
- [ ] Add integration with existing configuration system (bazel.executable, commandArgs, etc.)

**Verification Criteria:**
- [ ] Icon click triggers build for correct target
- [ ] Build output appears in existing VS Code terminal/output panel
- [ ] Icon states update correctly during build lifecycle
- [ ] Respects existing Bazel configuration settings

**Parallel Opportunities:** None - requires both previous stages

## Stage 4: Visual Feedback & User Experience
Depends on: Stage 3

**Objective:** Implement responsive UI feedback and error handling

**Tasks:**
- [ ] Implement build progress animations (spinner during building)
- [ ] Create success/error state indicators with automatic timeout (3-5 seconds)
- [ ] Add build failure notification system with actionable error messages
- [ ] Implement right-click context menu with additional options (build options, target selection)
- [ ] Create keyboard shortcut support for power users
- [ ] Add build output integration with click-to-view-details functionality
- [ ] Implement graceful degradation when Bazel is unavailable

**Verification Criteria:**
- [ ] Visual feedback is immediate and informative
- [ ] Error states provide actionable guidance to users
- [ ] Context menu enhances rather than clutters the experience
- [ ] Keyboard shortcuts work reliably

**Parallel Opportunities:** Can run simultaneously with Stage 5 (Testing & Quality) testing development

## Stage 5: Testing & Quality Assurance
Depends on: Stage 2

**Objective:** Ensure reliability and performance through comprehensive testing

**Tasks:**
- [ ] Create unit tests for FileTargetResolver with various project structures
- [ ] Implement integration tests for build command execution flow
- [ ] Add performance tests for icon state transitions and target resolution
- [ ] Create edge case tests (no BUILD files, malformed targets, missing Bazel)
- [ ] Implement automated testing for different workspace configurations
- [ ] Add memory leak detection tests for icon state management
- [ ] Create user acceptance tests for core workflows

**Verification Criteria:**
- [ ] >95% test coverage for core functionality
- [ ] All performance requirements met in test environment
- [ ] Edge cases handled gracefully
- [ ] Memory usage stays within bounds during extended use

**Parallel Opportunities:** Can run simultaneously with Stage 4 (User Experience) development

## Stage 6: Configuration & Advanced Features
Depends on: Stage 4

**Objective:** Add configurability and enhanced functionality

**Tasks:**
- [ ] Implement user configuration options (auto-detect vs manual target selection)
- [ ] Add build output visibility controls (show/hide terminal on build)
- [ ] Create target history and quick re-run functionality
- [ ] Implement build cache status indication (optional stretch feature)
- [ ] Add support for custom Bazel commands beyond basic build
- [ ] Create workspace-specific configuration override support
- [ ] Implement telemetry collection for feature usage analytics (optional)

**Verification Criteria:**
- [ ] Configuration options work as documented
- [ ] Advanced features enhance without complicating basic workflow
- [ ] Settings persist correctly across VS Code sessions
- [ ] Feature adoption tracking provides meaningful insights

**Parallel Opportunities:** None - requires stable core functionality

## Stage 7: Documentation & Release Preparation
Depends on: Stage 5, Stage 6

**Objective:** Prepare feature for production release with comprehensive documentation

**Tasks:**
- [ ] Update README.md with new feature documentation
- [ ] Create user guide with screenshots and workflow examples
- [ ] Document configuration options and troubleshooting guide
- [ ] Update CHANGELOG.md with feature description and migration notes
- [ ] Create developer documentation for extending icon functionality
- [ ] Prepare marketplace assets (screenshots, feature descriptions)
- [ ] Conduct final integration testing with real-world Bazel projects

**Verification Criteria:**
- [ ] Documentation is clear and actionable for end users
- [ ] All configuration options are documented with examples
- [ ] Troubleshooting guide covers common issues
- [ ] Release assets ready for marketplace publication

**Parallel Opportunities:** None - requires completed implementation

## Stage 8: Integration & Deployment
Depends on: Stage 7

**Objective:** Deploy feature to production with monitoring and feedback collection

**Tasks:**
- [ ] Integrate feature branch with main extension codebase
- [ ] Conduct final compatibility testing with various VS Code versions
- [ ] Deploy to VS Code marketplace as minor version update
- [ ] Monitor user feedback and issue reports in first 48 hours
- [ ] Collect performance metrics and usage analytics
- [ ] Prepare hotfix deployment process for critical issues
- [ ] Plan iteration cycle based on initial user feedback

**Verification Criteria:**
- [ ] Feature deploys successfully without breaking existing functionality
- [ ] No critical issues reported in first week of release
- [ ] User adoption rate meets expectations from PRD success criteria
- [ ] Performance metrics align with PRD technical requirements

**Parallel Opportunities:** None - final deployment stage

---

*Tick each box with `[x]` when finished to track progress.* 