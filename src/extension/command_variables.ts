// Copyright 2024 The Bazel Authors. All rights reserved.
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

import * as path from "path";
import * as vscode from "vscode";
import { getDefaultBazelExecutablePath } from "./configuration";
import {
  BazelTargetQuickPick,
  BazelWorkspaceInfo,
  QuickPickParams,
  queryQuickPickPackage,
  queryQuickPickTargets,
} from "../bazel";
import { BazelCQuery } from "../bazel/bazel_cquery";
import { BazelInfo } from "../bazel/bazel_info";
import { assert } from "console";

/**
 * Get the output of the given target.
 *
 * If there are multiple outputs, a quick-pick window will be opened asking the
 * user to choose one.
 *
 * The `bazel.getTargetOutput` command can be used in launch configurations to
 * obtain the path to an executable built by Bazel. For example, you can set the
 * "program" attribute of a launch configuration to an input variable:
 *
 * ```
 * "program": "${input:binaryOutputLocation}"
 * ```
 *
 * Then define a command input variable:
 *
 * ```
 * "inputs": [
 *     {
 *         "id": "binaryOutputLocation",
 *         "type": "command",
 *         "command": "bazel.getTargetOutput",
 *         "args": ["//my/binary:target"],
 *     }
 * ]
 * ```
 *
 * Additional Bazel flags can be provided:
 *
 * ```
 * "inputs": [
 *     {
 *         "id": "debugOutputLocation",
 *         "type": "command",
 *         "command": "bazel.getTargetOutput",
 *         "args": ["//my/binary:target", ["--compilation_mode", "dbg"]],
 *     }
 * ]
 * ```
 */
async function bazelGetTargetOutput(
  target: string,
  options: string[] = [],
): Promise<string> {
  // Workaround for https://github.com/microsoft/vscode/issues/167970
  if (Array.isArray(target)) {
    options = (target[1] || []) as string[];
    target = target[0] as string;
  }
  const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
  if (!workspaceInfo) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage(
      "Please open a Bazel workspace folder to use this command.",
    );

    return;
  }
  const outputPath = await new BazelInfo(
    getDefaultBazelExecutablePath(),
    workspaceInfo.bazelWorkspacePath,
  ).run("output_path");
  const outputs = await new BazelCQuery(
    getDefaultBazelExecutablePath(),
    workspaceInfo.bazelWorkspacePath,
  ).queryOutputs(target, options);
  switch (outputs.length) {
    case 0:
      throw new Error(`Target ${target} has no outputs.`);
    case 1:
      return path.join(outputPath, "..", outputs[0]);
    default:
      return await vscode.window.showQuickPick(outputs, {
        placeHolder: `Pick an output of ${target}`,
      });
  }
}

/**
 * Get the output of `bazel info` for the given key.
 *
 * If there are multiple outputs, a quick-pick window will be opened asking the
 * user to choose one.
 */
async function bazelInfo(key: string): Promise<string> {
  const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
  if (!workspaceInfo) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage(
      "Please open a Bazel workspace folder to use this command.",
    );
    return;
  }
  return new BazelInfo(
    getDefaultBazelExecutablePath(),
    workspaceInfo.bazelWorkspacePath,
  ).run(key);
}

/**
 * Gets a string-valued argument in a typesafe manner from an object.
 * Throws `Error`s with user-friendly error messages in case of an error.
 *
 * @param args the arguments
 * @param argName the argument name
 * @param commandName the commmand name. Used in the error message
 * @returns the extracted string value
 */
function getArgumentValue(
  args: Record<string, any>,
  argName: string,
  commandName: string,
): string | undefined {
  if (argName in args && typeof args[argName] === "string") {
    return args[argName] as string;
  } else if (argName in args) {
    throw new Error(
      `Expected the \`${argName}\` argument for \`${commandName}\` to be a string`,
    );
  }
}

/**
 * Wraps the `queryQuickPickPackage` / `queryQuickPickTargets` functions
 * so they can be exposed as command variables.
 */
async function wrapQuickPick(
  commandName: string,
  queryQuickPick: (x: QuickPickParams) => Promise<BazelTargetQuickPick[]>,
  args: unknown,
): Promise<string | undefined> {
  const workspaceInfo = await BazelWorkspaceInfo.fromWorkspaceFolders();
  if (!workspaceInfo) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    vscode.window.showInformationMessage(
      "Please open a Bazel workspace folder to use this command.",
    );

    return;
  }

  // Default values, overridable from the `tasks.json` invocation
  let query = "//...";
  let placeHolder = "";

  // Interpret the arguments
  if (args) {
    if (!(args instanceof Object) || args instanceof Array) {
      throw new Error(
        `Expected the \`args\` for \`${commandName}\` to be an object`,
      );
    } else {
      query = getArgumentValue(args, "query", commandName) ?? query;
      placeHolder =
        getArgumentValue(args, "placeHolder", commandName) ?? placeHolder;
    }
  }
  const quickPick = await vscode.window.showQuickPick(
    queryQuickPick({ query, workspaceInfo }),
    {
      canPickMany: false,
      placeHolder,
    },
  );
  if (quickPick === undefined) {
    // If the user cancelled the quick pick, fail the substitution
    return;
  }
  assert(quickPick.getBazelCommandOptions().targets.length === 1);
  return quickPick.getBazelCommandOptions().targets[0];
}

/**
 * Activate all "command variables"
 */
export function activateCommandVariables(): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(
      "bazel.getTargetOutput",
      bazelGetTargetOutput,
    ),
    ...["pickPackage", "pickTarget"].map((key, idx) => {
      const commandName = `bazel.${key}`;
      const funcs = [queryQuickPickPackage, queryQuickPickTargets];
      const func = funcs[idx];
      return vscode.commands.registerCommand(commandName, (args) =>
        wrapQuickPick(commandName, func, args),
      );
    }),
    ...[
      "bazel-bin",
      "bazel-genfiles",
      "bazel-testlogs",
      "execution_root",
      "output_base",
      "output_path",
      "workspace",
    ].map((key) =>
      vscode.commands.registerCommand(`bazel.info.${key}`, () =>
        bazelInfo(key),
      ),
    ),
  ];
}
