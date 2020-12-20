load("@rules_java//java:defs.bzl", "java_test")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "all_tests",
    srcs = [
        "AllTests.java",
    ],
    deps = [
        "//server/src/test/java/server/index:index",
        "//server/src/test/java/server/services:services",
        "//server/src/test/java/server/utils:utils",
        "//third_party/java:guava",
        "//third_party/java:junit",
    ],
)
