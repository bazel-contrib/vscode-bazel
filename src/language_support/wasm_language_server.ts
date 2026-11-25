// Copyright 2026 The Bazel Authors. All rights reserved.
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

/**
 * The bundled Starlark language server: starpls compiled to WebAssembly,
 * run under Node's WebAssembly System Interface in a helper process of the
 * extension host (see starpls_wasi_runner.ts). The helper preopens the
 * Bazel workspace, the output base and a data directory onto the sandbox
 * paths in wasi_mounts.ts, and this client translates URIs between the two
 * views. A WASI process cannot start Bazel, and startup does not wait for it:
 * the server asks the extension for a repository mapping or the native rule
 * definitions when it first needs them, and the extension runs the Bazel
 * command in the background, bounded in time.
 */

import * as childProcess from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as lc from "vscode-languageclient/node";
import { BazelWorkspaceInfo } from "../bazel/bazel_workspace_info";
import {
  getBazelExecutablePath,
  getLspFetchMode,
  getStartupOptions,
} from "../extension/configuration";
import { DATA_MOUNT, OUTPUT_BASE_MOUNT, WORKSPACE_MOUNT } from "./wasi_mounts";

/** How long one Bazel command run on the server's behalf may take. */
const BAZEL_TIMEOUT_MS = 10_000;

/** How long after that a Bazel client that ignored SIGTERM gets SIGKILL. */
const BAZEL_KILL_GRACE_MS = 2_000;

/** How long a fetch the user asked for may take; downloads are slow. */
const FETCH_TIMEOUT_MS = 10 * 60_000;

/** How long requests to fetch are collected into one prompt. */
const FETCH_PROMPT_DELAY_MS = 500;

/** The wasm shipped with the extension, if this build includes it. */
export function bundledStarplsWasm(
  context: vscode.ExtensionContext,
): vscode.Uri | undefined {
  const uri = vscode.Uri.joinPath(context.extensionUri, "dist", "starpls.wasm");
  return fs.existsSync(uri.fsPath) ? uri : undefined;
}

/** The helper that runs the wasm, bundled next to the extension. */
function wasiRunner(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(path.join("dist", "starpls-wasi-runner.js"));
}

/**
 * The output base, read from the `bazel-*` convenience symlinks in the
 * workspace root, which point into `<output base>/execroot/...`. Undefined
 * when the workspace has never been built.
 */
export function outputBaseFromSymlinks(root: string): string | undefined {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    if (!entry.isSymbolicLink() || !entry.name.startsWith("bazel-")) {
      continue;
    }
    let target: string;
    try {
      target = fs.realpathSync(path.join(root, entry.name));
    } catch {
      continue;
    }
    const marker = `${path.sep}execroot${path.sep}`;
    const idx = target.indexOf(marker);
    if (
      idx !== -1 &&
      fs.existsSync(path.join(target.slice(0, idx), "external"))
    ) {
      return target.slice(0, idx);
    }
  }
  return undefined;
}

/** Runs one Bazel command in the workspace, bounded in time. */
class BazelRunner {
  /**
   * The executable and startup options are fixed when the client is
   * created, so every command runs against the output base the server
   * mounted; a settings change restarts the client instead.
   */
  constructor(
    private readonly workspace: string,
    private readonly executable: string,
    private readonly startupOptions: string[],
    private readonly log: vscode.LogOutputChannel,
  ) {}

