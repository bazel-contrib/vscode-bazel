load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "formatting",
    srcs = [
        "FormattingProviderTest.java",
    ],
    deps = [
        "//server/src/main/java/server/buildifier",
        "//server/src/main/java/server/formatting",
        "//server/src/main/java/server/utils",
        "//third_party/java:junit",
        "//third_party/java:lsp4j",
        "//third_party/java:mockito",
    ],
)