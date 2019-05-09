// Copyright 2019 The Bazel Authors. All rights reserved.
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
import { IBazelCommandOptions } from "./bazellib";

/** Information about a Bazel task. */
export class BazelTaskInfo {
  /** pid for the task (if started). */
  public processId: number;

  /** exit code for the task (if completed). */
  public exitCode: number;

  /** start time (for internal performance tracking). */
  public startTime: [number, number];

  /**
   * Initializes a new Bazel task info instance.
   *
   * @param command The bazel command used (e.g. test, build).
   * @param commandOptions The bazel options used.
   */
  public constructor(
    readonly command: string,
    readonly commandOptions: IBazelCommandOptions,
  ) {}
}

export function setBazelTaskInfo(task: vscode.Task, info: BazelTaskInfo) {
  (task as any).bazelTaskInfo = info;
}

export function getBazelTaskInfo(task: vscode.Task): BazelTaskInfo {
  return (task as any).bazelTaskInfo;
}
