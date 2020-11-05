# Change Log

## Version 0.4.0 (August 21, 2020)

### New Features

- CodeLens has been disabled by default, but can be enabled via a new option.

### Bug Fixes

- WORKSPACE.bazel files are now properly recognized.
- We made multiple improvements to Windows support.

## Version 0.3.0 (September 19, 2019)

### Breaking Changes

- This extension now requires Visual Studio Code 1.30 or higher.
- This extension now requires buildifier version 0.25.1 or higher.

### New Features

- Buildifier diagnostics have been refined. For example, now only the
  violating range of text is highlighted instead of the entire line.
- Added the "Copy Label to Clipboard" context menu option to the Bazel
  Build Targets view.
- The `.star` file extension is now recognized as Starlark for syntax
  highlighting.

### Bug Fixes

- Formatting a BUILD or Starlark file no longer deletes the editor's content
  if the file contains syntax errors.
- BUILD files named `BUILD.bazel` are now correctly treated as BUILD files,
  not `bzl` files, for the purposes of formatting and linting.

## Version 0.2.0 (May 15, 2019)

### New Features

- Support formatting of `*.BUILD` files.
- Bazel Build Targets view and Command Palette QuickPicks results are now
  sorted making them easy to scan.
- Targets rooted in the directory opened are also included in the TreeView
  and Command Palette QuickPicks.
- Support in the Bazel Build Targets view and Command Palette QuickPicks for
  building the whole package or the package recursively (`:all` and `/...`).

### Bug Fixes

- On Windows, clicking a target in the Bazel Build Targets view should now
  navigate to the BUILD file where that target is defined.
- The "Bazel: Build Target with Debugging" command has been renamed to
  "Bazel: Build Target with Starlark Debugger" to clarify that this command
  debugs the Starlark build rules themselves and not the binary/executable
  being built.
- Handle cases where `buildifier` exists with a non zero result, but did
  successfully run.
- Fix case where the Bazel executable wasn't properly defaulting.
- Packages created by otherwise empty `BUILD` files are now properly detected
  so the Bazel Build Targets matches the on-disk layout more closely.
- Fixed issue where VS Code would hang when the Bazel Build Targets view was
  opened and a workspace folder was _not_ part of a Bazel workspace.

## Version 0.1.0 (January 23, 2019)

### New Features

- CodeLens adds build/test commands to targets in the editor for BUILD files.
- If Buildifier is installed, it will be used as the formatter for BUILD,
  `.bzl`, and other Starlark files, and lint warnings will be annotated in
  the editor and problems panel.
- Targets in BUILD files are now treated as "symbols" so they appear in the
  Outline view, can be navigated to using the "Go to Symbol" command, and
  so forth.
- The "Bazel: Clean" command has been added to the command palette.
- The "Bazel Build Targets" explorer view now has an explicit refresh
  control to requery the workspace if there are changes that cannot be
  auto-detected.

### Bug Fixes

- Improve path resolution for breakpoints in local/external workspaces, which
  should solve some issues with the debugger not stopping when a breakpoint
  is reached.
- When a Bazel command is invoked from the command palette, a quick pick panel
  is now presented that allows the user to type or select which target should
  be built or tested.

## Version 0.0.2 (November 28, 2018)

- Fix an issue where runtime dependencies were listed as development dependencies.

## Version 0.0.1 (November 28, 2018)

- Initial release.
