import * as assert from "assert";
import * as vscode from "vscode";
import {
  registerLogger,
  log,
  logError,
  logWarn,
  logInfo,
  logDebug,
} from "../src/extension/logger";

describe("The logger", () => {
  let mockLogChannel: vscode.LogOutputChannel;
  let mockContext: vscode.ExtensionContext;
  let disposable: vscode.Disposable;
  let originalCreateOutputChannel: typeof vscode.window.createOutputChannel;
  let originalShowErrorMessage: typeof vscode.window.showErrorMessage;
  let originalShowWarningMessage: typeof vscode.window.showWarningMessage;
  let originalShowInfoMessage: typeof vscode.window.showInformationMessage;
  let messageCalls: {
    method: string;
    message: string;
    items?: string[];
  }[];

  beforeEach(() => {
    // Track calls to the mock methods
    const calls: { method: string; message: string }[] = [];
    messageCalls = [];

    // Create a mock LogOutputChannel
    /* eslint-disable @typescript-eslint/no-empty-function */
    mockLogChannel = {
      name: "test-log",
      append: () => {},
      appendLine: (message: string) => {
        calls.push({ method: "appendLine", message });
      },
      replace: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      log: () => {},
      error: (message: string) => {
        calls.push({ method: "error", message });
      },
      warn: (message: string) => {
        calls.push({ method: "warn", message });
      },
      info: (message: string) => {
        calls.push({ method: "info", message });
      },
      debug: (message: string) => {
        calls.push({ method: "debug", message });
      },
      trace: () => {},
      traceLog: () => {},
      logLevel: vscode.LogLevel.Info,
      onDidChangeLogLevel: (() => ({
        dispose: () => {},
      })) as unknown as vscode.Event<vscode.LogLevel>,
    } as vscode.LogOutputChannel;
    /* eslint-enable @typescript-eslint/no-empty-function */

    // Store calls for assertions
    (mockLogChannel as any)._calls = calls;

    // Create a mock ExtensionContext
    const subscriptions: vscode.Disposable[] = [];
    mockContext = {
      subscriptions,
    } as vscode.ExtensionContext;

    // Mock vscode.window.createOutputChannel to return our mock channel
    originalCreateOutputChannel = vscode.window.createOutputChannel;
    (vscode.window.createOutputChannel as any) = () => mockLogChannel;

    // Mock VS Code message functions
    originalShowErrorMessage = vscode.window.showErrorMessage;
    originalShowWarningMessage = vscode.window.showWarningMessage;
    originalShowInfoMessage = vscode.window.showInformationMessage;

    (vscode.window.showErrorMessage as any) = (
      message: string,
      ...items: string[]
    ) => {
      // Track the call synchronously
      messageCalls.push({ method: "showErrorMessage", message, items });
      // Return a promise that resolves immediately
      return Promise.resolve(undefined);
    };

    (vscode.window.showWarningMessage as any) = (
      message: string,
      ...items: string[]
    ) => {
      // Track the call synchronously
      messageCalls.push({ method: "showWarningMessage", message, items });
      // Return a promise that resolves immediately
      return Promise.resolve(undefined);
    };

    (vscode.window.showInformationMessage as any) = (
      message: string,
      ...items: string[]
    ) => {
      // Track the call synchronously
      messageCalls.push({ method: "showInformationMessage", message, items });
      // Return a promise that resolves immediately
      return Promise.resolve(undefined);
    };
  });

  afterEach(() => {
    // Restore original functions
    vscode.window.createOutputChannel = originalCreateOutputChannel;
    vscode.window.showErrorMessage = originalShowErrorMessage;
    vscode.window.showWarningMessage = originalShowWarningMessage;
    vscode.window.showInformationMessage = originalShowInfoMessage;
    if (disposable) {
      disposable.dispose();
    }
  });

  it("registers logger successfully", () => {
    disposable = registerLogger("test-log", mockContext);
    assert.ok(disposable, "registerLogger should return a disposable");
    const calls = (mockLogChannel as any)._calls;
    assert.strictEqual(
      calls.length,
      1,
      "Logger initialization should log one message",
    );
    assert.strictEqual(
      calls[0].method,
      "info",
      "Logger initialization should use info level",
    );
    assert.ok(
      calls[0].message.includes("Logger initialized"),
      "Logger initialization message should contain expected text",
    );
  });

  it("logs messages correctly", () => {
    disposable = registerLogger("test-log", mockContext);
    log("test message");
    const calls = (mockLogChannel as any)._calls;
    const logCall = calls.find(
      (c: { method: string }) => c.method === "appendLine",
    );
    assert.ok(logCall, "log should call appendLine");
    assert.strictEqual(
      logCall.message,
      "test message",
      "log should format message correctly",
    );
  });

  it("logs errors correctly", () => {
    disposable = registerLogger("test-log", mockContext);
    logError("error message");
    const calls = (mockLogChannel as any)._calls;
    const errorCall = calls.find(
      (c: { method: string }) => c.method === "error",
    );
    assert.ok(errorCall, "logError should call error");
    assert.strictEqual(
      errorCall.message,
      "error message",
      "logError should format message correctly",
    );
  });

  it("logs warnings correctly", () => {
    disposable = registerLogger("test-log", mockContext);
    logWarn("warning message");
    const calls = (mockLogChannel as any)._calls;
    const warnCall = calls.find((c: { method: string }) => c.method === "warn");
    assert.ok(warnCall, "logWarn should call warn");
    assert.strictEqual(
      warnCall.message,
      "warning message",
      "logWarn should format message correctly",
    );
  });

  it("logs info correctly", () => {
    disposable = registerLogger("test-log", mockContext);
    logInfo("info message");
    const calls = (mockLogChannel as any)._calls;
    const infoCalls = calls.filter(
      (c: { method: string }) => c.method === "info",
    );
    assert.ok(infoCalls.length >= 1, "logInfo should call info");
    // Find the call with our test message (skip the initialization message)
    const testCall = infoCalls.find(
      (c: { message: string }) => c.message === "info message",
    );
    assert.ok(testCall, "logInfo should format message correctly");
  });

  it("logs verbose correctly", () => {
    disposable = registerLogger("test-log", mockContext);
    logDebug("verbose message");
    const calls = (mockLogChannel as any)._calls;
    const debugCall = calls.find(
      (c: { method: string }) => c.method === "debug",
    );
    assert.ok(debugCall, "logVerbose should call debug");
    assert.strictEqual(
      debugCall.message,
      "verbose message",
      "logVerbose should format message correctly",
    );
  });

  it("handles dispose correctly", () => {
    disposable = registerLogger("test-log", mockContext);
    log("before dispose");
    disposable.dispose();
    log("after dispose");
    const calls = (mockLogChannel as any)._calls;
    const beforeDisposeCalls = calls.filter(
      (c: { method: string }) => c.method === "appendLine",
    );
    assert.strictEqual(
      beforeDisposeCalls.length,
      1,
      "Only one log call should succeed before dispose",
    );
  });

  it("handles logging without registration gracefully", () => {
    // Don't register logger
    log("unregistered log");
    logError("unregistered error");
    logWarn("unregistered warn");
    logInfo("unregistered info");
    logDebug("unregistered verbose");
    // Should not throw - just silently do nothing
    assert.ok(true, "Logging without registration should not throw");
  });

  describe("showMessage functionality", () => {
    it("shows error message when showMessage is true", async () => {
      disposable = registerLogger("test-log", mockContext);
      logError("test error", true);
      // The mock function should be called synchronously when showUserMessage
      // calls messageFunc. However, since showUserMessage returns a promise
      // that's called with void, we need to wait for the microtask queue.
      await new Promise((resolve) =>
        Promise.resolve().then(() => resolve(undefined)),
      );
      assert.strictEqual(
        messageCalls.length,
        1,
        "showErrorMessage should be called once",
      );
      assert.strictEqual(
        messageCalls[0].method,
        "showErrorMessage",
        "should call showErrorMessage",
      );
      assert.strictEqual(
        messageCalls[0].message,
        "test error",
        "should pass correct message",
      );
      assert.deepStrictEqual(
        messageCalls[0].items,
        ["Details"],
        "should include Details button",
      );
    });

    it("shows warning message when showMessage is true", async () => {
      disposable = registerLogger("test-log", mockContext);
      logWarn("test warning", true);
      await new Promise((resolve) =>
        Promise.resolve().then(() => resolve(undefined)),
      );
      assert.strictEqual(
        messageCalls.length,
        1,
        "showWarningMessage should be called once",
      );
      assert.strictEqual(
        messageCalls[0].method,
        "showWarningMessage",
        "should call showWarningMessage",
      );
      assert.strictEqual(
        messageCalls[0].message,
        "test warning",
        "should pass correct message",
      );
      assert.deepStrictEqual(
        messageCalls[0].items,
        ["Details"],
        "should include Details button",
      );
    });

    it("shows info message when showMessage is true", async () => {
      disposable = registerLogger("test-log", mockContext);
      logInfo("test info", true);
      await new Promise((resolve) =>
        Promise.resolve().then(() => resolve(undefined)),
      );
      assert.strictEqual(
        messageCalls.length,
        1,
        "showInformationMessage should be called once",
      );
      assert.strictEqual(
        messageCalls[0].method,
        "showInformationMessage",
        "should call showInformationMessage",
      );
      assert.strictEqual(
        messageCalls[0].message,
        "test info",
        "should pass correct message",
      );
      assert.deepStrictEqual(
        messageCalls[0].items,
        ["Details"],
        "should include Details button",
      );
    });

    it("does not show message when showMessage is false", () => {
      disposable = registerLogger("test-log", mockContext);
      logError("test error", false);
      logWarn("test warning", false);
      logInfo("test info", false);
      assert.strictEqual(
        messageCalls.length,
        0,
        "no message functions should be called when showMessage is false",
      );
    });

    it("does not show message when showMessage is omitted \
      (defaults to false)", () => {
      disposable = registerLogger("test-log", mockContext);
      logError("test error");
      logWarn("test warning");
      logInfo("test info");
      assert.strictEqual(
        messageCalls.length,
        0,
        "no message functions should be called when showMessage is omitted",
      );
    });
  });

  describe("additional arguments functionality", () => {
    it("formats single additional argument correctly", () => {
      disposable = registerLogger("test-log", mockContext);
      log("test message", false, "additional info");
      const calls = (mockLogChannel as any)._calls;
      const logCall = calls.find(
        (c: { method: string }) => c.method === "appendLine",
      );
      assert.ok(logCall, "log should call appendLine");
      assert.ok(
        logCall.message.includes("test message"),
        "message should include base message",
      );
      assert.ok(
        logCall.message.includes("Details:"),
        "message should include Details prefix",
      );
      assert.ok(
        logCall.message.includes("additional info"),
        "message should include formatted argument",
      );
    });

    it("formats multiple additional arguments correctly", () => {
      disposable = registerLogger("test-log", mockContext);
      logError(
        "error occurred",
        false,
        "Error code:",
        500,
        "Status:",
        "failed",
      );
      const calls = (mockLogChannel as any)._calls;
      const errorCall = calls.find(
        (c: { method: string }) => c.method === "error",
      );
      assert.ok(errorCall, "logError should call error");
      assert.ok(
        errorCall.message.includes("error occurred"),
        "message should include base message",
      );
      assert.ok(
        errorCall.message.includes("Details:"),
        "message should include Details prefix",
      );
      assert.ok(
        errorCall.message.includes("Error code:"),
        "message should include first argument",
      );
      assert.ok(
        errorCall.message.includes("500"),
        "message should include second argument",
      );
      assert.ok(
        errorCall.message.includes("Status:"),
        "message should include third argument",
      );
      assert.ok(
        errorCall.message.includes("failed"),
        "message should include fourth argument",
      );
    });

    it("formats object arguments correctly", () => {
      disposable = registerLogger("test-log", mockContext);
      const errorObj = { code: 404, message: "Not found" };
      logWarn("warning message", false, "Error object:", errorObj);
      const calls = (mockLogChannel as any)._calls;
      const warnCall = calls.find(
        (c: { method: string }) => c.method === "warn",
      );
      assert.ok(warnCall, "logWarn should call warn");
      assert.ok(
        warnCall.message.includes("warning message"),
        "message should include base message",
      );
      assert.ok(
        warnCall.message.includes("Details:"),
        "message should include Details prefix",
      );
      assert.ok(
        warnCall.message.includes("Error object:"),
        "message should include argument label",
      );
    });

    it("handles empty additional arguments gracefully", () => {
      disposable = registerLogger("test-log", mockContext);
      logInfo("info message", false);
      const calls = (mockLogChannel as any)._calls;
      const infoCalls = calls.filter(
        (c: { method: string }) => c.method === "info",
      );
      const testCall = infoCalls.find(
        (c: { message: string }) => c.message === "info message",
      );
      assert.ok(testCall, "logInfo should format message correctly");
      assert.ok(
        !testCall.message.includes("Details:"),
        "message should not include Details prefix when no args provided",
      );
    });
  });

  describe("showMessage with additional arguments", () => {
    it("shows message and formats additional arguments correctly", async () => {
      disposable = registerLogger("test-log", mockContext);
      logError("error occurred", true, "Error code:", 500);
      await new Promise((resolve) =>
        Promise.resolve().then(() => resolve(undefined)),
      );
      const calls = (mockLogChannel as any)._calls;
      const errorCall = calls.find(
        (c: { method: string }) => c.method === "error",
      );
      assert.ok(errorCall, "logError should call error");
      assert.ok(
        errorCall.message.includes("error occurred"),
        "logged message should include base message",
      );
      assert.ok(
        errorCall.message.includes("Details:"),
        "logged message should include Details prefix",
      );
      assert.ok(
        errorCall.message.includes("Error code:"),
        "logged message should include formatted arguments",
      );
      assert.strictEqual(
        messageCalls.length,
        1,
        "showErrorMessage should be called once",
      );
      assert.strictEqual(
        messageCalls[0].message,
        "error occurred",
        "user message should only include base message",
      );
    });

    it("shows warning message with multiple additional arguments", async () => {
      disposable = registerLogger("test-log", mockContext);
      logWarn("warning", true, "arg1", "arg2", 123);
      await new Promise((resolve) =>
        Promise.resolve().then(() => resolve(undefined)),
      );
      const calls = (mockLogChannel as any)._calls;
      const warnCall = calls.find(
        (c: { method: string }) => c.method === "warn",
      );
      assert.ok(warnCall, "logWarn should call warn");
      assert.ok(
        warnCall.message.includes("warning"),
        "logged message should include base message",
      );
      assert.ok(
        warnCall.message.includes("arg1"),
        "logged message should include first argument",
      );
      assert.ok(
        warnCall.message.includes("arg2"),
        "logged message should include second argument",
      );
      assert.ok(
        warnCall.message.includes("123"),
        "logged message should include third argument",
      );
      assert.strictEqual(
        messageCalls.length,
        1,
        "showWarningMessage should be called once",
      );
      assert.strictEqual(
        messageCalls[0].message,
        "warning",
        "user message should only include base message",
      );
    });

    it("shows info message with object argument", async () => {
      disposable = registerLogger("test-log", mockContext);
      const data = { userId: 123, action: "login" };
      logInfo("operation completed", true, "Data:", data);
      await new Promise((resolve) =>
        Promise.resolve().then(() => resolve(undefined)),
      );
      const calls = (mockLogChannel as any)._calls;
      const infoCalls = calls.filter(
        (c: { method: string }) => c.method === "info",
      );
      const testCall = infoCalls.find(
        (c: { message: string }) =>
          c.message.includes("operation completed") &&
          c.message.includes("Details:"),
      );
      assert.ok(testCall, "logInfo should format message with details");
      assert.ok(
        testCall.message.includes("Data:"),
        "logged message should include argument label",
      );
      assert.strictEqual(
        messageCalls.length,
        1,
        "showInformationMessage should be called once",
      );
      assert.strictEqual(
        messageCalls[0].message,
        "operation completed",
        "user message should only include base message",
      );
    });
  });
});
