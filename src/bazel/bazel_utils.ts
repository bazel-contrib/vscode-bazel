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
import * as vscode from "vscode";
import { blaze_query } from "../protos";
import { BazelQuery } from "./bazel_query";

/**
 * Get the targets in the build file
 *
 * @param bazelExecutable The path to the Bazel executable.
 * @param workspace The path to the workspace.
 * @param buildFile The path to the build file.
 * @returns A query result for targets in the build file.
 */
export async function getTargetsForBuildFile(
  bazelExecutable: string,
  workspace: string,
  buildFile: string,
): Promise<blaze_query.QueryResult> {
  // Path to the BUILD file relative to the workspace.
  const relPathToDoc = path.relative(workspace, buildFile);
  // Strip away the name of the BUILD file from the relative path.
  let relDirWithDoc = path.dirname(relPathToDoc);
  // Strip away the "." if the BUILD file was in the same directory as the
  // workspace.
  if (relDirWithDoc === ".") {
    relDirWithDoc = "";
  }
  // Change \ (backslash) to / (forward slash) when on Windows
  relDirWithDoc = relDirWithDoc.replace(/\\/g, "/");
  // Turn the relative path into a package label
  const pkg = `//${relDirWithDoc}`;
  const queryResult = await new BazelQuery(
    bazelExecutable,
    workspace,
    `kind(rule, ${pkg}:all)`,
    [],
  ).queryTargets();

  return queryResult;
}

/**
 * Check if a path should be ignored and not considered to be part of a
 * Bazel Workspace.
 *
 * @param fsPath The path to a file in a Bazel workspace.
 * @returns true / false for if the path should be ignore (assumed not to
 *     be in a workspace).
 */
function shouldIgnorePath(fsPath: string): boolean {
  const bazelConfig = vscode.workspace.getConfiguration("bazel");
  const pathsToIgnore = bazelConfig.get<string[]>("pathsToIgnore");
  for (const pathRegex of pathsToIgnore) {
    try {
      const regex = new RegExp(pathRegex);
      if (regex.test(fsPath)) {
        return true;
      }
    } catch (err) {
      vscode.window.showErrorMessage(
        "pathsToIgnore value isn't a valid regex: " + escape(pathRegex),
      );
    }
  }
  return false;
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
export function getBazelWorkspaceFolder(fsPath: string): string | undefined {
  if (shouldIgnorePath(fsPath)) {
    return undefined;
  }
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
    const WORKSPACE_FILES = ["WORKSPACE.bazel", "WORKSPACE"];
    for (const workspaceFileName of WORKSPACE_FILES) {
      const workspace = path.join(dirname, workspaceFileName);
      try {
        fs.accessSync(workspace, fs.constants.F_OK);
        // workspace file is accessible. We have found the Bazel workspace
        // directory.
        return dirname;
      } catch (err) {
        // Intentionally do nothing; just try the next parent directory.
      }
    }
    dirname = path.dirname(dirname);
  } while (++iteration < maxIterations && dirname !== "" && dirname !== "/");

  return undefined;
}