  async run(
    args: string[],
    timeoutMs: number = BAZEL_TIMEOUT_MS,
  ): Promise<Buffer | undefined> {
    const started = Date.now();
    const what = `bazel ${args.slice(0, 2).join(" ")} for the language server`;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (out: Buffer | undefined, message: string) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(hardKill);
        if (out) {
          this.log.info(message);
        } else {
          this.log.warn(message);
        }
        resolve(out);
      };
      const child = childProcess.execFile(
        this.executable,
        [...this.startupOptions, ...args],
        {
          cwd: this.workspace,
          encoding: "buffer",
          maxBuffer: 64 * 1024 * 1024,
          timeout: timeoutMs,
        },
        (error, stdout) => {
          const took = `${Date.now() - started} ms`;
          if (error) {
            finish(undefined, `${what} failed after ${took}: ${error.message}`);
          } else {
            finish(stdout, `${what} took ${took}`);
          }
        },
      );
      // Node's timeout only sends SIGTERM and then waits for the process to
      // exit, and a Bazel client waiting on the server lock may not oblige.
      // The server is waiting on this answer, so give up for good.
      const hardKill = setTimeout(() => {
        child.kill("SIGKILL");
        finish(
          undefined,
          `${what} did not stop within ${timeoutMs + BAZEL_KILL_GRACE_MS} ms and was killed`,
        );
      }, timeoutMs + BAZEL_KILL_GRACE_MS);
    });
  }
}

/**
 * Fetching is the user's decision: the server's requests to fetch external
 * repositories are collected for a moment and put to the user as one
 * question. "Fetch" runs a single `bazel fetch` for all of them in the
 * workspace root; "Not now" answers the server that the fetch was declined,
 * which it remembers until the module graph changes. With `bazel.lsp.fetch`
 * set to "never" the question is skipped and every request is declined.
 */
class FetchPrompter {
  private pending: { repo: string; resolve: (r: boolean | null) => void }[] =
    [];
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly bazel: BazelRunner,
    private readonly bzlmod: boolean,
    private readonly log: vscode.LogOutputChannel,
  ) {}

  /** Resolves to true (fetched), false (failed) or null (declined). */
  request(repo: string): Promise<boolean | null> {
    if (getLspFetchMode() === "never") {
      this.log.info(`not fetching @@${repo}: bazel.lsp.fetch is "never"`);
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      this.pending.push({ repo, resolve });
      if (this.timer === undefined) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          void this.prompt();
        }, FETCH_PROMPT_DELAY_MS);
      }
    });
  }

  private async prompt(): Promise<void> {
    const batch = this.pending;
    this.pending = [];
    const repos = [...new Set(batch.map((p) => p.repo))];
    const names = repos.map((r) => `@${r}`).join(", ");
    const choice = await vscode.window.showInformationMessage(
      `The Starlark language server needs ${repos.length === 1 ? "a repository that is" : "repositories that are"} not fetched: ${names}. Fetch with bazel?`,
      "Fetch",
      "Not now",
    );
    if (choice !== "Fetch") {
      this.log.info(`fetch declined for ${names}`);
      for (const p of batch) {
        p.resolve(null);
      }
      return;
    }
    const fetched = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching ${names}`,
      },
      async () =>
        (await this.bazel.run(
          [
            "fetch",
            ...repos.flatMap((r) => [
              "--repo",
              // Canonical names exist under bzlmod only; a WORKSPACE
              // repository is fetched by its plain name.
              this.bzlmod ? `@@${r}` : `@${r}`,
            ]),
          ],
          FETCH_TIMEOUT_MS,
        )) !== undefined,
    );
    for (const p of batch) {
      p.resolve(fetched);
    }
  }
}

/**
 * The one Starlark semantics flag the server reads, bzlmod on or off,
 * decided from the workspace files rather than a `bazel info` call: a
 * workspace with no MODULE.bazel but a WORKSPACE file runs without bzlmod.
 * Everything else keeps the server's default, which is bzlmod on.
 */
function starlarkSemantics(workspace: string): string {
  const has = (name: string) => fs.existsSync(path.join(workspace, name));
  if (!has("MODULE.bazel") && (has("WORKSPACE") || has("WORKSPACE.bazel"))) {
    return "enable_bzlmod=false";
  }
  return "";
}

/**
 * Maps between editor URIs and the paths the server sees: the Bazel
 * workspace is mounted at `/workspace` and the output base (external
 * repositories) at `/output_base`.
 *
 * Paths are compared the way the file system does: case-insensitively on
 * Windows, where `Uri.fsPath` also lower-cases the drive letter that
 * `realpath` reports in upper case. A path that matches no mount as written
 * is tried again as a real path, so a file reached through another alias of
 * the output base (`/tmp` against `/private/tmp` on macOS, a symlinked
 * output base) still lands on the mount.
 */
function uriConverters(workspace: string, outputBase: string) {
  const mounts: [string, string][] = [
    [outputBase, OUTPUT_BASE_MOUNT],
    [workspace, WORKSPACE_MOUNT],
  ];
  const fold = (p: string): string =>
    process.platform === "win32" ? p.toLowerCase() : p;
  const under = (p: string, dir: string): boolean => {
    const base = fold(dir.endsWith(path.sep) ? dir.slice(0, -1) : dir);
    const candidate = fold(p);
    return candidate === base || candidate.startsWith(base + path.sep);
  };
  const realDirs = new Map<string, string>();
  const realPath = (p: string): string => {
    const dir = path.dirname(p);
    let real = realDirs.get(dir);
    if (real === undefined) {
      try {
        real = fs.realpathSync.native(dir);
      } catch {
        real = dir;
      }
      realDirs.set(dir, real);
    }
    return path.join(real, path.basename(p));
  };
  const toMount = (fsPath: string): string | undefined => {
    for (const [dir, mount] of mounts) {
      if (under(fsPath, dir)) {
        const rel = fsPath
          .slice(dir.endsWith(path.sep) ? dir.length - 1 : dir.length)
          .split(path.sep)
          .join("/");
        // Through the URI type, so `#`, `%`, `?` and spaces are encoded.
        return vscode.Uri.from({
          scheme: "file",
          path: `${mount}${rel}`,
        }).toString();
      }
    }
    return undefined;
  };
  return {
    code2Protocol: (uri: vscode.Uri): string => {
      if (uri.scheme === "file") {
        const mapped = toMount(uri.fsPath) ?? toMount(realPath(uri.fsPath));
        if (mapped !== undefined) {
          return mapped;
        }
      }
      return uri.toString();
    },
    protocol2Code: (value: string): vscode.Uri => {
      const uri = vscode.Uri.parse(value);
      if (uri.scheme === "file") {
        for (const [dir, mount] of mounts) {
          if (uri.path === mount || uri.path.startsWith(mount + "/")) {
            const rel = uri.path.slice(mount.length);
            return vscode.Uri.file(path.join(dir, ...rel.split("/")));
          }
        }
      }
      return uri;
    },
  };
}

