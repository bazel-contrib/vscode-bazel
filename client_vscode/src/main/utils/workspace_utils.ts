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
      openAssociatedBuildFile: "bazel.openAssociatedBuildFile",
      restartServer: "bazel.restartServer",
    },
  };

  /**
   * The valid languages for the bazel extension.
   */
  public static readonly LANGUAGES = {
    starlark: {
      extensions: [".BUILD", ".WORKSPACE", ".bzl", ".sky", ".star"],
      filenames: ["BUILD", "BUILD.bazel", "WORKSPACE", "WORKSPACE.bazel"],
      id: "starlark",
    },
  };

  /**
   * Variables specific to the server.
   *
   * TODO: this should be a configuration.
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
