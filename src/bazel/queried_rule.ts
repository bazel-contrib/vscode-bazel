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

import { QueryLocation } from "./query_location";

/**
 * An abstract class that contains common implementations of properties/methods
 * shared by different kinds of query result items.
 */
export abstract class QueryResultItem {
  /**
   * Sorts the given array of query result items lexicographically based on
   * their names.
   */
  public static sortByName(items: QueryResultItem[]) {
    items.sort((a: QueryResultItem, b: QueryResultItem) => {
      const aName = a.name;
      const bName = b.name;
      if (aName < bName) {
        return -1;
      }
      if (aName > bName) {
        return 1;
      }
      return 0;
    });
  }

  /**
   * Initializes a new query result item from the given XML node.
   *
   * @param node A JavaScript object that was parsed from the query's XML
   *     output.
   */
  constructor(protected readonly node: any) {}

  /**
   * The absolute file system path to the BUILD file where the query result item
   * is defined, along with the line and column number in that file.
   */
  get location(): QueryLocation {
    return new QueryLocation(this.node.$.location as string);
  }

  /**
   * The full package-qualified name of the build target that this item
   * represents.
   */
  get name(): string {
    return this.node.$.name as string;
  }
}
