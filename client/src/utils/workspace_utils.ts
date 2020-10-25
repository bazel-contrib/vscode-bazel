import * as vscode from "vscode";

/**
 * VSCode workspace specific utilities.
 */
export class WorkspaceUtils {
  /**
   * The valid config variables for the bazel extension.
   */
  public static readonly CONFIG = {
    bazel: {
      java: {
        home: "bazel.java.home",
      },
      javaConfig: "bazel.java",
    },
    bazelConfig: "bazel",
  };

  /**
   * The valid commands for the bazel extension.
   */
  public static readonly COMMANDS = {
    bazel: {
      restartServer: "bazel.restartServer",
    },
  };

  /**
   * The valid languages for the bazel extension.
   */
  public static readonly LANGUAGES = {
    starlark: "starlark",
  };

  /**
   * Variables specific to the server.
   */
  public static readonly SERVER = {
    jarName: "bazel-language-server-all.jar",
  };

  /**
   * Gets the current Bazel VSCode configuration based on the user's workspace.
   *
   * @returns The user's workspace Bazel VSCode configuration.
   */
  public static config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration();
  }
}
