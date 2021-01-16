load("@rules_java//java:defs.bzl", "java_proto_library")
load("@rules_proto//proto:defs.bzl", "proto_library")

package(default_visibility = ["//visibility:public"])

proto_library(
    name = "example_proto",
    srcs = ["example.proto"],
)

java_proto_library(
    name = "example_java_proto",
    deps = [":example_proto"],
)
