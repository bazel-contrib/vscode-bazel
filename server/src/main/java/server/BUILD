load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "server",
    srcs = [
        "BazelLanguageServer.java",
        "BazelServices.java",
    ],
    deps = [
        "//server/src/main/java/server/indexing:indexing",
        "//server/src/main/java/server/utils:utils",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
    ],
)
