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
import { getRenamedSetting } from "./settings_migration";
import { AUTO_TOOL_SETTING, ToolKey } from "../external-tools/tool_config";
import { getToolRegistry } from "../external-tools/tool_registry_instance";

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

  const value = getRenamedSetting<T>(section, name);

  if (!value) {
    const info = config.inspect<T>(name);

    if (!info || info.defaultValue == null) {
      throw new Error(`No default value for configuration ${section}.${name}`);
    }

    return info.defaultValue;
  } else {
    return value;
  }
}

/**
 * Gets how to invoke Bazel: the executable resolved by the tool registry
 * (see `ExternalToolRegistry`), or the configured value.
 */
export function getBazelExecutablePath(): string {
  return getToolCommand(
    "Bazelisk",
    getConfigurationWithDefault<string>("bazel", "executable"),
    "bazel",
  );
}

/**
 * Returns how to invoke a tool: as resolved by the tool registry if it was
 * resolved, else the configured value, with `"auto"` mapped to the tool's
 * plain executable name.
 */
function getToolCommand(
  toolKey: ToolKey,
  configuredValue: string,
  executableName: string,
): string {
  const resolved = getToolRegistry()?.getResolvedTool(toolKey);
  if (resolved) {
    return resolved.command;
  }
  const value = configuredValue.trim();
  return value === AUTO_TOOL_SETTING ? executableName : value;
}

export function getPathsToIgnore(): string[] {
  return getConfigurationWithDefault<string[]>(
    "bazel.workspace",
    "pathsToIgnore",
  );
}

/**
 * Gets the manually specified Bazel workspace path from the workspace
 * configuration.
 *
 * @param scopeUri Optional URI to scope the configuration lookup to a specific
 * resource.
 * @returns The manually specified workspace path, or an empty string if not set.
 */
export function getWorkspacePath(scopeUri?: vscode.Uri): string {
  return (
    getRenamedSetting<string>("bazel.workspace", "path", scopeUri) || ""
  ).trim();
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

/**
 * Whether queries should share the same Bazel server as builds, as specified
 * by the workspace configuration.
 */
export function getQueriesShareServer(): boolean {
  // Not `getConfigurationWithDefault`: that returns the default whenever the
  // value is falsey, which would make it impossible to set this to `false`.
  return (
    getRenamedSetting<boolean>("bazel.commandLine", "queriesShareServer") ??
    true
  );
}

/**
 * Gets the output base directory to use for queries when they don't share a
 * server with builds, as specified by the workspace configuration.
 *
 * Unlike most other settings, this one has no default value: an unset value
 * means "let Bazel decide" (see `getQueriesShareServer`'s caller), so it
 * can't go through `getConfigurationWithDefault`.
 *
 * @returns The configured output base directory, or `undefined` if unset.
 */
export function getQueryOutputBase(): string | undefined {
  return getRenamedSetting<string>("bazel.commandLine", "queryOutputBase");
}

/**
 * Gets how to invoke buildifier: the executable resolved by the tool registry
 * (see `ExternalToolRegistry`), or the configured value.
 */
export function getBuildifierExecutablePath(): string {
  return getToolCommand(
    "Buildifier",
    getConfigurationWithDefault<string>("bazel.buildifier", "executable"),
    "buildifier",
  );
}

export function getBuildifierFixOnFormat(): boolean {
  return getConfigurationWithDefault<boolean>(
    "bazel.buildifier",
    "fixOnFormat",
  );
}

/**
 * Gets the path to the buildifier json configuration file specified by the
 * workspace configuration.
 *
 * @returns The path to the buildifier json configuration file specified in the
 * workspace configuration, or its default.
 */
export function getBuildifierJsonConfigPath(): string {
  return getConfigurationWithDefault<string>(
    "bazel.buildifier",
    "configJsonPath",
  ).trim();
}

/**
 * Gets the path to the buildifier json configuration file specified by the
 * workspace configuration.
 *
 * @returns The path to the buildifier json configuration file specified in the
 * workspace configuration, or its default.
 */
export function getLspServerExecutablePath(): string {
  return getConfigurationWithDefault<string>("bazel.lsp", "command").trim();
}
export function getLspServerArgs(): string[] {
  return getConfigurationWithDefault<string[]>("bazel.lsp", "args");
}
export function getLspServerEnv(): Record<string, string> {
  return getConfigurationWithDefault<Record<string, string>>(
    "bazel.lsp",
    "env",
  );
}
