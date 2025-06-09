// Copyright 2024 The Bazel Authors. All rights reserved.
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
import { BazelWorkspaceInfo } from "./bazel_workspace_info";

/**
 * Enum representing the different states of the Bazel build icon.
 */
export enum IconState {
  Idle = "idle",
  Building = "building", 
  Success = "success",
  Error = "error",
  Disabled = "disabled"
}

/**
 * Manages icon state transitions and validation.
 */
export class IconStateManager {
  private currentState: IconState = IconState.Disabled;
  private transitionTimeouts: Map<IconState, NodeJS.Timeout> = new Map();

  /**
   * Gets the current icon state.
   */
  public getCurrentState(): IconState {
    return this.currentState;
  }

  /**
   * Transitions to a new state with validation.
   * @param newState The state to transition to
   * @param timeoutMs Optional timeout to automatically revert to idle state
   */
  public transitionTo(newState: IconState, timeoutMs?: number): boolean {
    if (!this.isValidTransition(this.currentState, newState)) {
      return false;
    }

    // Clear any existing timeout for the current state
    const existingTimeout = this.transitionTimeouts.get(this.currentState);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.transitionTimeouts.delete(this.currentState);
    }

    this.currentState = newState;

    // Set up automatic timeout if specified
    if (timeoutMs && (newState === IconState.Success || newState === IconState.Error)) {
      const timeout = setTimeout(() => {
        this.transitionTo(IconState.Idle);
      }, timeoutMs);
      this.transitionTimeouts.set(newState, timeout);
    }

    return true;
  }

  /**
   * Validates if a state transition is allowed.
   */
  private isValidTransition(from: IconState, to: IconState): boolean {
    // Define valid transition rules
    switch (from) {
      case IconState.Disabled:
        return to === IconState.Idle;
      case IconState.Idle:
        return to === IconState.Building || to === IconState.Disabled;
      case IconState.Building:
        return to === IconState.Success || to === IconState.Error || to === IconState.Idle;
      case IconState.Success:
      case IconState.Error:
        return to === IconState.Idle || to === IconState.Building || to === IconState.Disabled;
      default:
        return false;
    }
  }

  /**
   * Cleanup method to clear all timeouts.
   */
  public dispose(): void {
    this.transitionTimeouts.forEach(timeout => clearTimeout(timeout));
    this.transitionTimeouts.clear();
  }
}

/**
 * Manages the Bazel build icon in the VS Code status bar.
 */
