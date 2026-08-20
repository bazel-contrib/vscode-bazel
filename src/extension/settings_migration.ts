import * as vscode from "vscode";
import { logInfo, showInfoMessage } from "./logger";

interface RenamedSetting {
  oldSection: string;
  oldName: string;
  newSection: string;
  newName: string;
}

/**
 * Settings renamed while clustering each feature's configuration under its
 * own `bazel.<featureName>.*` section (see #490). Each entry is migrated
 * automatically on activation - see `migrateRenamedSettings` - so this list
 * only ever needs to grow: migrating an already-migrated (now unset) old key
 * is a no-op.
 */
const RENAMED_SETTINGS: readonly RenamedSetting[] = [
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

/**
 * Copies any explicitly-set value at a renamed setting's old location over to
 * its new location, then clears the old one - for both User and Workspace
 * scope.
 *
 * Per-workspace-folder overrides are intentionally not migrated: there's no
 * general way to enumerate "the folder this applies to" outside of a
 * multi-root workspace, and folder-scoped overrides of these settings are
 * rare in practice. A user relying on one will see a one-time
 * "unknown configuration setting" warning from VS Code and can move the
 * value to the new key by hand.
 *
 * @returns Whether a value was migrated at either scope.
 */
async function migrateOne(setting: RenamedSetting): Promise<boolean> {
  const oldConfig = vscode.workspace.getConfiguration(setting.oldSection);
  const inspected = oldConfig.inspect(setting.oldName);
  if (!inspected) {
    return false;
  }

  const newConfig = vscode.workspace.getConfiguration(setting.newSection);
  const valuesByTarget: [vscode.ConfigurationTarget, unknown][] = [
    [vscode.ConfigurationTarget.Global, inspected.globalValue],
    [vscode.ConfigurationTarget.Workspace, inspected.workspaceValue],
  ];

  let migratedAny = false;
  for (const [target, value] of valuesByTarget) {
    if (value === undefined) {
      continue;
    }
    await newConfig.update(setting.newName, value, target);
    await oldConfig.update(setting.oldName, undefined, target);
    migratedAny = true;
  }
  return migratedAny;
}

/**
 * Migrates every setting renamed during the #490 settings clustering pass.
 *
 * Must run before any `BaseExtensionFeature` reads its configuration, i.e.
 * at the very start of `activate()` - features only ever look at the new
 * setting names, so a value left behind at the old name would otherwise
 * silently stop applying.
 *
 * @returns The `old -> new` setting keys that had a value migrated, for
 * logging/testing purposes.
 */
export async function migrateRenamedSettings(): Promise<string[]> {
  const migrated: string[] = [];
  for (const setting of RENAMED_SETTINGS) {
    if (await migrateOne(setting)) {
      migrated.push(
        `${setting.oldSection}.${setting.oldName} -> ${setting.newSection}.${setting.newName}`,
      );
    }
  }

  if (migrated.length > 0) {
    logInfo(`Migrated renamed settings:\n  ${migrated.join("\n  ")}`);
    void showInfoMessage(
      `Bazel: ${migrated.length} setting(s) were renamed and have been migrated to their new names automatically. See the "Bazel" output channel for details.`,
    );
  }

  return migrated;
}
