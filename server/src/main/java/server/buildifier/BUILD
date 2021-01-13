load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "buildifier",
    srcs = [
        "BuildifierException.java",
        "BuildifierFacade.java",
        "BuildifierFileType.java",
        "BuildifierInput.java",
        "BuildifierNotFoundException.java",
        "BuildifierOutput.java",
        "FormatArgs.java",
    ],
    deps = [
        "//server/src/main/java/server/utils:utils",
        "//server/src/main/java/server/workspace:workspace",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
