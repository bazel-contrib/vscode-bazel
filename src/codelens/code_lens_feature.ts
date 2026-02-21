import * as vscode from "vscode";

import { BaseExtensionFeature } from "../extension/extension_feature";
import {
  checkBazelIsAvailable,
  checkBazelWorkspaceAvailable,
} from "../bazel/bazel_availability";
import { CodeLensProvider } from "./code_lens_provider";

/**
 * CodeLens feature for Bazel BUILD files.
 * Responsible for:
 * - Extension activation
 * - Precondition checks
 * - Provider registration with VSCode
 */
export class CodeLensFeature extends BaseExtensionFeature {
  constructor(context: vscode.ExtensionContext) {
    super("CodeLens", context);
  }

  enable(context: vscode.ExtensionContext): boolean {
    // Precondition: must be in a Bazel workspace
    if (!checkBazelWorkspaceAvailable()) {
      this.logWarn("Can not activate, no Bazel workspace found.");
      return false;
    }
    // Precondition: bazel executable available
    if (!checkBazelIsAvailable()) {
      this.logWarn("Can not activate, no bazel executable found.");
      return false;
    }

    // Create and register the CodeLens provider
    const codelensProvider = new CodeLensProvider();

    // Set up file watcher for BUILD files
    const buildWatcher = vscode.workspace.createFileSystemWatcher(
      "**/{BUILD,BUILD.bazel}",
      true, // ignoreCreateEvents
      false,
      true, // ignoreDeleteEvents
    );

    // Fire refresh when BUILD files change
    buildWatcher.onDidChange(
      () => codelensProvider.refresh(),
      this,
      this.disposables,
    );

    const codeLensRegistration = vscode.languages.registerCodeLensProvider(
      [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
      codelensProvider,
    );

    this.disposables.push(codeLensRegistration, buildWatcher);

    return true;
  }
}
