import * as vscode from "vscode";

let assertionFailureReported = false;

/**
 * Asserts that the given value is true.
 */
export function assert(value: boolean): asserts value {
  if (!value) {
    debugger; // eslint-disable-line no-debugger
    if (!assertionFailureReported) {
      // Only report one assertion failure, to avoid spamming the
      // user with error messages.
      assertionFailureReported = true;
      // Log an `Error` object which will include the stack trace
      // eslint-disable-next-line no-console
      console.error(new Error("Assertion violated."));
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      vscode.window.showErrorMessage(
        "Assertion violated. This is a programming error.\n" +
          "Please file a bug at " +
          "https://github.com/bazelbuild/vscode-bazel/issues",
      );
    }
    throw new Error("Assertion violated.");
  }
}
