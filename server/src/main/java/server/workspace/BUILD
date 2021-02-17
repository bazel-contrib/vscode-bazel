load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "workspace",
    srcs = [
        "ExtensionConfig.java",
        "ProjectFolder.java",
        "Workspace.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/bazelWorkspaceAPI",
        "//server/src/main/java/server/bazel/cli",
        "//server/src/main/java/server/bazel/tree",
        "//server/src/main/java/server/utils",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
    ],
)
