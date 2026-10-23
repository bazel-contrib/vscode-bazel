"""Repository declarations for the unpinned-repository warning tests.

Not loaded by any BUILD file; only the extension reads it.
"""

load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file", _http_archive = "http_archive")
load("@bazel_tools//tools/build_defs/repo:utils.bzl", "maybe")

def deps():
    """Declares the repositories, some of them deliberately unpinned."""
    _http_archive(
        name = "pinned_archive",
        integrity = "sha256-AAAA",
        urls = ["https://example.com/pinned.tar.gz"],
    )
    _http_archive(
        name = "unpinned_archive",
        urls = ["https://example.com/unpinned.tar.gz"],
    )
    http_file(
        name = "unpinned_file",
        urls = ["https://example.com/file"],
    )
    git_repository(
        name = "pinned_git",
        commit = "0123456789abcdef0123456789abcdef01234567",
        remote = "https://example.com/repo.git",
    )
    git_repository(
        name = "unpinned_git",
        branch = "main",
        remote = "https://example.com/repo.git",
    )
    maybe(
        _http_archive,
        name = "unpinned_via_maybe",
        urls = ["https://example.com/maybe.tar.gz"],
    )
    maybe(
        git_repository,
        name = "pinned_via_maybe",
        commit = "0123456789abcdef0123456789abcdef01234567",
        remote = "https://example.com/repo.git",
    )

def forwarding(**kwargs):
    """The pin may be among kwargs, so this is not reported."""
    _http_archive(name = "forwarded", **kwargs)
