import * as vscode from "vscode";

import { BaseExtensionFeature } from "../extension/extension_feature";
import { checkBazelIsAvailable } from "../bazel/bazel_availability";
import { BazelFileCoverage, parseLcov } from "./lcov_parser";
import { logWarn } from "../extension/logger";

/**
 * TestExplorer feature for Bazel.
 * Responsible for:
 * - Extension activation
 * - Precondition checks
 * - Registering the `TestController` that surfaces `bazel coverage` results in
 * VS Code's built-in Test Explorer view.
 */
export class TestExplorerFeature extends BaseExtensionFeature {
  private testController?: vscode.TestController;
  private coverageRunProfile?: vscode.TestRunProfile;

  constructor(context: vscode.ExtensionContext) {
    super("TestExplorer", context);
    activeInstance = this;
  }

  protected enable(context: vscode.ExtensionContext): Promise<boolean> {
    // Precondition: bazel executable available
    if (!checkBazelIsAvailable()) {
      this.logWarn("Can not activate, no bazel executable found.");
      return Promise.resolve(false);
    }

    // Create the test controller
    const testController = vscode.tests.createTestController(
      "bazel-coverage",
      "Bazel Coverage",
    );
    this.disposables.push(testController);

    // Create the test run profile
    const coverageRunProfile = testController.createRunProfile(
      "Bazel Coverage",
      vscode.TestRunProfileKind.Coverage,
      async () => undefined,
    );
    coverageRunProfile.isDefault = false;
    // `loadDetailedCoverage` is important so that line coverage data is shown.
    coverageRunProfile.loadDetailedCoverage = (_, coverage) =>
      Promise.resolve((coverage as BazelFileCoverage).details);

    this.testController = testController;
    this.coverageRunProfile = coverageRunProfile;

    return Promise.resolve(true);
  }

  protected disable(): boolean {
    this.testController = undefined;
    this.coverageRunProfile = undefined;
    return super.disable();
  }

  /**
   * Display coverage information from a `.lcov` file in the Test Explorer.
   *
   * @param description The heading message for the test (coverage) run.
   * @param baseFolder The source file entries are relative paths to baseFolder.
   * @param lcov The lcov report data as a string.
   */
  async showLcovCoverage(
    description: string,
    baseFolder: string,
    lcov: string,
  ): Promise<void> {
    if (!this.testController || !this.coverageRunProfile) {
      this.logWarn(
        "Can not display coverage, TestExplorer feature is disabled.",
      );
      return;
    }

    const run = this.testController.createTestRun(
      new vscode.TestRunRequest(undefined, undefined, this.coverageRunProfile),
      undefined,
      false,
    );
    run.appendOutput(description.replaceAll("\n", "\r\n"));
    for (const c of await parseLcov(baseFolder, lcov)) {
      run.addCoverage(c);
    }
    run.end();
  }

  /**
   * Get the test controller for testing purposes.
   */
  getTestController(): vscode.TestController | undefined {
    return this.testController;
  }
}

/**
 * Reference to the currently active feature instance, kept in sync by the
 * constructor above. There is only ever one instance created during
 * extension activation, but callers outside of the feature (e.g. the task
 * provider that runs `bazel coverage`) need a way to reach it without each
 * of them threading the instance through manually.
 */
let activeInstance: TestExplorerFeature | undefined;

/**
 * Display coverage information from a `.lcov` file.
 *
 * Delegates to the active `TestExplorerFeature` instance. Logs a warning and
 * does nothing if the feature has been disabled (or not yet activated).
 *
 * @param description The heading message for the test (coverage) run.
 * @param baseFolder The source file entries are relative paths to baseFolder.
 * @param lcov The lcov report data as a string.
 */
export async function showLcovCoverage(
  description: string,
  baseFolder: string,
  lcov: string,
): Promise<void> {
  if (!activeInstance) {
    logWarn(
      "Can not display coverage, TestExplorer feature is not active.",
      true,
    );
    return;
  }
  return activeInstance.showLcovCoverage(description, baseFolder, lcov);
}
