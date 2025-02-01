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
import * as util from "util";

import { BazelCommand } from "./bazel_command";

const execFile = util.promisify(child_process.execFile);

/** Provides a promise-based API around the `bazel info` command. */
export class BazelInfo extends BazelCommand {
  /**
   * Gets the info for a single key by running `bazel info <key>`.
   *
   * @param key The info key to query.
   * @returns The output of `bazel info <key>`.
   */
  public async getOne(key: string): Promise<string> {
    const execResult = await execFile(
      this.bazelExecutable,
      this.execArgs([key]),
      {
        cwd: this.workingDirectory,
      },
    );
    return execResult.stdout.trim();
  }

  /**
   * Runs `bazel info` and returns the output.
   *
   * @returns All `bazel info` entries
   */
  public async getAll(): Promise<Map<string, string>> {
    const execResult = await execFile(this.bazelExecutable, this.execArgs([]), {
      cwd: this.workingDirectory,
    });
    const keyValues = new Map<string, string>();
    const lines = execResult.stdout.trim().split("\n");
    for (const line of lines) {
      // Windows paths can have >1 ':', so can't use line.split(":", 2)
      const splitterIndex = line.indexOf(":");
      const key = line.substring(0, splitterIndex);
      const value = line.substring(splitterIndex + 1);
      keyValues.set(key.trim(), value.trim());
    }
    return keyValues;
  }

  protected bazelCommand(): string {
    return "info";
  }
}
