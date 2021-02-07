load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "buildifier",
    srcs = [
        "Buildifier.java",
        "BuildifierException.java",
        "BuildifierFileType.java",
        "BuildifierNotFoundException.java",
        "FallbackRunner.java",
        "FormatInput.java",
        "FormatOutput.java",
        "LintFile.java",
        "LintInput.java",
        "LintOutput.java",
        "LintWarning.java",
        "LintWarningPosition.java",
        "Runner.java",
        "RunnerInput.java",
        "RunnerOutput.java",
    ],
    deps = [
        "//server/src/main/java/server/utils:utils",
        "//server/src/main/java/server/workspace:workspace",
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "@maven//:com_google_code_gson_gson",
    ],
)
