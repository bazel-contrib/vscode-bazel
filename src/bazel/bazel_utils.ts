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

import * as path from "path";
import { blaze_query } from "../protos";
import { BazelQuery } from "./bazel_query";

/**
 * Encapsulates information about the "generator" of a BUILD target.
 *
 * The generator is the Starlark macro called in the BUILD file that eventually
 * evaluates to a rule function invocation, if the rule invocation is not
 * directly in the BUILD file.
 */
export interface IBlazeTargetGenerator {
  /**
   * The "name" argument of the generator function.
   *
   * If the generator function did not have an argument named "name", then this
   * value is equal to the generated target's name.
   */
  name: string;

  /** The name of the function called in the BUILD file. */
  function: string;

  /** The location string describing where the generator was called. */
  location: string;
}

/**
 * Gets the generator info for the given BUILD target query result.
 *
 * @param target The BUILD target proto from a query result.
 * @returns The BUILD target generator info, or undefined if the BUILD target
 *     was not generated.
 */
export function getTargetGenerator(
  target: blaze_query.ITarget,
): IBlazeTargetGenerator | undefined {
  let generatorName: string | undefined;
  let generatorFunction: string | undefined;
  let generatorLocation: string | undefined;

  for (const attribute of target.rule.attribute) {
    switch (attribute.name) {
      case "generator_name":
        generatorName = attribute.stringValue;
        break;
      case "generator_function":
        generatorFunction = attribute.stringValue;
        break;
      case "generator_location":
        generatorLocation = attribute.stringValue;
        break;
    }
  }

  if (generatorName && generatorFunction && generatorLocation) {
    return {
      function: generatorFunction,
      location: generatorLocation,
      name: generatorName,
    };
  }
  return undefined;
}

/**
 * Get the targets in the build file
 *
 * @param workspace The path to the workspace
 * @param buildFile The path to the build file
 * @returns A query result for targets in the build file
 */
export async function getTargetsForBuildFile(
  workspace: string,
  buildFile: string,
): Promise<blaze_query.QueryResult> {
  // Path to the BUILD file relative to the workspace.
  const relPathToDoc = path.relative(workspace, buildFile);
  // Strip away the name of the BUILD file from the relative path.
  let relDirWithDoc = path.dirname(relPathToDoc);
  // Strip away the "." if the BUILD file was in the same directory as the
  // workspace.
  if (relDirWithDoc === ".") {
    relDirWithDoc = "";
  }
  // Turn the relative path into a package label
  const pkg = `//${relDirWithDoc}`;
  const queryResult = await new BazelQuery(
    workspace,
    `'kind(rule, ${pkg}:all)'`,
    [],
  ).queryTargets();

  return queryResult;
}
