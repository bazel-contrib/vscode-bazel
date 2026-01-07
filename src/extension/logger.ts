import * as vscode from "vscode";

// Private static output channel shared by all logger instances
let singletonOutputChannel: vscode.LogOutputChannel | null = null;

/**
 * Logger class for the extension.
 * It provides a singleton output channel for all log messages.
 * It also provides a named logger instance for each feature.
 */
export class Logger implements vscode.Disposable {
  private static getOutputChannel(): vscode.LogOutputChannel {
    if (!singletonOutputChannel) {
      singletonOutputChannel = vscode.window.createOutputChannel("Bazel", {
        log: true,
      });
    }
    return singletonOutputChannel;
  }

  /**
   * Creates a new named Logger instance
   * @param name The name of the logger instance
   */
  constructor(private readonly name: string) {}

  /**
   * Show the output channel for the logger
   */
  public static show(): void {
    Logger.getOutputChannel().show();
  }

  /**
   * Creates a child logger with the given name
   * @param name The name of the child logger
   * @returns A new Logger instance with the combined name
   */
  public getChildLogger(name: string): Logger {
    return new Logger(`${this.name}.${name}`);
  }

  public debug(message: string, ...args: unknown[]): void {
    Logger.getOutputChannel().debug(this.formatMessage(message), ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    Logger.getOutputChannel().info(this.formatMessage(message), ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    Logger.getOutputChannel().warn(this.formatMessage(message), ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    Logger.getOutputChannel().error(this.formatMessage(message), ...args);
  }

  public showErrorMessage(message: string, ...args: unknown[]): void {
    this.error(message, ...args);
    void vscode.window
      .showErrorMessage(this.formatMessage(message), "Show Output")
      .then((selection) => {
        if (selection === "Show Output") {
          vscode.commands.executeCommand("bazel.showOutput");
        }
      });
  }

  private formatMessage(message: string): string {
    return `[${this.name}] ${message}`;
  }

  public dispose(): void {
    // Don't dispose the output channel here as it's shared
  }

  /**
   * Call this when the extension is deactivated to clean up the shared resource
   */
  public static disposeAll(): void {
    if (singletonOutputChannel) {
      singletonOutputChannel.dispose();
      singletonOutputChannel = null;
    }
  }
}
