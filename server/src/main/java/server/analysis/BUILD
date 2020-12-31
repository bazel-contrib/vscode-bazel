load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "analysis",
    srcs = [
        "Analyzer.java",
        "AnalyzerConfig.java",
        "BazelBuildFile.java",
        "BazelWorkspaceFile.java",
        "Utilities.java",
    ],
    deps = [
        "//server/src/main/java/server/utils:utils",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
