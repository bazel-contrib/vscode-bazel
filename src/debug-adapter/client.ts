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
import { DebugSession, InitializedEvent, OutputEvent, TerminatedEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import { BazelDebugConnection } from "./connection";
import { skylark_debugging } from "./debug_protocol";

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
  private isBazelRunning: boolean

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
    // TODO(allevato): Send requests to Bazel to set up breakpoints.
    await this.bazelConnection.sendRequest({
      startDebugging: skylark_debugging.StartDebuggingRequest.create()
    });
    this.sendResponse(response);
  }

  protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
    const port = args.port || 7300;
    const verbose = args.verbose || false;

    const bazelExecutable = this.bazelExecutable(args);
    const bazelArgs = [
      args.bazelCommand,
      "--color=yes",
      "--experimental_skylark_debug",
      `--experimental_skylark_debug_server_port=${port}`,
      `--experimental_skylark_debug_verbose_logging=${verbose}`
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
    // TODO(allevato): Implement this.
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

  protected threadsRequest(response: DebugProtocol.ThreadsResponse) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ) {
    // TODO(allevato): Implement this.
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
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments
  ) {
    // TODO(allevato): Implement this.
    this.sendResponse(response);
  }

  /**
   * Dispatches an asynchronous Bazel debug event received from the server.
   *
   * @param event The event that was received from the server.
   */
  private handleBazelEvent(event: skylark_debugging.DebugEvent) {
    // TODO(allevato): Implement this.
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
