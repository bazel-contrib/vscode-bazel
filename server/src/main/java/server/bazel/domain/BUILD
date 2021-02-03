load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "domain",
    srcs = [
        "BuildTarget.java",
        "Package.java",
        "SourceFile.java",
    ],
    deps = [
        "//third_party/java:gson",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
