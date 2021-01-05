load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "analysis",
    srcs = [
        "AnalysisException.java",
        "Analyzer.java",
        "BazelBuildFile.java",
        "BazelFile.java",
        "BazelWorkspaceFile.java",
        "Utilities.java",
    ],
    deps = [
        "//server/src/main/java/server/starlark:starlark",
        "//server/src/main/java/server/utils:utils",
        "//server/src/main/java/server/workspace:workspace",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
