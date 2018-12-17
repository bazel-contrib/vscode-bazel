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
import { BuildifierWarning } from "./buildifier_warning";

/** Whether to warn about lint findings or fix them. */
export type BuildifierLintMode = "fix" | "warn";

/** The type of file that buildifier should interpret standard input as. */
export type BuildifierFileType = "build" | "bzl" | "workspace";

/**
 * Invokes buildifier in format mode.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 *     via stdin.
 * @param type Indicates whether to treat the file content as a BUILD file or a
 *     .bzl file.
 * @param applyLintFixes If true, lint warnings with automatic fixes will be
 *     fixed as well.
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
  return (await executeBuildifier(fileContent, args)).stdout;
}

/**
 * Invokes buildifier in lint mode and fixes any errors that can be
 * automatically fixed.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 *     via stdin.
 * @param type Indicates whether to treat the file content as a BUILD file or a
 *     .bzl file.
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
 *     via stdin.
 * @param type Indicates whether to treat the file content as a BUILD file or a
 *     .bzl file.
 * @param lintMode Indicates whether to warn about lint findings or fix them.
 * @returns An array of strings representing the lint issues that occurred.
 */
export async function buildifierLint(
  fileContent: string,
  type: BuildifierFileType,
  lintMode: "warn",
): Promise<BuildifierWarning[]>;

export async function buildifierLint(
  fileContent: string,
  type: BuildifierFileType,
  lintMode: BuildifierLintMode,
): Promise<string | BuildifierWarning[]> {
  const args = [`--type=${type}`, `--lint=${lintMode}`];
  const outputs = await executeBuildifier(fileContent, args);
  switch (lintMode) {
    case "fix":
      return outputs.stdout;
    case "warn":
      const trimmedOutput = outputs.stderr.trim();
      if (trimmedOutput.length) {
        return parseLintWarnings(trimmedOutput.split("\n"));
      }
      return [];
  }
}

/**
 * Returns the file type of a file with the given path.
 *
 * @param fsPath The file path, whose extension and basename are used to
 *     determine the file type.
 * @returns The buildifier type of the file.
 */
export function getBuildifierFileType(fsPath: string): BuildifierFileType {
  // NOTE: The implementation here should be kept in sync with buildifier's
  // automatic format detection (see:
  // https://github.com/bazelbuild/buildtools/blob/d39e4d/build/lex.go#L88)
  // so that user actions in the IDE are consistent with the behavior they
  // would see running buildifier on the command line.
  const parsedPath = path.parse(fsPath.toLowerCase());
  if (parsedPath.ext === ".bzl" || parsedPath.ext === ".sky") {
    return "bzl";
  }
  if (parsedPath.ext === ".build" || parsedPath.base === "build") {
    return "build";
  }
  if (parsedPath.ext === ".workspace" || parsedPath.base === "workspace") {
    return "workspace";
  }
  return "bzl";
}

/**
 * Gets the path to the buildifier executable specified by the workspace
 * configuration, if present.
 *
 * @returns The path to the buildifier executable specified in the workspace
 *     configuration, or just "buildifier" if not present (in which case the
 *     system path will be searched).
 */
export function getDefaultBuildifierExecutablePath(): string {
  // Try to retrieve the executable from VS Code's settings. If it's not set,
  // just use "buildifier" as the default and get it from the system PATH.
  const bazelConfig = vscode.workspace.getConfiguration("bazel");
  const buildifierExecutable = bazelConfig.buildifierExecutable as string;
  if (buildifierExecutable.length === 0) {
    return "buildifier";
  }
  return buildifierExecutable;
}

/**
 * Parses the output of buildifier's {@code --lint=warn} mode and constructs
 * objects representing the warnings.
 *
 * @param lines The lines of output from standard error.
 */
function parseLintWarnings(lines: string[]): BuildifierWarning[] {
  const warnings = new Array<BuildifierWarning>();
  let lineNumber = 0;
  let category = "";
  let message = "";

  for (const line of lines) {
    // Lines that start a new lint warning will have the following format:
    // "stdin:10: category: message"
    // Some messages may span multiple lines; the loop below handled that by
    // waiting until we see a new message start line (or the end of the input)
    // before committing a warning.
    if (line.startsWith("stdin:")) {
      if (message) {
        warnings.push(new BuildifierWarning(lineNumber, category, message));
      }
      const [_, lineNumberPart, categoryPart, ...remainder] = line.split(":");
      lineNumber = parseInt(lineNumberPart, 10);
      category = categoryPart.trim();
      message = remainder.join(":");
    } else {
      message += `\n${line}`;
    }
  }

  if (message) {
    warnings.push(new BuildifierWarning(lineNumber, category, message));
  }

  return warnings;
}

/**
 * Executes buildifier with the given file content and arguments.
 *
 * @param fileContent The BUILD or .bzl file content to process, which is sent
 *     via stdin.
 * @param args Command line arguments to pass to buildifier.
 */
function executeBuildifier(
  fileContent: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const execOptions = {
      maxBuffer: Number.MAX_SAFE_INTEGER,
    };
    const process = child_process.exec(
      // TODO(allevato): If we can use the `--path=<path>` argument in the
      // future, we'll need to quote the path to avoid issues with spaces.
      [getDefaultBuildifierExecutablePath()].concat(args).join(" "),
      execOptions,
      (error: Error, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
    // Write the file being linted/formatted to stdin and close the stream so
    // that the buildifier process continues.
    process.stdin.write(fileContent);
    process.stdin.end();
  });
}
