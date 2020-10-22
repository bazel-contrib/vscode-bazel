import * as vscode from "vscode";

import * as utils from "./utils";

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
    console.log(`getJavaExecPath: ${utils.getJavaExecPath()}`);
  });

  context.subscriptions.push(disposable);
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): Thenable<void> | undefined {
  return undefined;
}
