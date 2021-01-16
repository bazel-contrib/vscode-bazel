load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "analysis",
    srcs = [
        "AnalyzerTest.java",
    ],
    deps = [
        "//server/src/main/java/server/analysis:analysis",
        "//third_party/java:guava",
        "//third_party/java:junit",
        "//third_party/java:lsp4j",
        "//third_party/java:mockito",
    ],
)
