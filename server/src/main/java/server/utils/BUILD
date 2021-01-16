load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "utils",
    srcs = [
        "DocumentTracker.java",
        "Observatory.java",
        "Positions.java",
    ],
    deps = [
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
    ],
)
