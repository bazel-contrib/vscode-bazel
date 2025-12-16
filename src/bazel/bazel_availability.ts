import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as which from "which";
import { getDefaultBazelExecutablePath } from "../extension/configuration";
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
  const bazelExecutable = getDefaultBazelExecutablePath();

  // Check if the program exists as a relative path of the workspace
  const pathExists = fileExistsSync(
    path.join(
      vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
      bazelExecutable,
    ),
  );

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
  if (!vscode.workspace.workspaceFolders?.length) {
    return false;
  }
  for (const folder of vscode.workspace.workspaceFolders) {
    if (getBazelWorkspaceFolder(folder.uri.fsPath)) {
      return true;
    }
  }
  return false;
}
