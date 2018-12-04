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

import * as path from "path";
import * as fs from "fs";

/**
 * Search for the path to the directory that has the Bazel WORKSPACE file for the given file.
 * Returns the path to the directory with the Bazel WORKSPACE if found. Returns undefined otherwise.
 * If multiple directories along the path to the file has files called "WORKSPACE", the lowest path
 * is returned.
 * @param fsPath Path to a file in a Bazel workspace
 */
export function getBazelWorkspaceFolder(fsPath: string): string | undefined {
  var b, d: string
  do {
    // The last element in the path
    b = path.basename(fsPath);
    // The directory containing "b"
    d = path.dirname(fsPath);
     // Potential WORKSPACE path
    let w = path.join(d, "WORKSPACE");
    try {
      fs.accessSync(w, fs.constants.F_OK);
      // WORKSPACE file is accessible. We have found the Bazel workspace directory
      return d;
    } catch (err) {
    }
    fsPath = d;
  } while (d !== "");
   return undefined;
}