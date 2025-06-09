# Extension Metadata Specification

## Purpose & Scope

This specification covers the extension metadata updates required to support project view functionality, including rebranding to "Bazel (Wix)", command registration, menu structure implementation, and activation event configuration. This establishes the user-facing interface and extension lifecycle management for the project view feature.

## Technical Requirements

- **Language/Framework:** VS Code Extension package.json configuration, TypeScript command handlers
- **Dependencies:** VS Code Extension APIs, command registration system
- **Performance Requirements:** Command registration <100ms, menu rendering <50ms
- **Security Considerations:** Validate command inputs to prevent injection attacks

## Implementation Tasks

### Extension Branding Updates
- [ ] Update `package.json` displayName to "Bazel (Wix)"
- [ ] Update `package.json` description to "Bazel BUILD integration at Wix"
- [ ] Update publisher information if needed for Wix branding
- [ ] Review and update extension tags and categories
- [ ] Update README.md with new branding and project view features
- [ ] Update extension icon and logo assets to reflect Wix branding

### Activation Events Configuration
- [ ] Add activation event for `workspaceContains:.vscwb/.bazelproject`
- [ ] Ensure existing Bazel activation events remain functional
- [ ] Test activation event triggering with project view files
- [ ] Add activation for project view specific commands
- [ ] Optimize activation events to minimize extension load time

### Command Registration
- [ ] Create `bazel.openProjectViewFile` command definition
- [ ] Add command to package.json contributions section
- [ ] Implement command handler in extension activation
- [ ] Add command descriptions and titles for Command Palette
- [ ] Create keyboard shortcut bindings for project view commands
- [ ] Add command enablement conditions (when clauses)

### Menu Structure Implementation
- [ ] Design nested menu structure: Bazel → Project → Open Project View File
- [ ] Implement submenu contributions in package.json
- [ ] Add menu item icons and visual indicators
- [ ] Create context menu contributions for project files
- [ ] Test menu structure across different VS Code versions
- [ ] Ensure menu items are conditionally enabled based on workspace state

### Context Menu Integration
- [ ] Add context menu items for `.bazelproject` files
- [ ] Create "Create Project View File" context action
- [ ] Add "Validate Project View" context action
- [ ] Implement context menu enablement conditions
- [ ] Design consistent iconography for project view actions

## Dependencies

**Requires completion of:**
- [ ] None (Infrastructure component)

**Enables:**
- [ ] features/command-implementation.md

## Acceptance Criteria

- [ ] Extension displays "Bazel (Wix)" name in marketplace and installed extensions
- [ ] Menu structure matches IntelliJ pattern exactly
- [ ] Commands are accessible via Command Palette with proper descriptions
- [ ] Activation events trigger extension when project view files are present
- [ ] Context menus appear correctly for relevant file types
- [ ] All existing extension functionality remains unaffected
- [ ] Extension loads efficiently with new activation events

## Testing Requirements

### Unit Tests
- [ ] Test command registration and handler binding
- [ ] Test activation event configuration
- [ ] Test menu contribution definitions
- [ ] Test context menu enablement conditions
- [ ] Test command enablement logic

### Integration Tests
- [ ] Test complete menu navigation workflow
- [ ] Test command execution from all entry points (menu, palette, shortcuts)
- [ ] Test extension activation with various workspace configurations
- [ ] Test context menu integration across file types
- [ ] Test branding display across VS Code interfaces

### User Experience Tests
- [ ] Verify menu structure matches IntelliJ for consistency
- [ ] Test keyboard navigation through menu hierarchy
- [ ] Validate command discoverability in Command Palette
- [ ] Test extension marketplace presentation
- [ ] Verify icon and branding consistency

## Integration Points

- **Inputs:**
  - User menu selections and command invocations
  - VS Code workspace folder changes
  - File system events for activation triggers

- **Outputs:**
  - Command execution events
  - Menu state updates
  - Extension activation signals

- **APIs/Interfaces:**
  - `vscode.commands.registerCommand(commandId, handler)`
  - `package.json` contributions configuration
  - VS Code menu and command palette integration

## Implementation Notes

### Package.json Configuration
Update the following sections in package.json:
```json
{
  "displayName": "Bazel (Wix)",
  "description": "Bazel BUILD integration at Wix",
  "activationEvents": [
    "workspaceContains:.vscwb/.bazelproject",
    // ... existing events
  ],
  "contributes": {
    "commands": [
      {
        "command": "bazel.openProjectViewFile",
        "title": "Open Project View File",
        "category": "Bazel"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "bazel.openProjectViewFile",
          "when": "bazel.haveWorkspace"
        }
      ]
    }
  }
}
```

### Menu Hierarchy Implementation
Create nested menu structure following VS Code menu contribution patterns:
- Main "Bazel" menu group
- "Project" submenu under Bazel
- "Open Project View File" action under Project submenu

### Command Handler Patterns
Follow existing extension patterns for command implementation:
- Use async/await for file operations
- Implement proper error handling and user feedback
- Ensure commands are properly disposed on extension deactivation
- Follow VS Code naming conventions for command IDs

### Activation Optimization
- Use specific activation events to minimize extension load time
- Ensure new activation events don't conflict with existing ones
- Test activation behavior with different workspace configurations
- Implement lazy loading where possible for non-critical functionality 