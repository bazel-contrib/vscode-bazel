import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import { BazelQuery, BazelWorkspaceInfo } from "../src/bazel";
import {
  BazelGotoDefinitionProvider,
  LABEL_REGEX,
} from "../src/definition/bazel_goto_definition_provider";
import { blaze_query } from "../src/protos";

describe("LABEL_REGEX", () => {
  function match(input: string): string | undefined {
    const m = LABEL_REGEX.exec(input);
    return m ? m[1] : undefined;
  }

  describe("valid labels", () => {
    it("matches a simple package-relative label", () => {
      assert.strictEqual(match('"//pkg:target"'), "//pkg:target");
    });

    it("matches a label with only a package path", () => {
      assert.strictEqual(match('"//pkg/sub"'), "//pkg/sub");
    });

    it("matches an external repository label", () => {
      assert.strictEqual(match('"@repo//pkg:target"'), "@repo//pkg:target");
    });

    it("matches an external repository label with no package", () => {
      assert.strictEqual(match('"@gazelle//:def.bzl"'), "@gazelle//:def.bzl");
    });

    it("matches a root-package label", () => {
      assert.strictEqual(match('"//:target"'), "//:target");
    });
  });

  describe("load() statements with multiple arguments", () => {
    it("matches only the .bzl path, not the following symbol string", () => {
      // Regression test: previously [^:] allowed crossing quote boundaries,
      // capturing '@gazelle//:def.bzl", "gazelle' as the label, which produced
      // a malformed 3-argument kind() query.
      assert.strictEqual(
        match('load("@gazelle//:def.bzl", "gazelle")'),
        "@gazelle//:def.bzl",
      );
    });

    it("matches only the .bzl path with multiple symbols", () => {
      assert.strictEqual(
        match('load("@rules_uv//uv:pip.bzl", "pip_compile", "pip_install")'),
        "@rules_uv//uv:pip.bzl",
      );
    });

    it("matches a local .bzl file load", () => {
      assert.strictEqual(
        match('load("//bazel:k6.bzl", "k6_test")'),
        "//bazel:k6.bzl",
      );
    });
  });

  describe("non-matching inputs", () => {
    it("returns undefined for a string without // or path separator", () => {
      // Plain strings like symbol names don't contain // so no match
      assert.strictEqual(match("not-a-label"), undefined);
    });

    it("returns undefined for an unquoted label", () => {
      assert.strictEqual(match("//pkg:target"), undefined);
    });
  });
});

describe("BazelGotoDefinitionProvider", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("runs its query from the resolved Bazel workspace root", async () => {
    const bazelWorkspacePath = "/workspace/root";
    sandbox.stub(BazelWorkspaceInfo, "fromDocument").returns({
      bazelWorkspacePath,
    } as BazelWorkspaceInfo);
    const queryTargets = sandbox
      .stub(BazelQuery.prototype, "queryTargets")
      .callsFake(async function (this: BazelQuery) {
        assert.strictEqual(this.workingDirectory, bazelWorkspacePath);
        return blaze_query.QueryResult.create({
          target: [
            {
              type: blaze_query.Target.Discriminator.RULE,
              rule: {
                name: "//pkg:target",
                ruleClass: "filegroup",
                location: "/workspace/root/pkg/BUILD:1:1",
              },
            },
          ],
        });
      });
    const range = new vscode.Range(0, 0, 0, 14);
    const document = {
      uri: vscode.Uri.file("/workspace/root/nested/pkg/BUILD"),
      getWordRangeAtPosition: () => range,
      getText: () => '"//pkg:target"',
    } as unknown as vscode.TextDocument;

    const result = await new BazelGotoDefinitionProvider().provideDefinition(
      document,
      new vscode.Position(0, 5),
    );

    assert.strictEqual(queryTargets.callCount, 1);
    assert.ok(Array.isArray(result));
  });
});
