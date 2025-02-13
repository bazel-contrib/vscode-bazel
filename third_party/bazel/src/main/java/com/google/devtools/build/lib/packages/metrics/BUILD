load("@protobuf//bazel:proto_library.bzl", "proto_library")

package(default_visibility = ["//visibility:public"])

filegroup(
    name = "srcs",
    srcs = glob(["*"]),
    visibility = ["//src:__subpackages__"],
)

proto_library(
    name = "package_metrics_proto",
    srcs = ["package_metrics.proto"],
    deps = [
        "@protobuf//:duration_proto",
    ],
)

proto_library(
    name = "package_load_metrics_proto",
    srcs = ["package_load_metrics.proto"],
    deps = [
        "@protobuf//:duration_proto",
    ],
)
