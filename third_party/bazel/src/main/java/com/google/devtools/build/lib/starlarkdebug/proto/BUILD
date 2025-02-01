load("@protobuf//bazel:proto_library.bzl", "proto_library")

package(default_visibility = ["//src:__subpackages__"])

filegroup(
    name = "srcs",
    srcs = glob(["**"]),
    visibility = ["//src/main/java/com/google/devtools/build/lib:__pkg__"],
)

proto_library(
    name = "starlark_debugging_proto",
    srcs = ["starlark_debugging.proto"],
    visibility = ["//visibility:public"],
)
