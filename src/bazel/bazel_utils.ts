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
import { getPathsToIgnore, getWorkspacePath } from "../extension/configuration";
import { logError, showInfoMessage } from "../extension/logger";
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
 * Turn a possibly package-relative label into an absolute one.
 *
 * Labels that already start with `//` (this repository) or `@` (a named
 * repository) are returned unchanged. A label starting with `:` refers to
 * a target in the same package. Anything else is treated as a bare
 * package-relative path (e.g. a source file), which becomes the target
 * name within the package.
 *
 * Note this is a purely textual transformation: it has no knowledge of
 * repository/module boundaries (e.g. a `local_path_override`'d nested
 * module), so `packageLabel` must already be correct for the label's
 * repository. See https://github.com/bazel-contrib/vscode-bazel/issues/416.
 *
 * @param target The label text as written in a BUILD/bzl file, e.g. "client.py", "subdir/client.py", ":lib", or "//pkg:target".
 * @param packageLabel The absolute package label to resolve `target` against, e.g. "//pkg" (see getPackageLabelForBuildFile).
 * @returns The absolute label.
 */
export function canonicalizeLabel(
  target: string,
  packageLabel: string,
): string {
  if (target.startsWith("//") || target.startsWith("@")) {
    return target;
  }
  return target.startsWith(":")
    ? `${packageLabel}${target}`
    : `${packageLabel}:${target}`;
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
  for (const pathRegex of getPathsToIgnore()) {
    try {
      const regex = new RegExp(pathRegex);
      if (regex.test(fsPath)) {
        return true;
      }
    } catch (err) {
      logError(
        "pathsToIgnore value isn't a valid regex",
        true,
        escape(pathRegex),
        err,
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

const WORKSPACE_MARKER_FILES = [
  "MODULE.bazel",
  "REPO.bazel",
  "WORKSPACE.bazel",
  "WORKSPACE",
];

/**
 * Resolves the Bazel root pinned via `bazel.workspace.path` for a VS Code
 * workspace folder.
 *
 * @param workspaceFolder The VS Code workspace folder whose setting is read.
 * Relative paths are resolved against it.
 * @returns The resolved absolute workspace path, or undefined if not
 * configured or invalid.
 */
function resolveConfiguredWorkspacePath(
  workspaceFolder: vscode.WorkspaceFolder,
): string | undefined {
  const configuredPath = getWorkspacePath(workspaceFolder.uri);
  if (!configuredPath) {
    return undefined;
  }

  const resolvedPath = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(workspaceFolder.uri.fsPath, configuredPath);

  // Verify the path exists and is a directory.
  try {
    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      logError(
        "Configured Bazel workspace path is not a directory",
        false,
        `Path: ${resolvedPath}`,
      );
      return undefined;
    }
  } catch {
    logError(
      "Configured Bazel workspace path does not exist",
      false,
      `Path: ${resolvedPath}`,
    );
    return undefined;
  }

  for (const file of WORKSPACE_MARKER_FILES) {
    try {
      fs.accessSync(path.join(resolvedPath, file), fs.constants.F_OK);
      return resolvedPath;
    } catch {
      // File not found, continue.
    }
  }

  logError(
    "Configured Bazel workspace path has no workspace marker file",
    false,
    `Path: ${resolvedPath}`,
    `Expected one of: ${WORKSPACE_MARKER_FILES.join(", ")}`,
  );
  return undefined;
}

/** The active Bazel root of a VS Code workspace folder, and its origin. */
export interface ActiveBazelRoot {
  /** The path of the Bazel root. */
  readonly path: string;
  /** Whether `bazel.workspace.path` pins it, or it was detected. */
  readonly pinned: boolean;
}

/**
 * Resolves the active Bazel root of a VS Code workspace folder. There is
 * exactly one per folder (see "Workspace model" in CONTRIBUTING.md).
 *
 * The root is `bazel.workspace.path` if it is set and valid. Otherwise it is
 * the nearest directory at or above the folder root that contains a Bazel
 * workspace marker file. Nested marker files below the folder root are never
 * considered.
 *
 * @param workspaceFolder The VS Code workspace folder.
 * @returns The active Bazel root, or undefined if there is none.
 */
export function resolveActiveBazelRoot(
  workspaceFolder: vscode.WorkspaceFolder,
): ActiveBazelRoot | undefined {
  const configuredWorkspace = resolveConfiguredWorkspacePath(workspaceFolder);
  if (configuredWorkspace) {
    return { path: configuredWorkspace, pinned: true };
  }
  const workspaceFile = findAncestorFile(
    workspaceFolder.uri.fsPath,
    WORKSPACE_MARKER_FILES,
  );
  return workspaceFile
    ? { path: path.dirname(workspaceFile), pinned: false }
    : undefined;
}

/**
 * Returns the path of the active Bazel root of a VS Code workspace folder, see
 * `resolveActiveBazelRoot`.
 */
export function getActiveBazelRoot(
  workspaceFolder: vscode.WorkspaceFolder,
): string | undefined {
  return resolveActiveBazelRoot(workspaceFolder)?.path;
}

/**
 * Returns the Bazel root that the given file belongs to: the active Bazel root
 * of the file's VS Code workspace folder (see `getActiveBazelRoot`), provided
 * the file lies inside it.
 *
 * Files outside every VS Code workspace folder, or outside their folder's
 * active root (e.g. in Bazel's repository cache, reached via Go to
 * Definition), don't belong to any Bazel root: features must not spawn Bazel
 * for them or compute labels for them.
 *
 * @param fsPath The path to a file or directory.
 * @returns The path to the Bazel root, or undefined if the file doesn't
 * belong to one.
 */
export function getBazelWorkspaceFolder(fsPath: string): string | undefined {
  if (shouldIgnorePath(fsPath)) {
    return undefined;
  }
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(fsPath),
  );
  if (!workspaceFolder) {
    return undefined;
  }
  const root = getActiveBazelRoot(workspaceFolder);
  if (!root || getBazelWorkspaceRelativePath(root, fsPath) === undefined) {
    return undefined;
  }
  return root;
}

/**
 * For a file that doesn't belong to its folder's active Bazel root (see
 * `getBazelWorkspaceFolder`), returns the Bazel workspace it would belong to
 * on its own: the nearest directory at or above it with a workspace marker
 * file (e.g. a repository in Bazel's cache, or a nested project that isn't the
 * active root).
 *
 * @param fsPath The path to a file.
 * @returns The path of that Bazel workspace, or undefined if the file belongs
 * to the active root or to no Bazel workspace at all.
 */
export function getForeignBazelWorkspace(fsPath: string): string | undefined {
  if (getBazelWorkspaceFolder(fsPath)) {
    return undefined;
  }
  const workspaceFile = findAncestorFile(fsPath, WORKSPACE_MARKER_FILES);
  return workspaceFile ? path.dirname(workspaceFile) : undefined;
}

/**
 * Tells the user that an explicitly invoked command does nothing for a file
 * outside the active Bazel root, if `fsPath` is such a file.
 *
 * @param fsPath The path to the file the command was invoked on.
 * @returns Whether the file is outside the active Bazel root (and the user
 * was told).
 */
export function notifyIfForeignFile(fsPath: string): boolean {
  const foreignWorkspace = getForeignBazelWorkspace(fsPath);
  if (foreignWorkspace === undefined) {
    return false;
  }
  void showInfoMessage(
    `This file belongs to the Bazel workspace at ${foreignWorkspace}, ` +
      "which is not the active Bazel workspace of its VS Code folder. " +
      "Bazel features are unavailable for it.",
  );
  return true;
}

/**
 * Returns a Bazel-compatible path relative to a workspace root.
 *
 * If the candidate is outside the workspace root, returns undefined.
 */
export function getBazelWorkspaceRelativePath(
  workspaceRoot: string,
  candidatePath: string,
): string | undefined {
  const relativePath = path.relative(workspaceRoot, candidatePath);
  if (
    path.isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`)
  ) {
    return undefined;
  }
  return relativePath.replace(/\\/g, "/");
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
  const relativeSourcePath = path
    .relative(path.dirname(buildFilePath), sourceFilePath)
    .replace(/\\/g, "/");
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
