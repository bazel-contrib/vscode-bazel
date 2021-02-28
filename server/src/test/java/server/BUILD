load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "all_tests",
    srcs = [
        "AllServerTests.java",
    ],
    deps = [
        ":server",
        "//server/src/test/java/server/analysis",
        "//server/src/test/java/server/bazel/bazelWorkspaceAPI:bazel_workspace_api",
        "//server/src/test/java/server/bazel/cli:bazel_cli",
        "//server/src/test/java/server/buildifier",
        "//server/src/test/java/server/completion",
        "//third_party/java:junit",
        "//server/src/test/java/server/bazel/cli",
        "//server/src/test/java/server/bazel/interp",
        "//server/src/test/java/server/buildifier",
        "//server/src/test/java/server/formatting",
        "//server/src/test/java/server/utils",
        "//server/src/test/java/server/workspace:bazel_workspace_test",
    ],
)
