load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "completion",
    srcs = [
        "CompletionProviderTest.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/bazelWorkspaceAPI",
        "//server/src/main/java/server/bazel/tree",
        "//server/src/main/java/server/completion",
        "//server/src/main/java/server/utils",
        "//server/src/main/java/server/workspace",
        "//third_party/java:gson",
        "//third_party/java:guava",
        "//third_party/java:jmifs",
        "//third_party/java:junit",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
        "//third_party/java:mockito",
    ],
)
