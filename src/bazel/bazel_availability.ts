import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as which from "which";
import { getBazelExecutablePath } from "../extension/configuration";
import { getBazelWorkspaceFolder } from "./bazel_utils";
import { logDebug } from "../extension/logger";

function fileExistsSync(filename: string): boolean {
  try {
    fs.statSync(filename);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether bazel is available (either at the system PATH or a
 * user-specified path, depending on the value in Settings).
 */
export function checkBazelIsAvailable(): boolean {
  const bazelExecutable = getBazelExecutablePath();
  const workspaceFolderPath =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // Check if the program exists as a relative path of the workspace
  const pathExists = workspaceFolderPath
    ? fileExistsSync(path.join(workspaceFolderPath, bazelExecutable))
    : false;

  if (!pathExists) {
    try {
      which.sync(bazelExecutable);
    } catch (e) {
      logDebug(`Bazel not found: ${bazelExecutable} got ${e}`);
      return false;
    }
  }
  return true;
}

/** Checks if any Bazel workspace is available. */
export function checkBazelWorkspaceAvailable(): boolean {
  const workspaceFolders =
    vscode.workspace.workspaceFolders
      ?.map((folder) => getBazelWorkspaceFolder(folder.uri.fsPath))
      .filter((folder) => folder !== undefined) ?? [];
  return workspaceFolders.length > 0;
}

export function setBazelWorkspaceAvailableContext() {
  vscode.commands.executeCommand(
    "setContext",
    "bazel.haveWorkspace",
    checkBazelWorkspaceAvailable(),
  );
}

export function registerBazelWorkspaceAvailabilityWatcher(
  context: vscode.ExtensionContext,
) {
  const buildFilesWatcher = vscode.workspace.createFileSystemWatcher(
    "**/{BUILD,BUILD.bazel,MODULE.bazel,REPO.bazel,WORKSPACE.bazel,WORKSPACE}",
    false, // ignoreCreateEvents
    true, // ignoreChangeEvents
    false, // ignoreDeleteEvents
  );

  buildFilesWatcher.onDidCreate(() => {
    setBazelWorkspaceAvailableContext();
  });
  buildFilesWatcher.onDidDelete(() => {
    setBazelWorkspaceAvailableContext();
  });
  vscode.workspace.onDidChangeWorkspaceFolders(() => {
    setBazelWorkspaceAvailableContext();
  });
  context.subscriptions.push(buildFilesWatcher);

  setBazelWorkspaceAvailableContext(); // Initialize
}
