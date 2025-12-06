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
import * as vscode from "vscode";
import * as which from "which";

import { executeBuildifier, IExecutable } from "./buildifier";
import { getDefaultBazelExecutablePath } from "../extension/configuration";
import {
  downloadBuildifier,
  getBuildifierExecutablePath,
} from "./buildifier_downloader";
import { extensionContext } from "../extension/extension";

/** The URL to load for buildifier's releases. */
const BUILDTOOLS_RELEASES_URL =
  "https://github.com/bazelbuild/buildtools/releases";

/**
 * Gets the buildifier configuration.
 *
 * @returns The buildifier configuration.
 */
export function getBuildifierConfiguration(): string {
  const bazelConfig = vscode.workspace.getConfiguration("bazel");
  return bazelConfig.get<string>("buildifierExecutable", "buildifier");
}

/**
 * Returns the path to the buildifier executable and arguments to use.
 *
 * This is the central point for resolving the buildifier executable. It may
 * involve downloading a buildifier release.
 *
 * @returns The path to the buildifier executable and arguments to use.
 */
async function getBuildifierExecutable(): Promise<IExecutable> {
  const configValue = getBuildifierConfiguration();
  // Bazel target
  if (configValue.startsWith("@")) {
    return {
      path: getDefaultBazelExecutablePath(),
      args: ["run", configValue, "--"],
    };
  }
  // Absolute path
  if (fs.existsSync(configValue)) {
    return { path: configValue, args: [] };
  }
  // File on $PATH
  try {
    return { path: await which(configValue), args: [] };
  } catch (e) {
    // nothing on PATH
  }
  // Release binary
  try {
    const dst = getBuildifierExecutablePath(configValue);
    if (fs.existsSync(dst.fsPath)) {
      return { path: dst.fsPath, args: [] };
    }
    return {
      path: (await downloadBuildifier(configValue)).fsPath,
      args: [],
    };
  } catch (e) {
    // Can't download a release with that version
  }
  await showBuildifierDownloadPrompt(
    `Did not find a buildifier for "${configValue}"`,
  );
}

/**
 * Checks whether buildifier is available (either at the system PATH or a
 * user-specified path, depending on the value in Settings).
 *
 * If not available, a warning message will be presented to the user with a
 * Download button that they can use to go to the GitHub releases page.
 */
export async function checkBuildifierIsAvailable() {
  const state = await getBuildifierExecutable();
  await extensionContext.workspaceState.update("buildifierExecutable", state);

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
  } catch {
    // If we got no valid JSON back, we don't have a compatible version.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    showBuildifierDownloadPrompt(
      "Buildifier is too old (0.25.1 or higher is needed)",
    );
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
