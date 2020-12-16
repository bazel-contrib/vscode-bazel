load("@rules_java//java:defs.bzl", "java_proto_library")
load("@io_bazel_rules_go//proto:def.bzl", "go_proto_library")
load("@rules_proto//proto:defs.bzl", "proto_library")

package(default_visibility = ["//visibility:public"])

proto_library(
    name = "syntax_proto",
    srcs = ["syntax.proto"],
)

go_proto_library(
    name = "syntax_go_proto",
    deps = [":syntax_proto"],
)

java_proto_library(
    name = "syntax_java_proto",
    deps = [":syntax_proto"],
)
