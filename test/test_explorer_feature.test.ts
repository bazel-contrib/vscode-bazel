import * as vscode from "vscode";
import * as assert from "assert";
import * as sinon from "sinon";
import {
  TestExplorerFeature,
  showLcovCoverage,
} from "../src/test-explorer/test_explorer_feature";
import * as bazel_availability from "../src/bazel/bazel_availability";

describe("TestExplorerFeature", () => {
  let testExplorerFeature: TestExplorerFeature;
  let sandbox: sinon.SinonSandbox;
  let mockContext: vscode.ExtensionContext;
  let mockTestController: vscode.TestController;
  let mockRunProfile: vscode.TestRunProfile;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockRunProfile = {} as vscode.TestRunProfile;
    mockTestController = {
      dispose: () => {
        /* empty */
      },
      createRunProfile: sandbox.stub().returns(mockRunProfile),
    } as unknown as vscode.TestController;
    mockContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    testExplorerFeature = new TestExplorerFeature(mockContext);
  });

  afterEach(async () => {
    // Make sure a disabled instance doesn't linger as the "active" one for
    // the module-level `showLcovCoverage` delegate used by later tests.
    (testExplorerFeature as any).disable();
    sandbox.restore();
  });

  describe("enable", () => {
    it("returns false when Bazel executable is not available", async () => {
      sandbox.stub(bazel_availability, "checkBazelIsAvailable").returns(false);

      const result = await (testExplorerFeature as any).enable(mockContext);

      assert.strictEqual(result, false);
    });

    it("returns true and registers a controller when available", async () => {
      sandbox.stub(bazel_availability, "checkBazelIsAvailable").returns(true);
      const createControllerStub = sandbox
        .stub(vscode.tests, "createTestController")
        .returns(mockTestController);

      const result = await (testExplorerFeature as any).enable(mockContext);

      assert.strictEqual(result, true);
      sinon.assert.calledWithMatch(
        createControllerStub,
        "bazel-coverage",
        "Bazel Coverage",
      );
      assert.strictEqual(
        testExplorerFeature.getTestController(),
        mockTestController,
      );
    });
  });

  describe("showLcovCoverage", () => {
    it("logs a warning and does nothing when disabled", async () => {
      // Never enabled, so testController stays undefined.
      await testExplorerFeature.showLcovCoverage("desc", "/base", "");
      // No assertion needed beyond "it doesn't throw" - absence of a test
      // controller must not crash a `bazel coverage` run.
    });

    it("creates a test run and adds coverage once enabled", async () => {
      sandbox.stub(bazel_availability, "checkBazelIsAvailable").returns(true);
      sandbox
        .stub(vscode.tests, "createTestController")
        .returns(mockTestController);
      const mockRun = {
        appendOutput: sandbox.stub(),
        addCoverage: sandbox.stub(),
        end: sandbox.stub(),
      };
      (mockTestController as any).createTestRun = sandbox
        .stub()
        .returns(mockRun);

      await (testExplorerFeature as any).enable(mockContext);
      await testExplorerFeature.showLcovCoverage("desc", "/base", "");

      sinon.assert.calledOnce(mockRun.end);
    });
  });

  describe("module-level showLcovCoverage delegate", () => {
    it("does not throw when no feature instance has been enabled", async () => {
      await showLcovCoverage("desc", "/base", "");
    });
  });
});
