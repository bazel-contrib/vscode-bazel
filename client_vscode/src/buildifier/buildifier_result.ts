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

/** The result emitted by buildifier when run in JSON mode. */
export interface IBuildifierResult {
  /**
   * Indicates whether or not the check succeeded without finding any problems.
   */
  success: boolean;

  /** Information about each file that was checked. */
  files: IBuildifierFile[];
}

/** Information about a file that was checked by buildifier. */
export interface IBuildifierFile {
  /** The path of the file that was checked. */
  filename: string;

  /** Indicates whether the file was formatted correctly. */
  formatted: boolean;

  /** Indicates whether the file is syntactically valid. */
  valid: boolean;

  /** The warnings, if any, that were found when checking the file. */
  warnings: IBuildifierWarning[];
}

/** Information about a warning found while checking a file with buildifier. */
export interface IBuildifierWarning {
  /** The line and column where the problem begins. */
  start: { line: number; column: number };

  /** The line and column where the problem ends. */
  end: { line: number; column: number };

  /** The category name of the problem. */
  category: string;

  /** Indicates whether the warning is actionable. */
  actionable: boolean;

  /** A descriptive message about the problem. */
  message: string;
}
