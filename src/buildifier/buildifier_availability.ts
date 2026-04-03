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

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import which from "which";

import { executeBuildifier, IExecutable } from "./buildifier";
import {
  getDefaultBazelExecutablePath,
  getBuildifierConfig,
  BuildifierConfig,
} from "../extension/configuration";
import {
  downloadBuildifier,
  getBuildifierExecutablePath,
} from "./buildifier_downloader";
import { logWarn } from "../extension/logger";

/** The URL to load for buildifier's releases. */
const BUILDTOOLS_RELEASES_URL =
  "https://github.com/bazelbuild/buildtools/releases";

/**
 * Gets the buildifier configuration.
 *
 * @returns The buildifier configuration.
 */
export function getBuildifierConfiguration(): BuildifierConfig {
  return getBuildifierConfig();
}

/**
 * Returns the path to the buildifier executable and arguments to use.
 *
 * This is the central point for resolving the buildifier executable. It may
 * involve downloading a buildifier release.
 *
 * @returns The path to the buildifier executable and arguments to use, or
 * undefined if buildifier cannot be found.
 */
async function getBuildifierExecutable(): Promise<IExecutable | undefined> {
  const config = getBuildifierConfiguration();
  const { source, value } = config;

  switch (source) {
    case "bazelTarget":
      return {
        path: getDefaultBazelExecutablePath(),
        args: ["run", "--", value],
      };

    case "releaseTag":
      return resolveReleaseBinary(value);

    case "path":
      return resolvePath(value);

    case "auto":
    default:
      return resolveAuto(value);
  }
}

/**
 * Resolves a file path to a buildifier executable.
 * @returns The executable, or undefined if not found.
 */
async function resolvePath(
  configValue: string,
): Promise<IExecutable | undefined> {
  const pathToCheck = configValue || "buildifier";

  // Absolute path (must be a file, not a directory)
  if (fs.existsSync(pathToCheck) && fs.statSync(pathToCheck).isFile()) {
    return { path: pathToCheck, args: [] };
  }
  // Relative path from workspace
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  if (workspacePath) {
    const relativePath = path.join(workspacePath, pathToCheck);
    if (fs.existsSync(relativePath) && fs.statSync(relativePath).isFile()) {
      return { path: relativePath, args: [] };
    }
  }
  // File on $PATH
  try {
    return { path: await which(pathToCheck), args: [] };
  } catch (e) {
    // nothing on PATH
  }

  await showBuildifierDownloadPrompt(
    `Did not find buildifier at path "${pathToCheck}"`,
  );
  return undefined;
}

/**
 * Resolves a release version to a buildifier executable, downloading if needed.
 * @returns The executable, or undefined if not found.
 */
async function resolveReleaseBinary(
  version: string,
): Promise<IExecutable | undefined> {
  if (!version) {
    await showBuildifierDownloadPrompt(
      "No release version specified for buildifier",
    );
    return undefined;
  }

  try {
    const dst = getBuildifierExecutablePath(version);
    if (fs.existsSync(dst.fsPath)) {
      return { path: dst.fsPath, args: [] };
    }
    return {
      path: (await downloadBuildifier(version)).fsPath,
      args: [],
    };
  } catch (e) {
    await showBuildifierDownloadPrompt(
      `Failed to download buildifier release "${version}"`,
    );
    return undefined;
  }
}

/**
 * Auto-detect buildifier: try path resolution first, then release download.
 * This preserves the original heuristic behavior for backward compatibility.
 * @returns The executable, or undefined if not found.
 */
async function resolveAuto(
  configValue: string,
): Promise<IExecutable | undefined> {
  const valueToCheck = configValue || "buildifier";

  // Bazel target (legacy support for @ prefix detection)
  if (valueToCheck.startsWith("@")) {
    return {
      path: getDefaultBazelExecutablePath(),
      args: ["run", valueToCheck, "--"],
    };
  }
  // Absolute path (must be a file, not a directory)
  if (fs.existsSync(valueToCheck) && fs.statSync(valueToCheck).isFile()) {
    return { path: valueToCheck, args: [] };
  }
  // Relative path from workspace
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  if (workspacePath) {
    const relativePath = path.join(workspacePath, valueToCheck);
    if (fs.existsSync(relativePath) && fs.statSync(relativePath).isFile()) {
      return { path: relativePath, args: [] };
    }
  }
  // File on $PATH
  try {
    return { path: await which(valueToCheck), args: [] };
  } catch (e) {
    // nothing on PATH
  }
  // Release binary
  try {
    const dst = getBuildifierExecutablePath(valueToCheck);
    if (fs.existsSync(dst.fsPath)) {
      return { path: dst.fsPath, args: [] };
    }
    return {
      path: (await downloadBuildifier(valueToCheck)).fsPath,
      args: [],
    };
  } catch (e) {
    // Can't download a release with that version
  }
  await showBuildifierDownloadPrompt(
    `Did not find a buildifier for "${valueToCheck}"`,
  );
  return undefined;
}

/**
 * Checks whether buildifier is available (either at the system PATH or a
 * user-specified path, depending on the value in Settings).
 *
 * If not available, a warning message will be presented to the user with a
 * Download button that they can use to go to the GitHub releases page.
 *
 * @returns The path/target identifier for buildifier, or null if not available.
 */
export async function checkBuildifierIsAvailable(): Promise<string | null> {
  const config = getBuildifierConfiguration();
  const state = await getBuildifierExecutable();

  if (state === undefined) {
    return null;
  }

  // Determine the identifier to return
  // For bazelTarget: return the target value from config
  // For auto with @ prefix: return the target from args[1]
  // For paths: return the resolved path
  let identifier: string;
  if (config.source === "bazelTarget") {
    identifier = config.value;
  } else if (state.args.length > 0 && state.args[0] === "run") {
    // Legacy bazel target detection (auto mode with @ prefix)
    identifier = state.args[1];
  } else {
    identifier = state.path;
  }

  // Make sure it's a compatible version by running
  // buildifier on an empty input and see if it exits successfully and the
  // output parses.
  let stdout: string;
  try {
    const result = await executeBuildifier(
      "",
      // specify the --lint value even though off is the default in case
      // a .buildifer.json with a different value is present
      ["--format=json", "--mode=check", "--lint=off"],
      false,
      state, // Pass state directly to avoid workspaceState dependency
    );
    stdout = result.stdout;
  } catch (e) {
    // Execution failed - buildifier not found or other error
    // The helper functions already showed appropriate prompts
    logWarn(`checkBuildifierIsAvailable: execution failed: ${e}`, false);
    return null;
  }

  try {
    JSON.parse(stdout);
  } catch {
    // If we got no valid JSON back, we don't have a compatible version.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    showBuildifierDownloadPrompt(
      "Buildifier is too old (0.25.1 or higher is needed)",
    );
    return null;
  }

  return identifier;
}

/**
 * Show a warning to the user that Buildifier was not found or is not
 * compatible, and give them the option to download it.
 *
 * @param reason The reason that Buildifier was not valid, which is displayed
 * to the user.
 */
async function showBuildifierDownloadPrompt(reason: string) {
  const message =
    `${reason}; linting and formatting of Bazel files ` +
    "will not be available. Please download it from " +
    `${BUILDTOOLS_RELEASES_URL} and install it ` +
    "on your system PATH or set its location in Settings.";

  // Log to output channel
  logWarn(message, false);

  // Show interactive message with Download button
  const item = await vscode.window.showWarningMessage(message, {
    title: "Download",
  });

  if (item && item.title === "Download") {
    await vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.parse(BUILDTOOLS_RELEASES_URL),
    );
  }
}
