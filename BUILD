load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@npm//:defs.bzl", "npm_link_all_packages")
load("@npm//:@vscode/vsce/package_json.bzl", vsce_bin = "bin")
load("@aspect_rules_ts//ts:proto.bzl", "ts_proto_library")

npm_link_all_packages(name = "node_modules")

# ts_proto_library(
#     name = "starlark_debugging_ts_proto",
#     has_services = False,
#     copy_files = False,
#     node_modules = ":node_modules",
#     proto = "@bazel//src/main/java/com/google/devtools/build/lib/starlarkdebug/proto:starlark_debugging_proto",
# )

ts_proto_library(
    name = "build_event_stream_ts_proto",
    has_services = False,
    copy_files = False,
    node_modules = ":node_modules",
    proto = "@bazel//src/main/java/com/google/devtools/build/lib/buildeventstream/proto:build_event_stream_proto",
)

ts_project(
    name = "ts",
    srcs = glob(["src/**/*.ts"]),
    declaration = True,
    out_dir = "out",
    source_map = True,
    transpiler = "tsc",
    deps = [
        # ":build_event_stream_ts_proto",
        "//foo:starlark_debugging_ts_proto",
        "//:node_modules/@types/long",
        "//:node_modules/@types/node",
        "//:node_modules/@types/vscode",
        "//:node_modules/vscode-debugadapter",
        "//:node_modules/vscode-debugprotocol",
        "//:node_modules/vscode-languageclient",
        "//:node_modules/vscode-uri",
        "//:node_modules/which",
    ],
)

filegroup(
    name = "package_srcs",
    srcs = [
        ":ts",
        "package.json",
        ".vscodeignore",
        "LICENSE",
        "README.md",
        "CHANGELOG.md",
    ] + glob([
        "media/**/*",
        "icons/**/*",
        "syntaxes/**/*",
    ]),
)

vsce_bin.vsce(
    name = "package",
    srcs = [":package_srcs"],
    outs = [
        "vscode-bazel-0.8.1.vsix",
    ],
    args = [
        "package",
        "--no-dependencies",
    ],
    chdir = package_name(),
    log_level = "debug",
)
