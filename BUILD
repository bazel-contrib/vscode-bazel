load("@aspect_rules_ts//ts:defs.bzl", "ts_project")
load("@npm//:defs.bzl", "npm_link_all_packages")
load("@npm//:@vscode/vsce/package_json.bzl", "bin")

npm_link_all_packages(name = "node_modules")

ts_project(
    name = "ts",
    srcs = glob(["src/**/*.ts"]),
    declaration = True,
    out_dir = "out",
    source_map = True,
    transpiler = "tsc",
    deps = [
        "//:node_modules/@types/long",
        "//:node_modules/@types/node",
        "//:node_modules/@types/vscode",
        "//:node_modules/protobufjs",
        "//:node_modules/vscode-debugadapter",
        "//:node_modules/vscode-debugprotocol",
        "//:node_modules/vscode-languageclient",
        "//:node_modules/vscode-uri",
        "//:node_modules/which",
    ],
)

filegroup(
    name = "all_protos",
    srcs = [
        "@build_event_stream_proto//file",
        "@build_proto//file",
        "@command_line_proto//file",
        "@invocation_policy_proto//file",
        "@option_filters_proto//file",
        "@starlark_debugging_proto//file",
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

bin.vsce(
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
