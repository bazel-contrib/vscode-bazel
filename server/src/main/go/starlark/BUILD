load("@io_bazel_rules_go//go:def.bzl", "go_library")

go_library(
    name = "starlark",
    srcs = glob(["*.go"]),
    importpath = "starlark",
    deps = [
        "//third_party/go:protobuf",
    ],
    visibility = ["//visibility:public"],
)
