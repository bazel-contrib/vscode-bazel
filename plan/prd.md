# Product Requirements Document: VS Code Bazel Build Icon

## Overview

A green Bazel build icon integrated into the VS Code action bar that provides one-click build functionality for the currently opened file. This feature mirrors the IntelliJ Bazel plugin's sync button, offering developers a streamlined way to trigger Bazel builds without navigating through command palettes or context menus.

The feature will automatically detect the appropriate Bazel target for the current file and execute the build, providing visual feedback throughout the process. This enhancement significantly reduces the friction in the development workflow and brings VS Code's Bazel integration closer to feature parity with IntelliJ.

## Goals and Success Criteria

**Business Goals:**
- Improve developer productivity by reducing build trigger time from 10+ seconds to <2 seconds
- Increase user adoption of the VS Code Bazel extension
- Achieve feature parity with IntelliJ Bazel plugin
- Enhance user satisfaction and reduce workflow interruptions

**Technical Goals:**
- Seamless integration with existing VS Code Bazel extension architecture
- Reliable target detection for various project structures
- Responsive UI with clear visual feedback states
- Minimal performance impact on VS Code startup and operation

**Success Criteria (30-90 days):**
- 70% reduction in average time to trigger builds
- 40% increase in build command usage frequency
- User satisfaction score >4.5/5 for the new feature
- Zero critical bugs reported in production
- <500ms response time for icon state changes

## Target User Personas

**Primary User: Full-Stack Developer "Sarah"**
- **Context**: Works daily with large Bazel monorepos, frequently switches between multiple files
- **Pain Points**: Tired of Command Palette navigation, wants instant feedback, values visual cues
- **Needs**: Quick build triggering, clear status indication, seamless workflow integration
- **Technical Level**: Intermediate to advanced, familiar with build systems
- **Usage Pattern**: Builds 15-30 times per day, often while debugging or testing changes

**Secondary User: DevOps Engineer "Mike"**
- **Context**: Manages build configurations, troubleshoots build issues, works with CI/CD pipelines
- **Pain Points**: Needs reliable build triggering, wants consistency across tools, troubleshoots build failures
- **Needs**: Robust error handling, build output visibility, configuration flexibility
- **Technical Level**: Advanced, deep knowledge of Bazel and build systems
- **Usage Pattern**: Builds 5-15 times per day, focuses on build configuration and optimization

## User Experience Flow

```
1. Developer opens VS Code workspace with Bazel project
   ↓
2. Green Bazel icon appears in action bar (if workspace has BUILD files)
   ↓
3. Developer opens a source file (e.g., .java, .ts, .py)
   ↓
4. Developer clicks Bazel icon
   ↓
5. System detects file → finds containing BUILD → identifies target
   ↓
6. Icon changes to "building" state (spinner animation)
   ↓
7. Bazel build command executes in background
   ↓
8. Build completes: Icon shows success (✓) or failure (✗) for 3 seconds
   ↓
9. Icon returns to idle state
   ↓
10. [If build failed] Developer can click again or check terminal output
```

**Alternative Flow - Ambiguous Target:**
- If multiple targets found → Show quick pick menu
- If no targets found → Show error message + option to select manually
- If no BUILD files → Icon disabled with tooltip explanation

## Core Features (MVP)

- **Action Bar Icon Integration**: Green Bazel logo positioned in VS Code action bar
- **File-to-Target Resolution**: Automatically detect Bazel target for currently active editor file
- **One-Click Build Trigger**: Execute `bazel build` command for detected target
- **Visual State Management**: Icon states for idle, building, success, and error
- **Build Output Integration**: Display build results in existing VS Code terminal/output panel
- **Error Handling**: Graceful handling of missing targets, build failures, and workspace issues
- **Settings Integration**: Respect existing Bazel extension configuration (executable path, flags)
- **Tooltip Support**: Hover text explaining current state and functionality
- **Workspace Detection**: Only show icon when valid Bazel workspace detected

**Rationale**: These features provide the essential functionality needed to replicate the IntelliJ experience while leveraging existing VS Code Bazel extension infrastructure.

## Advanced or Stretch Features

- **Build History Dropdown**: Right-click icon to see recent builds and re-run them
- **Multi-Target Building**: Support for building multiple related targets simultaneously
- **Build Cache Integration**: Visual indication of cache hits/misses
- **Keyboard Shortcut**: Configurable hotkey for triggering builds
- **Progress Indicators**: Detailed progress bar showing build steps
- **Build Notifications**: OS-level notifications for long-running builds
- **Smart Target Prediction**: ML-based target suggestion based on file patterns
- **Integration with Test Explorer**: Trigger test runs for test files
- **Build Artifacts View**: Quick access to generated outputs and artifacts
- **Team Sharing**: Share build configurations and frequent targets across team

## Technical Architecture and Stack

**Frontend Components:**
- **VS Code Extension API**: StatusBarItem for action bar integration
- **Icon Assets**: SVG icons for different states (idle, building, success, error)
- **State Management**: TypeScript classes for icon state transitions
- **UI Integration**: VS Code theme-aware styling and animations

**Backend/Core Logic:**
- **Target Resolution Engine**: File path → BUILD file → target mapping logic
- **Bazel Command Interface**: Integration with existing BazelCommand classes
- **Workspace Detection**: Leverage existing BazelWorkspaceInfo infrastructure
- **Build Execution**: Utilize current task execution system (vscode.tasks)

**Data Flow:**
```
Active Editor File → FileTargetResolver → BazelWorkspaceInfo → 
BazelCommand → Task Execution → Build Results → Icon State Update
```

**Key Integration Points:**
- Extend package.json contributes.commands section
- Implement new command handler in existing command structure
- Utilize IBazelCommandAdapter interface for build execution
- Integrate with existing configuration system

**Technology Stack:**
- TypeScript (existing extension language)
- VS Code Extension APIs (StatusBar, Commands, Tasks)
- Node.js (existing runtime)
- SVG icons with theme support

## Out-of-Scope / Future Features

**Explicitly Out-of-Scope for MVP:**
- Custom build command configuration beyond existing settings
- Integration with external CI/CD systems
- Advanced build analytics and reporting
- Multi-workspace support in single VS Code window
- Build result caching beyond Bazel's native caching
- Integration with remote Bazel execution
- Advanced build parallelization controls
- Custom icon themes or user-uploaded icons

**Future Considerations:**
- Integration with VS Code remote development
- Support for Bazel query operations from icon
- Build performance profiling and optimization suggestions
- Integration with version control for build-on-commit workflows

## Metrics and KPIs

**Technical Performance Metrics:**
- Icon display latency: <500ms after workspace load
- Build trigger response time: <200ms from click to build start
- Target resolution accuracy: >95% for common project structures
- Extension memory footprint increase: <5MB
- Build command execution time: No degradation vs. existing commands

**User Experience Metrics:**
- Build trigger time reduction: Target 70% improvement (from ~10s to ~3s)
- Feature adoption rate: >60% of active extension users within 90 days
- User satisfaction score: >4.5/5 in feedback surveys
- Support ticket reduction: 20% fewer build-related issues

**Business Metrics (30-90 days):**
- Extension active users: 15% increase
- Build command usage frequency: 40% increase
- Feature discoverability: >80% of users notice the icon within first session
- User retention: 10% improvement in daily active users
- Community feedback: Positive sentiment in VS Code marketplace reviews

**Error and Reliability Metrics:**
- Icon state inconsistency rate: <1%
- Build trigger failure rate: <2%
- False positive target detection: <5%
- Critical bug reports: 0 in first 90 days
- Extension crash rate: No increase from baseline
