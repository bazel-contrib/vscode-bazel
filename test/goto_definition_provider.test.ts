import * as assert from "assert";
import { LABEL_REGEX } from "../src/definition/bazel_goto_definition_provider";

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
