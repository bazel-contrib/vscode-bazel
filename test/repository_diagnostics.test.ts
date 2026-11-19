import * as assert from "assert";
import { findUnpinnedRepositories } from "../src/language_support/repository_diagnostics";

describe("findUnpinnedRepositories", () => {
  it("reports unpinned repositories through aliases and maybe()", () => {
    const text = [
      'load("//repo:git.bzl", "git_repository")',
      'load("//repo:http.bzl", _http_archive = "http_archive")',
      'load("//repo:utils.bzl", "maybe")',
      "",
      "def deps():",
      '    _http_archive(name = "ok", sha256 = "abc", urls = [])',
      '    _http_archive(name = "no_checksum", urls = [])',
      '    git_repository(name = "no_commit", tag = "v1", remote = "r")',
      '    git_repository(name = "ok_git", commit = "c", remote = "r")',
      '    maybe(_http_archive, name = "maybe_no_checksum", urls = [])',
      '    maybe(git_repository, name = "maybe_ok", commit = "c")',
      "",
      "def forward(**kwargs):",
      '    _http_archive(name = "forwarded", **kwargs)',
    ].join("\n");
    const findings = findUnpinnedRepositories(text);
    assert.deepStrictEqual(
      findings.map((f) => [f.rule, f.name]),
      [
        ["http_archive", "no_checksum"],
        ["git_repository", "no_commit"],
        ["http_archive", "maybe_no_checksum"],
      ],
    );
    assert.strictEqual(
      findings[0].message,
      'http_archive "no_checksum" is not pinned: add `integrity` ' +
        "(preferred) or `sha256` so downloads are verified.",
    );
    // The squiggle sits on the callee (or on the rule passed to maybe()).
    assert.strictEqual(
      text.slice(findings[0].span.start, findings[0].span.end),
      "_http_archive",
    );
    assert.strictEqual(
      text.slice(findings[2].span.start, findings[2].span.end),
      "_http_archive",
    );
  });

  it("understands MODULE.bazel overrides and use_repo_rule proxies", () => {
    const text = [
      'module(name = "m")',
      'git_override(module_name = "a", remote = "r", branch = "main")',
      'git_override(module_name = "b", remote = "r", commit = "c")',
      'archive_override(module_name = "c", urls = ["u"])',
      'archive_override(module_name = "d", urls = ["u"], integrity = "x")',
      'http_archive = use_repo_rule("//repo:http.bzl", "http_archive")',
      'http_archive(name = "e", urls = ["u"])',
      'http_archive(name = "f", urls = ["u"], sha256 = "s")',
    ].join("\n");
    assert.deepStrictEqual(
      findUnpinnedRepositories(text).map((f) => [f.rule, f.name]),
      [
        ["git_override", "a"],
        ["archive_override", "c"],
        ["http_archive", "e"],
      ],
    );
  });

  it("follows aliases of maybe() and the keyword form of use_repo_rule", () => {
    const text = [
      'load("//repo:http.bzl", "http_archive")',
      'load("//repo:utils.bzl", _maybe = "maybe")',
      "http_file = use_repo_rule(",
      '    rule_name = "http_file",',
      '    extension_bzl_file = "//repo:http.bzl",',
      ")",
      '_maybe(http_archive, name = "a", urls = ["u"])',
      'http_file(name = "b", urls = ["u"])',
    ].join("\n");
    assert.deepStrictEqual(
      findUnpinnedRepositories(text).map((f) => [f.rule, f.name]),
      [
        ["http_archive", "a"],
        ["http_file", "b"],
      ],
    );
  });

  it("trusts wrappers defined in the same file", () => {
    const text = [
      'load("//repo:http.bzl", _http_archive = "http_archive")',
      "",
      "def http_archive(**kwargs):",
      '    _http_archive(sha256 = "s", **kwargs)',
      "",
      'http_archive(name = "wrapped", urls = ["u"])',
    ].join("\n");
    assert.deepStrictEqual(findUnpinnedRepositories(text), []);
  });

  it("ignores unrelated calls and unparseable input", () => {
    assert.deepStrictEqual(
      findUnpinnedRepositories('cc_library(name = "x")'),
      [],
    );
    assert.deepStrictEqual(
      findUnpinnedRepositories("http_archive(name = "),
      [],
    );
  });
});
