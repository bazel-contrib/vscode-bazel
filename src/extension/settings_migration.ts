import * as vscode from "vscode";
import { logInfo } from "./logger";

interface RenamedSetting {
  oldSection: string;
  oldName: string;
  newSection: string;
  newName: string;
}

/**
 * Settings renamed while clustering each feature's configuration under its
 * own `bazel.<featureName>.*` section (see #490). The old names stay supported
 * as read-only aliases (see `getRenamedSetting`) so a checked-in
 * `.vscode/settings.json` keeps working across extension versions without the
 * extension ever rewriting it (#706).
 */
const RENAMED_SETTINGS: readonly RenamedSetting[] = [
  {
    oldSection: "bazel",
    oldName: "workspacePath",
    newSection: "bazel.workspace",
    newName: "path",
  },
  {
    oldSection: "bazel",
    oldName: "pathsToIgnore",
    newSection: "bazel.workspace",
    newName: "pathsToIgnore",
  },
  {
    oldSection: "bazel",
    oldName: "queriesShareServer",
    newSection: "bazel.commandLine",
    newName: "queriesShareServer",
  },
  {
    oldSection: "bazel",
    oldName: "queryOutputBase",
    newSection: "bazel.commandLine",
    newName: "queryOutputBase",
  },
  {
    oldSection: "bazel",
    oldName: "enableCodeLens",
    newSection: "bazel.codeLens",
    newName: "enable",
  },
  {
    oldSection: "bazel",
    oldName: "enableWorkspaceTree",
    newSection: "bazel.workspaceTree",
    newName: "enable",
  },
  {
    oldSection: "bazel",
    oldName: "enableBuildifier",
    newSection: "bazel.buildifier",
    newName: "enable",
  },
  {
    oldSection: "bazel",
    oldName: "buildifierExecutable",
    newSection: "bazel.buildifier",
    newName: "executable",
  },
  {
    oldSection: "bazel",
    oldName: "buildifierConfigJsonPath",
    newSection: "bazel.buildifier",
    newName: "configJsonPath",
  },
  {
    oldSection: "bazel",
    oldName: "buildifierFixOnFormat",
    newSection: "bazel.buildifier",
    newName: "fixOnFormat",
  },
  {
    oldSection: "bazel",
    oldName: "enableTestExplorer",
    newSection: "bazel.testExplorer",
    newName: "enable",
  },
  {
    oldSection: "bazel",
    oldName: "enableLanguageSupport",
    newSection: "bazel.languageSupport",
    newName: "enable",
  },
];

const RENAMED_BY_NEW_KEY: ReadonlyMap<string, RenamedSetting> = new Map(
  RENAMED_SETTINGS.map((s) => [`${s.newSection}.${s.newName}`, s]),
);

/**
 * Reads a setting by its new name, falling back to its pre-#490 name.
 *
 * Mirrors VS Code's own precedence (folder > workspace > user > default), and
 * at each scope a value under the new name wins over one under the old name.
 * That makes "set both keys" a valid way to support old and new extension
 * versions from one checked-in settings.json.
 *
 * Never writes to any settings file.
 */
export function getRenamedSetting<T>(
  section: string,
  name: string,
  scope?: vscode.ConfigurationScope,
): T | undefined {
  const config = vscode.workspace.getConfiguration(section, scope);
  const legacy = RENAMED_BY_NEW_KEY.get(`${section}.${name}`);
  if (!legacy) {
    return config.get<T>(name);
  }
  const current = config.inspect<T>(name);
  const old = vscode.workspace
    .getConfiguration(legacy.oldSection, scope)
    .inspect<T>(legacy.oldName);
  return (
    current?.workspaceFolderValue ??
    old?.workspaceFolderValue ??
    current?.workspaceValue ??
    old?.workspaceValue ??
    current?.globalValue ??
    old?.globalValue ??
    current?.defaultValue
  );
}

/**
 * `ConfigurationChangeEvent.affectsConfiguration`, also matching the old name
 * of a renamed setting.
 */
export function affectsRenamedSetting(
  event: vscode.ConfigurationChangeEvent,
  key: string,
): boolean {
  const legacy = RENAMED_BY_NEW_KEY.get(key);
  return (
    event.affectsConfiguration(key) ||
    (legacy !== undefined &&
      event.affectsConfiguration(`${legacy.oldSection}.${legacy.oldName}`))
  );
}

/**
 * Logs (but does not rewrite) any explicitly set old setting names, so users
 * learn about the rename without their working tree being modified.
 */
export function logDeprecatedSettingsInUse(): void {
  const inUse = RENAMED_SETTINGS.filter((s) => {
    const i = vscode.workspace
      .getConfiguration(s.oldSection)
      .inspect(s.oldName);
    return (
      i?.globalValue !== undefined ||
      i?.workspaceValue !== undefined ||
      i?.workspaceFolderValue !== undefined
    );
  }).map((s) => `${s.oldSection}.${s.oldName} -> ${s.newSection}.${s.newName}`);
  if (inUse.length > 0) {
    logInfo(
      `Deprecated setting names in use (still honored, but consider switching to the new names):\n  ${inUse.join("\n  ")}`,
    );
  }
}
