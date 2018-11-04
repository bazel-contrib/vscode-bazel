// Copyright 2018 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  Breakpoint,
  ContinuedEvent,
  DebugSession,
  InitializedEvent,
  OutputEvent,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread
} from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { BazelDebugConnection } from "./connection";
import { skylark_debugging } from "./debug_protocol";
import { Handles } from "./handles";

/**
 * Returns a {@code number} equivalent to the given {@code number} or {@code Long}.
 *
 * @param value If a {@code number}, the value itself is returned; if it is a {@code Long}, its
 *     equivalent is returned.
 * @returns A {@code number} equivalent to the given {@code number} or {@code Long}.
 */
function number64(value: (number | Long)): number {
  if (value instanceof Number) {
    return <number>value;
  }
  return (<Long>value).toNumber();
}

/** Arguments that the Bazel debug adapter supports for "attach" requests. */
interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  /** Target labels and other command line options passed to the 'bazel build' command. */
  args: string[];

  /** The Bazel command to execute (build, test, etc.). */
  bazelCommand: string;

  /**
   * The Bazel executable that should be invoked to execute the command.
   *
   * This can be either an absolute path or a command name that will be found on the system path. If
   * it is not specified, then the debugger will search for "bazel" on the system path.
   */
  bazelExecutablePath?: string;

  /** The working directory in which Bazel will be invoked. */
  cwd: string;

  /** The port number on which the Bazel debug server is running. */
  port?: number;

  /** Indicates whether verbose logging is enabled for the debugger. */
  verbose?: boolean;
}

/** Manages the state of the debugging client's session. */
class BazelDebugSession extends DebugSession {
  /** Manages communication with the Bazel debugging server. */
  private bazelConnection: BazelDebugConnection;

  /** Keeps track of whether a Bazel child process is currently running. */
  private isBazelRunning: boolean;

  private bazelInfo = new Map<string, string>();

  private sourceBreakpoints = new Map<string, DebugProtocol.Breakpoint[]>();

  private pausedThreads = new Map<number, skylark_debugging.IPausedThread>();

  private frameHandles = new Handles<skylark_debugging.IFrame>();

  private frameThreadIds = new Map<number, number>();

  /** Initializes a new Bazel debug session. */
  public constructor() {
    super();

    // Starlark uses 1-based line and column numbers.
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
  }

