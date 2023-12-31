// Copyright 2018 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as vscode from "vscode";
import { BazelWorkspaceInfo } from "./bazel_workspace_info";

/**
 * Arbitrary types should implement this interface to specify how a task should
 * be created to represent the Bazel build or test of a particular target or set
 * of targets in the UI (explorer tree view, quick pick, document link, etc.).
 */
export interface IBazelCommandAdapter {
  /**
   * Returns options that control how Bazel is launched (such as by a task, or
   * when launching the debugger).
   */
  getBazelCommandOptions(): IBazelCommandOptions;
}

/** Encapsulates the information needed to invoke Bazel. */
export interface IBazelCommandOptions {
  /** The workspace folder in which Bazel should be launched. */
  workspaceInfo: BazelWorkspaceInfo;

  /** A list of targets to build (most often, this is just one). */
  targets: string[];

  /**
   * The list of (non-startup) command line flags that should be passed to
   * Bazel.
   */
  options: string[];
}

/** Common functionality used to execute Bazel commands. */
export abstract class BazelCommand {
  /**
   * Initializes a new Bazel command instance.
   *
   * @param bazelExecutable The path to the Bazel executable.
   * @param workingDirectory The path to the directory from which Bazel will be
   * spawned.
   * @param options Command line options that will be passed to Bazel (targets,
   * query strings, flags, etc.).
   */
  public constructor(
    readonly bazelExecutable: string,
    readonly workingDirectory: string,
    readonly options: string[] = [],
  ) {}

  /**
   * Overridden by subclasses to provide the Bazel command that should be
   * executed (for example, {@code build}, {@code test}, or {@code query}).
   */
  protected abstract bazelCommand(): string;

  /** The args used to execute the for the command. */
  protected execArgs(
    additionalOptions: string[] = [],
    additionalStartupOptions: string[] = [],
  ) {
    const bazelConfigCmdLine =
      vscode.workspace.getConfiguration("bazel.commandLine");
    const startupOptions = bazelConfigCmdLine.get<string[]>("startupOptions");

    // Options that are applied to all Bazel commands
    const defaultOptions = [
      // See https://bazel.build/versions/6.4.0/external/lockfile
      // Prevent the extension from automatically creating the MODULE.bazel file
      // on bazel v7 or newer which enable bzlmod by default
      // Bazel can still enforce creating the MODULE.bazel automatically
      // when users run command in local.
      "--lockfile_mode=off",
    ];

    const result = startupOptions
      .concat(additionalStartupOptions)
      .concat([this.bazelCommand()])
      .concat(this.options)
      .concat(defaultOptions)
      .concat(additionalOptions);

    return result;
  }
}
