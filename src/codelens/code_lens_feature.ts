import * as vscode from "vscode";

import { BaseExtensionFeature } from "../extension/extension_feature";
import {
  BUILD_FILE_CHANGE_DELAY_MS,
  CoalescingRunner,
} from "../extension/coalescing_runner";
import { checkBazelIsAvailable } from "../bazel/bazel_availability";
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

  enable(context: vscode.ExtensionContext): Promise<boolean> {
    // Precondition: bazel executable available
    if (!checkBazelIsAvailable()) {
      this.logWarn("Can not activate, no bazel executable found.");
      return Promise.resolve(false);
    }

    // Create and register the CodeLens provider
    const codelensProvider = new CodeLensProvider(this.getLogger());

    // Set up file watcher for BUILD files
    const buildWatcher = vscode.workspace.createFileSystemWatcher(
      "**/{BUILD,BUILD.bazel}",
      true, // ignoreCreateEvents
      false,
      true, // ignoreDeleteEvents
    );

    // Fire refresh when BUILD files change, coalescing bursts of changes
    // (e.g. git checkout): each refresh re-queries every visible BUILD file.
    const refreshRunner = new CoalescingRunner(BUILD_FILE_CHANGE_DELAY_MS, () =>
      codelensProvider.refresh(),
    );
    buildWatcher.onDidChange(
      () => refreshRunner.schedule(),
      this,
      this.disposables,
    );

    const codeLensRegistration = vscode.languages.registerCodeLensProvider(
      [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
      codelensProvider,
    );

    this.disposables.push(codeLensRegistration, buildWatcher, refreshRunner);

    return Promise.resolve(true);
  }
}
