# Command Integration & Build Execution Specification

## Purpose & Scope
This specification covers the integration of the icon infrastructure with the build command system, including the creation of the "bazel.buildCurrentFile" command, integration with existing IBazelCommandAdapter patterns, and connection to the Bazel task execution system.

## Technical Requirements
- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** Existing IBazelCommandAdapter interface, createBazelTask() function, tasks.ts module
- **Performance Requirements:** Command execution startup <500ms, proper async handling for build operations
- **Security Considerations:** Secure command argument handling, validate target names before execution

## Implementation Tasks
- [ ] Create "bazel.buildCurrentFile" command handler in package.json contributes.commands
- [ ] Implement `BazelBuildIconAdapter` class extending IBazelCommandAdapter interface
- [ ] Integrate with existing `createBazelTask()` function for background build execution
- [ ] Create command registration logic in extension activation
- [ ] Implement icon click event binding to command execution via `vscode.commands.executeCommand`
- [ ] Add build progress tracking and icon state updates during task execution
- [ ] Integrate with existing configuration system (bazel.executable, commandArgs, etc.)
- [ ] Create error handling for build failures with icon state updates
- [ ] Implement build output integration with VS Code terminal/output panel
- [ ] Add support for build cancellation when build is in progress
- [ ] Create unit tests for command registration and execution flow

## Dependencies
**Requires completion of:**
- [ ] architecture/icon-infrastructure.md
- [ ] features/file-target-resolver.md

**Enables:**
- [ ] features/visual-feedback.md
- [ ] testing/integration-testing.md

## Acceptance Criteria
- [ ] Icon click triggers build for the correct target resolved from current file
- [ ] Build output appears in existing VS Code terminal/output panel
- [ ] Icon states update correctly during build lifecycle (idle → building → success/error)
- [ ] Respects all existing Bazel configuration settings from VS Code preferences
- [ ] Proper error handling when target resolution fails
- [ ] Build cancellation works correctly and resets icon state
- [ ] Command is only available when Bazel workspace is detected
- [ ] Integration with existing extension command infrastructure

## Testing Requirements
- [ ] Unit tests for `BazelBuildIconAdapter` class methods
- [ ] Unit tests for command registration and handler binding
- [ ] Unit tests for build task creation and execution
- [ ] Unit tests for icon state transitions during build lifecycle
- [ ] Integration tests for end-to-end build command flow
- [ ] Integration tests with existing Bazel configuration system
- [ ] Error handling tests for various failure scenarios
- [ ] Performance tests for command execution timing

## Integration Points
- **Inputs:** 
  - Icon click events from BazelBuildIcon
  - Target resolution results from FileTargetResolver
  - Bazel configuration from VS Code settings
  - User cancellation requests
- **Outputs:** 
  - Bazel build task execution
  - Icon state updates during build process
  - Build output to VS Code terminal/output panel
  - Success/failure notifications
- **APIs/Interfaces:** 
  - `vscode.commands.registerCommand` for command registration
  - `IBazelCommandAdapter` for consistent adapter pattern
  - `createBazelTask()` for task execution
  - `vscode.tasks.executeTask` for background execution

## Implementation Notes
- Follow existing extension patterns for command registration and execution
- Ensure proper async/await handling for build operations
- Use existing task execution infrastructure to maintain consistency
- Implement proper cleanup for cancelled builds
- Consider build queue management for rapid consecutive builds
- Integrate with existing VS Code notification system for build results 