import * as path from "path";
import * as vscode from "vscode";
import * as vscodelc from "vscode-languageclient";

import { JavaUtils, WorkspaceUtils } from "./utils";

interface IExtensionVars {
  client: vscodelc.LanguageClient | null;
  context: vscode.ExtensionContext | null;
}

const MESSAGES = {
  init: "Starting up Bazel language server...",
  initFailed: "The Bazel extension failed to start.",
  invalidJava: "The bazel.java.home setting does not point to a valid JDK.",
  missingJava:
    "Could not locate valid JDK. To configure JDK manually, " +
    "use the bazel.java.home setting.",
  reloadToApplySettings: "Reload the window to apply new settings for Bazel.",
};

const LABELS = {
  reloadWindow: "Reload Window",
};

const ext: IExtensionVars = {
  client: null,
  context: null,
};

export function activate(context: vscode.ExtensionContext): void {
  ext.context = context;

  vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration);
  vscode.commands.registerCommand(
    WorkspaceUtils.COMMANDS.bazel.restartServer,
    restartServer,
  );

  startServer();
}

export function deactivate(): Thenable<void> | undefined {
  ext.context = null;
  ext.client = null;
  return undefined;
}

export function onDidChangeConfiguration(
  event: vscode.ConfigurationChangeEvent,
): void {
  if (event.affectsConfiguration(WorkspaceUtils.CONFIG.bazel.java.home)) {
    restartServer();
  }
}

function restartServer(): void {
  if (!ext.client) {
    startServer();
    return;
  }

  const prevClient = ext.client;
  ext.client = null;

  // Attempt to restart the server. If the server fails to shut down,
  // prompt the user with a dialog to allow them to manually restart
  // the server.
  prevClient.stop().then(
    () => {
      startServer();
    },
    () => {
      vscode.window
        .showWarningMessage(MESSAGES.reloadToApplySettings, LABELS.reloadWindow)
        .then((action) => {
          if (action === LABELS.reloadWindow) {
            vscode.commands.executeCommand(
              WorkspaceUtils.COMMANDS.bazel.restartServer,
            );
          }
        });
    },
  );
}

function startServer(): void {
  const javaPath = JavaUtils.getJavaExecPath();

  vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window },
    (progress) => {
      return new Promise((resolve, _) => {
        // Ensure that the context has been setup.
        if (!ext.context) {
          resolve();
          vscode.window.showErrorMessage(MESSAGES.initFailed);
          return;
        }

        // Ensure that we have a valid java sdk to use.
        if (!javaPath) {
          resolve();
          const settingsJavaHome = vscode.workspace.getConfiguration(
            WorkspaceUtils.CONFIG.bazel.java.home,
          );
          if (settingsJavaHome) {
            vscode.window.showErrorMessage(MESSAGES.invalidJava);
          } else {
            vscode.window.showErrorMessage(MESSAGES.missingJava);
          }
          return;
        }

        // The pre-conditions were satisfied, inform the user that we've
        // started initializing the server.
        progress.report({ message: MESSAGES.init });

        // The java executable to run the server.
        const javaExec: vscodelc.Executable = {
          args: [
            "-jar",
            path.resolve(
              ext.context.extensionPath,
              "bin",
              WorkspaceUtils.SERVER.jarName,
            ),
          ],
          command: javaPath,
        };

        // The client options.
        const clientOptions: vscodelc.LanguageClientOptions = {
          documentSelector: [
            { scheme: "file", language: WorkspaceUtils.LANGUAGES.starlark },
          ],
          synchronize: {
            configurationSection: WorkspaceUtils.CONFIG.bazelConfig,
          },
        };

        const client = new vscodelc.LanguageClient(
          "bazel",
          "Bazel Language Server",
          javaExec,
          clientOptions,
        );

        client.onReady().then(resolve, (__) => {
          resolve();
          vscode.window.showErrorMessage(MESSAGES.initFailed);
        });

        // Start the server.
        ext.context.subscriptions.push(client.start());
        ext.client = client;
      });
    },
  );
}
