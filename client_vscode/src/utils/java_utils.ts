import * as path from "path";

import { FileUtils } from "./file_utils";
import { WorkspaceUtils } from "./workspace_utils";

/**
 * Java specific utilities.
 */
export class JavaUtils {
  /**
   * Platform OS keys.
   */
  public static readonly PLATFORM_OS = {
    windows32: "win32",
  };

  /**
   * Gets the full path to the user's Java SDK.
   *
   * @returns The full path to the user's Java SDK.
   */
  public static getJavaExecPath(): string | null {
    const javaExecName = JavaUtils.getJavaExecName();
    const settingsJavaHome = WorkspaceUtils.config().get(
      WorkspaceUtils.CONFIG.bazel.java.home,
    ) as string;

    // Prefer to use a Java SDK specified in the workspace configuration.
    if (settingsJavaHome) {
      const javaPath = path.join(settingsJavaHome, "bin", javaExecName);
      if (FileUtils.validateFileSync(javaPath)) {
        return javaPath;
      }
      return null;
    }

    // Try to use a Java SDK specified in the user's environment.
    if (process.env.JAVA_HOME) {
      const javaHome = process.env.JAVA_HOME as string;
      const javaPath = path.join(javaHome, "bin", javaExecName);
      if (FileUtils.validateFileSync(javaPath)) {
        return javaPath;
      }
    }

    // Try out all paths specifed by the environement. If a valid Java SDK
    // is found, use it.
    if (process.env.PATH) {
      const rawPaths = process.env.PATH as string;
      const parsedPaths = rawPaths.split(path.delimiter);
      for (const parsedPath of parsedPaths) {
        const javaExecPath = path.join(parsedPath, javaExecName);
        if (FileUtils.validateFileSync(javaExecPath)) {
          return javaExecPath;
        }
      }
    }

    // A valid Java SDK wan't found.
    return null;
  }

  /**
   * Gets the name of the java executable file (platform specific).
   *
   * @returns The name of the java executable file (platform specific).
   */
  public static getJavaExecName(): string {
    let name: string = "java";
    if (process.platform === JavaUtils.PLATFORM_OS.windows32) {
      name += ".exe";
    }
    return name;
  }
}
