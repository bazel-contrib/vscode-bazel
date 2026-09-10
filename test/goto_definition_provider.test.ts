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

  // Regression test helper for
  // https://github.com/bazel-contrib/vscode-bazel/issues/696: package-relative
  // labels (e.g. srcs = ["client.py"]) must resolve relative to the BUILD
  // file's package, even though the query itself always runs with the
  // resolved Bazel workspace root as its cwd (so that it keeps respecting a
  // pinned `bazel.workspacePath` root, per #687). Stubs `queryTargets`,
  // asserts its cwd is always the workspace root, and returns the stub (to
  // assert on the canonicalized query text) plus a `run` function that
  // invokes `provideDefinition` for a given document/label.
  function stubGotoDefinition(
    bazelWorkspacePath: string,
    documentPath: string,
    labelText: string,
  ) {
    sandbox.stub(BazelWorkspaceInfo, "fromDocument").returns({
      bazelWorkspacePath,
    } as BazelWorkspaceInfo);
    const query = sandbox
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
                location: `${bazelWorkspacePath}/pkg/BUILD:1:1`,
              },
            },
          ],
        });
      });
    const range = new vscode.Range(0, 0, 0, labelText.length);
    const document = {
      uri: vscode.Uri.file(documentPath),
      getWordRangeAtPosition: () => range,
      getText: () => labelText,
    } as unknown as vscode.TextDocument;

    return {
      query,
      run: () =>
        new BazelGotoDefinitionProvider().provideDefinition(
          document,
          new vscode.Position(0, 5),
        ),
    };
  }

  it("queries an absolute label from the resolved workspace root", async () => {
    const bazelWorkspacePath = "/workspace/root";
    const { query, run } = stubGotoDefinition(
      bazelWorkspacePath,
      "/workspace/root/nested/pkg/BUILD",
      '"//pkg:target"',
    );

    const result = await run();

    assert.strictEqual(query.callCount, 1);
    assert.match(query.firstCall.args[0], /"\/\/pkg:target"/);
    assert.ok(Array.isArray(result));
  });

  it("keeps an external repository label unchanged", async () => {
    const bazelWorkspacePath = "/workspace/root";
    const { query, run } = stubGotoDefinition(
      bazelWorkspacePath,
      "/workspace/root/pkg/BUILD",
      '"@repo//pkg:target"',
    );

    await run();

    assert.match(query.firstCall.args[0], /"@repo\/\/pkg:target"/);
  });

  it("canonicalizes a bare package-relative file label", async () => {
    const bazelWorkspacePath = "/workspace/root";
    const { query, run } = stubGotoDefinition(
      bazelWorkspacePath,
      "/workspace/root/pkg/BUILD",
      '"client.py"',
    );

    await run();

    assert.match(query.firstCall.args[0], /"\/\/pkg:client\.py"/);
  });

  it("canonicalizes a package-relative label in a subdirectory", async () => {
    const bazelWorkspacePath = "/workspace/root";
    const { query, run } = stubGotoDefinition(
      bazelWorkspacePath,
      "/workspace/root/pkg/BUILD",
      '"subdir/client.py"',
    );

    await run();

    assert.match(query.firstCall.args[0], /"\/\/pkg:subdir\/client\.py"/);
  });

  it("canonicalizes a colon-only same-package target label", async () => {
    const bazelWorkspacePath = "/workspace/root";
    const { query, run } = stubGotoDefinition(
      bazelWorkspacePath,
      "/workspace/root/pkg/BUILD",
      '":target"',
    );

    await run();

    assert.match(query.firstCall.args[0], /"\/\/pkg:target"/);
  });

  it("canonicalizes a package-relative Starlark file", async () => {
    const bazelWorkspacePath = "/workspace/root";
    const { query, run } = stubGotoDefinition(
      bazelWorkspacePath,
      "/workspace/root/pkg/BUILD",
      '"helpers.bzl"',
    );

    await run();

    assert.match(query.firstCall.args[0], /"\/\/pkg:helpers\.bzl"/);
  });

  it("canonicalizes a relative label at the workspace root", async () => {
    const bazelWorkspacePath = "/workspace/root";
    const { query, run } = stubGotoDefinition(
      bazelWorkspacePath,
      "/workspace/root/BUILD",
      '"client.py"',
    );

    await run();

    assert.match(query.firstCall.args[0], /"\/\/:client\.py"/);
  });
});
