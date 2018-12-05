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

import { BazelChildProcessCommand } from "./bazel_child_process_command";
import { QueryResult } from "./query_result";

/** Provides a promise-based API around a Bazel query. */
export class BazelQuery extends BazelChildProcessCommand {
  /**
   * Initializes a new Bazel query.
   *
   * @param workingDirectory The path to the directory from which Bazel will be
   *     spawned.
   * @param query The query to execute.
   * @param options Command line options that will be passed to Bazel (targets,
   *     query strings, flags, etc.).
   * @param ignoresErrors If true, a non-zero exit code for the child process is
   *     ignored and the {@link #run} function's promise is resolved with the
   *     empty string instead.
   */
  public constructor(
    workingDirectory: string,
    query: string,
    options: string[],
    ignoresErrors: boolean = false,
  ) {
    super(workingDirectory, [query].concat(options), ignoresErrors);
  }

  /**
   * Runs the query and parses its output into a rich object model that can be
   * traversed.
   *
   * @param additionalOptions Additional command line options that should be
   *     passed just to this specific invocation of the query.
   * @returns A {@link QueryResult} object that contains structured information
   *     about the query results.
   */
  public async runAndParse(
    additionalOptions: string[] = [],
  ): Promise<QueryResult> {
    const xmlString = await this.run(
      additionalOptions.concat(["--output=xml"]),
    );
    return Promise.resolve(new QueryResult(xmlString));
  }

  protected bazelCommand(): string {
    return "query";
  }
}
