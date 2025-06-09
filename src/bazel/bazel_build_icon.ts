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
  private stateManager: IconStateManager;
  private isEnabled: boolean = true;
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100 // Priority - appears before other items
    );
    this.stateManager = new IconStateManager();
    
    this.setupIcon();
    this.setupConfigurationWatcher();
    this.setupWorkspaceWatcher();
    
    // Add to disposables
    this.disposables.push(this.statusBarItem);
    this.disposables.push(this.stateManager);
  }

  /**
   * Sets up the initial icon configuration.
   */
  private setupIcon(): void {
    this.statusBarItem.command = "bazel.buildCurrentFile";
    this.updateIcon();
  }

  /**
   * Sets up configuration change watching.
   */
  private setupConfigurationWatcher(): void {
    const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("bazel.buildIcon.enabled")) {
        this.updateEnabledState();
      }
    });
    this.disposables.push(configWatcher);
  }

  /**
   * Sets up workspace change watching.
   */
  private setupWorkspaceWatcher(): void {
    const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.updateVisibility();
    });
    this.disposables.push(workspaceWatcher);
  }

  /**
   * Updates the enabled state based on configuration.
   */
  private updateEnabledState(): void {
    const config = vscode.workspace.getConfiguration("bazel");
    const enabled = config.get<boolean>("buildIcon.enabled", true);
    
    if (enabled !== this.isEnabled) {
      this.isEnabled = enabled;
      this.updateVisibility();
    }
  }

  /**
   * Updates icon visibility based on workspace and configuration.
   */
  private async updateVisibility(): Promise<void> {
    if (!this.isEnabled) {
      this.stateManager.transitionTo(IconState.Disabled);
      this.statusBarItem.hide();
      return;
    }

    // Check if we have a Bazel workspace
    const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
    if (workspaceInfo) {
      this.stateManager.transitionTo(IconState.Idle);
      this.statusBarItem.show();
    } else {
      this.stateManager.transitionTo(IconState.Disabled);
      this.statusBarItem.hide();
    }
    
    this.updateIcon();
  }

  /**
   * Updates the icon appearance based on current state.
   */
  private updateIcon(): void {
    const state = this.stateManager.getCurrentState();
    
    switch (state) {
      case IconState.Idle:
        this.statusBarItem.text = "$(tools) Bazel";
        this.statusBarItem.tooltip = "Click to build current file with Bazel";
        this.statusBarItem.backgroundColor = undefined;
        break;
      case IconState.Building:
        this.statusBarItem.text = "$(loading~spin) Bazel";
        this.statusBarItem.tooltip = "Building...";
        this.statusBarItem.backgroundColor = undefined;
        break;
      case IconState.Success:
        this.statusBarItem.text = "$(check) Bazel";
        this.statusBarItem.tooltip = "Build successful";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.prominentBackground");
        break;
      case IconState.Error:
        this.statusBarItem.text = "$(error) Bazel";
        this.statusBarItem.tooltip = "Build failed - click to retry";
        this.statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
        break;
      case IconState.Disabled:
      default:
        this.statusBarItem.hide();
        return;
    }
  }

  /**
   * Transitions the icon to the specified state.
   */
  public setState(state: IconState, timeoutMs?: number): boolean {
    const success = this.stateManager.transitionTo(state, timeoutMs);
    if (success) {
      this.updateIcon();
    }
    return success;
  }

  /**
   * Gets the current icon state.
   */
  public getState(): IconState {
    return this.stateManager.getCurrentState();
  }

  /**
   * Forces a refresh of icon visibility and state.
   */
  public async refresh(): Promise<void> {
    await this.updateVisibility();
  }

  /**
   * Disposes of the icon and cleans up resources.
   */
  public dispose(): void {
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
  }
} 