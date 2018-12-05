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

/**
 * Arbitrary types should implement this interface to provide the arguments to
 * the Bazel build or test command to execute when the user selects a particular
 * target in the UI (explorer tree view, quick pick, document link, etc.).
 */
export interface IBazelCommandAdapter {
  /** Returns the arguments that should be passed to the Bazel command. */
  getBazelCommandArgs(): IBazelCommandArgs;
}

/** Encapsulates the arguments to a Bazel command invoked through the UI. */
export interface IBazelCommandArgs {
  /** The working directory in which Bazel should be launched. */
  workingDirectory: string;

  /**
   * The list of targets and command line flags that should be passed to Bazel.
   */
  options: string[];
}

/** Common functionality used to execute Bazel commands. */
export abstract class BazelCommand {
  /**
   * Initializes a new Bazel command instance.
   *
   * @param workingDirectory The path to the directory from which Bazel will be
   *     spawned.
   * @param options Command line options that will be passed to Bazel (targets,
   *     query strings, flags, etc.).
   */
  public constructor(
    readonly workingDirectory: string,
    readonly options: string[] = [],
  ) {}

  /**
   * Overridden by subclasses to provide the Bazel command that should be
   * executed (for example, {@code build}, {@code test}, or {@code query}).
   */
  protected abstract bazelCommand(): string;

  /** The command line string used to execute the query. */
  protected commandLine(additionalOptions: string[] = []) {
    let result = `${getDefaultBazelExecutablePath()} ${this.bazelCommand()}`;
    if (this.options.length > 0) {
      result += " ";
      result += this.options.join(" ");
    }
    if (additionalOptions.length > 0) {
      result += " ";
      result += additionalOptions.join(" ");
    }
    return result;
  }
}

/**
 * Gets the path to the Bazel executable specified by the workspace
 * configuration, if present.
 *
 * @returns The path to the Bazel executable specified in the workspace
 * configuration, or just "bazel" if not present (in which case the system path
 * will be searched).
 */
export function getDefaultBazelExecutablePath(): string {
  // Try to retrieve the executable from VS Code's settings. If it's not set,
  // just use "bazel" as the default and get it from the system PATH.
  const bazelConfig = vscode.workspace.getConfiguration("bazel");
  const bazelExecutable = bazelConfig.executable as string;
  if (bazelExecutable.length === 0) {
    return "bazel";
  }
  return bazelExecutable;
}
