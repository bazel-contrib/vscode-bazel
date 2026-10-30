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

import * as path from "path";
import * as vscode from "vscode";

import { logDebug, logError, logInfo, logWarn } from "../extension/logger";
import { ILogger } from "../extension/logger_interface";
import { affectsRenamedSetting } from "../extension/settings_migration";
import {
  ToolConfig,
  ToolKey,
  ToolsConfig,
  Platform,
  detectPlatform,
  loadToolsConfig,
} from "./tool_config";
import {
  downloadExternalTool,
  findOutdatedManagedTool,
  getManagedToolPath,
  getToolDownloadUrl,
} from "./tool_downloader";
import { setToolRegistry } from "./tool_registry_instance";
import {
  LocatedTool,
  getConfiguredToolValue,
  getToolSetting,
  isExecutableFile,
  locateConfiguredTool,
  locateToolOnPath,
} from "./tool_locator";

export const TOOL_KEYS: readonly ToolKey[] = [
  "Bazelisk",
  "Buildifier",
  "Starlark Language Server",
];

/** How missing tools are downloaded (`bazel.externalTools.autoDownload`). */
export type AutoDownloadMode = "ask" | "always" | "never";

export type ToolState =
  | { kind: "resolved"; tool: LocatedTool }
  /**
   * Not found. `configured` tells whether an explicit setting value could
   * not be found (then nothing is downloaded) or the automatic lookup failed.
   */
  | { kind: "missing"; reason: string; configured: boolean }
  | { kind: "downloading" }
  /** Not found, and there is no release for this platform to download. */
  | { kind: "unsupported"; reason: string };

export interface ToolStateChange {
  key: ToolKey;
  state: ToolState;
  /** True for the first resolution of a tool, false for every later change. */
  initial: boolean;
}

/** Human readable names and purposes, used in prompts and the status. */
export const TOOL_INFO: Record<ToolKey, { label: string; purpose: string }> = {
  Bazelisk: {
    label: "Bazelisk",
    purpose: "build, test and query Bazel targets",
  },
  Buildifier: {
    label: "Buildifier",
    purpose: "format and lint Bazel files",
  },
  "Starlark Language Server": {
    label: "starpls",
    purpose: "provide Starlark language support",
  },
};

const AUTO_DOWNLOAD_SETTING = "bazel.externalTools.autoDownload";
const DONT_ASK_PREFIX = "bazel.externalTools.dontAsk.";
const FOCUS_RECHECK_INTERVAL_MS = 5000;

const registryLogger: ILogger = {
  logDebug: (message, showMessage, ...args) =>
    logDebug(`[ExternalTools] ${message}`, showMessage, ...args),
  logInfo: (message, showMessage, ...args) =>
    logInfo(`[ExternalTools] ${message}`, showMessage, ...args),
  logWarn: (message, showMessage, ...args) =>
    logWarn(`[ExternalTools] ${message}`, showMessage, ...args),
  logError: (message, showMessage, ...args) =>
    logError(`[ExternalTools] ${message}`, showMessage, ...args),
};

export interface ToolRegistryOptions {
  /** Root directory of the managed tool copies. */
  toolsDir: string;
  /** Persists the "Don't ask again" choices. */
  globalState: vscode.Memento;
  /**
   * Whether a Bazel workspace is open. The user is only asked to download a
   * tool in a Bazel workspace; until then the offer is kept pending.
   */
  isBazelWorkspaceAvailable: () => boolean;
  /** Checks that a located tool works, e.g. that buildifier is recent enough. */
  validators?: Partial<Record<ToolKey, (command: string) => Promise<boolean>>>;
  toolsConfig?: ToolsConfig;
  platform?: Platform;
  getConfiguredValue?: typeof getConfiguredToolValue;
  getAutoDownloadMode?: typeof getAutoDownloadMode;
  locateConfigured?: typeof locateConfiguredTool;
  locateOnPath?: typeof locateToolOnPath;
  download?: typeof downloadExternalTool;
}

/**
 * Knows where the external tools (Bazel, Buildifier, the language server)
 * are, and downloads missing ones.
 *
 * Lookup order per tool:
 * 1. An explicitly configured setting value is used as is. Nothing is ever
 * downloaded in its place.
 * 2. With the setting at `"auto"` (the default): the tool on the system PATH,
 * 3. then a managed copy of the pinned version in global storage,
 * 4. then a managed copy of an older version (while the pinned one is
 * downloaded in the background),
 * 5. else the user is offered a download (`bazel.externalTools.autoDownload`).
 *
 * Settings are never written. The resolved state is kept in memory; only the
 * "Don't ask again" choices are persisted.
 */
