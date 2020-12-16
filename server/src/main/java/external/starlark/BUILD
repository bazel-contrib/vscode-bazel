load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "syntax_lib",
    srcs = [
        "Syntax.java",
    ],
    deps = [
        "//third_party/java:protobuf",
        "//server/src/main/proto/starlark:syntax_java_proto",
    ],
)
