load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "bazel",
    srcs = [
        "WorkspaceTree.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/domain",
        "//third_party/java:gson",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
