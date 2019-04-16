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

import * as fs from "fs";
import * as path from "path";

/**
 * Represents the Bazel workspace information.
 */
export class BazelWorkspaceInfo {
  /**
   * Returns the Bazel workspace info for the given file or folder path.
   *
   * If the file or folder is not in a Bazel workspace, this function returns
   * {@code undefined}.
   *
   * @param fileOrFolderPath The path to the file or folder whose workspace info
   *    should be retrieved.
   */
  public static fromPath(
    fileOrFolderPath: string,
  ): BazelWorkspaceInfo | undefined {
    const bazelWorkspace = getBazelWorkspaceFolder(fileOrFolderPath);
    if (bazelWorkspace) {
      return new BazelWorkspaceInfo(bazelWorkspace);
    }
    return undefined;
  }

  /**
   * Initializes a new workspace info object.
   *
   * @param bazelWorkspacePath The closest directory to a document that contains
   *     a Bazel WORKSPACE file.
   */
  private constructor(public readonly bazelWorkspacePath: string) {}
}

/**
 * Search for the path to the directory that has the Bazel WORKSPACE file for
 * the given file.
 *
 * If multiple directories along the path to the file has files called
 * "WORKSPACE", the lowest path is returned.
 *
 * @param fsPath The path to a file in a Bazel workspace.
 * @returns The path to the directory with the Bazel WORKSPACE file if found,
 *     others undefined.
 */
function getBazelWorkspaceFolder(fsPath: string): string | undefined {
  let dirname = fsPath;
  let iteration = 0;
  // Fail safe in case other file systems have a base dirname that doesn't
  // match the checks below. Having this failsafe guarantees that we don't
  // hang in an infinite loop.
  const maxIterations = 100;
  if (fs.statSync(fsPath).isFile()) {
    dirname = path.dirname(dirname);
  }
  do {
    const workspace = path.join(dirname, "WORKSPACE");
    try {
      fs.accessSync(workspace, fs.constants.F_OK);
      // WORKSPACE file is accessible. We have found the Bazel workspace
      // directory.
      return dirname;
    } catch (err) {
      // Intentionally do nothing; just try the next parent directory.
    }
    dirname = path.dirname(dirname);
  } while (++iteration < maxIterations && dirname !== "" && dirname !== "/");

  return undefined;
}
