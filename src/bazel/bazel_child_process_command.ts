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
import { BazelCommand } from "./bazel_command";

/**
 * Commands that are executed as child processes, returning their output as a
 * promise.
 */
export abstract class BazelChildProcessCommand extends BazelCommand {
  /**
   * Initializes a new Bazel command instance.
   *
   * @param workingDirectory The path to the directory from which Bazel will be
   *     spawned.
   * @param options Command line options that will be passed to Bazel (targets,
   *     query strings, flags, etc.).
   * @param ignoresErrors If true, a non-zero exit code for the child process is
   *     ignored and the {@link #run} function's promise is resolved with the
   *     empty string instead.
   */
  public constructor(
    workingDirectory: string,
    options: string[] = [],
    readonly ignoresErrors: boolean = false,
  ) {
    super(workingDirectory, options);
  }

  /**
   * Executes the command and returns a promise for the contents of standard
   * output.
   *
   * @param additionalOptions Additional command line options that apply only to
   *     this particular invocation of the command.
   * @returns A promise that is resolved with the contents of the process's
   *     standard output, or rejected if the command fails.
   */
  public run(additionalOptions: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const execOptions = {
        cwd: this.workingDirectory,
        maxBuffer: 500 * 1024,
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
        },
      );
    });
  }
}
