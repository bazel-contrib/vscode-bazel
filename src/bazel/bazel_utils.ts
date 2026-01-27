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
 * Get the package label for a build file.
 *
 * @param workspace The path to the workspace.
 * @param buildFile The path to the build file.
 * @returns The package label for the build file.
 */
export function getPackageLabelForBuildFile(
  workspace: string,
  buildFile: string,
): string {
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
  return `//${relDirWithDoc}`;
}

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
  const pkg = getPackageLabelForBuildFile(workspace, buildFile);
  const queryResult = await new BazelQuery(
    bazelExecutable,
    workspace,
  ).queryTargets(`kind(rule, ${pkg}:all)`, { sortByRuleName: true });

  return queryResult;
}

/**
 * Check if a path should be ignored and not considered to be part of a
 * Bazel Workspace.
 *
 * @param fsPath The path to a file in a Bazel workspace.
 * @returns true / false for if the path should be ignore (assumed not to
 * be in a workspace).
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
 * Finds the nearest ancestor file with any of the specified names.
 *
 * @param startPath The starting path to search from
 * @param filenames Array of filenames to search for
 * @returns The full path to the first matching file found, or undefined if not found
 */
function findAncestorFile(
  startPath: string,
  filenames: string[],
): string | undefined {
  if (shouldIgnorePath(startPath)) {
    return undefined;
  }

  let dirname = startPath;
  let iteration = 0;
  const maxIterations = 100; // Fail-safe to prevent infinite loops

  try {
    if (fs.statSync(startPath).isFile()) {
      dirname = path.dirname(dirname);
    }
  } catch (err) {
    // File doesn't exist, start searching from the directory itself
    dirname = path.dirname(startPath);
  }

  do {
    for (const filename of filenames) {
      const filePath = path.join(dirname, filename);
      try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return filePath;
      } catch (err) {
        // File not found, continue to next filename
      }
    }
    dirname = path.dirname(dirname);
  } while (++iteration < maxIterations && dirname !== "" && dirname !== "/");

  return undefined;
}

/**
 * Search for the path to the directory that has the Bazel WORKSPACE file for
 * the given file.
 *
 * If multiple directories along the path to the file have workspace files,
 * the lowest path is returned.
 *
 * @param fsPath The path to a file in a Bazel workspace.
 * @returns The path to the directory with the Bazel workspace file if found,
 * otherwise undefined.
 */
export function getBazelWorkspaceFolder(fsPath: string): string | undefined {
  const workspaceFile = findAncestorFile(fsPath, [
    "MODULE.bazel",
    "REPO.bazel",
    "WORKSPACE.bazel",
    "WORKSPACE",
  ]);
  return workspaceFile ? path.dirname(workspaceFile) : undefined;
}

/**
 * Finds the nearest Bazel package file (BUILD or BUILD.bazel) for the given file path
 * by searching up the directory tree, but only if it's within the current Bazel workspace.
 *
 * @param fsPath The path to a file in a Bazel package.
 * @returns The path to the BUILD file, or undefined if not found or outside the workspace.
 */
export function getBazelPackageFile(fsPath: string): string | undefined {
  const buildFile = findAncestorFile(fsPath, ["BUILD", "BUILD.bazel"]);
  if (!buildFile) {
    return undefined;
  }
  const workspaceRoot = getBazelWorkspaceFolder(fsPath);
  if (!workspaceRoot) {
    return undefined; // Not in a Bazel workspace
  }
  if (!buildFile.startsWith(workspaceRoot)) {
    return undefined; // Build file is outside the workspace
  }
  return buildFile;
}

/**
 * Finds the nearest Bazel package folder for the given file path
 * by searching up the directory tree.
 *
 * @param fsPath The path to a file in a Bazel package.
 * @returns The path to the package folder, or undefined if not found.
 */
export const getBazelPackageFolder = (fsPath: string): string | undefined => {
  const pkgFile = getBazelPackageFile(fsPath);
  return pkgFile ? path.dirname(pkgFile) : undefined;
};

/**
 * Returns the line number where the source file is mentioned in the build file.
 * @param buildFilePath The path to the build file.
 * @param sourceFilePath The path to the source file.
 * @returns The line number where the source file is mentioned, or undefined if not found.
 */
export function getBuildFileLineWithSourceFilePath(
  buildFilePath: string,
  sourceFilePath: string,
): number | undefined {
  // Find the line number where the current editors file is mentioned
  const relativeSourcePath = path.relative(
    path.dirname(buildFilePath),
    sourceFilePath,
  );
  const buildFileContent = fs
    .readFileSync(buildFilePath, "utf8")
    .trim()
    .replace(/\r\n|\r/g, "\n")
    .split("\n");
  for (let i = 0; i < buildFileContent.length; i++) {
    if (buildFileContent[i].includes(relativeSourcePath)) {
      return i;
    }
  }
  return undefined;
}

/**
 * Finds the target name for a given line number in a BUILD file
 * @param buildFilePath The path to the build file.
 * @param lineNumber - The line number (1-based)
 * @returns The target name or undefined if not inside any target
 */
export function getTargetNameAtBuildFileLocation(
  buildFilePath: string,
  lineNumber: number,
): string | undefined {
  const buildFileContent = fs
    .readFileSync(buildFilePath, "utf8")
    .trim()
    .replace(/\r\n|\r/g, "\n")
    .split("\n");
  let currentTarget: string | undefined = undefined;
  let currentTargetStartLine: number = -1;
  let currentTargetEndLine: number = -1;
  let braceDepth = 0;

  for (let i = 0; i < buildFileContent.length; i++) {
    const line = buildFileContent[i];
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    // Check if this line starts a new target (function call)
    const targetMatch = trimmedLine.match(/^(\w+)\s*\(/);
    if (targetMatch) {
      // If we were in a target before, close it
      if (braceDepth === 0 && currentTarget !== undefined) {
        currentTargetEndLine = i - 1;
      }

      // Start new target
      currentTarget = undefined;
      currentTargetStartLine = i;
      braceDepth = 1; // We've seen an opening parenthesis

      // Look for name attribute in the same line
      const nameMatch = trimmedLine.match(/name\s*=\s*["']([^"']+)["']/);
      if (nameMatch) {
        currentTarget = nameMatch[1];
      }
    }
    // Handle closing parenthesis
    else if (trimmedLine.includes(")") && braceDepth > 0) {
      braceDepth--;
      if (braceDepth === 0 && currentTarget !== undefined) {
        currentTargetEndLine = i;
      }
    }
    // Handle opening parenthesis
    else if (trimmedLine.includes("(") && braceDepth > 0) {
      braceDepth++;
    }
    // Look for name attribute inside the target
    else if (braceDepth > 0 && currentTarget === undefined) {
      const nameMatch = trimmedLine.match(/name\s*=\s*["']([^"']+)["']/);
      if (nameMatch) {
        currentTarget = nameMatch[1];
      }
    }

    // Check if the requested line is within the current target
    if (
      lineNumber >= currentTargetStartLine &&
      lineNumber <= currentTargetEndLine
    ) {
      return currentTarget;
    }
  }

  return undefined;
}
