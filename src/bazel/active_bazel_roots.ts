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
 * How long to wait after the last trigger before re-resolving the roots, so
 * that bursts (e.g. a `git checkout`, or a setting changed and reverted)
 * cost at most one round of refreshes.
 */
export const ROOT_CHANGE_DELAY_MS = 500;

/**
 * Runs `task` `delayMs` after the last `schedule()` call.
 *
 * TODO(#712): replace with `CoalescingRunner` from
 * `src/extension/coalescing_runner.ts` once merged, which has the same
 * interface, and use its `BUILD_FILE_CHANGE_DELAY_MS` instead of
 * `ROOT_CHANGE_DELAY_MS`, i.e.
 * `new CoalescingRunner(BUILD_FILE_CHANGE_DELAY_MS, () => this.update())`.
 */
class DebouncedRunner implements vscode.Disposable {
  private timeout: NodeJS.Timeout | undefined;

  constructor(
    private readonly delayMs: number,
    private readonly task: (signal: AbortSignal) => void,
  ) {}

  /** Requests a run of the task, `delayMs` after the last request. */
  public schedule(): void {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(
      () => this.task(new AbortController().signal),
      this.delayMs,
    );
  }

  /** Cancels any pending run. */
  public dispose(): void {
    clearTimeout(this.timeout);
  }
}

interface TrackedFolder {
  readonly folder: vscode.WorkspaceFolder;
  readonly root: ActiveBazelRoot | undefined;
}

/**
 * Keeps track of the active Bazel root of every VS Code workspace folder (see
 * `resolveActiveBazelRoot`) and fires an event whenever one changes.
 *
 * Re-resolves `ROOT_CHANGE_DELAY_MS` after the last change to
 * `bazel.workspace.path` or `bazel.workspace.pathsToIgnore`, to the set of
 * workspace folders, or to marker files directly in a folder root. Marker
 * files above a folder root are not watched.
 */
export class ActiveBazelRoots implements vscode.Disposable {
  private readonly onDidChangeEmitter =
    new vscode.EventEmitter<ActiveBazelRootChange>();
  /** Fires once per folder whose active root changed. */
  public readonly onDidChange = this.onDidChangeEmitter.event;

  private readonly folders = new Map<string, TrackedFolder>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly updater = new DebouncedRunner(ROOT_CHANGE_DELAY_MS, () =>
    this.update(),
  );

  constructor() {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const root = resolveActiveBazelRoot(folder);
      this.folders.set(folder.uri.toString(), { folder, root });
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
      markerWatcher.onDidCreate(() => this.updater.schedule()),
      markerWatcher.onDidDelete(() => this.updater.schedule()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          affectsRenamedSetting(e, "bazel.workspace.path") ||
          affectsRenamedSetting(e, "bazel.workspace.pathsToIgnore")
        ) {
          this.updater.schedule();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(() =>
        this.updater.schedule(),
      ),
    );
  }

  /** Re-resolves every folder's root and fires for those that changed. */
  public update(): void {
    const current = new Set<string>();
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const key = folder.uri.toString();
      current.add(key);
      const tracked = this.folders.get(key);
      const root = resolveActiveBazelRoot(folder);
      if (tracked && sameRoot(tracked.root, root)) {
        continue;
      }
      this.folders.set(key, { folder, root });
      logInfo(describeRoot(folder, root));
      this.onDidChangeEmitter.fire({
        folder,
        previous: tracked?.root,
        current: root,
      });
    }
    for (const [key, tracked] of this.folders) {
      if (!current.has(key)) {
        this.folders.delete(key);
        this.onDidChangeEmitter.fire({
          folder: tracked.folder,
          previous: tracked.root,
          current: undefined,
        });
      }
    }
  }

  public dispose(): void {
    this.updater.dispose();
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
