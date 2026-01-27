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

import { spawn } from "child_process";
import * as crypto from "crypto";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import { blaze_query } from "../protos";
import { BazelCommand } from "./bazel_command";
import { getBazelWorkspaceFolder } from "./bazel_utils";
import { logDebug } from "../extension/logger";

const protoOutputOptions = [
  "--proto:output_rule_attrs=''",
  "--noproto:rule_inputs_and_outputs",
  "--noproto:default_values",
];

/** Provides a promise-based API around a Bazel query. */
export class BazelQuery extends BazelCommand {
  /**
   * Runs the query and returns a {@code QueryResult} containing the targets
   * that match.
   *
   * @param query The query to execute.
   * @param options
   * @param options.additionalOptions Additional command line options that
   * should be passed just to this specific invocation of the query.
   * @param options.sortByRuleName If `true`, the results from the query will
   * be sorted by their name.
   * @param options.ignoresErrors `true` if errors from executing the query
   * should be ignored.
   * @returns A {@link QueryResult} object that contains structured information
   * about the query results.
   */
  public async queryTargets(
    query: string,
    {
      additionalOptions = [],
      sortByRuleName = false,
      ignoresErrors = false,
      abortSignal,
    }: {
      additionalOptions?: string[];
      sortByRuleName?: boolean;
      ignoresErrors?: boolean;
      abortSignal?: AbortSignal;
    } = {},
  ): Promise<blaze_query.QueryResult> {
    const buffer = await this.run(
      [query, ...additionalOptions, "--output=proto", ...protoOutputOptions],
      { ignoresErrors, abortSignal },
    );
    const result = blaze_query.QueryResult.decode(buffer);
    if (sortByRuleName) {
      const sorted = result.target.sort((t1, t2) => {
        const n1 = t1.rule.name;
        const n2 = t2.rule.name;
        if (n1 > n2) {
          return 1;
        }
        if (n1 < n2) {
          return -1;
        }
        return 0;
      });
      result.target = sorted;
    }
    return result;
  }

  /**
   * Runs the query and returns an array of package paths containing the targets
   * that match.
   *
   * @param query The query to execute.
   * @returns An sorted array of package paths containing the targets that
   * match.
   */
  public async queryPackages(
    query: string,
    { abortSignal }: { abortSignal?: AbortSignal } = {},
  ): Promise<string[]> {
    const buffer = await this.run([query, "--output=package"], { abortSignal });
    const result = buffer
      .toString("utf-8")
      .trim()
      .replace(/\r\n|\r/g, "\n")
      .split("\n")
      .sort();
    return result;
  }

  protected bazelCommand(): string {
    return "query";
  }

  /**
   * Executes the command and returns a promise for the binary contents of
   * standard output.
   * The running process will be aborted if the abortSignal is aborted.
   *
   * @param options The options to pass to `bazel query`
   * @param ignoresErrors `true` if errors from executing the query
   * should be ignored.
   * @returns The contents of the process's standard output
   */
  protected async run(
    options: string[],
    {
      ignoresErrors = false,
      abortSignal,
    }: { ignoresErrors?: boolean; abortSignal?: AbortSignal } = {},
  ): Promise<Buffer> {
    const bazelConfig = vscode.workspace.getConfiguration("bazel");
    const queriesShareServer = bazelConfig.get<boolean>("queriesShareServer");
    let additionalStartupOptions: string[] = [];
    if (!queriesShareServer) {
      // If not sharing the Bazel server, use a custom output_base.
      //
      // This helps get the queries out of the way of any other builds (or use
      // of ibazel). The docs suggest using a custom output base for IDE support
      // features, which is what these queries are. See:
      // https://bazel.build/run/scripts#output-base-option
      // NOTE: This does NOT use a random directory for each query instead it
      // uses a generated tmp directory based on the Bazel workspace, this way
      // the server is shared for all the queries.
      const ws = getBazelWorkspaceFolder(this.workingDirectory);
      const hash = crypto.createHash("md5").update(ws).digest("hex");
      const queryOutputBaseConfigValue =
        bazelConfig.get<string>("queryOutputBase");
      const queryOutputBase = path.join(
        queryOutputBaseConfigValue ?? os.tmpdir(),
        hash,
      );
      additionalStartupOptions = additionalStartupOptions.concat([
        `--output_base=${queryOutputBase}`,
      ]);
    }
    return new Promise<Buffer>((resolve, reject) => {
      logDebug(
        `Running Bazel query with command line: ${this.bazelExecutable} ${this.execArgs(
          options,
          additionalStartupOptions,
        ).join(" ")}`,
      );
      const child = spawn(
        this.bazelExecutable,
        this.execArgs(options, additionalStartupOptions),
        {
          cwd: this.workingDirectory,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      // Handle abort signal if provided
      const onAbort = () => {
        try {
          child.kill();
          const abortError = new Error("The operation was aborted") as Error & {
            name: string;
          };
          abortError.name = "AbortError";
          reject(abortError);
        } catch (error: unknown) {
          reject(error);
        }
      };

      const cleanup = () => {
        if (abortSignal) {
          abortSignal.removeEventListener("abort", onAbort);
        }
      };

      if (abortSignal) {
        if (abortSignal.aborted) {
          onAbort();
          return;
        }
        abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      const chunks: Buffer[] = [];
      let errorOutput = "";

      child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
      child.stderr?.on("data", (chunk: Buffer) => {
        errorOutput += chunk.toString();
      });

      child.on("error", (error: Error) => {
        cleanup();
        reject(error);
      });

      child.on("close", (code: number | null) => {
        cleanup();

        if (code === 0 || ignoresErrors) {
          resolve(Buffer.concat(chunks));
        } else {
          const error = new Error(`Bazel query failed with code ${code}`);
          (error as { stderr?: string }).stderr = errorOutput;
          reject(error);
        }
      });
    });
  }
}
