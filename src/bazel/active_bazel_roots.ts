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

import { affectsRenamedSetting } from "../extension/settings_migration";
import { logInfo } from "../extension/logger";
import { ActiveBazelRoot, resolveActiveBazelRoot } from "./bazel_utils";

/** A change of the active Bazel root of one VS Code workspace folder. */
export interface ActiveBazelRootChange {
  readonly folder: vscode.WorkspaceFolder;
  /** The previous root, or undefined if the folder had none (or is new). */
  readonly previous: ActiveBazelRoot | undefined;
  /** The new root, or undefined if the folder has none (or was removed). */
  readonly current: ActiveBazelRoot | undefined;
}

function sameRoot(
  a: ActiveBazelRoot | undefined,
  b: ActiveBazelRoot | undefined,
): boolean {
  return a?.path === b?.path && a?.pinned === b?.pinned;
}

function describeRoot(
  folder: vscode.WorkspaceFolder,
  root: ActiveBazelRoot | undefined,
): string {
  if (!root) {
    return `No Bazel workspace found for folder "${folder.name}".`;
  }
  return (
    `Bazel workspace of folder "${folder.name}": ${root.path}` +
    (root.pinned ? " (pinned by bazel.workspace.path)" : "")
  );
}

/**
 * Keeps track of the active Bazel root of every VS Code workspace folder (see
 * `resolveActiveBazelRoot`) and fires an event whenever one changes.
 *
 * Re-resolves on changes to `bazel.workspace.path` and
 * `bazel.workspace.pathsToIgnore`, to the set of workspace folders, and to
 * marker files directly in a folder root. Marker files above a folder root
 * are not watched.
 */
export class ActiveBazelRoots implements vscode.Disposable {
  private readonly onDidChangeEmitter =
    new vscode.EventEmitter<ActiveBazelRootChange>();
  /** Fires once per folder whose active root changed. */
  public readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly roots = new Map<string, ActiveBazelRoot | undefined>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor() {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const root = resolveActiveBazelRoot(folder);
      this.roots.set(folder.uri.toString(), root);
      logInfo(describeRoot(folder, root));
    }

    const markerWatcher = vscode.workspace.createFileSystemWatcher(
      "{MODULE.bazel,REPO.bazel,WORKSPACE.bazel,WORKSPACE}",
      false, // ignoreCreateEvents
      true, // ignoreChangeEvents
      false, // ignoreDeleteEvents
    );
    this.disposables.push(
      this.onDidChangeEmitter,
      markerWatcher,
      markerWatcher.onDidCreate(() => this.update()),
      markerWatcher.onDidDelete(() => this.update()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          affectsRenamedSetting(e, "bazel.workspace.path") ||
          affectsRenamedSetting(e, "bazel.workspace.pathsToIgnore")
        ) {
          this.update();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders((e) => {
        for (const folder of e.removed) {
          const previous = this.roots.get(folder.uri.toString());
          this.roots.delete(folder.uri.toString());
          this.onDidChangeEmitter.fire({
            folder,
            previous,
            current: undefined,
          });
        }
        this.update();
      }),
    );
  }

  /** Re-resolves every folder's root and fires for those that changed. */
  public update(): void {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const key = folder.uri.toString();
      const previous = this.roots.get(key);
      const current = resolveActiveBazelRoot(folder);
      if (this.roots.has(key) && sameRoot(previous, current)) {
        continue;
      }
      this.roots.set(key, current);
      logInfo(describeRoot(folder, current));
      this.onDidChangeEmitter.fire({ folder, previous, current });
    }
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}

let activeBazelRoots: ActiveBazelRoots | undefined;

/**
 * Starts tracking the active Bazel roots. Registers the tracker with
 * `context.subscriptions`.
 */
export function registerActiveBazelRoots(
  context: vscode.ExtensionContext,
): ActiveBazelRoots {
  activeBazelRoots?.dispose();
  activeBazelRoots = new ActiveBazelRoots();
  context.subscriptions.push(activeBazelRoots);
  return activeBazelRoots;
}

/**
 * Subscribes to changes of any folder's active Bazel root. Safe to call
 * before `registerActiveBazelRoots` (e.g. from tests); the listener is then
 * never called.
 */
export function onDidChangeActiveBazelRoot(
  listener: (change: ActiveBazelRootChange) => void,
): vscode.Disposable {
  return activeBazelRoots?.onDidChange(listener) ?? vscode.Disposable.from();
}
