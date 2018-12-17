import { setFlagsFromString } from "v8";

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

/**
 * Represents the location of a query item in the BUILD file where it was
 * defined.
 */
export class BazelLabel {
  /**
   * Parses the given string representing a Bazel label.
   *
   * @param label The label string to parse.
   */
  public static parse(label: string): BazelLabel {
    // The implementation of this function is adapted from the Go version in
    // https://github.com/bazelbuild/buildtools/blob/82e2ba/edit/edit.go#L40.
    let target: string;
    let repository: string;
    if (label.startsWith("@")) {
      target = label.substr(1);
      let otherParts: string[];
      [repository, ...otherParts] = target.split("/");

      if (otherParts.length === 0) {
        // "@foo" => { repository: "foo", package: "", name: "foo" }
        // (i.e., it is equivalent to "@foo//:foo")
        return new BazelLabel(repository, "", repository);
      }
      target = `/${otherParts.join("/")}`;
    } else {
      repository = "";
      target = label;
    }

    // Labels can end with ":", which is equivalent to no ":" at all.
    if (target.endsWith(":")) {
      target = target.substr(target.length - 1);
    }

    const isAbsolute = target.startsWith("//");
    if (isAbsolute) {
      target = target.substr(2);
    }

    const [packagePath, ...nameParts] = target.split(":");
    if (nameParts.length === 0) {
      if (isAbsolute) {
        // "//absolute/pkg" => { package: "absolute/pkg", name: "pkg" }
        const name = path.basename(packagePath);
        return new BazelLabel(repository, packagePath, name);
      } else {
        // "relative/label" => { package: "", name: "relative/label" }
        return new BazelLabel(repository, "", packagePath);
      }
    } else {
      // "//absolute/pkg:name" => { package: "absolute/pkg", name: "name" }
      const name = nameParts.join(":");
      return new BazelLabel(repository, packagePath, name);
    }
  }

  /**
   * Creates a new Bazel label with the given components.
   *
   * @param repository The name of the repository that the label refers to.
   * @param packagePath The path of the package that the label refers to.
   * @param name The name of the target or file that the label refers to.
   */
  public constructor(
    public readonly repository: string,
    public readonly packagePath: string,
    public readonly name: string,
  ) {}
}
