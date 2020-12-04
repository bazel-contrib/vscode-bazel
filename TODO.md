1. Finish up client_vscode to use bazel
2. Pull down jar from bazel ls repo to get starlark parser
3. Update readme to reflect bazel build/run/test changes

<!-- OLD -->

load("@build_bazel_rules_nodejs//:index.bzl", "npm_install")

npm_install(
name = "npm",
package_json = ":package.json",
package_lock_json = ":package-lock.json",
)