export class ExternalToolRegistry implements vscode.Disposable {
  private readonly toolsConfig: ToolsConfig;
  private readonly platform: Platform | undefined;
  private readonly states = new Map<ToolKey, ToolState>();
  private readonly resolving = new Map<ToolKey, Promise<ToolState>>();
  private readonly downloads = new Map<ToolKey, Promise<void>>();
  /** Tools a feature asked for, which may be offered for download. */
  private readonly requested = new Set<ToolKey>();
  /** Tools the user was already asked about in this session. */
  private readonly offered = new Set<ToolKey>();
  /** Tools to offer once a Bazel workspace is open. */
  private readonly pendingOffers = new Set<ToolKey>();
  private readonly changeEmitter = new vscode.EventEmitter<ToolStateChange>();
  private readonly disposables: vscode.Disposable[] = [];
  private lastFocusRecheck = 0;

  /** Fires whenever a tool's state changes. */
  readonly onDidChangeTool = this.changeEmitter.event;

  constructor(private readonly options: ToolRegistryOptions) {
    this.toolsConfig = options.toolsConfig ?? loadToolsConfig();
    this.platform = options.platform ?? detectPlatformOrUndefined();
    this.disposables.push(
      this.changeEmitter,
      vscode.workspace.onDidChangeConfiguration((e) =>
        this.onConfigurationChanged(e),
      ),
      vscode.window.onDidChangeWindowState((e) => {
        if (e.focused) {
          void this.recheckMissingTools();
        }
      }),
    );
  }

  /** Returns the current state, or `undefined` before the first resolution. */
  getState(key: ToolKey): ToolState | undefined {
    return this.states.get(key);
  }

  /** Returns the resolved tool, if any. */
  getResolvedTool(key: ToolKey): LocatedTool | undefined {
    const state = this.states.get(key);
    return state?.kind === "resolved" ? state.tool : undefined;
  }

  getToolConfig(key: ToolKey): ToolConfig {
    return this.toolsConfig[key];
  }

  /**
   * Resolves a tool for a feature that needs it. If it is missing, the user
   * is offered a download in the background (never awaited, so this does not
   * block extension activation on a notification).
   */
  async ensure(key: ToolKey): Promise<ToolState> {
    this.requested.add(key);
    const state = await this.resolve(key);
    if (state.kind === "missing") {
      void this.offer(key);
    }
    return state;
  }

  /**
   * Resolves a tool without offering a download. Cached unless `force`.
   */
  resolve(key: ToolKey, force = false): Promise<ToolState> {
    const pending = this.resolving.get(key);
    if (pending !== undefined) {
      return pending;
    }
    const current = this.states.get(key);
    if (current && (!force || current.kind === "downloading")) {
      return Promise.resolve(current);
    }
    const resolution = this.locate(key)
      .catch((error): ToolState => {
        registryLogger.logError(`Failed to locate ${key}`, false, error);
        return { kind: "missing", reason: String(error), configured: false };
      })
      .then((state) => {
        this.resolving.delete(key);
        // A download that started meanwhile owns the state.
        if (!this.downloads.has(key)) {
          this.setState(key, state);
        }
        return this.states.get(key) ?? state;
      });
    this.resolving.set(key, resolution);
    return resolution;
  }

  /** Offers the tools that were waiting for a Bazel workspace. */
  offerPendingTools(): void {
    if (!this.options.isBazelWorkspaceAvailable()) {
      return;
    }
    for (const key of [...this.pendingOffers]) {
      void this.offer(key);
    }
  }

  /**
   * Downloads the pinned version of a tool. Interactive downloads show their
   * progress and errors; background updates only log.
   */
  download(key: ToolKey, interactive = true): Promise<void> {
    const running = this.downloads.get(key);
    if (running !== undefined) {
      return running;
    }
    const config = this.toolsConfig[key];
    const { label } = TOOL_INFO[key];
    const previous = this.states.get(key);
    if (!this.platform || !config.assets[this.platform]) {
      return Promise.resolve();
    }
    const platform = this.platform;

    const run = async () => {
      if (interactive) {
        this.setState(key, { kind: "downloading" });
      }
      try {
        const title = `Downloading ${label} ${config.version}`;
        const download = this.options.download ?? downloadExternalTool;
        const toolPath = await vscode.window.withProgress(
          {
            location: interactive
              ? vscode.ProgressLocation.Notification
              : vscode.ProgressLocation.Window,
            title,
          },
          () =>
            download(
              key,
              config,
              this.options.toolsDir,
              platform,
              registryLogger,
            ),
        );
        this.downloads.delete(key);
        this.setState(key, {
          kind: "resolved",
          tool: {
            command: toolPath,
            location: toolPath,
            source: "managed",
            version: config.version,
          },
        });
      } catch (error) {
        this.downloads.delete(key);
        const message = error instanceof Error ? error.message : String(error);
        this.setState(
          key,
          previous?.kind === "resolved" || !interactive
            ? (previous ?? missing(`${label} was not found`))
            : missing(`Downloading ${label} failed`),
        );
        if (interactive) {
          void this.showDownloadError(key, message);
        }
      }
    };
    const promise = run();
    this.downloads.set(key, promise);
    return promise;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables.length = 0;
  }

