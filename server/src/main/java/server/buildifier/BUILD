load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "buildifier",
    srcs = [
        "Buildifier.java",
        "BuildifierException.java",
        "BuildifierFileType.java",
        "BuildifierFormatArgs.java",
        "BuildifierNotFoundException.java",
        "Executor.java",
        "ExecutorFallback.java",
        "ExecutorInput.java",
        "ExecutorOutput.java",
    ],
    deps = [
        "//server/src/main/java/server/utils:utils",
        "//server/src/main/java/server/workspace:workspace",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
