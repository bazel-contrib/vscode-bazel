load("@protobuf//bazel:proto_library.bzl", "proto_library")

package(default_visibility = ["//visibility:public"])

FILES = [
    "action_cache",
    "bazel_flags",
    "builtin",
    "crash_debugging",
    "crosstool_config",
    "deps",
    "desugar_deps",
    "execution_statistics",
    "extra_actions_base",
    "java_compilation",
    "memory_pressure",
    "strategy_policy",
    "test_status",
    "worker_protocol",
    "execution_graph",
]

[proto_library(
    name = s + "_proto",
    srcs = [s + ".proto"],
) for s in FILES]

proto_library(
    name = "build_proto",
    srcs = ["build.proto"],
    deps = [":stardoc_output_proto"],
)

proto_library(
    name = "analysis_v2_proto",
    srcs = ["analysis_v2.proto"],
    deps = [":build_proto"],
)

proto_library(
    name = "command_server_proto",
    srcs = ["command_server.proto"],
    deps = [
        ":failure_details_proto",
        "@protobuf//:any_proto",
    ],
)

proto_library(
    name = "failure_details_proto",
    srcs = ["failure_details.proto"],
    deps = ["@protobuf//:descriptor_proto"],
)

proto_library(
    name = "invocation_policy_proto",
    srcs = ["invocation_policy.proto"],
    deps = [":strategy_policy_proto"],
)

proto_library(
    name = "option_filters_proto",
    srcs = ["option_filters.proto"],
)

proto_library(
    name = "command_line_proto",
    srcs = ["command_line.proto"],
    deps = [":option_filters_proto"],
)

# Proto needed by singlejar and embedded into the java tools archive.
genrule(
    name = "desugar_deps_zip",
    srcs = ["desugar_deps.proto"],
    outs = ["desugar_deps.zip"],
    cmd = "zip -q $@ $<",
    visibility = ["//src/tools/singlejar:__pkg__"],
)

filegroup(
    name = "desugar_deps_filegroup",
    srcs = ["desugar_deps.proto"],
    visibility = ["//src/tools/singlejar:__pkg__"],
)

proto_library(
    name = "cache_salt_proto",
    srcs = ["cache_salt.proto"],
)

proto_library(
    name = "remote_scrubbing_proto",
    srcs = ["remote_scrubbing.proto"],
)

proto_library(
    name = "bazel_output_service_proto",
    srcs = ["bazel_output_service.proto"],
    deps = [
        "@googleapis//google/rpc:status_proto",
        "@protobuf//:any_proto",
    ],
)

proto_library(
    name = "spawn_proto",
    srcs = ["spawn.proto"],
    deps = [
        "@protobuf//:duration_proto",
        "@protobuf//:timestamp_proto",
    ],
)

# Note that stardoc_output_proto and stardoc_output_java_proto are vendored by
# Stardoc: https://github.com/bazelbuild/stardoc/tree/master/stardoc/proto
package_group(
    name = "stardoc_output_users",
    packages = [
        "//src/main/java/com/google/devtools/build/docgen/...",
        "//src/main/java/com/google/devtools/build/lib/rules/starlarkdocextract/...",
        "//src/main/java/com/google/devtools/build/lib/starlarkdocextract/...",
        "//src/test/java/com/google/devtools/build/docgen/...",
        "//src/test/java/com/google/devtools/build/lib/rules/starlarkdocextract/...",
        "//src/test/java/com/google/devtools/build/lib/starlarkdocextract/...",
    ],
)

proto_library(
    name = "stardoc_output_proto",
    srcs = ["stardoc_output.proto"],
    visibility = [":stardoc_output_users"],
)

proto_library(
    name = "xcode_proto",
    srcs = ["xcode_config.proto"],
    visibility = ["//visibility:public"],
)

filegroup(
    name = "srcs",
    srcs = glob(
        ["**"],
        exclude = ["android_deploy_info.proto"],
    ),
)
