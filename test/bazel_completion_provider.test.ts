import * as assert from "assert";
import * as vscode from "vscode";
import { BazelCompletionItemProvider } from "../src/completion-provider/bazel_completion_provider";

describe("BazelCompletionItemProvider", () => {
  describe("buildQuery", () => {
    afterEach(async () => {
      await vscode.workspace
        .getConfiguration("bazel.completion")
        .update("queryScope", undefined, vscode.ConfigurationTarget.Workspace);
    });

    it("should query entire workspace when queryScope is empty", () => {
      const provider = new BazelCompletionItemProvider();
      const query = (provider as any).buildQuery();
      assert.strictEqual(query, "kind('.* rule', ...)");
    });

    it("should scope query to single pattern when queryScope has one entry", async () => {
      await vscode.workspace
        .getConfiguration("bazel.completion")
        .update(
          "queryScope",
          ["//src/..."],
          vscode.ConfigurationTarget.Workspace,
        );
      const provider = new BazelCompletionItemProvider();
      const query = (provider as any).buildQuery();
      assert.strictEqual(query, "kind('.* rule', //src/...)");
    });

    it("should join multiple patterns with ' + ' when queryScope has multiple entries", async () => {
      await vscode.workspace
        .getConfiguration("bazel.completion")
        .update(
          "queryScope",
          ["//src/...", "//lib/..."],
          vscode.ConfigurationTarget.Workspace,
        );
      const provider = new BazelCompletionItemProvider();
      const query = (provider as any).buildQuery();
      assert.strictEqual(query, "kind('.* rule', //src/... + //lib/...)");
    });
  });
});
