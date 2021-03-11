load("@rules_java//java:defs.bzl", "java_library", "java_binary")

java_library(
    name = "interp",
    srcs = glob(["*.java"]),
    deps = [
        "//server/src/main/java/server/bazel/tree",
        "//server/src/main/java/server/utils",
        "//server/src/main/java/server/workspace",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:starlark",
    ],
    visibility = [
        "//server/src/main/java/server/diagnostics:__subpackages__",
        "//server/src/test/java/server/bazel/interp:__subpackages__",
    ]
)