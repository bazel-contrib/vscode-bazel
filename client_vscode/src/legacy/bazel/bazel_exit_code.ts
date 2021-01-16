// Copyright 2019 The Bazel Authors. All rights reserved.
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

// tslint:disable:max-line-length

/**
 * Bazel exit codes.
 *
 * This should be kept in sync with
 *   https://source.bazel.build/bazel/+/master:src/main/cpp/util/exit_code.h
 * and
 *  https://source.bazel.build/bazel/+/master:src/main/java/com/google/devtools/build/lib/util/ExitCode.java
 */
export enum ExitCode {
  SUCCESS = "SUCCESS",
  BUILD_FAILURE = "BUILD_FAILURE",
  PARSING_FAILURE = "PARSING_FAILURE",
  COMMAND_LINE_ERROR = "COMMAND_LINE_ERROR",
  TESTS_FAILED = "TESTS_FAILED",
  PARTIAL_ANALYSIS_FAILURE = "PARTIAL_ANALYSIS_FAILURE",
  NO_TESTS_FOUND = "NO_TESTS_FOUND",
  RUN_FAILURE = "RUN_FAILURE",
  ANALYSIS_FAILURE = "ANALYSIS_FAILURE",
  INTERRUPTED = "INTERRUPTED",
  LOCK_HELD_NOBLOCK_FOR_LOCK = "LOCK_HELD_NOBLOCK_FOR_LOCK",
  REMOTE_ENVIRONMENTAL_ERROR = "REMOTE_ENVIRONMENTAL_ERROR",
  OOM_ERROR = "OOM_ERROR",
  REMOTE_ERROR = "REMOTE_ERROR",
  LOCAL_ENVIRONMENTAL_ERROR = "LOCAL_ENVIRONMENTAL_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  PUBLISH_ERROR = "PUBLISH_ERROR",
  REMOTE_EXECUTOR_OVERLOADED = "REMOTE_EXECUTOR_OVERLOADED",
  RESERVED = "RESERVED",
  UNKNOWN = "UNKNOWN",
}

/**
 * Converts a given ExitCode to a user-presentable string.
 *
 * @param exitCode Bazel ExitCode to convert.
 * @returns A {@link string} representing the ExitCode.
 */
export function exitCodeToUserString(exitCode: ExitCode): string {
  switch (exitCode) {
    case ExitCode.SUCCESS:
      return "Success!";
    case ExitCode.BUILD_FAILURE:
      return "Build failed: check your build logs for errors.";
    case ExitCode.PARSING_FAILURE:
      return "BUILD file parsing failed: check your BUILD files.";
    case ExitCode.COMMAND_LINE_ERROR:
      return "Command line error: bad or illegal flags.";
    case ExitCode.TESTS_FAILED:
      return "Tests failed: check your test logs for errors.";
    case ExitCode.PARTIAL_ANALYSIS_FAILURE:
      return "Query failed: error during analysis.";
    case ExitCode.NO_TESTS_FOUND:
      return "No test targets were found.";
    case ExitCode.INTERRUPTED:
      return "Command interrupted.";
    case ExitCode.LOCK_HELD_NOBLOCK_FOR_LOCK:
      return "No block for lock: server locked already taken.";
    case ExitCode.REMOTE_ENVIRONMENTAL_ERROR:
      return "Remote Environment error: check your logs.";
    case ExitCode.OOM_ERROR:
      return "Out of Memory error: Try giving Bazel more RAM?";
    case ExitCode.REMOTE_ERROR:
      return "Remote error: check your remote cache and runner.";
    case ExitCode.LOCAL_ENVIRONMENTAL_ERROR:
      return (
        "Local environment error: " +
        "Unable to set up environment correctly, check your logs."
      );
    case ExitCode.INTERNAL_ERROR:
      return "Internal error: Please file a Bazel issue (and try again).";
    case ExitCode.PUBLISH_ERROR:
      return "BES publish error: uploading failed.";
    case ExitCode.REMOTE_EXECUTOR_OVERLOADED:
      return "Remote error: Remote runner is overloaded.";
    case ExitCode.RESERVED:
      return "Reserved error: unexpected, please file a vscode-bazel issue.";
    default:
      return (
        "Unknown error " + exitCode + ": please file a vscode-bazel issue."
      );
  }
}

/**
 * Converts a (exit num, command) pair to a Bazel ExitCode.
 *
 * @param exitCode Raw exitcode number from a Bazel execution.
 * @param command Bazel command used (optional).
 * @returns A {@link ExitCode} representing the ExitCode.
 */
export function parseExitCode(exitCode: number, command?: string): ExitCode {
  switch (exitCode) {
    case 0:
      return ExitCode.SUCCESS;
    case 1:
      // Builds can also have parsing failures but Bazel uses the same code
      // for... reasons?
      return command !== "build"
        ? ExitCode.PARSING_FAILURE
        : ExitCode.BUILD_FAILURE;
    case 2:
      return ExitCode.COMMAND_LINE_ERROR;
    case 3:
      return command === "test"
        ? ExitCode.TESTS_FAILED
        : ExitCode.PARTIAL_ANALYSIS_FAILURE;
    case 4:
      return ExitCode.NO_TESTS_FOUND;
    case 6:
      return ExitCode.RUN_FAILURE;
    case 7:
      return ExitCode.ANALYSIS_FAILURE;
    case 8:
      return ExitCode.INTERRUPTED;
    case 9:
      return ExitCode.LOCK_HELD_NOBLOCK_FOR_LOCK;
    case 32:
      return ExitCode.REMOTE_ENVIRONMENTAL_ERROR;
    case 33:
      return ExitCode.OOM_ERROR;
    case 34:
      return ExitCode.REMOTE_ERROR;
    case 36:
      return ExitCode.LOCAL_ENVIRONMENTAL_ERROR;
    case 37:
      return ExitCode.INTERNAL_ERROR;
    case 38:
      return ExitCode.PUBLISH_ERROR;
    case 39:
      return ExitCode.REMOTE_EXECUTOR_OVERLOADED;
    case 40:
      return ExitCode.RESERVED;
    default:
      return ExitCode.UNKNOWN;
  }
}
