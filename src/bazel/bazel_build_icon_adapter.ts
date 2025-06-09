// Copyright 2024 The Bazel Authors. All rights reserved.
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

import { BazelWorkspaceInfo } from "./bazel_workspace_info";
import { IBazelCommandAdapter, IBazelCommandOptions } from "./bazel_command";

/**
 * Command adapter for the build icon that implements IBazelCommandAdapter.
 * This adapter handles the target and workspace information for build commands
 * triggered by the build icon.
 */
export class BazelBuildIconAdapter implements IBazelCommandAdapter {
  /** Workspace info in which to execute Bazel. */
  private workspaceInfo: BazelWorkspaceInfo;

  /** The target to build. */
  private target: string;

  /** Additional command line arguments to pass to Bazel. */
  private options: string[];

  /**
   * Initializes a new build icon command adapter.
   *
   * @param workspaceInfo Workspace info in which to execute Bazel.
   * @param target The target to build.
   * @param options Additional command line arguments to pass to Bazel.
   */
  public constructor(
    workspaceInfo: BazelWorkspaceInfo,
    target: string,
    options: string[] = [],
  ) {
    this.workspaceInfo = workspaceInfo;
    this.target = target;
    this.options = options;
  }

  /**
   * Returns the Bazel command options for this adapter.
   */
  public getBazelCommandOptions(): IBazelCommandOptions {
    return {
      options: this.options,
      targets: [this.target],
      workspaceInfo: this.workspaceInfo,
    };
  }

  /**
   * Gets the target being built.
   */
  public getTarget(): string {
    return this.target;
  }

  /**
   * Gets the workspace info.
   */
  public getWorkspaceInfo(): BazelWorkspaceInfo {
    return this.workspaceInfo;
  }

  /**
   * Updates the target for this adapter.
   */
  public updateTarget(target: string): void {
    this.target = target;
  }

  /**
   * Updates the command options for this adapter.
   */
  public updateOptions(options: string[]): void {
    this.options = options;
  }
} 