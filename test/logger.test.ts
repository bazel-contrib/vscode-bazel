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

  beforeEach(() => {
    // Track calls to the mock methods
    const calls: { method: string; message: string }[] = [];

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
  });

  afterEach(() => {
    // Restore original createOutputChannel
    vscode.window.createOutputChannel = originalCreateOutputChannel;
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
});
