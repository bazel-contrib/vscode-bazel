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

import { logDebug, logWarn } from "../extension/logger";
import { executeBuildifier } from "./buildifier";

/**
 * Validates that buildifier executable is working correctly.
 *
 * @param buildifierExecutable Custom executable path to use instead of default.
 * @returns True if buildifier is working correctly, false otherwise.
 */
export async function validateBuildifierExecutable(
  buildifierExecutable: string,
): Promise<boolean> {
  try {
    logDebug(`Testing buildifier with JSON output format`);
    const { stdout } = await executeBuildifier(
      "",
      ["--format=json", "--mode=check", "--lint=off"],
      false,
      buildifierExecutable,
    );
    JSON.parse(stdout); // Will throw if not valid JSON
    logDebug(`Buildifier validation successful - JSON output supported`);
    return true;
  } catch (jsonError) {
    logWarn(
      `Buildifier JSON validation failed. The buildifier version may be too old and doesn't support JSON output format. Consider updating to a newer version. Error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
      false,
    );
    return false;
  }
}
