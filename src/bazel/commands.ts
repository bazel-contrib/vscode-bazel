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

import * as child_process from "child_process";
import * as vscode from "vscode";

/**
 * Arbitrary types should implement this interface to provide the arguments to the Bazel build or
 * test command to execute when the user selects a particular target in the UI (explorer tree view,
 * quick pick, document link, etc.).
 */
export interface BazelCommandAdapter {
  /** Returns the arguments that should be passed to the Bazel command. */
  getBazelCommandArgs(): BazelCommandArgs;
}

/** Encapsulates the arguments to a Bazel command invoked through the UI. */
export interface BazelCommandArgs {
  /** The working directory in which Bazel should be launched. */
  workingDirectory: string;

  /** The list of targets and command line flags that should be passed to Bazel. */
  options: string[];
}

/** Common functionality used to execute Bazel commands. */
export abstract class BazelCommand {
  /**
   * Initializes a new Bazel command instance.
   * 
   * @param workingDirectory The path to the directory from which Bazel will be spawned.
   * @param options Command line options that will be passed to Bazel (targets, query strings,
   *     flags, etc.).
   */
  public constructor(readonly workingDirectory: string, readonly options: string[] = []) { }

  /**
   * Overridden by subclasses to provide the Bazel command that should be executed (for example,
   * {@code build}, {@code test}, or {@code query}).
   */
  protected abstract bazelCommand(): string

  /** The command line string used to execute the query. */
  protected commandLine(additionalOptions: string[] = []) {
    var result = `${this.bazelExecutable} ${this.bazelCommand()}`;
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

  /**
   * The Bazel executable that should be invoked to execute the command.
   *
   * This can be either an absolute path or a command name that will be found on the system path.
   */
  private get bazelExecutable() {
    // Try to retrieve the executable from VS Code's settings. If it's not set, just use "bazel" as
    // the default and get it from the system PATH.
    const bazelConfig = vscode.workspace.getConfiguration("bazel");
    let bazelExecutable = <string>bazelConfig.executable;
    if (bazelExecutable.length == 0) {
      return "bazel";
    }
    return bazelExecutable;
  }
}

/** Commands that are executed as child processes, returning their output as a promise. */
export abstract class BazelChildProcessCommand extends BazelCommand {
  /**
   * Initializes a new Bazel command instance.
   * 
   * @param workingDirectory The path to the directory from which Bazel will be spawned.
   * @param options Command line options that will be passed to Bazel (targets, query strings,
   *     flags, etc.).
   * @param ignoresErrors If true, a non-zero exit code for the child process is ignored and the
   *     {@link #run} function's promise is resolved with the empty string instead.
   */
  public constructor(
    workingDirectory: string,
    options: string[] = [],
    readonly ignoresErrors: boolean = false
  ) {
    super(workingDirectory, options);
  }

  /**
   * Executes the command and returns a promise for the contents of standard output.
   * 
   * @param additionalOptions Additional command line options that apply only to this particular
   *     invocation of the command.
   * @returns A promise that is resolved with the contents of the process's standard output, or
   *     rejected if the command fails.
   */
  public run(additionalOptions: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const execOptions = {
        cwd: this.workingDirectory,
        maxBuffer: 500 * 1024
      };
      child_process.exec(
        this.commandLine(additionalOptions),
        execOptions,
        (error: Error, stdout: string, stderr: string) => {
          if (error) {
            if (this.ignoresErrors) {
              resolve("");
            } else {
              reject(error);
            }
          } else {
            resolve(stdout);
          }
        }
      );
    });
  }
}

/** The singleton terminal managed by {@link provideBazelTerminal}. */
let bazelGlobalTerminal: vscode.Terminal = null

/** Returns the singleton terminal used to execute Bazel commands, creating it if needed. */
function getBazelGlobalTerminal(): vscode.Terminal {
  if (bazelGlobalTerminal === null) {
    bazelGlobalTerminal = vscode.window.createTerminal("Bazel");
  }
  return bazelGlobalTerminal;
}

/** Commands that are executed in a terminal panel. */
export abstract class BazelTerminalCommand extends BazelCommand {
  /**
   * Executes the command, sending its output to the Bazel terminal panel.
   *
   * @param additionalOptions Additional command line options that apply only to this particular
   *     invocation of the command.
   */
  public run(additionalOptions: string[] = []) {
    const terminal = getBazelGlobalTerminal();
    terminal.sendText("clear");
    terminal.show(true);
    terminal.sendText(`cd ${this.workingDirectory} && ${this.commandLine(additionalOptions)}`);
  }
}

/** Executes a Bazel build command and displays its output in the terminal. */
export class BazelBuild extends BazelTerminalCommand {
  protected bazelCommand(): string { return "build"; }
}

/** Executes a Bazel test command and displays its output in the terminal. */
export class BazelTest extends BazelTerminalCommand {
  protected bazelCommand(): string { return "test"; }
}
