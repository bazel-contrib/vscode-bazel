// Copyright 2022 The Bazel Authors. All rights reserved.
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

import { BazelQuery } from "./bazel_query";

export class BazelCQuery extends BazelQuery {
  public async queryOutputs(
    target: string,
    options: string[] = [],
  ): Promise<string[]> {
    return (
      await this.run([
        target,
        ...options,
        "--output=starlark",
        "--starlark:expr",
        '"\\n".join([f.path for f in target.files.to_list()])',
      ])
    )
      .toString("utf-8")
      .trim()
      .replace(/\r\n|\r/g, "\n")
      .split("\n")
      .sort();
  }

  protected bazelCommand(): string {
    return "cquery";
  }
}
