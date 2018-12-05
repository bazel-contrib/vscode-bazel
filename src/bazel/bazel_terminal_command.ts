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

import * as vscode from "vscode";
import { BazelCommand } from "./bazel_command";

/** The singleton terminal managed by {@link provideBazelTerminal}. */
let bazelGlobalTerminal: vscode.Terminal = null;

/**
 * Returns the singleton terminal used to execute Bazel commands, creating it if
 * needed.
 */
function getBazelGlobalTerminal(): vscode.Terminal {
  if (bazelGlobalTerminal === null) {
    bazelGlobalTerminal = vscode.window.createTerminal("Bazel");
  }
  return bazelGlobalTerminal;
}

/** Commands that are executed in a terminal panel. */
export abstract class BazelTerminalCommand extends BazelCommand {
  /**
   * Executes the command, sending its output to the Bazel terminal panel.
   *
   * @param additionalOptions Additional command line options that apply only to
   *     this particular invocation of the command.
   */
  public run(additionalOptions: string[] = []) {
    const terminal = getBazelGlobalTerminal();
    terminal.sendText("clear");
    terminal.show(true);
    terminal.sendText(
      `cd ${this.workingDirectory} && ${this.commandLine(additionalOptions)}`,
    );
  }
}
