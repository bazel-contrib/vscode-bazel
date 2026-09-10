import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { BazelCompletionItemProvider } from "../src/completion-provider/bazel_completion_provider";
import { BazelWorkspaceInfo } from "../src/bazel";
import * as sinon from "sinon";

describe("BazelCompletionItemProvider", () => {
  let sandbox: sinon.SinonSandbox;
  const testWorkspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(async () => {
    sandbox.restore();
    await vscode.workspace
      .getConfiguration("bazel")
      .update("workspacePath", undefined, vscode.ConfigurationTarget.Workspace);
  });

  it("should return completion items filtered by workspace", async () => {
    const provider = new BazelCompletionItemProvider();

    // Populate targetsMap manually for testing provideCompletionItems
    const workspacePath1 = "/path/to/workspace1";
    const workspacePath2 = "/path/to/workspace2";

    (provider as any).targetsMap.set(workspacePath1, [
      "//pkg1:target1",
      "//pkg1:target2",
      "//pkg2:target3",
    ]);
    (provider as any).targetsMap.set(workspacePath2, [
      "//other_pkg:other_target",
    ]);

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

    const position = new vscode.Position(0, 20);

    const results = provider.provideCompletionItems(mockDocument, position);

    assert.ok(results);
    assert.strictEqual(results.length, 2);

    // We expect completion items with folder/file label names
    const labels = results.map((item) => item.label);
    assert.ok(labels.includes("target1"));
    assert.ok(labels.includes("target2"));
  });

  it("uses the pinned root cache in a nested module", async () => {
    await vscode.workspace
      .getConfiguration("bazel")
      .update(
        "workspacePath",
        testWorkspacePath,
        vscode.ConfigurationTarget.Workspace,
      );

    const nestedDocumentUri = vscode.Uri.file(
      path.join(testWorkspacePath, "nested_module", "BUILD"),
    );
    const workspaceFolder =
      vscode.workspace.getWorkspaceFolder(nestedDocumentUri);
    assert.ok(workspaceFolder);
    const staticallyResolvedWorkspace =
      BazelWorkspaceInfo.fromWorkspaceFolder(workspaceFolder);
    assert.ok(staticallyResolvedWorkspace);

    const provider = new BazelCompletionItemProvider();
    (provider as any).targetsMap.set(
      staticallyResolvedWorkspace.bazelWorkspacePath,
      ["//pkg1:target1", "//pkg1:target2"],
    );
    const nestedDocument = {
      uri: nestedDocumentUri,
      lineAt: () => ({ text: '    srcs = ["//pkg1:' }),
    } as unknown as vscode.TextDocument;

    const results = provider.provideCompletionItems(
      nestedDocument,
      new vscode.Position(0, 20),
    );

    assert.deepStrictEqual(
      results.map((item) => item.label),
      ["target1", "target2"],
    );
    assert.strictEqual(
      BazelWorkspaceInfo.fromDocument(nestedDocument)?.bazelWorkspacePath,
      staticallyResolvedWorkspace.bazelWorkspacePath,
    );
  });
});
