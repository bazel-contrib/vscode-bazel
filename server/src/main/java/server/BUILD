load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "server",
    srcs = [
        "BazelLanguageServer.java",
        "BazelServices.java",
    ],
    deps = [
        "//server/src/main/java/server/analysis",
        "//server/src/main/java/server/bazel",
        "//server/src/main/java/server/buildifier",
        "//server/src/main/java/server/completion",
        "//server/src/main/java/server/highlighting",
        "//server/src/main/java/server/starlark",
        "//server/src/main/java/server/utils",
        "//server/src/main/java/server/workspace",
        "//third_party/java:gson",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
    ],
)
