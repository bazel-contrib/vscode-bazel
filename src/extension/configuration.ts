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

import * as vscode from "vscode";

/**
 * Gets a configuration value, returning the default set in the package.json if
 * the value is not set or falsey.
 * @param section The section that contains the configuration, as is passed to vscode.workspace.getConfiguration.
 * @param name The name of the configuration item within the section.
 * @returns The configuration value, or its default.
 */
export function getConfigurationWithDefault<T>(
  section: string,
  name: string,
): T {
  const config = vscode.workspace.getConfiguration(section);

  const value = config.get<T>(name);

  if (!value) {
    const info = config.inspect<T>(name);

    if (info.defaultValue == null) {
      throw new Error(`No default value for configuration ${section}.${name}`);
    }

    return info.defaultValue;
  } else {
    return value;
  }
}

/**
 * Gets the path to the Bazel executable specified by the workspace
 * configuration.
 *
 * @returns The path to the Bazel executable specified in the workspace
 * configuration, or its default.
 */
export function getDefaultBazelExecutablePath(): string {
  return getConfigurationWithDefault<string>("bazel", "executable").trim();
}

export function getStartupOptions(): string[] {
  return getConfigurationWithDefault<string[]>(
    "bazel.commandLine",
    "startupOptions",
  );
}

export function getCommandArgs(): string[] {
  return getConfigurationWithDefault<string[]>(
    "bazel.commandLine",
    "commandArgs",
  );
}

export function getQueryExpression(): string {
  return getConfigurationWithDefault<string>(
    "bazel.commandLine",
    "queryExpression",
  );
}

/** The source type for buildifier resolution. */
export type BuildifierSource = "auto" | "path" | "bazelTarget" | "releaseTag";

/** Configuration for buildifier resolution. */
export interface BuildifierConfig {
  source: BuildifierSource;
  value: string;
}

const DEFAULT_BUILDIFIER_CONFIG: BuildifierConfig = {
  source: "auto",
  value: "",
};

/**
 * Gets the buildifier configuration from settings.
 * Prefers the new `bazel.buildifier` object setting, falls back to legacy
 * `bazel.buildifierExecutable` string.
 *
 * @returns The buildifier configuration.
 */
export function getBuildifierConfig(): BuildifierConfig {
  const config = vscode.workspace.getConfiguration("bazel");

  // Check the new object setting first
  const buildifierObj = config.get<BuildifierConfig>("buildifier");
  if (
    buildifierObj &&
    (buildifierObj.source !== "auto" || buildifierObj.value !== "")
  ) {
    return buildifierObj;
  }

  // Fall back to legacy string setting
  const legacyValue = config.get<string>("buildifierExecutable", "");
  if (legacyValue) {
    // Infer source from legacy value format
    return {
      source: "auto",
      value: legacyValue,
    };
  }

  return DEFAULT_BUILDIFIER_CONFIG;
}
