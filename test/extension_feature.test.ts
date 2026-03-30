import * as vscode from "vscode";
import * as assert from "assert";
import * as sinon from "sinon";
import { BaseExtensionFeature } from "../src/extension/extension_feature";

class TestExtensionFeature extends BaseExtensionFeature {
  constructor(context: vscode.ExtensionContext) {
    super("TestFeature", context);
  }

  protected enable(context: vscode.ExtensionContext): boolean {
    this.disposables.push({
      dispose: () => {
        /* empty */
      },
    } as vscode.Disposable);
    return true;
  }
}

class FailingTestFeature extends BaseExtensionFeature {
  constructor(context: vscode.ExtensionContext) {
    super("FailingTestFeature", context);
  }

  protected enable(context: vscode.ExtensionContext): boolean {
    return false;
  }
}

describe("BaseExtensionFeature", () => {
  let testFeature: TestExtensionFeature;
  let failingFeature: FailingTestFeature;
  let sandbox: sinon.SinonSandbox;
  let mockContext: vscode.ExtensionContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    testFeature = new TestExtensionFeature(mockContext);
    failingFeature = new FailingTestFeature(mockContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("create", () => {
    it("creates and initializes the feature", () => {
      const configStub = sandbox
        .stub(vscode.workspace, "getConfiguration")
        .returns({
          get: sinon.stub().withArgs("bazel.enableTestFeature").returns(true),
        } as any);
      const setContextStub = sandbox.stub(vscode.commands, "executeCommand");

      const feature = TestExtensionFeature.create(mockContext);

      sinon.assert.calledOnce(configStub);
      assert.ok((feature as any).disposables.length > 0);
      sinon.assert.calledWith(
        setContextStub,
        "setContext",
        "bazel.feature.TestFeature.enabled",
        true,
      );
    });
  });

  describe("onConfigurationChanged", () => {
    it("enables when config is true and not enabled", () => {
      const config = {
        get: sinon.stub().withArgs("bazel.enableTestFeature").returns(true),
      } as any;
      const setContextStub = sandbox.stub(vscode.commands, "executeCommand");

      (testFeature as any).onConfigurationChanged(config);

      assert.strictEqual((testFeature as any).isEnabled, true);
      assert.ok((testFeature as any).disposables.length > 0);
      sinon.assert.calledWith(
        setContextStub,
        "setContext",
        "bazel.feature.TestFeature.enabled",
        true,
      );
    });

    it("disables when config is false and enabled", () => {
      // First enable
      const configTrue = {
        get: sinon.stub().withArgs("bazel.enableTestFeature").returns(true),
      } as any;
      (testFeature as any).onConfigurationChanged(configTrue);
      assert.strictEqual((testFeature as any).isEnabled, true);

      // Then disable
      const configFalse = {
        get: sinon.stub().withArgs("bazel.enableTestFeature").returns(false),
      } as any;
      const setContextStub = sandbox.stub(vscode.commands, "executeCommand");
      (testFeature as any).onConfigurationChanged(configFalse);

      assert.strictEqual((testFeature as any).isEnabled, false);
      assert.strictEqual((testFeature as any).disposables.length, 0);
      sinon.assert.calledWith(
        setContextStub,
        "setContext",
        "bazel.feature.TestFeature.enabled",
        false,
      );
    });

    it("does not enable if enable returns false", () => {
      const config = {
        get: sinon
          .stub()
          .withArgs("bazel.enableFailingTestFeature")
          .returns(true),
      } as any;
      const showMessageStub = sandbox
        .stub(vscode.window, "showErrorMessage")
        .resolves();

      (failingFeature as any).onConfigurationChanged(config);

      assert.strictEqual((failingFeature as any).isEnabled, false);
      sinon.assert.calledWith(
        showMessageStub,
        "Failed to enable FailingTestFeature",
      );
    });
  });

  describe("disable", () => {
    it("disposes all disposables", () => {
      // Enable first
      const config = {
        get: sinon.stub().withArgs("bazel.enableTestFeature").returns(true),
      } as any;
      (testFeature as any).onConfigurationChanged(config);
      assert.ok((testFeature as any).disposables.length > 0);

      const disposeSpy = sandbox.spy(
        (testFeature as any).disposables[0],
        "dispose",
      );

      (testFeature as any).disable();

      sinon.assert.calledOnce(disposeSpy);
      assert.strictEqual((testFeature as any).disposables.length, 0);
    });
  });

  describe("dispose", () => {
    it("disables and disposes config callback", () => {
      const configCallbackDisposeSpy = sandbox.spy(
        (testFeature as any).configCallback,
        "dispose",
      );

      testFeature.dispose();

      sinon.assert.calledOnce(configCallbackDisposeSpy);
    });
  });
});
