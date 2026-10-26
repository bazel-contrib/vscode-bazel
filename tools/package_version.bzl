"""Exposes package.json's version to BUILD files.

package.json is the single source of truth for the extension version
(release-please bumps it). This repository rule reads it and writes a
`version.bzl` with `VERSION = "x.y.z"`; Bazel re-runs it when package.json
changes.
"""

def _package_version_impl(rctx):
    package_json = json.decode(rctx.read(rctx.path(rctx.attr.package_json)))
    rctx.file("BUILD.bazel", "")
    rctx.file("version.bzl", "VERSION = %r\n" % package_json["version"])

package_version = repository_rule(
    implementation = _package_version_impl,
    attrs = {
        "package_json": attr.label(
            doc = "The package.json to read the version from.",
            allow_single_file = True,
            mandatory = True,
        ),
    },
)
