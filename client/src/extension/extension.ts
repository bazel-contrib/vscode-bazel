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

/**
 * Called when the extension is activated; that is, when its first command is
 * executed.
 *
 * @param context The extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  // TODO:
  // - [Examples](https://github.com/microsoft/vscode-extension-samples)
  // - [Groovy LS](https://github.com/prominic/groovy-language-server)

  // First task:
  // -----------
  // Communicate with LSP, log a simple message. This is taken straight from
  // the hello world program.
  // https://code.visualstudio.com/api/get-started/your-first-extension
  //
  // How to Run this command:
  // ------------------------
  // With this repo open
  // - Press F5 (this will serve up a dev app)
  // - Press command + shift + p
  // - Type in "bazel.helloworld" and run it
  const disposable = vscode.commands.registerCommand("bazel.helloworld", () => {
    vscode.window.showInformationMessage("A 'Hello World' message from bazel!");
  });

  context.subscriptions.push(disposable);
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): Thenable<void> | undefined {
  return undefined;
}
