load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

alias(
    name = "bazel_cli",
    actual = "cli",
)

java_library(
    name = "cli",
    srcs = [
        "AbstractBazelCommand.java",
        "Bazel.java",
        "BazelServerException.java",
        "QueryCommand.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/tree",
        "//server/src/main/java/server/dispatcher",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
