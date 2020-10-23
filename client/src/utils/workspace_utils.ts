import * as vscode from "vscode";

/**
 * VSCode workspace specific utilities.
 */
export class WorkspaceUtils {
  /**
   * The valid config variables for the bazel extension.
   */
  public static readonly CONFIG = {
    java: {
      home: "java.home",
    },
  };

  /**
   * Gets the current Bazel VSCode configuration based on the user's workspace.
   *
   * @returns The user's workspace Bazel VSCode configuration.
   */
  public static config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("bazel");
  }
}
