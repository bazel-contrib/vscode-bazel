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

import * as xml2js from "xml2js";
import { QueryResultItem } from "./queried_rule";
import { QueriedSourceFile } from "./queried_source_file";
import { QueriedRule } from "./query_result_item";

/** Contains the structured results of a Bazel query. */
export class QueryResult {
  /** Build targets that were instantiated from rules. */
  public readonly rules: QueriedRule[];

  /** Build targets that represent source files exported by the package. */
  public readonly sourceFiles: QueriedSourceFile[];

  /**
   * Intializes a new Bazel query result from the given XML output.
   *
   * @param xmlString The XML output of a {@code bazel query}. This string may
   *     be empty, in which case the results are empty as well.
   */
  constructor(xmlString: string) {
    if (xmlString.length === 0) {
      this.rules = [];
      this.sourceFiles = [];
      return;
    }

    let queryResult: any = {};
    xml2js.parseString(xmlString, (err, result) => {
      queryResult = result;
    });

    const queryNode = queryResult.query;

    this.rules = ((queryNode.rule as any[]) || []).map((ruleNode: any) => {
      return new QueriedRule(ruleNode);
    });
    QueryResultItem.sortByName(this.rules);

    // TODO(allevato): These will only be returned if we do a ":*" query, not a
    // "/..." query. Determine if we want to surface these in the build target
    // view.
    this.sourceFiles = ((queryNode["source-file"] as any[]) || []).map(
      (sourceFileNode: any) => {
        return new QueriedSourceFile(sourceFileNode);
      },
    );
    QueryResultItem.sortByName(this.sourceFiles);
  }
}