export class BazelBuildIcon implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private currentState: IconState = IconState.Idle;
  private stateTimeout?: NodeJS.Timeout;
  private buildProgressTimer?: NodeJS.Timeout;
  private progressFrameIndex: number = 0;
  private readonly PROGRESS_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private readonly PROGRESS_INTERVAL_MS = 100; // 10fps for spinner

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    
    // Set initial state
    this.updateDisplay();
    this.statusBarItem.show();
  }

  /**
   * Update the icon state with optional automatic timeout
   */
  public setState(state: IconState, timeoutMs?: number): void {
    // Validate state transition
    if (!this.isValidTransition(this.currentState, state)) {
      console.warn(`Invalid state transition from ${this.currentState} to ${state}`);
      return;
    }

    // Clear existing timeout and progress animation
    this.clearStateTimeout();
    this.clearProgressAnimation();

    // Update state
    const previousState = this.currentState;
    this.currentState = state;
    
    // Start progress animation for building state
    if (state === IconState.Building) {
      this.startProgressAnimation();
    }

    // Update display
    this.updateDisplay();

    // Set timeout if provided
    if (timeoutMs && timeoutMs > 0) {
      this.stateTimeout = setTimeout(() => {
        this.setState(IconState.Idle);
      }, timeoutMs);
    }

    // Show notification for certain state transitions
    this.handleStateNotification(previousState, state);
  }

  /**
   * Get the current icon state
   */
  public getState(): IconState {
    return this.currentState;
  }

  /**
   * Force update the visual display
   */
  public refresh(): void {
    this.updateDisplay();
  }

  /**
   * Handle progress animation for building state
   */
  private startProgressAnimation(): void {
    this.progressFrameIndex = 0;
    this.buildProgressTimer = setInterval(() => {
      this.progressFrameIndex = (this.progressFrameIndex + 1) % this.PROGRESS_FRAMES.length;
      this.updateDisplay();
    }, this.PROGRESS_INTERVAL_MS);
  }

  /**
   * Stop progress animation
   */
  private clearProgressAnimation(): void {
    if (this.buildProgressTimer) {
      clearInterval(this.buildProgressTimer);
      this.buildProgressTimer = undefined;
    }
  }

  /**
   * Show appropriate notifications for state changes
   */
  private handleStateNotification(previousState: IconState, newState: IconState): void {
    const config = vscode.workspace.getConfiguration('bazel.buildIcon');
    const showSuccessNotifications = config.get('showSuccessNotifications', true);
    const showErrorNotifications = config.get('showErrorNotifications', true);

    switch (newState) {
      case IconState.Success:
        if (showSuccessNotifications && previousState === IconState.Building) {
          vscode.window.showInformationMessage('Build completed successfully! ✅', 
            'View Output').then(action => {
              if (action === 'View Output') {
                vscode.commands.executeCommand('bazel.showTaskOutput');
              }
            });
        }
        break;
      
      case IconState.Error:
        if (showErrorNotifications) {
          vscode.window.showErrorMessage('Build failed! ❌', 
            'View Output', 'Try Again').then(action => {
              if (action === 'View Output') {
                vscode.commands.executeCommand('bazel.showTaskOutput');
              } else if (action === 'Try Again') {
                vscode.commands.executeCommand('bazel.buildCurrentFile');
              }
            });
        }
        break;
    }
  }

  /**
   * Update the status bar display based on current state
   */
  private updateDisplay(): void {
    const config = vscode.workspace.getConfiguration('bazel.buildIcon');
    const iconEnabled = config.get('enabled', true);

    if (!iconEnabled) {
      this.statusBarItem.hide();
      return;
    }

    switch (this.currentState) {
      case IconState.Idle:
        this.statusBarItem.text = '$(tools) Bazel';
        this.statusBarItem.tooltip = 'Click to build current file with Bazel';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = undefined;
        break;

      case IconState.Building:
        const spinner = this.PROGRESS_FRAMES[this.progressFrameIndex];
        this.statusBarItem.text = `${spinner} Building...`;
        this.statusBarItem.tooltip = 'Building target with Bazel...';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
        break;

      case IconState.Success:
        this.statusBarItem.text = '$(check) Build Success';
        this.statusBarItem.tooltip = 'Build completed successfully';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        break;

      case IconState.Error:
        this.statusBarItem.text = '$(error) Build Failed';
        this.statusBarItem.tooltip = 'Build failed - click for details';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
        break;

      case IconState.Disabled:
        this.statusBarItem.text = '$(tools) Bazel (Unavailable)';
        this.statusBarItem.tooltip = 'Bazel is not available in this workspace';
        this.statusBarItem.backgroundColor = undefined;
        this.statusBarItem.color = new vscode.ThemeColor('disabledForeground');
        break;
    }

    // Set command and context menu
    this.statusBarItem.command = 'bazel.buildCurrentFile';
    this.statusBarItem.show();
  }

  /**
   * Validates if a state transition is allowed.
   */
  private isValidTransition(from: IconState, to: IconState): boolean {
    // Define valid transition rules
    switch (from) {
      case IconState.Disabled:
        return to === IconState.Idle;
      case IconState.Idle:
        return to === IconState.Building || to === IconState.Disabled;
      case IconState.Building:
        return to === IconState.Success || to === IconState.Error || to === IconState.Idle;
      case IconState.Success:
      case IconState.Error:
        return to === IconState.Idle || to === IconState.Building || to === IconState.Disabled;
      default:
        return false;
    }
  }

  /**
   * Clear any active state timeout
   */
  private clearStateTimeout(): void {
    if (this.stateTimeout) {
      clearTimeout(this.stateTimeout);
      this.stateTimeout = undefined;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.clearStateTimeout();
    this.clearProgressAnimation();
    this.statusBarItem.dispose();
  }
} 