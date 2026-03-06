import * as vscode from "vscode";
import * as assert from "assert";
import * as sinon from "sinon";
import { CodeLensFeature } from "../src/codelens/code_lens_feature";
import { CodeLensProvider } from "../src/codelens/code_lens_provider";
import * as bazel_availability from "../src/bazel/bazel_availability";

describe("CodeLensFeature", () => {
  let codeLensFeature: CodeLensFeature;
  let sandbox: sinon.SinonSandbox;
  let mockContext: vscode.ExtensionContext;
  let mockDisposable: vscode.Disposable;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockDisposable = {
      dispose: () => {
        /* empty */
      },
    } as vscode.Disposable;
    mockContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    codeLensFeature = new CodeLensFeature(mockContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("enable", () => {
    it("returns false when not in a Bazel workspace", () => {
      sandbox
        .stub(bazel_availability, "checkBazelWorkspaceAvailable")
        .returns(false);

      const result = codeLensFeature.enable(mockContext);

      assert.strictEqual(result, false);
    });

    it("returns false when Bazel executable is not available", () => {
      sandbox
        .stub(bazel_availability, "checkBazelWorkspaceAvailable")
        .returns(true);
      sandbox.stub(bazel_availability, "checkBazelIsAvailable").returns(false);

      const result = codeLensFeature.enable(mockContext);

      assert.strictEqual(result, false);
    });

    it("returns true when all preconditions are met", () => {
      sandbox
        .stub(bazel_availability, "checkBazelWorkspaceAvailable")
        .returns(true);
      sandbox.stub(bazel_availability, "checkBazelIsAvailable").returns(true);
      const registerStub = sandbox
        .stub(vscode.languages, "registerCodeLensProvider")
        .returns(mockDisposable);
      const createWatcherStub = sandbox
        .stub(vscode.workspace, "createFileSystemWatcher")
        .returns({
          onDidChange: sinon.stub(),
        } as unknown as vscode.FileSystemWatcher);

      const result = codeLensFeature.enable(mockContext);

      // Assert that feature enables successfully
      assert.strictEqual(result, true);
      // Assert that disposables were added
      assert.ok((codeLensFeature as any).disposables.length > 0);
      // Assert that registerCodeLensProvider was called
      sinon.assert.calledWithMatch(
        registerStub,
        [{ pattern: "**/BUILD" }, { pattern: "**/BUILD.bazel" }],
        sinon.match.instanceOf(CodeLensProvider),
      );
      // Assert that createFileSystemWatcher was called
      sinon.assert.calledOnce(createWatcherStub);
    });
  });
});
