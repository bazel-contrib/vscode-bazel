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
import { logDebug, logError } from "./logger";

/**
 * How long to wait after the last BUILD file change before reacting to it.
 * Bulk operations like `git checkout` change many files within this window.
 */
export const BUILD_FILE_CHANGE_DELAY_MS = 500;

/**
 * Coalesces bursts of requests to run an async task, e.g. a `bazel query`
 * triggered by file watcher events during a `git checkout`.
 *
 * The task runs `delayMs` after the last `schedule()` call, and never more
 * than once at a time: requests that arrive while it runs are folded into a
 * single trailing run after it finishes.
 */
export class CoalescingRunner implements vscode.Disposable {
  private timeout: NodeJS.Timeout | undefined;
  private inFlight: AbortController | undefined;
  private rerunRequested = false;
  private disposed = false;

  constructor(
    private readonly delayMs: number,
    private readonly task: (signal: AbortSignal) => void | Promise<void>,
  ) {}

  /** Requests a run of the task, `delayMs` after the last request. */
  public schedule(): void {
    if (this.disposed) {
      return;
    }
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      this.timeout = undefined;
      if (this.inFlight) {
        logDebug("Task still running, queueing a trailing run");
        this.rerunRequested = true;
      } else {
        void this.run();
      }
    }, this.delayMs);
  }

  /** Cancels any pending run and aborts the one in flight. */
  public dispose(): void {
    this.disposed = true;
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
    this.inFlight?.abort();
  }

  private async run(): Promise<void> {
    const controller = new AbortController();
    this.inFlight = controller;
    try {
      await this.task(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        logError("Coalesced task failed", false, error);
      }
    } finally {
      this.inFlight = undefined;
    }
    if (this.rerunRequested) {
      this.rerunRequested = false;
      this.schedule();
    }
  }
}
