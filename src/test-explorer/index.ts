import * as vscode from "vscode";
import { BazelFileCoverage, parseLcov } from "./lcov_parser";

let testController: vscode.TestController;
let coverageRunProfile: vscode.TestRunProfile;

export function activateTesting(): vscode.Disposable[] {
  const subscriptions: vscode.Disposable[] = [];

  // Create the test controller
  testController = vscode.tests.createTestController(
    "bazel-coverage",
    "Bazel Coverage",
  );
  subscriptions.push(testController);

  // Create the test run profile
  coverageRunProfile = testController.createRunProfile(
    "Bazel Coverage",
    vscode.TestRunProfileKind.Coverage,
    undefined,
  );
  coverageRunProfile.isDefault = false;
  // `loadDetailedCoverage` is important so that line coverage data is shown.
  coverageRunProfile.loadDetailedCoverage = (_, coverage) =>
    Promise.resolve((coverage as BazelFileCoverage).details);

  return subscriptions;
}

/**
 * Display coverage information from a `.lcov` file.
 */
export function showLcovCoverage(
  description: string,
  baseFolder: string,
  lcov: string,
) {
  const run = testController.createTestRun(
    new vscode.TestRunRequest(undefined, undefined, coverageRunProfile),
    null,
    false,
  );
  run.appendOutput(description.replaceAll("\n", "\r\n"));
  for (const c of parseLcov(baseFolder, lcov)) {
    run.addCoverage(c);
  }
  run.end();
}
