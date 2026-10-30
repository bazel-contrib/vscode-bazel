import * as vscode from "vscode";
import { getBazelWorkspaceFolder } from "./bazel_utils";

/** Checks if any Bazel workspace is available. */
export function checkBazelWorkspaceAvailable(): boolean {
  const workspaceFolders =
    vscode.workspace.workspaceFolders
      ?.map((folder) => getBazelWorkspaceFolder(folder.uri.fsPath))
      .filter((folder) => folder !== undefined) ?? [];
  return workspaceFolders.length > 0;
}

const workspaceAvailabilityEmitter = new vscode.EventEmitter<boolean>();

/** Fires with the new availability whenever it is re-evaluated. */
export const onDidCheckBazelWorkspaceAvailability =
  workspaceAvailabilityEmitter.event;

export function setBazelWorkspaceAvailableContext() {
  const available = checkBazelWorkspaceAvailable();
  vscode.commands.executeCommand(
    "setContext",
    "bazel.haveWorkspace",
    available,
  );
  workspaceAvailabilityEmitter.fire(available);
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
