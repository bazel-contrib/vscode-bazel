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

/**
 * Contains information about a lint warning emitted by buildifier.
 */
export class BuildifierWarning {
  /**
   * Initializes a new object containing information about a buildifier warning.
   *
   * @param line The 1-based line number where the warning occurred.
   * @param category The short category name of the warning.
   * @param message The message associated with the warning.
   */
  constructor(
    public readonly line: number,
    public readonly category: string,
    public readonly message: string,
  ) {}
}
