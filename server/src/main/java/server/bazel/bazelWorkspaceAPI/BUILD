load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "bazelWorkspaceAPI",
    srcs = [
        "WorkspaceAPI.java",
        "WorkspaceAPIException.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/tree:tree",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
    ],
)
