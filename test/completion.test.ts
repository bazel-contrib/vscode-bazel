import * as assert from "assert";
import * as vscode from "vscode";
import { BazelCompletionItemProvider } from "../src/completion-provider/bazel_completion_provider";
import { BazelWorkspaceInfo } from "../src/bazel";
import * as sinon from "sinon";

describe("BazelCompletionItemProvider", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return completion items filtered by workspace", async () => {
    const provider = new BazelCompletionItemProvider();

    // Populate targetsMap manually for testing provideCompletionItems
    const workspacePath1 = "/path/to/workspace1";
    const workspacePath2 = "/path/to/workspace2";

    provider["targetsMap"].set(workspacePath1, [
      "//pkg1:target1",
      "//pkg1:target2",
      "//pkg2:target3",
    ]);
    provider["targetsMap"].set(workspacePath2, ["//other_pkg:other_target"]);

    // Stub BazelWorkspaceInfo.fromDocument
    const mockWorkspaceInfo = {
      bazelWorkspacePath: workspacePath1,
    } as BazelWorkspaceInfo;
    sandbox.stub(BazelWorkspaceInfo, "fromDocument").returns(mockWorkspaceInfo);

    // Mock vscode.TextDocument
    const mockDocument = {
      lineAt: (pos: vscode.Position) => ({
        text: '    srcs = ["//pkg1:',
      }),
    } as any as vscode.TextDocument;

    const position = new vscode.Position(0, 21);

    const results = provider.provideCompletionItems(mockDocument, position);

    assert.ok(results);
    assert.strictEqual(results.length, 2);

    // We expect completion items with folder/file label names
    const labels = results.map((item) => item.label);
    assert.ok(labels.includes("target1"));
    assert.ok(labels.includes("target2"));
  });
});
