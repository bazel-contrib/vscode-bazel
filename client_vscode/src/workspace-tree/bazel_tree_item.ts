// Copyright 2018 The Bazel Authors. All rights reserved.
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

/** An interface implemented by items in the Bazel tree provider. */
export interface IBazelTreeItem {
  /**
   * Indicates whether or not the item _may_ have children.
   *
   * This method is used to control the collapsible state of the tree item. If
   * this function returns false, then the item definitively does _not_ have
   * children (for example, an item representing a build target). If it returns
   * true, then it _may_ have children, but the actual computation of those
   * children is deferred until {@link #getChildren()} is called.
   *
   * @returns True if the item may have children, or false if it definitively
   *     does not.
   */
  mightHaveChildren(): boolean;

  /** Returns a promise for the children of the tree item. */
  getChildren(): Thenable<IBazelTreeItem[]>;

  /** Returns the text label of the tree item. */
  getLabel(): string;

  /** Returns the icon that should be shown next to the tree item. */
  getIcon(): vscode.ThemeIcon | string | undefined;

  /**
   * Returns the tooltip that should be displayed when the user hovers over the
   * tree item.
   */
  getTooltip(): string | undefined;

  /** Returns the command that should be executed when the item is selected. */
  getCommand(): vscode.Command | undefined;

  /**
   * Returns an identifying string that is used to filter which commands are
   * available for the item.
   */
  getContextValue(): string | undefined;
}
