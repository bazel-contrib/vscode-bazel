// Copyright 2024 The Bazel Authors. All rights reserved.
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
import * as vscode from "vscode";

export enum IconName {
  ANDROID_BINARY = "android_binary",
  APPLE_APPLICATION = "apple_application",
  APPLE_EXECUTABLE_BUNDLE = "apple_executable_bundle",
  APPLE_FRAMEWORK = "apple_framework",
  BINARY = "binary",
  CONFIG_SETTING = "config_setting",
  FILEGROUP = "filegroup",
  GENRULE = "genrule",
  LIBRARY = "library",
  PROTO = "proto",
  RESOURCE_BUNDLE = "resource_bundle",
  TEST = "test",
  TEST_SUITE = "test_suite",
}

/**
 * Helper functions for getting the resource bundled inside this extension.
 */
export class Resources {
  public static fromExtensionContext(
    context: vscode.ExtensionContext,
  ): Resources {
    return new Resources(context.extensionPath);
  }

  /**
   * @param extensionPath The extension path, usually from the extension
   * context.
   */
  constructor(private readonly extensionPath: string) {}

  /**
   * Returns the icon path in string.
   *
   * @param name The icon file name.
   */
  public getIconPath(name: IconName): string {
    return path.join(this.extensionPath, "icons", `${name}.svg`);
  }
}
