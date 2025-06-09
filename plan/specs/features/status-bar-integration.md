# Status Bar Integration Specification

## Purpose & Scope

This specification covers the enhancement of the existing BazelBuildIcon status bar to display project view status and information. It extends the current status bar functionality to show active project view details, target counts, directory counts, error states, and provide user interaction capabilities for project view management.

## Technical Requirements

- **Language/Framework:** TypeScript VS Code Extension with Node.js runtime
- **Dependencies:** Existing BazelBuildIcon status bar, BazelProjectView infrastructure, build icon integration
- **Performance Requirements:** Status updates <100ms, tooltip generation <50ms
- **Security Considerations:** Sanitize displayed information to prevent information disclosure

## Implementation Tasks

### Status Bar Extension
- [ ] Extend `BazelBuildIcon` class to include project view status information
- [ ] Add project view status properties to status bar item
- [ ] Implement status text generation for project view mode
- [ ] Create visual indicators for project view vs legacy mode
- [ ] Add conditional display logic based on project view availability

### Project View Status Display
- [ ] Display active project view file name in status bar
- [ ] Show target count from project view configuration
- [ ] Display directory count from directories attribute
- [ ] Add derived vs explicit target indicators
- [ ] Implement status text formatting and truncation for long names

### Error State Visualization
- [ ] Add error indicators for invalid project view configurations
- [ ] Display parsing error states with appropriate colors
- [ ] Show validation failure indicators
- [ ] Implement warning states for configuration issues
- [ ] Add error count display when multiple issues exist

### Interactive Tooltips
- [ ] Create detailed tooltips with project view information
- [ ] Show full project view file path in tooltip
- [ ] Display complete target list in tooltip
- [ ] Add directory listing with inclusion/exclusion indicators
- [ ] Include error details and suggested fixes in tooltip

### Click Handler Implementation
- [ ] Add click handlers for project view status interaction
- [ ] Implement quick actions menu on status bar click
- [ ] Add "Open Project View File" action
- [ ] Create "Refresh Project View" action
- [ ] Add "Switch to Legacy Mode" toggle option

### Status Update Integration
- [ ] Integrate with project view file change events
- [ ] Update status when build icon service mode changes
- [ ] Refresh status on target resolution completion
- [ ] Handle status updates during derived target discovery
- [ ] Implement debounced updates for frequent changes

## Dependencies

**Requires completion of:**
- [ ] architecture/project-view-infrastructure.md
- [ ] features/build-icon-integration.md

**Enables:**
- [ ] None (final integration component)

## Acceptance Criteria

- [ ] Status bar clearly indicates when project view is active
- [ ] Target and directory counts display accurately
- [ ] Error states are visible and informative
- [ ] Status updates reflect project view file changes immediately
- [ ] Tooltips provide comprehensive project view information
- [ ] Click interactions provide useful quick actions
- [ ] Visual design is consistent with existing status bar patterns
- [ ] Performance meets requirements for status updates and tooltips

## Testing Requirements

### Unit Tests
- [ ] Test status text generation with various project view configurations
- [ ] Test error state display logic
- [ ] Test tooltip content generation
- [ ] Test click handler implementation
- [ ] Test status update triggers and debouncing
- [ ] Test visual indicator logic for different modes

### Integration Tests
- [ ] Test complete status bar workflow with project view active
- [ ] Test status bar updates when project view changes
- [ ] Test error state integration with validation system
- [ ] Test tooltip display with real project view configurations
- [ ] Test click interactions and quick actions menu
- [ ] Test status bar behavior during build operations

### Visual Tests
- [ ] Verify status bar appearance in different themes
- [ ] Test tooltip formatting and readability
- [ ] Validate error state color coding
- [ ] Test status bar layout with long project names
- [ ] Verify icon and text alignment

## Integration Points

- **Inputs:**
  - Project view configuration changes
  - Build operation status updates
  - Error and validation results
  - User click interactions

- **Outputs:**
  - Status bar text and visual updates
  - Tooltip content display
  - Quick action menu commands
  - User feedback and notifications

- **APIs/Interfaces:**
  - `vscode.StatusBarItem` extension for project view display
  - `BazelBuildIcon.updateStatusBar(projectView?: ProjectViewConfig): void`
  - Click handler integration with VS Code command system

## Implementation Notes

### Status Bar Text Formatting
Design status text patterns for different scenarios:
```typescript
// Project view active
"$(tools) Bazel (ProjectView: 5 targets, 3 dirs)"

// Project view with errors
"$(error) Bazel (ProjectView: 2 errors)"

// Legacy mode
"$(tools) Bazel"

// Derived targets mode
"$(tools) Bazel (ProjectView: 12 derived targets)"
```

### Tooltip Content Structure
Create comprehensive tooltip information:
```
Project View: myproject.bazelproject
Targets (5):
  //app/main:binary
  //app/lib:library
  //tests:all
Directories (3):
  app/
  tests/
  -third_party/legacy
Status: Active, 0 errors
```

### Error State Integration
Integrate with validation system:
- Red background for critical errors
- Yellow/orange background for warnings
- Tooltip shows specific error messages
- Click handler opens project view file at error location

### Performance Optimization
- Cache formatted status text
- Debounce rapid updates (200ms)
- Lazy load tooltip content
- Optimize click handler registration

### Visual Design Consistency
Follow existing status bar patterns:
- Use consistent color theming
- Maintain icon usage patterns
- Follow VS Code status bar conventions
- Ensure accessibility compliance

### Quick Actions Implementation
Status bar click shows context menu:
```typescript
const actions = [
  {
    label: "Open Project View File",
    command: "bazel.openProjectViewFile"
  },
  {
    label: "Refresh Project View",
    command: "bazel.refreshProjectView"
  },
  {
    label: "Build Project View Targets",
    command: "bazel.buildProjectViewTargets"
  }
];
```

### Integration with Build States
Extend existing build state handling:
- Show project view context during builds
- Display target-specific progress information
- Maintain project view status during build operations
- Update status based on build results 