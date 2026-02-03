# Bazel plugin for Visual Studio Code

[![Build Status](https://github.com/bazel-contrib/vscode-bazel/actions/workflows/build-release.yml/badge.svg)](https://github.com/bazel-contrib/vscode-bazel/actions/workflows/build-release.yml)

This extension provides support for Bazel in Visual Studio.

## Features

- **Syntax highlighting**
- **Bazel Targets** tree displays the build packages/targets in your
  workspace
- **CodeLens** links in BUILD files to directly launch a build or test by simply
  clicking on the targets
- **Buildifier** integration to lint and format your Bazel files (requires that
  [Buildifier](https://github.com/bazelbuild/buildtools/releases) be installed)
- **Bazel Task** definitions for `tasks.json`
- **Coverage Support** showing coverage results from `bazel coverage` directly
  in VS Code.
- **Code Navigation** to go to BUILD files or labels
- **Starlark Debugger** to debug Starlark code in your `.bzl` files during analysis phase (set breakpoints, step
  through code, inspect variables, etc.)
- **URI handler** to go to targets from outside of VSCode. (Example: vscode://bazelbuild.vscode-bazel//path/to/tests:target)

## Configuring the Extension

This extension adds a **Bazel** section to the extension settings in Visual
Studio Code. If you have Bazel installed in a location that is not on your
system path or if you wish to use a different version in the IDE, you should
set the **Bazel: Executable** setting to the location of the Bazel executable.

Similarly, the **Bazel: Buildifier Executable** setting can be configured if
you install Buildifier in a location that is not on your system path.

When Buildifier is installed, the **Format Document** command in Visual Studio
code will reformat `BUILD`, `WORKSPACE`, `.bzl`, and `.sky` files using the
tool and will display lint warnings from those files as you type. By default,
this extension does not automatically _fix_ lint warnings during formatting,
but you can opt into this by enabling the **Bazel: Buildifier Fix on Format**
setting.

### Using a separate output base

By default this extension will use the default output base for running queries. This will cause builds to block queries, potentially causing degraded performance. In Bazel versions since 7.1 it is safe to disable this by changing the `bazel.queriesShareServer` setting to `false`. In earlier versions it can be safely disabled after adding the convenience symlinks to `.bazelignore`, for example:

```
bazel-myreponame
bazel-bin
bazel-testlogs
```

See [#216](https://github.com/bazelbuild/vscode-bazel/issues/216) and [bazelbuild/bazel#106539](https://github.com/bazelbuild/bazel/issues/10653).

## Using the Starlark Debugger

The Starlark Debugger is designed to help you understand and debug Starlark code execution during Bazel's analysis phase.
It's particularly useful when working with macros, rule implementations, or aspects - giving you insight into how your build configuration is processed.

To start debugging, simply right-click any build target in the **Bazel Build Targets** view and select "Build Target with Starlark Debugger".
Or use the command palette and search for "Bazel: Build Target with Starlark Debugger".
This launches the Bazel build within Visual Studio Code's debugger, redirecting output to the Debug Console pane and automatically pausing at any breakpoints you've set.

**Helpful tips for effective debugging:**

- The debugger activates when Bazel evaluates Starlark code. With the flags automatically applied by the extension, your Starlark code will be reanalyzed each debugging session, ensuring breakpoints are consistently hit.
- Set breakpoints directly in `*.bzl` files next to line numbers where your Starlark functions are implemented.
- For builds requiring specific configuration arguments, use the `bazel.commandLine.commandArgs` setting to add them.

Once debugging is active and Bazel pauses, you can step through your Starlark code, add watch expressions in VSCode's Debug pane to monitor variables, and execute statements directly in the Debug Console input area.

To stop the debugging session, click the "Stop" button in the debugger.
This terminates the current Bazel process while keeping the Bazel server running for future builds.

## Using a language server (experimental)

This extension can use a language server for various features, such as go to definition and completions. There are currently two compatible language servers:

- [bazel-lsp](https://github.com/cameron-martin/bazel-lsp) is based on Facebook's Starlark language server and extends it with additional, Bazel-specific functionality.
- [starpls](https://github.com/withered-magic/starpls) is an implementation based on rust-analyzer which also provides Bazel-specific functionality.

In general, you need to install the language server binary and then set the `bazel.lsp.command` setting. See the README of the corresponding repo for more specific setup instructions.

We can't currently make any recommendation between these two. Both are under active development and are rapidly gaining more functionality.

## Bazel tasks

Bazel tasks can be configured from the `tasks.json` using the following structure:

```jsonc
{
  // See https://go.microsoft.com/fwlink/?LinkId=733558
  // for the documentation about the tasks.json format
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Check for flakyness",
      "type": "bazel",
      "command": "test",
      "targets": ["${input:pickFlakyTest}"],
      "options": ["--runs_per_test=9"],
    },
  ],
  "inputs": [
    {
      "id": "pickFlakyTest",
      "type": "command",
      "command": "bazel.pickTarget",
      "args": {
        "query": "kind('.*_test', //...:*)",
        "placeHolder": "Which test to check for flakyness?",
      },
    },
  ],
}
```

## Coverage support (Experimental)

For all `coverage` tasks, the coverage results are automatically loaded into VS
Code upon completion of the task. E.g., you could define your own task to
display the coverage provided by your integration tests using the following task
definition:

```jsonc
{
  "label": "Show test coverage from integration test",
  "type": "bazel",
  "command": "coverage",
  "targets": ["//test/integration/...", "//cpp/test/integration/..."],
  "options": ["--instrumentation_filter=.*"],
}
```

You might need additional Bazel `options` to get the intended coverage results.
In particular if are using remote builds, you might need to use the
`--experimental_split_coverage_postprocessing` and `--experimental_fetch_all_coverage_outputs`
options. See the documentation on [Code Coverage with Bazel](https://bazel.build/configure/coverage)
for more details.

Code coverage support in this extension is still rather fresh and might still
have rough edges. It was tested with the Java, C++, Go and Rust rules.
In case you are using the code coverage integration with any other language
(Python, Swift, Kotlin, Scala, ...), please let us know how things are going in
bazelbuild/vscode-bazel#367. Please share both positive and negative experiences
you might have.

For C++ and Rust, make sure to have `c++filt` / `rustfilt` installed and
available through the `$PATH`. Otherwise, only mangled, hard-to-decipher
function names will be displayed. For Java, no additional steps are required.

## Contributing

If you would like to contribute to the Bazel Visual Studio extension, please
refer to the [contribution guidelines](CONTRIBUTING.md) for information about
our patch acceptance process and setting up your development environment.
