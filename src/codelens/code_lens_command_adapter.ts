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

import {
  BazelWorkspaceInfo,
  IBazelCommandAdapter,
  IBazelCommandOptions,
} from "../bazel";

/**
 * Command adapter to pass arguments to Bazel commands.
 */
export class CodeLensCommandAdapter implements IBazelCommandAdapter {
  /** Workspace info in which to execute Bazel. */
  private workspaceInfo: BazelWorkspaceInfo;

  /** The list of targets to build. */
  private targets: string[];

  /** Other command line arguments to pass to Bazel. */
  private options: string[];

  /**
   * Initializes a new CodeLens command adapter that invokes Bazel.
   *
   * @param workspaceFolder Workspace folder from which to execute Bazel.
   * @param options Other command line arguments to pass to Bazel.
   */
  public constructor(
    workspaceInfo: BazelWorkspaceInfo,
    targets: string[],
    options: string[] = [],
  ) {
    this.workspaceInfo = workspaceInfo;
    this.targets = targets;
    this.options = options;
  }

  public getBazelCommandOptions(): IBazelCommandOptions {
    return {
      options: this.options,
      targets: this.targets,
      workspaceInfo: this.workspaceInfo,
    };
  }
}
