import * as path from "path";
import * as vscode from "vscode";
import * as vscodelc from "vscode-languageclient";
import { _Middleware } from "vscode-languageclient";

import { JavaUtils, WorkspaceUtils } from "./utils";

interface IExtensionVars {
  langClient: vscodelc.LanguageClient | null;
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
  context: null,
  langClient: null,
};

export function activate(context: vscode.ExtensionContext): void {
  ext.context = context;

  vscode.workspace.onDidChangeConfiguration(onDidChangeConfiguration);

  vscode.commands.registerCommand(
    WorkspaceUtils.COMMANDS.bazel.restartServer,
    restartServer,
  );

  vscode.commands.registerCommand(
    WorkspaceUtils.COMMANDS.bazel.openAssociatedBuildFile,
    restartServer,
  );

  startServer();
}

export function deactivate(): Thenable<void> | undefined {
  ext.context = null;
  ext.langClient = null;
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
  if (!ext.langClient) {
    startServer();
    return;
  }

  const prevClient = ext.langClient;
  ext.langClient = null;

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
      return new Promise<void>((resolve, _) => {
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

        // The server options (AKA the java executable to run the server).
        const serverOptions: vscodelc.Executable = {
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
            { scheme: "file", language: WorkspaceUtils.LANGUAGES.starlark.id },
          ],
          middleware: {
            provideCompletionItem: (
              document,
              position,
              context,
              token,
              next,
            ) => {
              console.log("I AM PROVIDING A COMPLETION ITEM FOR MY MASTERS");
              return undefined;
            },
            resolveCompletionItem: (item, token, next) => {
              console.log("I AM RESOLVING A COMPLETION ITEM FOR MY MASTERS");
              return undefined;
            },
          },
          synchronize: {
            configurationSection: WorkspaceUtils.CONFIG.bazelConfig,
            fileEvents: [
              vscode.workspace.createFileSystemWatcher(
                `**/.{${WorkspaceUtils.LANGUAGES.starlark.extensions}}`,
              ),
              vscode.workspace.createFileSystemWatcher(
                `**/{${WorkspaceUtils.LANGUAGES.starlark.filenames}}`,
              ),
            ],
          },
          uriConverters: {
            code2Protocol: (value: vscode.Uri) => {
              if (/^win32/.test(process.platform)) {
                // Drive letters on Windows are encoded with "%3A" instead of
                // ":", but Java doesn't treat them the same
                return value.toString().replace("%3A", ":");
              } else {
                return value.toString();
              }
            },
            // This is just the default behavior, but we need to define both.
            protocol2Code: (value) => vscode.Uri.parse(value),
          },
        };

        const langClient = new vscodelc.LanguageClient(
          "bazel",
          "Bazel Language Server",
          serverOptions,
          clientOptions,
        );

        langClient.onReady().then(resolve, (__) => {
          resolve();
          vscode.window.showErrorMessage(MESSAGES.initFailed);
        });

        // Start the server.
        ext.context.subscriptions.push(langClient.start());
        ext.langClient = langClient;
      });
    },
  );
}
