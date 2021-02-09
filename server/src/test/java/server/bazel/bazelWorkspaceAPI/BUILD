load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "bazel_workspace_api",
    srcs = [
        "APITests.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/bazelWorkspaceAPI",
        "//server/src/main/java/server/utils",
        "//server/src/main/java/server/bazel/tree",
        "//third_party/java:guava",
        "//third_party/java:jmifs",
        "//third_party/java:junit",
        "//third_party/java:mockito",
    ],
)
