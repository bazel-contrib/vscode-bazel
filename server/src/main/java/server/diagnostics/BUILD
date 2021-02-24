load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "diagnostics",
    srcs = [
        "DiagnosticCodes.java",
        "DiagnosticParams.java",
        "DiagnosticsProvider.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/bazelWorkspaceAPI",
        "//server/src/main/java/server/bazel/interp",
        "//server/src/main/java/server/bazel/tree",
        "//server/src/main/java/server/utils",
        "//server/src/main/java/server/workspace",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
        "//third_party/java:starlark",
    ],
)
