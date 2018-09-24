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

import { BazelChildProcessCommand } from "./commands";
import * as vscode from "vscode";
import * as xml2js from "xml2js";

/** Provides a promise-based API around a Bazel query. */
export class BazelQuery extends BazelChildProcessCommand {
  /**
   * Initializes a new Bazel query.
   * 
   * @param workingDirectory The path to the directory from which Bazel will be spawned.
   * @param query The query to execute.
   * @param options Command line options that will be passed to Bazel (targets, query strings,
   *     flags, etc.).
   * @param ignoresErrors If true, a non-zero exit code for the child process is ignored and the
   *     {@link #run} function's promise is resolved with the empty string instead.
   */
  public constructor(
    workingDirectory: string,
    query: string,
    options: string[],
    ignoresErrors: boolean = false,
  ) {
    super(workingDirectory, [query].concat(options), ignoresErrors);
  }

  protected bazelCommand(): string { return "query"; }

  /**
   * Runs the query and parses its output into a rich object model that can be traversed.
   * 
   * @param additionalOptions Additional command line options that should be passed just to this
   *     specific invocation of the query.
   * @returns A {@link QueryResult} object that contains structured information about the query
   *     results.
   */
  public async runAndParse(additionalOptions: string[] = []): Promise<QueryResult> {
    const xmlString = await this.run(additionalOptions.concat(["--output=xml"]));
    return Promise.resolve(new QueryResult(xmlString));
  }
}

/** Contains the structured results of a Bazel query. */
export class QueryResult {
  /** Build targets that were instantiated from rules. */
  public readonly rules: QueriedRule[]

  /** Build targets that represent source files exported by the package. */
  public readonly sourceFiles: QueriedSourceFile[]

  /**
   * Intializes a new Bazel query result from the given XML output.
   * 
   * @param xmlString The XML output of a {@code bazel query}. This string may be empty, in which
   *     case the results are empty as well.
   */
  constructor(xmlString: string) {
    if (xmlString.length == 0) {
      this.rules = [];
      this.sourceFiles = [];
      return;
    }

    var queryResult: any = {};
    xml2js.parseString(xmlString, (err, result) => {
      queryResult = result;
    });

    let queryNode = queryResult["query"];

    this.rules = (<any[]>queryNode["rule"] || []).map((ruleNode: any) => {
      return new QueriedRule(ruleNode);
    });
    QueryResultItem.sortByName(this.rules);

    // TODO(allevato): These will only be returned if we do a ":*" query, not a "/..." query.
    // Determine if we want to surface these in the build target view.
    this.sourceFiles = (<any[]>queryNode["source-file"] || []).map((sourceFileNode: any) => {
      return new QueriedSourceFile(sourceFileNode);
    });
    QueryResultItem.sortByName(this.sourceFiles);
  }
}

/** Represents the location of a query item in the BUILD file where it was defined. */
export class QueryLocation {
  /** The absolute file path of the BUILD file. */
  readonly path: string;

  /** The 1-based line number in the BUILD file where the item was defined. */
  readonly line: number;

  /** The 1-based column number in the BUILD file where the item was defined. */
  readonly column: number;

  constructor(stringRepresentation: string) {
    const parts = stringRepresentation.split(":");

    this.path = parts[0];
    this.line = parts.length > 1 ? parseInt(parts[1]) : 1;
    this.column = parts.length > 2 ? parseInt(parts[2]) : 1;
}

  /**
   * A {@code vscode.Range} value that points to the first character where the given query item is
   * defined.
   * 
   * This property handles the conversation from Bazel's 1-based line/column indices to the 0-based
   * indices that VS Code expects.
   */
  get range(): vscode.Range {
    return new vscode.Range(this.line - 1, this.column - 1, this.line - 1, this.column - 1);
  }
}

/**
 * An abstract class that contains common implementations of properties/methods shared by different
 * kinds of query result items.
 */
export abstract class QueryResultItem {
  /**
   * Initializes a new query result item from the given XML node.
   * 
   * @param node A JavaScript object that was parsed from the query's XML output.
   */
  constructor(protected readonly node: any) { }

  /**
   * The absolute file system path to the BUILD file where the query result item is defined, along
   * with the line and column number in that file.
   */
  get location(): QueryLocation {
    return new QueryLocation(<string>this.node["$"]["location"]);
  }

  /** The full package-qualified name of the build target that this item represents. */
  get name(): string {
    return <string>this.node["$"]["name"];
  }

  /** Sorts the given array of query result items lexicographically based on their names. */
  static sortByName(items: QueryResultItem[]) {
    items.sort((a: QueryResultItem, b: QueryResultItem) => {
      const aName = a.name;
      const bName = b.name;
      if (aName < bName) { return -1; }
      if (aName > bName) { return 1; }
      return 0;
    });
  }
}

/** Represents a build target that was created by instantiation of a build rule. */
export class QueriedRule extends QueryResultItem {
  /** The name of the build rule used to instantiate this target. */
  get ruleClass(): string {
    return <string>this.node["$"]["class"];
  }
}

/** Represents a build target that represents a source file in a queried package. */
export class QueriedSourceFile extends QueryResultItem { }
