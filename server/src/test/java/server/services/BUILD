load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "services",
    srcs = [
        "TextDocumentTest.java",
        "WorkspaceTest.java",
    ],
    deps = [
        "//server/src/main/java/server/services:services",
        "//third_party/java:guava",
        "//third_party/java:junit",
        "//third_party/java:lsp4j",
        "//third_party/java:mockito",
    ],
)
