# Change Log

## [0.12.0](https://github.com/bazel-contrib/vscode-bazel/compare/v0.11.0...v0.12.0) (2025-02-18)


### Features

* Add URI handler for jumping to targets ([#431](https://github.com/bazel-contrib/vscode-bazel/issues/431)) ([7e5ee8f](https://github.com/bazel-contrib/vscode-bazel/commit/7e5ee8f3fce34043a6b82a20d3de661589ea0812))
* **lsp:** Allow passing environment variables to the language server ([#438](https://github.com/bazel-contrib/vscode-bazel/issues/438)) ([0dc2684](https://github.com/bazel-contrib/vscode-bazel/commit/0dc2684aaa8e3ce5ae1b7e8d67e562329d3fb374))


### Bug Fixes

* Don't instantiate CompletionItemProvider when using a language server ([#440](https://github.com/bazel-contrib/vscode-bazel/issues/440)) ([7b6f85f](https://github.com/bazel-contrib/vscode-bazel/commit/7b6f85f9d08d0b6d1f1991f05e09cfcd8740407e))
* fix starlark debugger broken in release 0.11.0 ([#432](https://github.com/bazel-contrib/vscode-bazel/issues/432)) ([#433](https://github.com/bazel-contrib/vscode-bazel/issues/433)) ([b83b99c](https://github.com/bazel-contrib/vscode-bazel/commit/b83b99c57299d003d2858d859c487b2523d233d5))

## [0.11.0](https://github.com/bazel-contrib/vscode-bazel/compare/0.10.0...v0.11.0) (2024-11-28)


### Features

* Cmd-click to jump to a source file from a build rule ([#380](https://github.com/bazel-contrib/vscode-bazel/issues/380)) ([fa38d08](https://github.com/bazel-contrib/vscode-bazel/commit/fa38d08eceedf56777cfff2b8b0f74477e623154))
* **codelens:** Add a copy target command ([da62c67](https://github.com/bazel-contrib/vscode-bazel/commit/da62c6718515de8a0c50cffd77cf284acdbf85ab))
* **codelens:** Don't add target names for one line targets ([#407](https://github.com/bazel-contrib/vscode-bazel/issues/407)) ([4f02dc5](https://github.com/bazel-contrib/vscode-bazel/commit/4f02dc5a86d5293800b44b67000b14cbd4edce38))
* **codelens:** Extend CodeLens to build and run more targets ([00d9971](https://github.com/bazel-contrib/vscode-bazel/commit/00d9971761e5f4378b4157574afe1ef6c53b1a1d))
* **coverage:** Basic test coverage support ([#366](https://github.com/bazel-contrib/vscode-bazel/issues/366)) ([0d293b8](https://github.com/bazel-contrib/vscode-bazel/commit/0d293b81154b77c29900d89577a6b4ed1b725b93))
* **coverage:** Demangling C++ & Rust function names in coverage results ([#398](https://github.com/bazel-contrib/vscode-bazel/issues/398)) ([d28c294](https://github.com/bazel-contrib/vscode-bazel/commit/d28c29443610f627cbafcab1ddf7007a02934b9a))
* **coverage:** Demangling of Java function names in coverage results ([#388](https://github.com/bazel-contrib/vscode-bazel/issues/388)) ([7084368](https://github.com/bazel-contrib/vscode-bazel/commit/7084368f5e76741fd8cdc2fd072a799187e7e513))
* **coverage:** Load branch coverage from coverage files [#389](https://github.com/bazel-contrib/vscode-bazel/issues/389) ([e5c95e4](https://github.com/bazel-contrib/vscode-bazel/commit/e5c95e4567a80c82ada48031c9fde5561fc7c957))
* **lsp:** Add option to trace LSP communication ([#425](https://github.com/bazel-contrib/vscode-bazel/issues/425)) ([583fb65](https://github.com/bazel-contrib/vscode-bazel/commit/583fb651b0dc27d6deb56df6b617f1941c49f255))
* syntax highlighting for .bazelrc ([#379](https://github.com/bazel-contrib/vscode-bazel/issues/379)) ([2aea27e](https://github.com/bazel-contrib/vscode-bazel/commit/2aea27e45cca43e7f20b673f331b3c994c195e99)), closes [#259](https://github.com/bazel-contrib/vscode-bazel/issues/259)


### Bug Fixes

* **buildifier:** Handle relative buildifier path without warning [#387](https://github.com/bazel-contrib/vscode-bazel/issues/387) ([60051c5](https://github.com/bazel-contrib/vscode-bazel/commit/60051c54854332f9a00891ebd6fa46ac08a4c577))
* Change explorer UI label to "Bazel Targets" ([#409](https://github.com/bazel-contrib/vscode-bazel/issues/409)) ([dba3102](https://github.com/bazel-contrib/vscode-bazel/commit/dba310232cf89f125250b6b627c9e83e8afefcf2))
* **codelens:** Apply commandArgs to run targets ([#408](https://github.com/bazel-contrib/vscode-bazel/issues/408)) ([9c77c18](https://github.com/bazel-contrib/vscode-bazel/commit/9c77c18410b565f69fcad0f44f8861abf4fc9caf))
* **coverage:** Do not emit error on BRDA:0 entries ([#417](https://github.com/bazel-contrib/vscode-bazel/issues/417)) ([7f62f0e](https://github.com/bazel-contrib/vscode-bazel/commit/7f62f0eb775590417c12afc01029781d6851e4e8))
* **coverage:** Expand external local repo in coverage report ([#418](https://github.com/bazel-contrib/vscode-bazel/issues/418)) ([c115a86](https://github.com/bazel-contrib/vscode-bazel/commit/c115a86f20924fdbde89ed85c307b122958c2252))
* Default to Python syntax highlighting theme ([#397](https://github.com/bazel-contrib/vscode-bazel/issues/397)) ([2614f19](https://github.com/bazel-contrib/vscode-bazel/commit/2614f1985f9ea4ba0a16418f338cfcd736067f2a))
* Link the full label / file name instead of individual components ([#382](https://github.com/bazel-contrib/vscode-bazel/issues/382)) ([2e207c9](https://github.com/bazel-contrib/vscode-bazel/commit/2e207c9647881f335afa7288d7f05b70818be8bd))

## [0.10.0](https://github.com/bazelbuild/vscode-bazel/compare/0.9.0...v0.10.0) (2024-04-09)


### Features

* Add `bazel.info.workspace` command variable ([#351](https://github.com/bazelbuild/vscode-bazel/issues/351)) ([8ae24cf](https://github.com/bazelbuild/vscode-bazel/commit/8ae24cf235cfe66078be7deab86f4f83ac25bbd1))
* Add buildifier Json File Configuration ([#357](https://github.com/bazelbuild/vscode-bazel/issues/357)) ([afc3aed](https://github.com/bazelbuild/vscode-bazel/commit/afc3aeddfce0821a10a0b1fa889855a2a12a2433))
* Introduce `pickTarget` and `pickPackage` command variables ([#354](https://github.com/bazelbuild/vscode-bazel/issues/354)) ([2ef6d2a](https://github.com/bazelbuild/vscode-bazel/commit/2ef6d2ad3f30700bc7076e8d3b7d42e81abb1ed2))
* Pick up `.buildifier.json` configuration from the Bazel workspace root ([#350](https://github.com/bazelbuild/vscode-bazel/issues/350)) ([c2f3f8c](https://github.com/bazelbuild/vscode-bazel/commit/c2f3f8cb486edb079d129db0c08b53535f88a20c))
* Support bazel tasks from tasks.json ([#346](https://github.com/bazelbuild/vscode-bazel/issues/346)) ([f2426e4](https://github.com/bazelbuild/vscode-bazel/commit/f2426e4e29c88e04cb1589f518c169804deda70f))
* Support relative paths for bazel.buildifierExecutable ([#350](https://github.com/bazelbuild/vscode-bazel/issues/350)) ([c2f3f8c](https://github.com/bazelbuild/vscode-bazel/commit/c2f3f8cb486edb079d129db0c08b53535f88a20c))
* Support running buildifier through Bazel ([#350](https://github.com/bazelbuild/vscode-bazel/issues/350)) ([c2f3f8c](https://github.com/bazelbuild/vscode-bazel/commit/c2f3f8cb486edb079d129db0c08b53535f88a20c))


### Bug Fixes

* Activate the extension automatically ([#344](https://github.com/bazelbuild/vscode-bazel/issues/344)) ([085262e](https://github.com/bazelbuild/vscode-bazel/commit/085262ea23607449f098b1cb47b6f4b9b4c84881))
* Add a welcome view to the Bazel Build Targets tree view ([#372](https://github.com/bazelbuild/vscode-bazel/issues/372)) ([1cbdfd6](https://github.com/bazelbuild/vscode-bazel/commit/1cbdfd6ad60b2bcee04dd4e689b2ac04f37672d2))
* Don't wait on the "Buildifier not found" notification ([#368](https://github.com/bazelbuild/vscode-bazel/issues/368)) ([8b659a2](https://github.com/bazelbuild/vscode-bazel/commit/8b659a23875e80ba278b99846e019cddb2c99338))
* Enable the "Restart LSP" command only if the language server is enabled ([#345](https://github.com/bazelbuild/vscode-bazel/issues/345)) ([15793a4](https://github.com/bazelbuild/vscode-bazel/commit/15793a40abb6127cbe08b53827440f6938a09369))
* Hide commands which are intended to be command variables ([#347](https://github.com/bazelbuild/vscode-bazel/issues/347)) ([6d3e988](https://github.com/bazelbuild/vscode-bazel/commit/6d3e9884e345e754706f20d847e1f86b8729f40c))

## 0.9.0 (February 20, 2024)

### New Features

- Support relative target completion (@kon72)
- Add support for launching an LSP (@cameron-martin)

### Bug fixes

- Make queries share the same server by default (@limdor)

## 0.8.1 (January 2, 2024)

### Bug Fixes

- Fix regressions caused by `bazel query` optimization in 0.8.0 (@daivinhtran)
- Add new and upcoming files names to the list of files marking the root of a repo / workspace (@hypdeb)

### Internal Improvements

- Migrate to eslint (@hypdeb)
- Upgrade typescript (@cameron-martin)

## 0.8.0 (December 15, 2023)

### New Features

- Add codelens support for running binary targets (@avx-rchung)

- WORKSPACE.bazel is now identified as starlark (@lalten)

- Add bazel.runTarget command for running targets (@romannikov)

- Add bazel.queryOutputBase configuration setting (@sheldonneuberger-sc)

  Changes where output_base is placed. This is convenient for when someone wants bazel using something other than TMPDIR. This is useful if you use a ramdisk for faster builds, or if your TMPDIR has space or security constraints.

- Add bazel.info.\* commands (@jfirebaugh)

  This command can be used in launch configurations to embed the results of `bazel info` values. For example:

      "initCommands": [
        "platform settings -w ${command:bazel.info.execution_root}",
      ]

### Bug Fixes

- Target completion no longer requires leading quotation mark (@kon72)
- Optimized performance of `bazel query` operations (@iamricard)
- CI updated to Node 20 (@jfirebaugh)

## 0.7.0 (December 6, 2022)

### New Features

- Add bazel.commandLine.queryExpression configuration setting (@maximMalofeev)

  A [query language expression](https://bazel.build/query/language) which determines the packages displayed in the workspace tree and quick picker. The default inspects the entire workspace, but you could narrow it. For example: `//part/you/want/...:*`

- Make executable and buildifierExecutable settings `machine-overridable` (@jfirebaugh)

  This allows them to be set in workspace or folder settings.

- Starlark syntax highlighting now applies to any file with a `.bazel` extension (@dierksen)

### Bug Fixes

- Fix and document providing flags to `getTargetOutput` (@jfirebaugh)

  Additional Bazel flags can be provided to the `bazel.getTargetOutput` command:

      "inputs": [
          {
              "id": "debugOutputLocation",
              "type": "command",
              "command": "bazel.getTargetOutput",
              "args": ["//my/binary:target", ["--compilation_mode", "dbg"]],
          }
      ]

## 0.6.0 (September 14, 2022)

### New Features

- Add bazel.getTargetOutput command.

  This command can be used in launch configurations to obtain the path to an executable built by Bazel. For example, you can set the "program" attribute of a launch configuration to an input variable:

      "program": "${input:binaryOutputLocation}"

  Then define a command input variable:

      "inputs": [
          {
              "id": "binaryOutputLocation",
              "type": "command",
              "command": "bazel.getTargetOutput",
              "args": ["//my/binary:target"],
          }
      ]

### Bug Fixes

- return `default` for .sky files in getBuildifierFileType (@arahatashun)

## 0.5.0 (October 29, 2021)

### New Features

- Implemented IntelliSense code completion for targets and packages in BUILD files.
- Added rudimentary goto definition handling for BUILD files.

### Bug Fixes

- Fixed problems with CodeLens on Windows.
- Added support for "no-floating-promises" lint check and fixed violations.
- Made sure that multiple targets in CodeLens are sorted.

### Contributors

We would like to thank Alex Frasson, Chi Wang, ericisko, hensom, Jonathan Dierksen and Neil Ding for their great contributions.

## 0.4.1 (April 14, 2021)

### Bug Fixes

- Fix CVE-2021-22539: Malicious project can cause vscode-bazel to run arbitrary executable when linting a \*.bzl file.

## 0.4.0 (August 21, 2020)

### New Features

- CodeLens has been disabled by default, but can be enabled via a new option.

### Bug Fixes

- WORKSPACE.bazel files are now properly recognized.
- We made multiple improvements to Windows support.

## 0.3.0 (September 19, 2019)

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

## 0.2.0 (May 15, 2019)

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

## 0.1.0 (January 23, 2019)

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

## 0.0.2 (November 28, 2018)

- Fix an issue where runtime dependencies were listed as development dependencies.

## 0.0.1 (November 28, 2018)

- Initial release.
