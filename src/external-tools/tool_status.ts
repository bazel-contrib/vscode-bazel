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

import * as vscode from "vscode";

import { TOOL_INFO, TOOL_KEYS, ToolKey } from "./tool_config";
import { getToolSetting, openToolSettingCommand } from "./tool_locator";
import { ExternalToolRegistry, ToolState } from "./tool_registry";

/** Command that downloads the tool given as argument. */
export const DOWNLOAD_TOOL_COMMAND = "bazel.externalTools.download";

const STARLARK_SELECTOR: vscode.DocumentSelector = [
  { language: "starlark" },
  { pattern: "**/*.bazel" },
  { pattern: "**/*.bzl" },
];

/**
 * Shows the state of each external tool (which one is used, where it comes
 * from, whether it is missing) as language status items on Starlark files.
 */
export function registerToolStatusItems(
  registry: ExternalToolRegistry,
): vscode.Disposable {
  const items = new Map<ToolKey, vscode.LanguageStatusItem>();
  for (const key of TOOL_KEYS) {
    const item = vscode.languages.createLanguageStatusItem(
      `bazel.externalTools.${key}`,
      STARLARK_SELECTOR,
    );
    item.name = TOOL_INFO[key].displayName;
    items.set(key, item);
    updateItem(item, key, registry.getState(key), registry);
  }
  const listener = registry.onDidChangeTool(({ key, state }) =>
    updateItem(items.get(key), key, state, registry),
  );
  return vscode.Disposable.from(listener, ...items.values());
}

function updateItem(
  item: vscode.LanguageStatusItem,
  key: ToolKey,
  state: ToolState | undefined,
  registry: ExternalToolRegistry,
) {
  const { displayName: name, label, missingDetail } = TOOL_INFO[key];
  const config = registry.getToolConfig(key);
  const settingKey = getToolSetting(config).key;
  item.busy = false;
  item.severity = vscode.LanguageStatusSeverity.Information;
  item.command = openToolSettingCommand(config);

  if (!state) {
    item.text = name;
    item.detail = "checking…";
    item.busy = true;
    return;
  }
  switch (state.kind) {
    case "resolved": {
      const { tool } = state;
      if (tool.source === "managed") {
        const release = `${label} ${tool.version}`;
        item.text = name === label ? release : `${name} (${release})`;
        item.detail = "auto-downloaded";
      } else {
        item.text = name;
        item.detail =
          tool.source === "path"
            ? `from PATH: ${tool.location}`
            : `from ${settingKey}: ${tool.location}`;
      }
      return;
    }
    case "downloading":
      item.text = `Downloading ${label} ${config.version}`;
      item.detail = undefined;
      item.busy = true;
      return;
    case "unsupported":
      item.text = `${name} unavailable`;
      item.detail = state.reason;
      return;
    case "missing": {
      item.text = `${name} not found`;
      item.detail = missingDetail ?? state.reason;
      item.severity = vscode.LanguageStatusSeverity.Warning;
      if (registry.canDownload(key)) {
        item.command = {
          title: `Download ${label}`,
          command: DOWNLOAD_TOOL_COMMAND,
          arguments: [key],
        };
      }
      return;
    }
  }
}