  private async locate(key: ToolKey): Promise<ToolState> {
    const config = this.toolsConfig[key];
    const { label } = TOOL_INFO[key];
    const validate = this.options.validators?.[key] ?? (async () => true);

    const configured = (
      this.options.getConfiguredValue ?? getConfiguredToolValue
    )(config);
    if (configured !== undefined) {
      const settingKey = getToolSetting(config).key;
      const locate = this.options.locateConfigured ?? locateConfiguredTool;
      const found = await locate(key, configured);
      if (!found) {
        return missing(
          `${label} \`${configured}\` (${settingKey}) was not found`,
          true,
        );
      }
      if (!(await validate(found.command))) {
        return missing(
          `${label} \`${configured}\` (${settingKey}) is not compatible`,
          true,
        );
      }
      return { kind: "resolved", tool: found };
    }

    const locateOnPath = this.options.locateOnPath ?? locateToolOnPath;
    const onPath = await locateOnPath(config);
    if (onPath && (await validate(onPath.command))) {
      return { kind: "resolved", tool: onPath };
    }

    const managedPath =
      this.platform &&
      getManagedToolPath(this.options.toolsDir, key, config, this.platform);
    if (!managedPath) {
      return {
        kind: "unsupported",
        reason: `${label} was not found and has no release for ${this.platform ?? process.platform}`,
      };
    }
    if (await isExecutableFile(managedPath)) {
      return {
        kind: "resolved",
        tool: {
          command: managedPath,
          location: managedPath,
          source: "managed",
          version: config.version,
        },
      };
    }

    // A copy downloaded by an earlier extension release: keep using it and
    // update it in the background. The user agreed to a managed copy before.
    const outdated = await findOutdatedManagedTool(
      this.options.toolsDir,
      key,
      config,
      this.platform,
    );
    if (outdated) {
      if (this.autoDownloadMode() !== "never") {
        // Starts once the resolution is stored, see `resolve`.
        setTimeout(() => void this.download(key, false), 0);
      }
      return {
        kind: "resolved",
        tool: {
          command: outdated.path,
          location: outdated.path,
          source: "managed",
          version: outdated.version,
        },
      };
    }

    return missing(
      onPath
        ? `${label} at ${onPath.location} is not compatible`
        : `${label} was not found`,
      false,
    );
  }

  /** Tells the user about a missing tool, at most once per session. */
  private async offer(key: ToolKey): Promise<void> {
    if (this.offered.has(key)) {
      return;
    }
    if (!this.options.isBazelWorkspaceAvailable()) {
      this.pendingOffers.add(key);
      return;
    }
    this.pendingOffers.delete(key);
    const state = this.states.get(key);
    if (state?.kind !== "missing") {
      return;
    }
    this.offered.add(key);

    const config = this.toolsConfig[key];
    const { label, purpose } = TOOL_INFO[key];
    const settingKey = getToolSetting(config).key;

    if (state.configured) {
      registryLogger.logWarn(state.reason);
      const action = await vscode.window.showWarningMessage(
        `${state.reason}. Fix the setting to ${purpose}.`,
        "Open Settings",
      );
      if (action === "Open Settings") {
        await openSetting(settingKey);
      }
      return;
    }

    const mode = this.autoDownloadMode();
    if (mode === "never") {
      registryLogger.logInfo(
        `${state.reason}; not downloading it (${AUTO_DOWNLOAD_SETTING} is "never")`,
      );
      return;
    }
    if (mode === "always") {
      registryLogger.logInfo(`${state.reason}; downloading it`);
      await this.download(key);
      return;
    }
    if (this.options.globalState.get<boolean>(DONT_ASK_PREFIX + key)) {
      registryLogger.logInfo(
        `${state.reason}; not asking to download it (Don't Ask Again)`,
      );
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      `${state.reason}. Download ${label} ${config.version} to ${purpose}?`,
      "Download",
      "Configure Path",
      "Don't Ask Again",
    );
    switch (choice) {
      case "Download":
        await this.download(key);
        break;
      case "Configure Path":
        await openSetting(settingKey);
        break;
      case "Don't Ask Again":
        await this.options.globalState.update(DONT_ASK_PREFIX + key, true);
        break;
    }
  }

