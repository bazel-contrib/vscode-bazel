load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "server",
    srcs = [
        "BazelServicesTest.java",
    ],
    deps = [
        "//server/src/main/java/server",
        "//third_party/java:guava",
        "//third_party/java:junit",
        "//third_party/java:lsp4j",
        "//third_party/java:mockito",
    ],
)

java_library(
    name = "all_tests",
    srcs = [
        "AllServerTests.java",
    ],
    deps = [
        ":server",
        "//server/src/test/java/server/analysis",
        "//server/src/test/java/server/bazel",
        "//server/src/test/java/server/buildifier",
        "//server/src/test/java/server/utils",
        "//third_party/java:junit",
    ],
)
