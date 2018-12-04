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
export function getBazelWorkspaceFolder(fsPath: string): string | undefined {
  let dirname: string;
  do {
    dirname = path.dirname(fsPath);

    const workspace = path.join(dirname, "WORKSPACE");
    try {
      fs.accessSync(workspace, fs.constants.F_OK);
      // WORKSPACE file is accessible. We have found the Bazel workspace
      // directory.
      return dirname;
    } catch (err) {
      // Intentionally do nothing; just try the next parent directory.
    }
    fsPath = dirname;
  } while (dirname !== "");

  return undefined;
}
