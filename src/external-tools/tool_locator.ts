// Copyright 2026 The Bazel Authors. All rights reserved.
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

import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";
import which from "which";

import { getBazelWorkspaceFolder } from "../bazel/bazel_utils";
import { getRenamedSetting } from "../extension/settings_migration";
import {
  AUTO_TOOL_SETTING,
  TOOL_INFO,
  ToolConfig,
  ToolKey,
} from "./tool_config";

/** Where a resolved tool came from. */
export type ToolSource = "setting" | "path" | "managed";

/** A tool that was found and can be invoked. */
export interface LocatedTool {
  /**
   * What to invoke: an absolute path, a name looked up on the PATH, a path
   * relative to the Bazel workspace, or (for buildifier) a `@target`.
   */
  command: string;
  /** Absolute path of the executable (or the `@target`), for display. */
  location: string;
  source: ToolSource;
  /** The version of a managed copy. */
  version?: string;
}

/** The setting a tool is configured by, e.g. `bazel.buildifier.executable`. */
export interface ToolSetting {
  /** Full key, e.g. `bazel.buildifier.executable`. */
  key: string;
  /** Section, e.g. `bazel.buildifier`. */
  section: string;
  /** Name within the section, e.g. `executable`. */
  name: string;
}

export function getToolSetting(config: ToolConfig): ToolSetting {
  const key = `bazel.${config.configKey}`;
  const lastDot = key.lastIndexOf(".");
  return {
    key,
    section: key.slice(0, lastDot),
    name: key.slice(lastDot + 1),
  };
}

/** A command that opens the Settings UI at the tool's setting. */
export function openToolSettingCommand(config: ToolConfig): vscode.Command {
  return {
    title: "Configure",
    command: "workbench.action.openSettings",
    arguments: [getToolSetting(config).key],
  };
}

/** Whether a setting value names a Bazel target the tool is run from. */
export function isBazelTarget(toolKey: ToolKey, value: string): boolean {
  return TOOL_INFO[toolKey].allowsBazelTarget === true && value.startsWith("@");
}

/**
 * Returns the explicitly configured value of a tool's setting, or `undefined`
 * if the extension should locate the tool itself (`"auto"`, empty, or the
 * tool's plain executable name, which the automatic lookup tries first).
 */
export function getConfiguredToolValue(config: ToolConfig): string | undefined {
  const { section, name } = getToolSetting(config);
  const value = (getRenamedSetting<string>(section, name) ?? "").trim();
  if (
    value === "" ||
    value === AUTO_TOOL_SETTING ||
    value === config.executableName
  ) {
    return undefined;
  }
  return value;
}

export async function isExecutableFile(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return false;
    }
    await fs.access(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Directories a relative executable path is resolved against.
 *
 * A tool that runs in the Bazel workspace root is looked up from each
 * resolved Bazel root (including one pinned by `bazel.workspace.path`),
 * falling back to the VS Code folder when no Bazel workspace can be resolved.
 * The other tools are looked up in the first VS Code folder.
 */
function relativePathBases(toolKey: ToolKey): string[] {
  const folders = (vscode.workspace.workspaceFolders ?? []).map(
    (folder) => folder.uri.fsPath,
  );
  if (TOOL_INFO[toolKey].runsIn === "bazelRoot") {
    return folders.map((folder) => getBazelWorkspaceFolder(folder) ?? folder);
  }
  return folders.slice(0, 1);
}

/**
 * Locates a tool from an explicitly configured setting value: a `@target`
 * (buildifier only), an absolute path, a path relative to the workspace or a
 * name on the system PATH.
 */
export async function locateConfiguredTool(
  toolKey: ToolKey,
  value: string,
): Promise<LocatedTool | undefined> {
  if (isBazelTarget(toolKey, value)) {
    return { command: value, location: value, source: "setting" };
  }

  const candidates = path.isAbsolute(value)
    ? [value]
    : relativePathBases(toolKey).map((base) => path.resolve(base, value));
  for (const candidate of candidates) {
    if (await isExecutableFile(candidate)) {
      const command = TOOL_INFO[toolKey].runsIn ? value : candidate;
      return { command, location: candidate, source: "setting" };
    }
  }

  const onPath = await which(value, { nothrow: true });
  if (onPath) {
    return { command: value, location: onPath, source: "setting" };
  }
  return undefined;
}

/** Locates a tool by its executable name on the system PATH. */
export async function locateToolOnPath(
  config: ToolConfig,
): Promise<LocatedTool | undefined> {
  const onPath = await which(config.executableName, { nothrow: true });
  if (!onPath) {
    return undefined;
  }
  return {
    command: config.executableName,
    location: onPath,
    source: "path",
  };
}
