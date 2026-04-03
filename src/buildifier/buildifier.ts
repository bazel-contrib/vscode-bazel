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

import * as child_process from "child_process";
import * as util from "util";
import * as vscode from "vscode";

import { IBuildifierResult, IBuildifierWarning } from "./buildifier_result";
import { getDefaultBazelExecutablePath } from "../extension/configuration";

const execFile = util.promisify(child_process.execFile);
type PromiseExecFileException = child_process.ExecFileException & {
  stdout: string;
  stderr: string;
};

/** Whether to warn about lint findings or fix them. */
export type BuildifierLintMode = "fix" | "warn";

/**
 * Invokes buildifier in format mode.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 * via stdin.
 * @param filePath The path to the file being formatted, relative to the
 * workspace root.
 * @param applyLintFixes If true, lint warnings with automatic fixes will be
 * fixed as well.
 * @returns The formatted file content.
 */
export async function buildifierFormat(
  fileContent: string,
  filePath: string,
  applyLintFixes: boolean,
): Promise<string> {
  const args = [`--mode=fix`, `--path=${filePath}`];
  if (applyLintFixes) {
    args.push(`--lint=fix`);
  }
  return (await executeBuildifier(fileContent, args, false)).stdout;
}

/**
 * Invokes buildifier in lint mode and fixes any errors that can be
 * automatically fixed.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 * via stdin.
 * @param filePath The path to the file being formatted, relative to the
 * workspace root.
 * @param lintMode Indicates whether to warn about lint findings or fix them.
 * @returns The fixed content.
 */
export async function buildifierLint(
  fileContent: string,
  filePath: string,
  lintMode: "fix",
): Promise<string>;

/**
 * Invokes buildifier in lint mode and emits warnings indicating any issues that
 * were found.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 * via stdin.
 * @param filePath The path to the file being formatted, relative to the
 * workspace root.
 * @param lintMode Indicates whether to warn about lint findings or fix them.
 * @returns An array of objects representing the lint issues that occurred.
 */
export async function buildifierLint(
  fileContent: string,
  filePath: string,
  lintMode: "warn",
): Promise<IBuildifierWarning[]>;

export async function buildifierLint(
  fileContent: string,
  filePath: string,
  lintMode: BuildifierLintMode,
): Promise<string | IBuildifierWarning[]> {
  const args = [
    `--format=json`,
    `--mode=check`,
    `--path=${filePath}`,
    `--lint=${lintMode}`,
  ];
  const outputs = await executeBuildifier(fileContent, args, true);
  switch (lintMode) {
    case "fix":
      return outputs.stdout;
    case "warn": {
      const result = JSON.parse(outputs.stdout) as IBuildifierResult;
      for (const file of result.files) {
        if (file.filename === filePath) {
          return file.warnings;
        }
      }
      return [];
    }
  }
}

/**
 * Gets the path to the buildifier json configuration file specified by the
 * workspace configuration.
 *
 * @returns The path to the buildifier json configuration file specified in the
 * workspace configuration, or its default.
 */
export function getDefaultBuildifierJsonConfigPath(): string {
  return vscode.workspace
    .getConfiguration("bazel")
    .get<string>("buildifierConfigJsonPath")
    .trim();
}

/** A description of an executable and the arguments to pass to it. */
export interface IExecutable {
  /** The path to the executable. */
  path: string;

  /** The arguments that should be passed to the executable. */
  args: string[];
}

/**
 * Executes buildifier with the given file content and arguments.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 * via stdin.
 * @param args Command line arguments to pass to buildifier.
 * @param acceptNonSevereErrors If true, syntax/lint exit codes will not be
 * treated as severe tool errors.
 * @param executableOverride Optional executable to use instead of resolving
 * from config.
 */
export async function executeBuildifier(
  fileContent: string,
  args: string[],
  acceptNonSevereErrors: boolean,
  executableOverride?: IExecutable,
): Promise<{ stdout: string; stderr: string }> {
  // Determine the executable
  let executable: string;
  let execArgs: string[] = [];

  if (executableOverride) {
    executable = executableOverride.path;
    execArgs = executableOverride.args;
  } else {
    // Fallback to simple config-based resolution (for backward compatibility)
    const config = vscode.workspace.getConfiguration("bazel");
    const buildifierConfig = config.get<{ source?: string; value?: string }>(
      "buildifier",
    );
    let configValue =
      buildifierConfig?.value || config.get<string>("buildifierExecutable", "");

    // Default to "buildifier" if nothing configured
    if (!configValue) {
      configValue = "buildifier";
    }

    // Paths starting with @ are Bazel targets
    if (configValue.startsWith("@")) {
      executable = getDefaultBazelExecutablePath();
      execArgs = ["run", configValue, "--"];
    } else {
      executable = configValue;
    }
  }

  args = execArgs.concat(args);

  const buildifierConfigJsonPath = getDefaultBuildifierJsonConfigPath();
  if (buildifierConfigJsonPath.length !== 0) {
    args.push("--config", buildifierConfigJsonPath);
  }
  const execOptions = {
    maxBuffer: Number.MAX_SAFE_INTEGER,
    // Use the workspace folder as CWD, thereby allowing relative
    // paths. See #329
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
  };

  // Start buildifier
  const process = execFile(executable, args, execOptions);

  // Write the file being linted/formatted to stdin and close the stream so
  // that the buildifier process continues.
  process.child.stdin?.write(fileContent);
  process.child.stdin?.end();

  try {
    return await process;
  } catch (e) {
    const error = e as PromiseExecFileException;
    if (acceptNonSevereErrors && shouldTreatBuildifierErrorAsSuccess(error)) {
      return { stdout: error.stdout, stderr: error.stderr };
    } else {
      throw error;
    }
  }
}

/**
 * Returns a value indicating whether we need to consider the given error to be
 * a "successful" buildifier exit in the sense that it correctly reported
 * warnings/errors in the file despite the non-zero exit code.
 *
 * @param error The {@code Error} passed to the `child_process.execFile`
 * callback.
 */
function shouldTreatBuildifierErrorAsSuccess(
  error: child_process.ExecFileException,
): boolean {
  // Some of buildifier's exit codes represent states that we want to treat as
  // "successful" (i.e., the file had warnings/errors but we want to render
  // them), and other exit codes represent legitimate failures (like I/O
  // errors). We have to treat them specifically; see the following section for
  // the specific exit codes we handle (and make sure that this is updated if
  // new failure modes are introduced in the future):
  //
  // https://github.com/bazelbuild/buildtools/blob/831e4632/buildifier/buildifier.go#L323-L331
  switch (error.code) {
    case 1: // syntax errors in input
    case 4: // check mode failed
      return true;
    case undefined: // some other type of error, assume it's severe
      return false;
    default:
      return false;
  }
}