  // Life-cycle requests

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ) {
    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsFunctionBreakpoints = true;
    response.body.supportsEvaluateForHovers = true;
    this.sendResponse(response);
  }

  protected async configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments
  ) {
    await this.bazelConnection.sendRequest({
      startDebugging: skylark_debugging.StartDebuggingRequest.create()
    });

    this.sendResponse(response);
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
    const port = args.port || 7300;
    const verbose = args.verbose || false;

    const bazelExecutable = this.bazelExecutable(args);
    this.bazelInfo = await this.getBazelInfo(bazelExecutable, args.cwd);

    const bazelArgs = [
      args.bazelCommand,
      "--color=yes",
      "--experimental_skylark_debug",
      `--experimental_skylark_debug_server_port=${port}`,
      `--experimental_skylark_debug_verbose_logging=${verbose}`,
    ].concat(args.args)

    this.launchBazel(bazelExecutable, args.cwd, bazelArgs);

    this.bazelConnection = new BazelDebugConnection("localhost", port, this.debugLog);
    this.bazelConnection.on("connect", () => {
      // TODO: Implement some UI feedback here.
      this.sendResponse(response);
      this.sendEvent(new InitializedEvent());
    });

    this.bazelConnection.on("event", (event) => {
      this.handleBazelEvent(event);
    });
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  // Breakpoint requests

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ) {
    const breakpoints = new Array<Breakpoint>();

    for (const line of args.lines || []) {
      // TODO(allevato): It would be nice to verify breakpoints (i.e., that they've been placed on
      // valid lines of code), but that's tricky with the information we have here. Perhaps with a
      // language server, we could match it up with the AST.
      const bp = <DebugProtocol.Breakpoint>new Breakpoint(true, line);
      breakpoints.push(bp);
    }

    // VS Code passes us the absolute path to the file, but Bazel's debugger will match against
    // paths beneath the output_base. It appears that even .bzl files in the same workspace as the
    // one containing the target being built will be found in the "external" subtree.
    const workspaceName = path.basename(this.bazelInfo.get("execution_root"));
    const relativeSourcePath = path.relative(this.bazelInfo.get("workspace"), args.source.path);
    const sourcePathInExternal = path.join(
      this.bazelInfo.get("output_base"), "external", workspaceName, relativeSourcePath);
    this.sourceBreakpoints.set(sourcePathInExternal, breakpoints);

    // Convert to Bazel breakpoints.
    const bazelBreakpoints = new Array<skylark_debugging.Breakpoint>();
    for (const [path, breakpoints] of this.sourceBreakpoints) {
      for (const bp of breakpoints) {
        bazelBreakpoints.push(skylark_debugging.Breakpoint.create({
          location: skylark_debugging.Location.create({
            path: path,
            lineNumber: bp.line
          })
        }));
      }
    }

    this.bazelConnection.sendRequest({
      setBreakpoints: skylark_debugging.SetBreakpointsRequest.create({
        breakpoint: bazelBreakpoints
      })
    });
    this.sendResponse(response);
  }

  protected setFunctionBreakPointsRequest(
    response: DebugProtocol.SetFunctionBreakpointsResponse,
    args: DebugProtocol.SetFunctionBreakpointsArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  // Thread, stack frame, and variable requests

  protected async threadsRequest(response: DebugProtocol.ThreadsResponse) {
    response.body = {
      threads: Array.from(this.pausedThreads.values()).map((bazelThread) => {
        return new Thread(number64(bazelThread.id), bazelThread.name);
      })
    };
    this.sendResponse(response);
  }

  protected async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ) {
    const event = await this.bazelConnection.sendRequest({
      listFrames: skylark_debugging.ListFramesRequest.create({
        threadId: args.threadId
      })
    });

    const bazelFrames = event.listFrames.frame;
    const vsFrames = new Array<StackFrame>();
    for (const bazelFrame of bazelFrames) {
      const frameHandle = this.frameHandles.create(bazelFrame);
      this.frameThreadIds.set(frameHandle, args.threadId);

      const location = bazelFrame.location;
      const vsFrame = new StackFrame(frameHandle, bazelFrame.functionName || "<global scope>");
      if (location) {
        // Resolve the real path to the file, which will make sure that when the user interacts with
        // the stack frame, VS Code loads the file from it's actual path instead of from a location
        // inside Bazel's output base.
        const sourcePath = fs.realpathSync(location.path);
        vsFrame.source = new Source(path.basename(sourcePath), sourcePath);
        vsFrame.line = location.lineNumber;
      }
      vsFrames.push(vsFrame);
    }

    response.body = { stackFrames: vsFrames, totalFrames: vsFrames.length };
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  protected evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  // Execution/control flow requests

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ) {
    response.body = { allThreadsContinued: false };
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.NONE);
    this.sendResponse(response);
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ) {
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.OVER);
    this.sendResponse(response);
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments
  ) {
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.INTO);
    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments
  ) {
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.OUT);
    this.sendResponse(response);
  }

  /**
   * Sends a request to Bazel to continue the execution of the given thread, with stepping behavior.
   *
   * @param threadId The identifier of the thread to continue.
   * @param stepping The stepping behavior of the request (OVER, INTO, OUT, or NONE).
   */
  private sendControlFlowRequest(threadId: number, stepping: skylark_debugging.Stepping) {
    this.bazelConnection.sendRequest({
      continueExecution: skylark_debugging.ContinueExecutionRequest.create({
        threadId: threadId,
        stepping: stepping
      })
    });
  }

  /**
   * Dispatches an asynchronous Bazel debug event received from the server.
   *
   * @param event The event that was received from the server.
   */
  private handleBazelEvent(event: skylark_debugging.DebugEvent) {
    switch (event.payload) {
      case "threadPaused":
        this.handleThreadPaused(event.threadPaused);
        break;
      case "threadContinued":
        this.handleThreadContinued(event.threadContinued);
        break;
      default:
        break;
    }
  }

  private handleThreadPaused(event: skylark_debugging.IThreadPausedEvent) {
    this.pausedThreads.set(number64(event.thread.id), event.thread);
    this.sendEvent(new StoppedEvent(
      "a breakpoint", number64(event.thread.id)));
  }

  private handleThreadContinued(event: skylark_debugging.IThreadContinuedEvent) {
    this.sendEvent(new ContinuedEvent(number64(event.threadId)));
    this.pausedThreads.delete(number64(event.threadId));
  }

  /** Returns the path to the Bazel executable from launch arguments, or a reasonable default. */
  private bazelExecutable(launchArgs: LaunchRequestArguments): string {
    let bazelExecutable = launchArgs.bazelExecutablePath;
    if (!bazelExecutable || bazelExecutable.length == 0) {
      return "bazel";
    }
    return bazelExecutable;
  }

  /**
   * Invokes {@code bazel info} and returns the information in a map.
   *
   * @param bazelExecutable The name/path of the Bazel executable.
   * @param cwd The working directory in which Bazel should be launched.
   */
  private getBazelInfo(bazelExecutable: string, cwd: string): Promise<Map<string, string>> {
    return new Promise((resolve, reject) => {
      const execOptions = {
        cwd: cwd,
        maxBuffer: 500 * 1024
      };
      child_process.exec(
        [bazelExecutable, "info"].join(" "),
        execOptions,
        (error: Error, stdout: string, stderr: string) => {
          if (error) {
            reject(error);
          } else {
            const keyValues = new Map<string, string>();
            const lines = stdout.trim().split("\n");
            for (const line of lines) {
              const [key, value] = line.split(":", 2);
              keyValues.set(key.trim(), value.trim());
            }
            resolve(keyValues);
          }
        }
      );
    });
  }

  /**
   * Launches the Bazel process to be debugged.
   *
   * @param bazelExecutable The name/path of the Bazel executable.
   * @param cwd The working directory in which Bazel should be launched.
   * @param args The command line arguments to pass to Bazel.
   */
  private launchBazel(bazelExecutable: string, cwd: string, args: string[]) {
    const options = { cwd: cwd };

    const bazelProcess = child_process.spawn(bazelExecutable, args, options)
      .on("error", (error) => {
        this.onBazelTerminated(error);
      }).on("exit", (code, signal) => {
        this.onBazelTerminated({ code: code, signal: signal });
      });
    this.isBazelRunning = true;

    // We intentionally render stderr from Bazel as stdout in VS Code so that normal build log text
    // shows up as white instead of red. ANSI color codes are applied as expected in either case.
    bazelProcess.stdout.on("data", (data: string) => {
      this.onBazelOutput(data);
    });
    bazelProcess.stderr.on("data", (data: string) => {
      this.onBazelOutput(data);
    });
  }

  /**
   * Called when the Bazel child process as terminated.
   *
   * @param result The outcome of the process; either an object containing the exit code and signal
   *     by which it terminated, or an {@code Error} describing an exceptional situation that
   *     occurred.
   */
  private onBazelTerminated(result: { code: number, signal: string } | Error) {
    // TODO(allevato): Handle abnormal termination.
    if (this.isBazelRunning) {
      this.isBazelRunning = false;
      this.sendEvent(new TerminatedEvent());
    }
  }

  /**
   * Called when the Bazel child process has produced output on stdout or stderr.
   *
   * @param data The string that was output.
   */
  private onBazelOutput(data: string) {
    this.sendEvent(new OutputEvent(data.toString(), "stdout"));
  }

  /** Sends output events to the client to log messages and optional pretty-printed objects. */
  private debugLog(message: string, ...objects: object[]) {
    this.sendEvent(new OutputEvent(message, "console"));
    for (const object of objects) {
      const s = JSON.stringify(object, undefined, 2);
      if (s) {
        this.sendEvent(new OutputEvent(`\n${s}`, "console"));
      }
    }
    this.sendEvent(new OutputEvent("\n", "console"));
  }
}

// Start the debugging session.
DebugSession.run(BazelDebugSession);
