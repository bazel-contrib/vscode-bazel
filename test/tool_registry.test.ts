import * as assert from "assert";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as sinon from "sinon";
import * as vscode from "vscode";

import {
  ToolConfig,
  ToolKey,
  loadToolsConfig,
} from "../src/external-tools/tool_config";
import { getManagedToolPath } from "../src/external-tools/tool_downloader";
import { LocatedTool } from "../src/external-tools/tool_locator";
import {
  AutoDownloadMode,
  ExternalToolRegistry,
  ToolRegistryOptions,
  ToolStateChange,
} from "../src/external-tools/tool_registry";

class FakeMemento implements vscode.Memento {
  private readonly values = new Map<string, unknown>();

  keys(): readonly string[] {
    return [...this.values.keys()];
  }

  get<T>(key: string, defaultValue?: T): T {
    return (this.values.has(key) ? this.values.get(key) : defaultValue) as T;
  }

  update(key: string, value: unknown): Thenable<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

/** Polls until `condition` holds; offers run in the background. */
async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(condition(), "condition not met in time");
}

describe("ExternalToolRegistry", () => {
  const toolsConfig = loadToolsConfig();
  const pinnedVersion = toolsConfig.Buildifier.version;
  let sandbox: sinon.SinonSandbox;
  let toolsDir: string;
  let globalState: FakeMemento;
  let registries: ExternalToolRegistry[];
  let showWarningStub: sinon.SinonStub;
  let showErrorStub: sinon.SinonStub;
  let downloadStub: sinon.SinonStub;

  // Inputs of the registry, set per test.
  let workspaceAvailable: boolean;
  let configuredValue: string | undefined;
  let autoDownloadMode: AutoDownloadMode;
  let onPath: LocatedTool | undefined;
  let configuredTool: LocatedTool | undefined;

  function createRegistry(
    overrides: Partial<ToolRegistryOptions> = {},
  ): ExternalToolRegistry {
    const registry = new ExternalToolRegistry({
      toolsDir,
      globalState,
      isBazelWorkspaceAvailable: () => workspaceAvailable,
      platform: "linux-amd64",
      getConfiguredValue: () => configuredValue,
      getAutoDownloadMode: () => autoDownloadMode,
      locateConfigured: async () => configuredTool,
      locateOnPath: async () => onPath,
      download: downloadStub,
      ...overrides,
    });
    registries.push(registry);
    return registry;
  }

  async function createManagedCopy(
    key: ToolKey,
    config: ToolConfig,
  ): Promise<string> {
    const managedPath = getManagedToolPath(
      toolsDir,
      key,
      config,
      "linux-amd64",
    );
    await fs.mkdir(path.dirname(managedPath), { recursive: true });
    await fs.writeFile(managedPath, "#!/bin/sh\n", { mode: 0o755 });
    return managedPath;
  }

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    toolsDir = await fs.mkdtemp(path.join(os.tmpdir(), "vscode-bazel-tools-"));
    globalState = new FakeMemento();
    registries = [];
    workspaceAvailable = true;
    configuredValue = undefined;
    autoDownloadMode = "ask";
    onPath = undefined;
    configuredTool = undefined;
    showWarningStub = sandbox
      .stub(vscode.window, "showWarningMessage")
      .resolves(undefined);
    showErrorStub = sandbox
      .stub(vscode.window, "showErrorMessage")
      .resolves(undefined);
    sandbox
      .stub(vscode.window, "withProgress")
      .callsFake((_options, task) =>
        Promise.resolve(
          task(
            { report: () => undefined },
            new vscode.CancellationTokenSource().token,
          ),
        ),
      );
    downloadStub = sandbox
      .stub()
      .callsFake(async (key: ToolKey, config: ToolConfig) =>
        createManagedCopy(key, config),
      );
  });

  afterEach(async () => {
    registries.forEach((r) => r.dispose());
    sandbox.restore();
    await fs.rm(toolsDir, { recursive: true, force: true });
  });

  describe("resolution", () => {
    it("prefers the tool on the system PATH", async () => {
      onPath = {
        command: "buildifier",
        location: "/usr/bin/buildifier",
        source: "path",
      };
      await createManagedCopy("Buildifier", toolsConfig.Buildifier);
      const registry = createRegistry();

      const state = await registry.ensure("Buildifier");

      assert.deepStrictEqual(state, { kind: "resolved", tool: onPath });
      sinon.assert.notCalled(showWarningStub);
    });

    it("uses the managed copy of the pinned version", async () => {
      const managedPath = await createManagedCopy(
        "Buildifier",
        toolsConfig.Buildifier,
      );
      const registry = createRegistry();

      const state = await registry.ensure("Buildifier");

      assert.deepStrictEqual(state, {
        kind: "resolved",
        tool: {
          command: managedPath,
          location: managedPath,
          source: "managed",
          version: pinnedVersion,
        },
      });
    });

    it("skips a tool on the PATH that fails validation", async () => {
      onPath = {
        command: "buildifier",
        location: "/usr/bin/buildifier",
        source: "path",
      };
      const registry = createRegistry({
        validators: { Buildifier: async () => false },
      });

      const state = await registry.resolve("Buildifier");

      assert.strictEqual(state.kind, "missing");
      assert.match(
        (state as { reason: string }).reason,
        /\/usr\/bin\/buildifier is not compatible/,
      );
    });

    it("uses an explicitly configured tool as is", async () => {
      configuredValue = "tools/buildifier";
      configuredTool = {
        command: "/ws/tools/buildifier",
        location: "/ws/tools/buildifier",
        source: "setting",
      };
      onPath = {
        command: "buildifier",
        location: "/usr/bin/buildifier",
        source: "path",
      };
      const registry = createRegistry();

      const state = await registry.resolve("Buildifier");

      assert.deepStrictEqual(state, { kind: "resolved", tool: configuredTool });
    });

    it("locates a tool only once for concurrent requests", async () => {
      const locateOnPath = sandbox.stub().resolves(undefined);
      const registry = createRegistry({ locateOnPath });

      await Promise.all([
        registry.resolve("Bazelisk"),
        registry.resolve("Bazelisk"),
        registry.ensure("Bazelisk"),
      ]);

      sinon.assert.calledOnce(locateOnPath);
    });

    it("reports a platform without release as unsupported", async () => {
      const registry = createRegistry({ platform: "win32-arm64" });

      const state = await registry.ensure("Starlark Language Server");

      assert.strictEqual(state.kind, "unsupported");
      sinon.assert.notCalled(showWarningStub);
    });

    it("keeps using an outdated managed copy while updating it", async () => {
      const outdatedConfig = { ...toolsConfig.Buildifier, version: "v0.0.1" };
      const outdatedPath = await createManagedCopy(
        "Buildifier",
        outdatedConfig,
      );
      const registry = createRegistry();
      const changes: ToolStateChange[] = [];
      registry.onDidChangeTool((change) => changes.push(change));

      const state = await registry.ensure("Buildifier");

      assert.deepStrictEqual(state, {
        kind: "resolved",
        tool: {
          command: outdatedPath,
          location: outdatedPath,
          source: "managed",
          version: "v0.0.1",
        },
      });
      await waitFor(
        () => registry.getResolvedTool("Buildifier")?.version === pinnedVersion,
      );
      sinon.assert.notCalled(showWarningStub);
      assert.strictEqual(changes.length, 2);
      assert.strictEqual(changes[1].initial, false);
    });
  });

  describe("offering downloads", () => {
    it("downloads a missing tool when the user agrees", async () => {
      showWarningStub.resolves("Download");
      const registry = createRegistry();
      const changes: ToolStateChange[] = [];
      registry.onDidChangeTool((change) => changes.push(change));

      const state = await registry.ensure("Buildifier");

      assert.strictEqual(state.kind, "missing");
      await waitFor(() => registry.getResolvedTool("Buildifier") !== undefined);
      assert.strictEqual(
        registry.getResolvedTool("Buildifier")?.source,
        "managed",
      );
      sinon.assert.calledOnce(downloadStub);
      sinon.assert.calledWithMatch(
        showWarningStub,
        /Buildifier was not found. Download Buildifier/,
        "Download",
        "Configure Path",
        "Don't Ask Again",
      );
      assert.deepStrictEqual(
        changes.map((c) => [c.state.kind, c.initial]),
        [
          ["missing", true],
          ["downloading", false],
          ["resolved", false],
        ],
      );
    });

    it("asks only once per session", async () => {
      const registry = createRegistry();

      await registry.ensure("Buildifier");
      await registry.ensure("Buildifier");
      await waitFor(() => showWarningStub.called);

      sinon.assert.calledOnce(showWarningStub);
    });

    it("does not ask outside of a Bazel workspace", async () => {
      workspaceAvailable = false;
      const registry = createRegistry();

      await registry.ensure("Bazelisk");
      await new Promise((resolve) => setTimeout(resolve, 20));
      sinon.assert.notCalled(showWarningStub);

      workspaceAvailable = true;
      registry.offerPendingTools();

      await waitFor(() => showWarningStub.calledOnce);
    });

    it("remembers Don't Ask Again", async () => {
      showWarningStub.resolves("Don't Ask Again");
      await createRegistry().ensure("Buildifier");
      await waitFor(() => globalState.keys().length > 0);
      showWarningStub.resetHistory();

      await createRegistry().ensure("Buildifier");
      await new Promise((resolve) => setTimeout(resolve, 20));

      sinon.assert.notCalled(showWarningStub);
      sinon.assert.notCalled(downloadStub);
    });

    it("downloads without asking when set to always", async () => {
      autoDownloadMode = "always";
      const registry = createRegistry();

      await registry.ensure("Buildifier");

      await waitFor(() => registry.getResolvedTool("Buildifier") !== undefined);
      sinon.assert.notCalled(showWarningStub);
    });

    it("never downloads when set to never", async () => {
      autoDownloadMode = "never";
      const registry = createRegistry();

      await registry.ensure("Buildifier");
      await new Promise((resolve) => setTimeout(resolve, 20));

      sinon.assert.notCalled(showWarningStub);
      sinon.assert.notCalled(downloadStub);
    });

    it("never downloads in place of an explicit setting", async () => {
      autoDownloadMode = "always";
      configuredValue = "tools/buildifier";
      const registry = createRegistry();

      const state = await registry.ensure("Buildifier");

      assert.deepStrictEqual(state, {
        kind: "missing",
        reason:
          "Buildifier `tools/buildifier` (bazel.buildifier.executable) " +
          "was not found",
        configured: true,
      });
      await waitFor(() => showWarningStub.called);
      sinon.assert.calledWithMatch(showWarningStub, /./, "Open Settings");
      sinon.assert.notCalled(downloadStub);
    });

    it("reports a failed download", async () => {
      showWarningStub.resolves("Download");
      downloadStub.rejects(new Error("HTTP 503"));
      const registry = createRegistry();

      await registry.ensure("Buildifier");

      await waitFor(() => showErrorStub.called);
      sinon.assert.calledWithMatch(
        showErrorStub,
        /Failed to download Buildifier: HTTP 503/,
        "Configure Path",
        "Open Download Page",
      );
      assert.strictEqual(registry.getState("Buildifier")?.kind, "missing");
    });
  });
});
