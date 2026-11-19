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

import { executeBuildifier } from "./buildifier";
import { logWarn } from "../extension/logger";

/**
 * Checks that the given buildifier is compatible (0.25.1 or higher) by
 * running it on an empty input and checking that it exits successfully and
 * its JSON output parses.
 *
 * @param executable The buildifier to check: a path, a name on the system
 * PATH, or a Bazel target starting with `@`.
 */
export async function validateBuildifierExecutable(
  executable: string,
): Promise<boolean> {
  let stdout: string;
  try {
    ({ stdout } = await executeBuildifier(
      "",
      // specify the --lint value even though off is the default in case
      // a .buildifer.json with a different value is present
      ["--format=json", "--mode=check", "--lint=off"],
      false,
      executable,
    ));
  } catch (e) {
    logWarn(`Buildifier version check failed for ${executable}: ${e}`);
    return false;
  }
  try {
    JSON.parse(stdout);
    return true;
  } catch {
    // If we got no valid JSON back, we don't have a compatible version.
    logWarn(`Buildifier ${executable} is too old (0.25.1 or higher is needed)`);
    return false;
  }
}
