load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "server",
    srcs = [
        "BazelLanguageServer.java",
        "BazelServices.java",
    ],
    deps = [
        "//server/src/main/proto:example_java_proto",
        "//server/src/main/java/server/analysis:analysis",
        "//server/src/main/java/server/buildifier:buildifier",
        "//server/src/main/java/server/completion:completion",
        "//server/src/main/java/server/highlighting:highlighting",
        "//server/src/main/java/server/starlark:starlark",
        "//server/src/main/java/server/utils:utils",
        "//server/src/main/java/server/workspace:workspace",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
    ],
)
