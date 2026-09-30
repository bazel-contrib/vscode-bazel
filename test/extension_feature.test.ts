import * as vscode from "vscode";
import * as assert from "assert";
import * as sinon from "sinon";
import { BaseExtensionFeature } from "../src/extension/extension_feature";

class TestExtensionFeature extends BaseExtensionFeature {
  constructor(context: vscode.ExtensionContext) {
    super("TestFeature", context);
  }

  protected async enable(context: vscode.ExtensionContext): Promise<boolean> {
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

  protected async enable(context: vscode.ExtensionContext): Promise<boolean> {
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

  /**
   * Stubs `vscode.workspace.getConfiguration` so that `<section>.enable`
   * reads as `enabled`. Returns a setter to change the value later on.
   */
  function stubEnableSetting(
    section: string,
    enabled: boolean,
  ): { stub: sinon.SinonStub; set: (value: boolean) => void } {
    let value = enabled;
    const stub = sandbox
      .stub(vscode.workspace, "getConfiguration")
      .withArgs(section)
      .returns({
        get: (name: string) => (name === "enable" ? value : undefined),
      } as any);
    return {
      stub,
      set: (v) => {
        value = v;
      },
    };
  }

  describe("create", () => {
    it("creates and initializes the feature", async () => {
      const { stub: configStub } = stubEnableSetting("bazel.testFeature", true);
      const setContextStub = sandbox.stub(vscode.commands, "executeCommand");

      const feature = await TestExtensionFeature.create(mockContext);

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
    it("enables when config is true and not enabled", async () => {
      stubEnableSetting("bazel.testFeature", true);
      const setContextStub = sandbox.stub(vscode.commands, "executeCommand");

      await (testFeature as any).onConfigurationChanged();

      assert.strictEqual((testFeature as any).isEnabled, true);
      assert.ok((testFeature as any).disposables.length > 0);
      sinon.assert.calledWith(
        setContextStub,
        "setContext",
        "bazel.feature.TestFeature.enabled",
        true,
      );
    });

    it("disables when config is false and enabled", async () => {
      // First enable
      const setting = stubEnableSetting("bazel.testFeature", true);
      await (testFeature as any).onConfigurationChanged();
      assert.strictEqual((testFeature as any).isEnabled, true);

      // Then disable
      setting.set(false);
      const setContextStub = sandbox.stub(vscode.commands, "executeCommand");
      await (testFeature as any).onConfigurationChanged();

      assert.strictEqual((testFeature as any).isEnabled, false);
      assert.strictEqual((testFeature as any).disposables.length, 0);
      sinon.assert.calledWith(
        setContextStub,
        "setContext",
        "bazel.feature.TestFeature.enabled",
        false,
      );
    });

    it("does not enable if enable returns false", async () => {
      stubEnableSetting("bazel.failingTestFeature", true);
      const showMessageStub = sandbox
        .stub(vscode.window, "showErrorMessage")
        .resolves();

      await (failingFeature as any).onConfigurationChanged();

      assert.strictEqual((failingFeature as any).isEnabled, false);
      sinon.assert.calledWith(
        showMessageStub,
        "Failed to enable FailingTestFeature",
      );
    });
  });

  describe("disable", () => {
    it("disposes all disposables", async () => {
      // Enable first
      stubEnableSetting("bazel.testFeature", true);
      await (testFeature as any).onConfigurationChanged();
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
