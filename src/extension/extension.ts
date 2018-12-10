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

import * as vscode from "vscode";
import * as which from "which";
import {
  BazelBuild,
  BazelTest,
  getDefaultBazelExecutablePath,
  IBazelCommandAdapter,
  queryQuickPickTargets,
} from "../bazel";
import {
  BuildifierDiagnosticsManager,
  BuildifierFormatProvider,
  getDefaultBuildifierExecutablePath,
} from "../buildifier";
import { BazelBuildCodeLensProvider } from "../codelens";
import { BazelWorkspaceTreeProvider } from "../workspace-tree";

/**
 * Called when the extension is activated; that is, when its first command is
 * executed.
 *
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext) {
  const workspaceTreeProvider = new BazelWorkspaceTreeProvider(context);
  const codeLensProvider = new BazelBuildCodeLensProvider(context);
  const buildifierDiagnostics = new BuildifierDiagnosticsManager();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "bazelWorkspace",
      workspaceTreeProvider,
    ),
    // Commands
    vscode.commands.registerCommand("bazel.buildTarget", bazelBuildTarget),
    vscode.commands.registerCommand(
      "bazel.buildTargetWithDebugging",
      bazelBuildTargetWithDebugging,
    ),
    vscode.commands.registerCommand("bazel.testTarget", bazelTestTarget),
    // CodeLens provider for BUILD files
    vscode.languages.registerCodeLensProvider(
      [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
      codeLensProvider,
    ),
    // Buildifier formatting support
    vscode.languages.registerDocumentFormattingEditProvider(
      [
        { pattern: "**/BUILD" },
        { pattern: "**/BUILD.bazel" },
        { pattern: "**/WORKSPACE" },
        { pattern: "**/WORKSPACE.bazel" },
        { pattern: "**/*.bzl" },
        { pattern: "**/*.sky" },
      ],
      new BuildifierFormatProvider(),
    ),
    buildifierDiagnostics,
  );

  // Notify the user if buildifier is not available on their path (or where
  // their settings expect it).
  checkBuildifierIsAvailable();
}

/** Called when the extension is deactivated. */
export function deactivate() {
  // Nothing to do here.
}

/**
 * Builds a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link BazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelBuildTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets("\"kind('.* rule', ...)\""),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      bazelBuildTarget(quickPick);
    }
    return;
  }
  const args = adapter.getBazelCommandArgs();
  const command = new BazelBuild(args.workingDirectory, args.options);
  command.run();
}

/**
 * Builds a Bazel target and attaches the Starlark debugger.
 *
 * @param adapter An object that implements {@link BazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */

async function bazelBuildTargetWithDebugging(
  adapter: IBazelCommandAdapter | undefined,
) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick build targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets("\"kind('.* rule', ...)\""),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      bazelBuildTargetWithDebugging(quickPick);
    }
    return;
  }
  const args = adapter.getBazelCommandArgs();
  vscode.debug.startDebugging(undefined, {
    args: args.options,
    bazelCommand: "build",
    bazelExecutablePath: getDefaultBazelExecutablePath(),
    cwd: args.workingDirectory,
    name: "On-demand Bazel Build Debug",
    request: "launch",
    type: "bazel-launch-build",
  });
}

/**
 * Tests a Bazel target and streams output to the terminal.
 *
 * @param adapter An object that implements {@link BazelCommandAdapter} from
 *     which the command's arguments will be determined.
 */
async function bazelTestTarget(adapter: IBazelCommandAdapter | undefined) {
  if (adapter === undefined) {
    // If the command adapter was unspecified, it means this command is being
    // invoked via the command palatte. Provide quickpick test targets for
    // the user to choose from.
    const quickPick = await vscode.window.showQuickPick(
      queryQuickPickTargets("\"kind('.*_test rule', ...)\""),
      {
        canPickMany: false,
      },
    );
    // If the result was undefined, the user cancelled the quick pick, so don't
    // try again.
    if (quickPick) {
      bazelTestTarget(quickPick);
    }
    return;
  }
  const args = adapter.getBazelCommandArgs();
  const command = new BazelTest(args.workingDirectory, args.options);
  command.run();
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
 */
function checkBuildifierIsAvailable() {
  const buildifierExecutable = getDefaultBuildifierExecutablePath();
  which(buildifierExecutable, async (err, _) => {
    if (err) {
      const item = await vscode.window.showWarningMessage(
        "Buildifier was not found; linting and formatting of Bazel files " +
          "will not be available. Please download it from " +
          `${BUILDTOOLS_RELEASES_URL} and install it ` +
          "on your system PATH or set its location in Settings.",
        { title: "Download" },
      );
      if (item && item.title === "Download") {
        vscode.commands.executeCommand(
          "vscode.open",
          vscode.Uri.parse(BUILDTOOLS_RELEASES_URL),
        );
      }
    }
  });
}
