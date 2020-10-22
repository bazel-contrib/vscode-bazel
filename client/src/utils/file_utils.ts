import * as fs from "fs";

/**
 * File specific utilities.
 */
export class FileUtils {
  /**
   * Validates a file syncronously.
   *
   * @param path The path to the file.
   * @returns Whether the file is valid (exists).
   */
  public static validateFileSync(path: string): boolean {
    return fs.existsSync(path) && fs.statSync(path).isFile();
  }
}
