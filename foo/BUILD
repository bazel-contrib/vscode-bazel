load("@aspect_rules_ts//ts:proto.bzl", "ts_proto_library")

ts_proto_library(
    name = "starlark_debugging_ts_proto",
    has_services = False,
    copy_files = False,
    node_modules = "//:node_modules",
    proto = "@bazel//src/main/java/com/google/devtools/build/lib/starlarkdebug/proto:starlark_debugging_proto",
)
