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
import * as path from "path";
import * as vscode from "vscode";
import { IBuildifierResult, IBuildifierWarning } from "./buildifier_result";
import { getDefaultBazelExecutablePath } from "../extension/configuration";

/** Whether to warn about lint findings or fix them. */
export type BuildifierLintMode = "fix" | "warn";

/** The type of file that buildifier should interpret standard input as. */
export type BuildifierFileType = "build" | "bzl" | "workspace" | "default";

/**
 * Invokes buildifier in format mode.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 * via stdin.
 * @param type Indicates whether to treat the file content as a BUILD file or a
 * .bzl file.
 * @param applyLintFixes If true, lint warnings with automatic fixes will be
 * fixed as well.
 * @returns The formatted file content.
 */
export async function buildifierFormat(
  fileContent: string,
  type: BuildifierFileType,
  applyLintFixes: boolean,
): Promise<string> {
  const args = [`--mode=fix`, `--type=${type}`];
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
 * @param type Indicates whether to treat the file content as a BUILD file or a
 * .bzl file.
 * @param lintMode Indicates whether to warn about lint findings or fix them.
 * @returns The fixed content.
 */
export async function buildifierLint(
  fileContent: string,
  type: BuildifierFileType,
  lintMode: "fix",
): Promise<string>;

/**
 * Invokes buildifier in lint mode and emits warnings indicating any issues that
 * were found.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 * via stdin.
 * @param type Indicates whether to treat the file content as a BUILD file or a
 * .bzl file.
 * @param lintMode Indicates whether to warn about lint findings or fix them.
 * @returns An array of objects representing the lint issues that occurred.
 */
export async function buildifierLint(
  fileContent: string,
  type: BuildifierFileType,
  lintMode: "warn",
): Promise<IBuildifierWarning[]>;

export async function buildifierLint(
  fileContent: string,
  type: BuildifierFileType,
  lintMode: BuildifierLintMode,
): Promise<string | IBuildifierWarning[]> {
  const args = [
    `--format=json`,
    `--mode=check`,
    `--type=${type}`,
    `--lint=${lintMode}`,
  ];
  const outputs = await executeBuildifier(fileContent, args, true);
  switch (lintMode) {
    case "fix":
      return outputs.stdout;
    case "warn": {
      const result = JSON.parse(outputs.stdout) as IBuildifierResult;
      for (const file of result.files) {
        if (file.filename === "<stdin>") {
          return file.warnings;
        }
      }
      return [];
    }
  }
}

/**
 * Returns the file type of a file with the given path.
 *
 * @param fsPath The file path, whose extension and basename are used to
 * determine the file type.
 * @returns The buildifier type of the file.
 */
export function getBuildifierFileType(fsPath: string): BuildifierFileType {
  // TODO(bazelbuild/buildtools#475, bazelbuild/buildtools#681): Switch to
  // `--path=<path>` rather than duplicate the logic from buildifier. The
  // catch is `--path` was already documented, but didn't work with stdin
  // until bazelbuild/buildtools#681, so we'd need to dual code path testing
  // --version to decide how to do things; so it likely is better to just
  // ignore things until the support has been out a while.

  // NOTE: The implementation here should be kept in sync with buildifier's
  // automatic format detection (see:
  // https://github.com/bazelbuild/buildtools/blob/d39e4d/build/lex.go#L88)
  // so that user actions in the IDE are consistent with the behavior they
  // would see running buildifier on the command line.
  const raw = fsPath.toLowerCase();
  let parsedPath = path.parse(raw);
  if (parsedPath.ext === ".oss") {
    parsedPath = path.parse(parsedPath.name);
  }
  switch (parsedPath.ext) {
    case ".bzl":
      return "bzl";
    case ".sky":
      return "default";
  }
  if (
    parsedPath.ext === ".build" ||
    parsedPath.name === "build" ||
    parsedPath.name.startsWith("build.")
  ) {
    return "build";
  }
  if (
    parsedPath.ext === ".workspace" ||
    parsedPath.name === "workspace" ||
    parsedPath.name.startsWith("workspace.")
  ) {
    return "workspace";
  }
  return "default";
}

/**
 * Gets the path to the buildifier executable specified by the workspace
 * configuration, if present.
 *
 * @returns The path to the buildifier executable specified in the workspace
 * configuration, or just "buildifier" if not present (in which case the
 * system path will be searched).
 */
export function getDefaultBuildifierExecutablePath(): string {
  // Try to retrieve the executable from VS Code's settings. If it's not set,
  // just use "buildifier" as the default and get it from the system PATH.
  const bazelConfig = vscode.workspace.getConfiguration("bazel");
  const buildifierExecutable = bazelConfig.get<string>("buildifierExecutable");
  if (buildifierExecutable.length === 0) {
    return "buildifier";
  }
  return buildifierExecutable;
}

/**
 * Gets the path to the buildifier json configuration file specified by the
 * workspace configuration, if present.
 *
 * @returns The path to the buildifier json configuration file specified in the
 * workspace configuration, or an empty string if not present.
 */
export function getDefaultBuildifierJsonConfigPath(): string {
  const bazelConfig = vscode.workspace.getConfiguration("bazel");
  return bazelConfig.get<string>("buildifierConfigJsonPath", "");
}

/**
 * Executes buildifier with the given file content and arguments.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 * via stdin.
 * @param args Command line arguments to pass to buildifier.
 * @param acceptNonSevereErrors If true, syntax/lint exit codes will not be
 * treated as severe tool errors.
 */
export function executeBuildifier(
  fileContent: string,
  args: string[],
  acceptNonSevereErrors: boolean,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Determine the executable
    let executable = getDefaultBuildifierExecutablePath();
    const buildifierConfigJsonPath = getDefaultBuildifierJsonConfigPath();
    if (buildifierConfigJsonPath.length !== 0) {
      args = ["--config", buildifierConfigJsonPath, ...args];
    }
    // Paths starting with an `@` are referring to Bazel targets
    if (executable.startsWith("@")) {
      const targetName = executable;
      executable = getDefaultBazelExecutablePath();
      args = ["run", targetName, "--", ...args];
    }
    const execOptions = {
      maxBuffer: Number.MAX_SAFE_INTEGER,
      // Use the workspace folder as CWD, thereby allowing relative
      // paths. See #329
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
    };

    // Start buildifier
    const process = child_process.execFile(
      executable,
      args,
      execOptions,
      (error, stdout, stderr) => {
        if (
          !error ||
          (acceptNonSevereErrors && shouldTreatBuildifierErrorAsSuccess(error))
        ) {
          resolve({ stdout, stderr });
        } else {
          reject(error);
        }
      },
    );
    // Write the file being linted/formatted to stdin and close the stream so
    // that the buildifier process continues.
    process.stdin.write(fileContent);
    process.stdin.end();
  });
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
