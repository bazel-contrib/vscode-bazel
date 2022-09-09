// Copyright 2022 The Bazel Authors. All rights reserved.
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

/** Provides a promise-based API around the `bazel info` command. */
export class BazelInfo extends BazelCommand {
  /**
   * Runs `bazel info <key>` and returns the output.
   *
   * @param key The info key to query.
   * @returns The output of `bazel info <key>`.
   */
  public async run(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      child_process.execFile(
        this.bazelExecutable,
        this.execArgs([key]),
        { cwd: this.workingDirectory },
        (error: Error, stdout: string) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout.trim());
          }
        },
      );
    });
  }

  protected bazelCommand(): string {
    return "info";
  }
}
