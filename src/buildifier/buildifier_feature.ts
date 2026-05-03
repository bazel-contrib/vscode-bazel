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

import { BaseExtensionFeature } from "../extension/extension_feature";
import {
  checkBuildifierIsAvailable,
  showBuildifierDownloadPrompt,
} from "./buildifier_availability";
import { BuildifierDiagnosticsManager } from "./buildifier_diagnostics_manager";
import { BuildifierFormatProvider } from "./buildifier_format_provider";

/**
 * Buildifier feature for Bazel BUILD and Starlark files.
 * Responsible for:
 * - Extension activation
 * - Precondition checks
 * - Provider registration with VSCode
 * - Diagnostics management for lint warnings
 * - Document formatting support
 */
export class BuildifierFeature extends BaseExtensionFeature {
  private diagnosticsManager?: BuildifierDiagnosticsManager;

  constructor(context: vscode.ExtensionContext) {
    super("Buildifier", context);
  }

  enable(context: vscode.ExtensionContext): boolean {
    // Precondition: buildifier executable available
    if (!checkBuildifierIsAvailable()) {
      this.logWarn("Can not activate, no buildifier executable found.");

      // Asynchronously show download prompt without waiting for it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      showBuildifierDownloadPrompt("Buildifier was not found");

      return false;
    }

    // Create and register the diagnostics manager for lint warnings
    this.diagnosticsManager = new BuildifierDiagnosticsManager();
    this.disposables.push(this.diagnosticsManager);

    // Create and register the document formatting provider
    const formatProvider = new BuildifierFormatProvider();
    const formatRegistration =
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
        formatProvider,
      );
    this.disposables.push(formatRegistration);

    return true;
  }

  /**
   * Get the diagnostics manager for testing purposes.
   */
  getDiagnosticsManager(): BuildifierDiagnosticsManager | undefined {
    return this.diagnosticsManager;
  }
}
