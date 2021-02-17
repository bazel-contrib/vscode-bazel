load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "interp",
    srcs = [
        "InterpException.java",
        "Label.java",
        "LabelSyntaxException.java",
    ],
    deps = [
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
