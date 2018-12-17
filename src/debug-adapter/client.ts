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
  ContinuedEvent,
  DebugSession,
  InitializedEvent,
  OutputEvent,
  Scope,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread,
  Variable,
} from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";
import * as skylark_debugging from "../protos/src/main/java/com/google/devtools/build/lib/skylarkdebug/proto/skylark_debugging_pb";
import { BazelDebugConnection } from "./connection";
import { Handles } from "./handles";

/** Arguments that the Bazel debug adapter supports for "attach" requests. */
interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  /**
   * Target labels and other command line options passed to the 'bazel build'
   * command.
   */
  args: string[];

  /** The Bazel command to execute (build, test, etc.). */
  bazelCommand: string;

  /**
   * The Bazel executable that should be invoked to execute the command.
   *
   * This can be either an absolute path or a command name that will be found on
   * the system path. If it is not specified, then the debugger will search for
   * "bazel" on the system path.
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

  /** The spawned Bazel process. */
  private bazelProcess: child_process.ChildProcess;

  /** Keeps track of whether a Bazel child process is currently running. */
  private isBazelRunning: boolean;

  /** Caches the result of invoking {@code bazel info} when debugging begins. */
  private bazelInfo = new Map<string, string>();

  /** Currently set breakpoints, keyed by source path. */
  private sourceBreakpoints = new Map<
    string,
    DebugProtocol.SourceBreakpoint[]
  >();

  /** Information about paused threads, keyed by thread number. */
  private pausedThreads = new Map<number, skylark_debugging.PausedThread>();

  /** An auto-indexed mapping of stack frames. */
  private frameHandles = new Handles<skylark_debugging.Frame>();

  /**
   * An auto-indexed mapping of variables references, which may be either scopes
   * (whose values are directly members of the scope) or values with child
   * values (which need to be requested by contacting the debug server).
   */
  private variableHandles = new Handles<
    skylark_debugging.Scope | skylark_debugging.Value
  >();

  /** A mapping from frame reference numbers to thread IDs. */
  private frameThreadIds = new Map<number, number>();

  /** A mapping from scope reference numbers to thread IDs. */
  private scopeThreadIds = new Map<number, number>();

  /** A mapping from value reference numbers to thread IDs. */
  private valueThreadIds = new Map<number, number>();

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
    args: DebugProtocol.InitializeRequestArguments,
  ) {
    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsConditionalBreakpoints = true;
    response.body.supportsEvaluateForHovers = true;
    this.sendResponse(response);
  }

  protected async configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments,
  ) {
    await this.bazelConnection.sendRequest((request) => {
      request.setStartDebugging(new skylark_debugging.StartDebuggingRequest());
    });

    this.sendResponse(response);
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: ILaunchRequestArguments,
  ) {
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
    ].concat(args.args);

    this.launchBazel(bazelExecutable, args.cwd, bazelArgs);

    this.bazelConnection = new BazelDebugConnection(
      "localhost",
      port,
      (message, objects) => {
        this.debugLog(message, ...objects);
      },
    );
    this.bazelConnection.on("connect", () => {
      this.sendResponse(response);
      this.sendEvent(new InitializedEvent());
    });
    this.bazelConnection.on("error", (error) => {
      this.sendErrorResponse(
        response,
        503,
        'Unable to connect to Bazel debug server: "{e}"',
        { e: error.message },
      );
    });

    this.bazelConnection.on("event", (event) => {
      this.handleBazelEvent(event);
    });
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments,
  ) {
    // Kill the spawned Bazel process on disconnect. The Bazel server will stay
    // up, but this should terminate processing of the invoked command.
    this.bazelProcess.kill("SIGKILL");
    this.bazelProcess = null;
    this.isBazelRunning = false;
    this.sendResponse(response);
  }

  // Breakpoint requests

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ) {
    // The path we need to pass to Bazel here depends on how the .bzl file has
    // been loaded. Unfortunately this means we have to create two breakpoints,
    // one for each possible path, because the way the .bzl file is loaded is
    // chosen by the user:
    //
    // 1. If the file is loaded using an explicit repository reference (i.e.,
    //    `@foo//:bar.bzl`), then it will appear in the `external` subdirectory
    //    of Bazel's output_base.
    // 2. If the file is loaded as a same-repository path (i.e., `//:bar.bzl`),
    //    then Bazel will treat it as if it were under `execroot`, which is a
    //    symlink to the actual filesystem location of the file.
    //
    // TODO(allevato): We may be able to simplify this once
    // https://github.com/bazelbuild/bazel/issues/6848 is in a release.
    const workspaceName = path.basename(this.bazelInfo.get("execution_root"));
    const relativeSourcePath = path.relative(
      this.bazelInfo.get("workspace"),
      args.source.path,
    );
    const sourcePathInExternal = path.join(
      this.bazelInfo.get("output_base"),
      "external",
      workspaceName,
      relativeSourcePath,
    );
    this.sourceBreakpoints.set(args.source.path, args.breakpoints);
    this.sourceBreakpoints.set(sourcePathInExternal, args.breakpoints);

    // Convert to Bazel breakpoints.
    const bazelBreakpoints = new Array<skylark_debugging.Breakpoint>();
    for (const [sourcePath, breakpoints] of this.sourceBreakpoints) {
      for (const breakpoint of breakpoints) {
        const locationProto = new skylark_debugging.Location();
        locationProto.setPath(sourcePath);
        locationProto.setLineNumber(breakpoint.line);

        const breakpointProto = new skylark_debugging.Breakpoint();
        breakpointProto.setExpression(breakpoint.condition);
        breakpointProto.setLocation(locationProto);

        bazelBreakpoints.push(breakpointProto);
      }
    }

    this.bazelConnection.sendRequest((request) => {
      const breakpointsRequest = new skylark_debugging.SetBreakpointsRequest();
      breakpointsRequest.setBreakpointList(bazelBreakpoints);
      request.setSetBreakpoints(breakpointsRequest);
    });
    this.sendResponse(response);
  }

  // Thread, stack frame, and variable requests

  protected async threadsRequest(response: DebugProtocol.ThreadsResponse) {
    response.body = {
      threads: Array.from(this.pausedThreads.values()).map((bazelThread) => {
        return new Thread(bazelThread.getId(), bazelThread.getName());
      }),
    };
    this.sendResponse(response);
  }

  protected async stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments,
  ) {
    const event = await this.bazelConnection.sendRequest((request) => {
      const listFramesRequest = new skylark_debugging.ListFramesRequest();
      listFramesRequest.setThreadId(args.threadId);
      request.setListFrames(listFramesRequest);
    });

    if (event.getListFrames()) {
      const bazelFrames = event.getListFrames().getFrameList();
      const vsFrames = new Array<StackFrame>();
      for (const bazelFrame of bazelFrames) {
        const frameHandle = this.frameHandles.create(bazelFrame);
        this.frameThreadIds.set(frameHandle, args.threadId);

        const location = bazelFrame.getLocation();
        const vsFrame = new StackFrame(
          frameHandle,
          bazelFrame.getFunctionName() || "<global scope>",
        );
        if (location) {
          // Resolve the real path to the file, which will make sure that when
          // the user interacts with the stack frame, VS Code loads the file
          // from it's actual path instead of from a location inside Bazel's
          // output base.
          const sourcePath = fs.realpathSync(location.getPath());
          vsFrame.source = new Source(path.basename(sourcePath), sourcePath);
          vsFrame.line = location.getLineNumber();
        }
        vsFrames.push(vsFrame);
      }
      response.body = { stackFrames: vsFrames, totalFrames: vsFrames.length };
    }

    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments,
  ) {
    const frameThreadId = this.frameThreadIds.get(args.frameId);
    const bazelFrame = this.frameHandles.get(args.frameId);

    const vsScopes = new Array<Scope>();
    for (const bazelScope of bazelFrame.getScopeList()) {
      const scopeHandle = this.variableHandles.create(bazelScope);
      const vsScope = new Scope(bazelScope.getName(), scopeHandle);
      vsScopes.push(vsScope);

      // Associate the thread ID from the frame with the scope so that it can be
      // passed through to child values as well.
      this.scopeThreadIds.set(scopeHandle, frameThreadId);
    }

    response.body = { scopes: vsScopes };
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ) {
    let bazelValues: skylark_debugging.Value[];
    let threadId: number;

    const reference = args.variablesReference;
    const scopeOrParentValue = this.variableHandles.get(reference);
    if (scopeOrParentValue instanceof skylark_debugging.Scope) {
      // If the reference is to a scope, then we ask for the thread ID
      // associated with the scope so that we can associate it later with the
      // top-level values in the scope.
      threadId = this.scopeThreadIds.get(reference);
      const scope = scopeOrParentValue as skylark_debugging.Scope;
      bazelValues = scope.getBindingList();
    } else if (scopeOrParentValue instanceof skylark_debugging.Value) {
      // If the reference is to a value, we need to send a request to Bazel to
      // get its child values.
      threadId = this.valueThreadIds.get(reference);
      bazelValues = (await this.bazelConnection.sendRequest((request) => {
        const getChildrenRequest = new skylark_debugging.GetChildrenRequest();
        const value = scopeOrParentValue as skylark_debugging.Value;
        getChildrenRequest.setThreadId(threadId);
        getChildrenRequest.setValueId(value.getId());
        request.setGetChildren(getChildrenRequest);
      }))
        .getGetChildren()
        .getChildrenList();
    } else {
      bazelValues = [];
      threadId = 0;
    }

    const variables = new Array<Variable>();
    for (const value of bazelValues) {
      let valueHandle: number;
      if (value.getHasChildren() && value.getId()) {
        // Record the value in a handle so that its children can be queried when
        // the user expands it in the UI. We also record the thread ID for the
        // value since we need it when we make that request later.
        valueHandle = this.variableHandles.create(value);
        this.valueThreadIds.set(valueHandle, threadId);
      } else {
        valueHandle = 0;
      }
      const variable = new Variable(
        value.getLabel(),
        value.getDescription(),
        valueHandle,
      );
      variables.push(variable);
    }

    response.body = { variables };
    this.sendResponse(response);
  }

  protected async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments,
  ) {
    const threadId = this.frameThreadIds.get(args.frameId);

    const bazelResponse = await this.bazelConnection.sendRequest((request) => {
      const evaluateRequest = new skylark_debugging.EvaluateRequest();
      evaluateRequest.setStatement(args.expression);
      evaluateRequest.setThreadId(threadId);
      request.setEvaluate(evaluateRequest);
    });

    const error = bazelResponse.getError();
    if (error) {
      this.sendErrorResponse(
        response,
        500,
        `Error evaluating statement: ${error.getMessage()}`,
      );
      return;
    }

    const value = bazelResponse.getEvaluate().getResult();

    let valueHandle: number;
    if (value.getHasChildren() && value.getId()) {
      // Record the value in a handle so that its children can be queried when
      // the user expands it in the UI. We also record the thread ID for the
      // value since we need it when we make that request later.
      valueHandle = this.variableHandles.create(value);
      this.valueThreadIds.set(valueHandle, threadId);
    } else {
      valueHandle = 0;
    }

    response.body = {
      result: value.getDescription(),
      variablesReference: valueHandle,
    };
    this.sendResponse(response);
  }

  // Execution/control flow requests

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
  ) {
    response.body = { allThreadsContinued: false };
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.NONE);
    this.sendResponse(response);
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments,
  ) {
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.OVER);
    this.sendResponse(response);
  }

  protected stepInRequest(
    response: DebugProtocol.StepInResponse,
    args: DebugProtocol.StepInArguments,
  ) {
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.INTO);
    this.sendResponse(response);
  }

  protected stepOutRequest(
    response: DebugProtocol.StepOutResponse,
    args: DebugProtocol.StepOutArguments,
  ) {
    this.sendControlFlowRequest(args.threadId, skylark_debugging.Stepping.OUT);
    this.sendResponse(response);
  }

  /**
   * Sends a request to Bazel to continue the execution of the given thread,
   * with stepping behavior.
   *
   * @param threadId The identifier of the thread to continue.
   * @param stepping The stepping behavior of the request (OVER, INTO, OUT, or
   *     NONE).
   */
  private sendControlFlowRequest(
    threadId: number,
    stepping: skylark_debugging.Stepping,
  ) {
    // Clear out all the cached state when the user resumes a thread.
    this.frameHandles.clear();
    this.variableHandles.clear();
    this.frameThreadIds.clear();
    this.scopeThreadIds.clear();
    this.valueThreadIds.clear();

    this.bazelConnection.sendRequest((request) => {
      const continueRequest = new skylark_debugging.ContinueExecutionRequest();
      continueRequest.setStepping(stepping);
      continueRequest.setThreadId(threadId);
      request.setContinueExecution(continueRequest);
    });
  }

  /**
   * Dispatches an asynchronous Bazel debug event received from the server.
   *
   * @param event The event that was received from the server.
   */
  private handleBazelEvent(event: skylark_debugging.DebugEvent) {
    switch (event.getPayloadCase()) {
      case skylark_debugging.DebugEvent.PayloadCase.THREAD_PAUSED:
        this.handleThreadPaused(event.getThreadPaused());
        break;
      case skylark_debugging.DebugEvent.PayloadCase.THREAD_CONTINUED:
        this.handleThreadContinued(event.getThreadContinued());
        break;
      default:
        break;
    }
  }

  private handleThreadPaused(event: skylark_debugging.ThreadPausedEvent) {
    const thread = event.getThread();
    const threadId = thread.getId();
    if (threadId) {
      this.pausedThreads.set(threadId, thread);
      let reason: string;
      switch (thread.getPauseReason()) {
        case skylark_debugging.PauseReason.HIT_BREAKPOINT:
          reason = "a breakpoint";
          break;
        case skylark_debugging.PauseReason.INITIALIZING:
          reason = "initialization";
          break;
        case skylark_debugging.PauseReason.ALL_THREADS_PAUSED:
          reason = "all threads";
          break;
        case skylark_debugging.PauseReason.CONDITIONAL_BREAKPOINT_ERROR:
          reason = "evaluation error";
          break;
        case skylark_debugging.PauseReason.PAUSE_THREAD_REQUEST:
          reason = "request";
          break;
        default:
          reason = "";
          break;
      }
      this.sendEvent(new StoppedEvent(reason, threadId));
    }
  }

  private handleThreadContinued(event: skylark_debugging.ThreadContinuedEvent) {
    const threadId = event.getThreadId();
    this.sendEvent(new ContinuedEvent(threadId));
    this.pausedThreads.delete(threadId);
  }

  /**
   * Returns the path to the Bazel executable from launch arguments, or a
   * reasonable default.
   */
  private bazelExecutable(launchArgs: ILaunchRequestArguments): string {
    const bazelExecutable = launchArgs.bazelExecutablePath;
    if (!bazelExecutable || bazelExecutable.length === 0) {
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
  private getBazelInfo(
    bazelExecutable: string,
    cwd: string,
  ): Promise<Map<string, string>> {
    return new Promise((resolve, reject) => {
      const execOptions = {
        cwd,
        // The maximum amount of data allowed on stdout. 500KB should be plenty
        // of `bazel info`, but if this becomes problematic we can switch to the
        // event-based `child_process` APIs instead.
        maxBuffer: 500 * 1024,
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
        },
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
    const options = { cwd };

    this.bazelProcess = child_process
      .spawn(bazelExecutable, args, options)
      .on("error", (error) => {
        this.onBazelTerminated(error);
      })
      .on("exit", (code, signal) => {
        this.onBazelTerminated({ code, signal });
      });
    this.isBazelRunning = true;

    // We intentionally render stderr from Bazel as stdout in VS Code so that
    // normal build log text shows up as white instead of red. ANSI color codes
    // are applied as expected in either case.
    this.bazelProcess.stdout.on("data", (data: string) => {
      this.onBazelOutput(data);
    });
    this.bazelProcess.stderr.on("data", (data: string) => {
      this.onBazelOutput(data);
    });
  }

  /**
   * Called when the Bazel child process as terminated.
   *
   * @param result The outcome of the process; either an object containing the
   *     exit code and signal by which it terminated, or an {@code Error}
   *     describing an exceptional situation that occurred.
   */
  private onBazelTerminated(result: { code: number; signal: string } | Error) {
    // TODO(allevato): Handle abnormal termination.
    if (this.isBazelRunning) {
      this.isBazelRunning = false;
      this.sendEvent(new TerminatedEvent());
    }
  }

  /**
   * Called when the Bazel child process has produced output on stdout or
   * stderr.
   *
   * @param data The string that was output.
   */
  private onBazelOutput(data: string) {
    this.sendEvent(new OutputEvent(data.toString(), "stdout"));
  }

  /**
   * Sends output events to the client to log messages and optional
   * pretty-printed objects.
   */
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