/**
 * Creates a language client whose server is the given starpls wasm, run
 * under Node's WASI in a helper process. The client is not started.
 */
export async function createWasmLspClient(
  context: vscode.ExtensionContext,
  wasmUri: vscode.Uri,
  outputChannel: vscode.LogOutputChannel,
  folder: vscode.WorkspaceFolder,
): Promise<lc.LanguageClient> {
  const info = BazelWorkspaceInfo.fromWorkspaceFolder(folder);
  if (!info) {
    throw new Error(`${folder.name} is not a Bazel workspace`);
  }
  const workspace = info.bazelWorkspacePath;
  const startupOptions = getStartupOptions();
  const bazel = new BazelRunner(
    workspace,
    getBazelExecutablePath(),
    startupOptions,
    outputChannel,
  );

  // The output base: from the convenience symlinks when the configured
  // startup options do not choose one, else from a bounded `bazel info`
  // with those options, the same way the delegated commands run.
  const startupOptionsChooseOutputBase = startupOptions.some(
    (option) =>
      option.startsWith("--output_base") ||
      option.startsWith("--output_user_root"),
  );
  let outputBase = startupOptionsChooseOutputBase
    ? undefined
    : outputBaseFromSymlinks(workspace);
  if (!outputBase) {
    const out = await bazel.run(["info", "output_base"]);
    outputBase = out?.toString("utf8").trim() || undefined;
  }
  if (!outputBase) {
    throw new Error("the Bazel output base could not be determined");
  }

  const semantics = starlarkSemantics(workspace);
  const bzlmod = semantics !== "enable_bzlmod=false";

  // One data directory per output base, so windows on different
  // workspaces never read each other's files.
  const dataDir = path.join(
    context.globalStorageUri.fsPath,
    "starpls",
    crypto.createHash("sha256").update(outputBase).digest("hex").slice(0, 16),
  );
  await fs.promises.mkdir(dataDir, { recursive: true });

  const serverOptions: lc.ServerOptions = {
    module: wasiRunner(context),
    transport: lc.TransportKind.stdio,
    args: [wasmUri.fsPath, workspace, outputBase, dataDir],
    options: {
      // Node flags WASI as experimental; the warning is noise in the log.
      execArgv: ["--no-warnings"],
      env: { RUST_LOG: "starpls=warn" },
    },
  };

  // Protocol-level relative patterns, which the client turns into
  // `vscode.RelativePattern`s: this client serves its folder and the
  // output base it mounted (files there belong to no folder).
  const inFolder = (pattern: string) => ({
    baseUri: folder.uri.toString(),
    pattern,
  });
  const inOutputBase = {
    baseUri: vscode.Uri.file(outputBase).toString(),
    pattern: "**/*",
  };
  const clientOptions: lc.LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "starlark", pattern: inFolder("**/*") },
      { scheme: "file", pattern: inFolder("**/BUILD") },
      { scheme: "file", pattern: inFolder("**/BUILD.bazel") },
      { scheme: "file", pattern: inFolder("**/*.bzl") },
      { scheme: "file", language: "starlark", pattern: inOutputBase },
      { scheme: "file", pattern: { ...inOutputBase, pattern: "**/*.bzl" } },
      { scheme: "file", pattern: { ...inOutputBase, pattern: "**/BUILD" } },
      {
        scheme: "file",
        pattern: { ...inOutputBase, pattern: "**/BUILD.bazel" },
      },
    ],
    workspaceFolder: folder,
    outputChannel,
    uriConverters: uriConverters(workspace, outputBase),
    initializationOptions: {
      bazel: {
        info: {
          workspace: WORKSPACE_MOUNT,
          outputBase: OUTPUT_BASE_MOUNT,
          release: "",
          starlarkSemantics: semantics,
          workspaceName: null,
        },
        requests: true,
      },
    },
  };

  const client = new lc.LanguageClient(
    "bazel.starpls",
    `Starlark (bundled starpls, ${folder.name})`,
    serverOptions,
    clientOptions,
  );

  // What the server asks for when it first needs it.
  client.onRequest(
    "starpls/bazel/repoMapping",
    async (params: {
      repo: string;
    }): Promise<Record<string, string> | null> => {
      const out = await bazel.run(["mod", "dump_repo_mapping", params.repo]);
      if (!out) {
        return null;
      }
      try {
        return JSON.parse(out.toString("utf8")) as Record<string, string>;
      } catch {
        return null;
      }
    },
  );
  client.onRequest(
    "starpls/bazel/buildLanguage",
    async (): Promise<string | null> => {
      const out = await bazel.run(["info", "build-language"]);
      if (!out) {
        return null;
      }
      // Written atomically so the server never reads a partial file.
      const target = path.join(dataDir, "build-language.pb");
      const temp = `${target}.${crypto.randomUUID()}.tmp`;
      await fs.promises.writeFile(temp, out);
      await fs.promises.rename(temp, target);
      return `${DATA_MOUNT}/build-language.pb`;
    },
  );
  const fetches = new FetchPrompter(bazel, bzlmod, outputChannel);
  client.onRequest(
    "starpls/bazel/fetchRepo",
    (params: { repo: string }): Promise<boolean | null> =>
      fetches.request(params.repo),
  );
  return client;
}
