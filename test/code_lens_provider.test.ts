// test/code_lens_provider.test.ts
import * as vscode from "vscode";
import * as assert from "assert";
import * as sinon from "sinon";
import * as bazelUtils from "../src/bazel/bazel_utils";
import { CodeLensProvider } from "../src/codelens/code_lens_provider";
import { BazelWorkspaceInfo } from "../src/bazel";
import { CodeLensBuilder } from "../src/codelens/code_lens_builder";
import { blaze_query } from "../src/protos";

describe("CodeLensProvider", () => {
  let provider: CodeLensProvider;
  let sandbox: sinon.SinonSandbox;
  let mockDocument: vscode.TextDocument;
  let mockWorkspaceInfo: BazelWorkspaceInfo;
  let mockCodeLensBuilder: {
    buildCodeLenses: sinon.SinonStub;
  };

  // Helper function to create test document
  function createTestDocument(overrides: Partial<vscode.TextDocument> = {}) {
    return {
      isDirty: false,
      uri: {
        fsPath: "/workspace/path/to/BUILD",
        scheme: "file",
        toString: () => "file:///workspace/path/to/BUILD",
      } as vscode.Uri,
      fileName: "/workspace/path/to/BUILD",
      lineCount: 10,
      getText: () => 'cc_binary(name = "test")',
      ...overrides,
    } as unknown as vscode.TextDocument;
  }

  // Helper function to create workspace info
  function createWorkspaceInfo(overrides: Partial<BazelWorkspaceInfo> = {}) {
    return {
      bazelWorkspacePath: "/workspace",
      workspacePath: "/workspace",
      bazelExecutable: "bazel",
      workspaceFolder: {
        uri: vscode.Uri.file("/workspace"),
        name: "workspace",
        index: 0,
      },
      ...overrides,
    } as unknown as BazelWorkspaceInfo;
  }

  // Setup common stubs before each test
  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Create default test document and workspace info
    mockDocument = createTestDocument();
    mockWorkspaceInfo = createWorkspaceInfo();

    // Create a mock builder
    mockCodeLensBuilder = {
      buildCodeLenses: sandbox.stub().returns([]),
    };

    // Stub the CodeLensBuilder class to return our mock instance
    sandbox
      .stub(CodeLensBuilder.prototype, "buildCodeLenses")
      .callsFake(mockCodeLensBuilder.buildCodeLenses as any);

    // Create the provider after common stubs are in place
    provider = new CodeLensProvider();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("provideCodeLenses", () => {
    it("returns empty array when document is dirty", async () => {
      const dirtyDoc = { ...mockDocument, isDirty: true };
      const result = await provider.provideCodeLenses(dirtyDoc);
      assert.strictEqual(result.length, 0);
    });

    it("returns empty array when not in a Bazel workspace", async () => {
      sandbox.stub(BazelWorkspaceInfo, "fromDocument").returns(undefined);
      const result = await provider.provideCodeLenses(mockDocument);
      assert.strictEqual(result.length, 0);
    });

    it("propagates parameters correctly", async () => {
      sandbox
        .stub(BazelWorkspaceInfo, "fromDocument")
        .returns(mockWorkspaceInfo);

      const mockTargets = blaze_query.QueryResult.create({
        target: [
          {
            type: blaze_query.Target.Discriminator.RULE,
            rule: {
              name: "test",
              ruleClass: "cc_binary",
              location: "/workspace/path/to/BUILD:1:1",
            },
          },
        ],
      });

      const getTargetsStub = sandbox
        .stub(bazelUtils, "getTargetsForBuildFile")
        .resolves(mockTargets);

      await provider.provideCodeLenses(mockDocument);

      sinon.assert.calledWith(
        getTargetsStub,
        "bazel",
        "/workspace",
        "/workspace/path/to/BUILD",
      );
      sinon.assert.calledWith(
        mockCodeLensBuilder.buildCodeLenses,
        mockWorkspaceInfo,
        mockTargets,
      );
    });

    it("handles errors from getTargetsForBuildFile", async () => {
      sandbox
        .stub(BazelWorkspaceInfo, "fromDocument")
        .returns(mockWorkspaceInfo);
      const error = new Error("Bazel error");
      sandbox.stub(bazelUtils, "getTargetsForBuildFile").rejects(error);

      const result = await provider.provideCodeLenses(mockDocument);
      assert.strictEqual(result.length, 0);
    });
  });

  describe("refresh", () => {
    it("triggers onDidChangeCodeLenses event", (done) => {
      provider.onDidChangeCodeLenses(() => {
        done();
      });
      provider.refresh();
    });
  });
});
