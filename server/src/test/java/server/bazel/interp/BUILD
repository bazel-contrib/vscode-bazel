load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "interp",
    srcs = [
        "LabelTest.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/interp",
        "//third_party/java:guava",
        "//third_party/java:junit",
        "//third_party/java:mockito",
    ],
)
