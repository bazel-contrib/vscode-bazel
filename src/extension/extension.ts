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

import { activateTaskProvider } from "../bazel";
import {
  BuildifierDiagnosticsManager,
  BuildifierFormatProvider,
  checkBuildifierIsAvailable,
} from "../buildifier";
import { CodeLensFeature } from "../codelens/code_lens_feature";
import {
  BazelWorkspaceTreeProvider,
  WorkspaceTreeFeature,
} from "../workspace-tree";
import { targetToUri } from "../definition/bazel_goto_definition_provider";
import { activateCommandVariables } from "./command_variables";
import { activateTesting } from "../test-explorer";
import { activateWrapperCommands } from "./bazel_wrapper_commands";
import { registerLogger, logInfo, logError, showOutputChannel } from "./logger";
import { registerBazelWorkspaceAvailabilityWatcher } from "../bazel/bazel_availability";
import { LanguageSupportFeature } from "../language_support/language_support_feature";

// Global reference to the workspace tree provider for testing
declare global {
  var bazelWorkspaceTreeProvider: BazelWorkspaceTreeProvider | undefined;
}

// Clean way to access the provider for testing
export function getWorkspaceTreeProviderForTesting():
  | BazelWorkspaceTreeProvider
  | undefined {
  return globalThis.bazelWorkspaceTreeProvider;
}

// Also set a global variable that can be accessed from tests
export function storeWorkspaceTreeProviderForTesting(
  provider: BazelWorkspaceTreeProvider | undefined,
) {
  globalThis.bazelWorkspaceTreeProvider = provider;
}

/**
 * Called when the extension is activated; that is, when its first command is
 * executed.
 *
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext) {
  // Setup logging
  const logger = registerLogger(context);
  logInfo("Extension activated successfully.");
  context.subscriptions.push(
    vscode.commands.registerCommand("bazel.showOutputChannel", () => {
      showOutputChannel();
    }),
  );

  // Watch for availability of bazel workspace
  registerBazelWorkspaceAvailabilityWatcher(context);

  // WorkspaceTreeFeature
  const workspaceTreeFeature = WorkspaceTreeFeature.create(context);
  context.subscriptions.push(workspaceTreeFeature);
  storeWorkspaceTreeProviderForTesting(
    workspaceTreeFeature.getWorkspaceTreeProvider(),
  );

  // CodeLensFeature
  context.subscriptions.push(CodeLensFeature.create(context));

  // Other components
  const buildifierDiagnostics = new BuildifierDiagnosticsManager();

  // Initialize language support feature
  context.subscriptions.push(LanguageSupportFeature.create(context));

  context.subscriptions.push(
    // Commands
    ...activateWrapperCommands(),
    // URI handler
    vscode.window.registerUriHandler({
      async handleUri(uri: vscode.Uri) {
        try {
          const workspace = vscode.workspace.workspaceFolders[0];
          const quotedUriPath = `"${uri.path}"`;
          const location = await targetToUri(quotedUriPath, workspace.uri);

          vscode.commands
            .executeCommand(
              "vscode.open",
              vscode.Uri.file(location.path).with({
                fragment: `${location.line}:${location.column}`,
              }),
            )
            .then(undefined, (err) => {
              logError("Could not open file", true, location.path, err);
            });
        } catch (err: any) {
          logError("While handling URI", true, JSON.stringify(uri), err);
        }
      },
    }),
    // Buildifier formatting support
    vscode.languages.registerDocumentFormattingEditProvider(
      [
        { language: "starlark" },
        { pattern: "**/BUILD" },
        { pattern: "**/*.bazel" },
        { pattern: "**/WORKSPACE" },
        { pattern: "**/*.BUILD" },
        { pattern: "**/*.bzl" },
        { pattern: "**/*.sky" },
      ],
      new BuildifierFormatProvider(),
    ),
    buildifierDiagnostics,
    // Task provider
    ...activateTaskProvider(),
    // Command variables
    ...activateCommandVariables(),
    // Test provider
    ...activateTesting(),
  );

  // Notify the user if buildifier is not available on their path (or where
  // their settings expect it).
  // We intentionally do no `await` the completion because doing so would mean
  // that VS Code considers the extension activation to be "in-flight" until the
  // users closes the "Buildifier not found" notification. VS Code hence
  // dislayed  never-finishing "Loading" indicator on top of the "Bazel Build
  // Targets" tree view.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  checkBuildifierIsAvailable();
}

/** Called when the extension is deactivated. */
export function deactivate() {
  // Nothing to do here.
  logInfo("Extension deactivated.");
}
