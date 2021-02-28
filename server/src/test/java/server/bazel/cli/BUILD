load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

alias(
    name = "bazel_cli",
    actual = "cli",
)

java_library(
    name = "cli",
    srcs = [
        "BazelTest.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/cli:bazel_cli",
        "//server/src/main/java/server/utils",
        "//server/src/main/java/server/workspace",
        "//third_party/java:guava",
        "//third_party/java:jmifs",
        "//third_party/java:junit",
        "//third_party/java:mockito",
    ],
)
