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

import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import * as which from "which";

import {
  executeBuildifier,
  getDefaultBuildifierExecutablePath,
} from "./buildifier";

async function fileExists(filename: string) {
  try {
    // First check if file exists and is a regular file
    const stats = await fs.stat(filename);
    if (!stats.isFile()) {
      return false;
    }

    // Then check if it's executable by trying to access it
    await fs.access(filename, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The URL to load for buildifier's releases. */
const BUILDTOOLS_RELEASES_URL =
  "https://github.com/bazelbuild/buildtools/releases";

/**
 * Checks whether buildifier is available (either at the system PATH or a
 * user-specified path, depending on the value in Settings).
 *
 * If not available, a warning message will be presented to the user with a
 * Download button that they can use to go to the GitHub releases page.
 *
 * @returns absolute path to the found buildifier executable, or null if not found
 */
export async function checkBuildifierIsAvailable(): Promise<string | null> {
  const buildifierExecutable = getDefaultBuildifierExecutablePath();

  // Check if the program exists (in case it's an actual executable and not
  // an target name starting with `@`).
  const isTarget = buildifierExecutable.startsWith("@");

  // Check if the program exists as a relative path of the workspace
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  const relativePath = path.join(workspacePath || "", buildifierExecutable);
  const relativePathExists = await fileExists(relativePath);

  let executablePath: string;
  if (relativePathExists) {
    executablePath = relativePath;
  } else if (isTarget) {
    // For Bazel targets, use the target name as-is
    executablePath = buildifierExecutable;
  } else {
    // Try to find the executable in the system PATH
    try {
      executablePath = await which(buildifierExecutable);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      showBuildifierDownloadPrompt("Buildifier was not found");
      return null;
    }
  }

  // Make sure it's a compatible version by running
  // buildifier on an empty input and see if it exits successfully and the
  // output parses.
  const { stdout } = await executeBuildifier(
    "",
    // specify the --lint value even though off is the default in case
    // a .buildifer.json with a different value is present
    ["--format=json", "--mode=check", "--lint=off"],
    false,
  );
  try {
    JSON.parse(stdout);
    return executablePath;
  } catch {
    // If we got no valid JSON back, we don't have a compatible version.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    showBuildifierDownloadPrompt(
      "Buildifier is too old (0.25.1 or higher is needed)",
    );
    return null;
  }
}

/**
 * Show a warning to the user that Buildifier was not found or is not
 * compatible, and give them the option to download it.
 *
 * @param reason The reason that Buildifier was not valid, which is displayed
 * to the user.
 */
async function showBuildifierDownloadPrompt(reason: string) {
  const item = await vscode.window.showWarningMessage(
    `${reason}; linting and formatting of Bazel files ` +
      "will not be available. Please download it from " +
      `${BUILDTOOLS_RELEASES_URL} and install it ` +
      "on your system PATH or set its location in Settings.",
    { title: "Download" },
  );

  if (item && item.title === "Download") {
    await vscode.commands.executeCommand(
      "vscode.open",
      vscode.Uri.parse(BUILDTOOLS_RELEASES_URL),
    );
  }
}
