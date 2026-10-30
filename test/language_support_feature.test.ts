import * as vscode from "vscode";
import * as assert from "assert";
import * as sinon from "sinon";
import { BazelCompletionItemProvider } from "../src/completion-provider";
import { ToolKey } from "../src/external-tools/tool_config";
import {
  ExternalToolRegistry,
  ToolState,
  ToolStateChange,
} from "../src/external-tools/tool_registry";
import { setToolRegistry } from "../src/external-tools/tool_registry_instance";
import { LanguageSupportFeature } from "../src/language_support/language_support_feature";

describe("LanguageSupportFeature", () => {
  const missing: ToolState = {
    kind: "missing",
    reason: "not found",
    configured: false,
  };
  const resolved: ToolState = {
    kind: "resolved",
    tool: { command: "bazel", location: "/usr/bin/bazel", source: "path" },
  };
  let sandbox: sinon.SinonSandbox;
  let toolStates: Record<ToolKey, ToolState>;
  let toolChanges: vscode.EventEmitter<ToolStateChange>;
  let scheduleRefreshStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    toolStates = {
      Bazelisk: missing,
      Buildifier: missing,
      "Starlark Language Server": missing,
    };
    toolChanges = new vscode.EventEmitter<ToolStateChange>();
    setToolRegistry({
      onDidChangeTool: toolChanges.event,
      ensure: async (key: ToolKey) => toolStates[key],
      resolve: async (key: ToolKey) => toolStates[key],
    } as unknown as ExternalToolRegistry);
    // `bazel.languageSupport.enable` defaults to true.
    sandbox.stub(vscode.commands, "executeCommand");
    scheduleRefreshStub = sandbox.stub(
      BazelCompletionItemProvider.prototype,
      "scheduleRefresh",
    );
  });

  afterEach(() => {
    setToolRegistry(undefined);
    toolChanges.dispose();
    sandbox.restore();
  });

  it("does not query completion targets while Bazel is missing", async () => {
    const feature = await LanguageSupportFeature.create(
      {} as vscode.ExtensionContext,
    );

    sinon.assert.notCalled(scheduleRefreshStub);
    feature.dispose();
  });

  it("queries completion targets once Bazel becomes available", async () => {
    const feature = await LanguageSupportFeature.create(
      {} as vscode.ExtensionContext,
    );

    toolStates.Bazelisk = resolved;
    toolChanges.fire({ key: "Bazelisk", state: resolved, initial: false });
    await (feature as any).pendingConfigChange;

    sinon.assert.calledOnce(scheduleRefreshStub);
    feature.dispose();
  });
});