  private async showDownloadError(key: ToolKey, message: string) {
    const config = this.toolsConfig[key];
    const { label } = TOOL_INFO[key];
    const url = this.platform && getToolDownloadUrl(config, this.platform);
    const actions = url
      ? ["Configure Path", "Open Download Page"]
      : ["Configure Path"];
    const choice = await vscode.window.showErrorMessage(
      `Failed to download ${label}: ${message}`,
      ...actions,
    );
    if (choice === "Configure Path") {
      await openSetting(getToolSetting(config).key);
    } else if (choice === "Open Download Page" && url) {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    }
  }

  private onConfigurationChanged(e: vscode.ConfigurationChangeEvent) {
    const autoDownloadChanged = e.affectsConfiguration(AUTO_DOWNLOAD_SETTING);
    for (const key of TOOL_KEYS) {
      const settingChanged =
        affectsRenamedSetting(e, getToolSetting(this.toolsConfig[key]).key) ||
        (key === "Bazelisk" &&
          affectsRenamedSetting(e, "bazel.workspace.path"));
      const isMissing = this.states.get(key)?.kind === "missing";
      if (!settingChanged && !(autoDownloadChanged && isMissing)) {
        continue;
      }
      // A changed setting deserves a fresh offer.
      this.offered.delete(key);
      void this.resolve(key, true).then((state) => {
        if (state.kind === "missing" && this.requested.has(key)) {
          void this.offer(key);
        }
      });
    }
  }

  /**
   * A missing tool may have been installed meanwhile, so look again when the
   * window regains focus. Resolved tools are not probed again.
   */
  private async recheckMissingTools() {
    const now = Date.now();
    if (now - this.lastFocusRecheck < FOCUS_RECHECK_INTERVAL_MS) {
      return;
    }
    this.lastFocusRecheck = now;
    await Promise.all(
      TOOL_KEYS.filter((key) => this.states.get(key)?.kind === "missing").map(
        (key) => this.resolve(key, true),
      ),
    );
  }

  private autoDownloadMode(): AutoDownloadMode {
    return (this.options.getAutoDownloadMode ?? getAutoDownloadMode)();
  }

  private setState(key: ToolKey, state: ToolState) {
    const previous = this.states.get(key);
    if (previous && JSON.stringify(previous) === JSON.stringify(state)) {
      return;
    }
    this.states.set(key, state);
    registryLogger.logInfo(`${key}: ${describeToolState(state)}`);
    this.changeEmitter.fire({ key, state, initial: previous === undefined });
  }
}

function missing(reason: string, configured = false): ToolState {
  return { kind: "missing", reason, configured };
}

function detectPlatformOrUndefined(): Platform | undefined {
  try {
    return detectPlatform(registryLogger);
  } catch {
    return undefined;
  }
}

export function getAutoDownloadMode(): AutoDownloadMode {
  const mode = vscode.workspace
    .getConfiguration("bazel.externalTools")
    .get<string>("autoDownload");
  return mode === "always" || mode === "never" ? mode : "ask";
}

async function openSetting(settingKey: string) {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    settingKey,
  );
}

/** One line description of a tool state, for the log. */
export function describeToolState(state: ToolState): string {
  switch (state.kind) {
    case "resolved": {
      const { tool } = state;
      const version = tool.version ? ` ${tool.version}` : "";
      const source = {
        setting: "from settings",
        path: "from PATH",
        managed: "auto-downloaded",
      }[tool.source];
      return `${tool.location}${version} (${source})`;
    }
    case "missing":
    case "unsupported":
      return state.reason;
    case "downloading":
      return "downloading";
  }
}

/**
 * Creates the extension's tool registry (see `getToolRegistry`). Called once
 * in `activate()`, before any feature is created.
 */
export function registerToolRegistry(
  context: vscode.ExtensionContext,
  options: Omit<ToolRegistryOptions, "toolsDir" | "globalState">,
): ExternalToolRegistry {
  const registry = new ExternalToolRegistry({
    toolsDir: path.join(context.globalStorageUri.fsPath, "external-tools"),
    globalState: context.globalState,
    ...options,
  });
  setToolRegistry(registry);
  context.subscriptions.push(registry, {
    dispose: () => setToolRegistry(undefined),
  });
  return registry;
}
