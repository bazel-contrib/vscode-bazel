# Bazel plugin for Visual Studio Code

This repository provides support for Bazel in Visual Studio.

## Features

* **Bazel Build Targets** tree displays the build packages/targets in your
  workspace
* Debug Starlark code in your `.bzl` files during a build (set breakpoints, step
  through code, inspect variables, etc.)

## Configuring the Extension

This extension adds a **Bazel** section to the extension settings in Visual
Studio Code. If you have Bazel installed in a location that is not on your
system path or if you wish to use a different version in the IDE, you should
set the **Bazel: Executable** setting to the location of the Bazel executable.

## Using the Starlark Debugger

Currently, the Starlark debugger can be used by right-clicking a build target in
the **Bazel Build Targets** view and selecting "Build Target with Debugging".
This will start the build inside the Visual Studio Code debugger (output will
be redirected to the Debug Console pane) and it will pause on any breakpoints
hit during execution.

When a Bazel thread is paused, you can step through Starlark code, add watch
expressions, and execute arbitrary statements by typing them in the input area
of the Debug Console.

Clicking the "Stop" button in the debugger will kill the Bazel process being
debugger, allowing you to halt the current build. The Bazel server, however,
will continue running.
